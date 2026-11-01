import { commit, getMode, getState, leaveLive, loadRemote, loadState, pull, resetState, setLocal } from './store';
import { auth, docs, getSession, remoteEnabled } from './remote';
import { DEPTS_PUBLIC } from './seed';
import { ApiError } from './errors';
import type { Category, DB, OrderStatus, Product, PulseQuestion, Role, Settings, SignalStatus, User } from './types';
import { cartDetailed, employeeMonthReceived, isUnlocked, pickPrize, spinsThisMonth, managerQuarter, PET_LEVELS, poolRaised, productLevel, teamOf, userById } from './selectors';
import { uid } from '../lib/utils';

/**
 * Единый слой работы с данными. Интерфейс асинхронный, как у настоящего API:
 * для перехода на бэкенд достаточно заменить тела функций на HTTP-запросы.
 */
export { ApiError };

const LATENCY = 280;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** В демо имитирует задержку сети, в живом режиме подтягивает свежие данные перед изменением. */
const wait = async (ms = LATENCY) => { if (getMode() === 'live') { try { await pull(); } catch { /* сохраним и без свежих данных */ } } else await sleep(ms); };
const fail = (m: string): never => { throw new ApiError(m); };

function requireUser(db: DB, id = db.sessionUserId) {
  const u = id ? userById(db, id) : undefined;
  if (!u) fail('Сессия истекла. Войдите заново');
  return u!;
}
const notify = (db: DB, userId: string, text: string, link?: string) =>
  db.notifications.push({ id: uid('nt'), userId, ts: Date.now(), text, read: false, link });
const touch = (db: DB, userId: string) => { const u = db.users.find((x) => x.id === userId); if (u) u.lastActiveAt = Date.now(); };
/** Учёт дефицита (C3): открывает период «нет в наличии», когда остаток стал нулевым, и закрывает при пополнении. */
function trackStock(p: Product, ts = Date.now()) {
  const open = p.stockouts?.find((x) => !x.to);
  if (p.stock <= 0 && !open) (p.stockouts ??= []).push({ from: ts });
  if (p.stock > 0 && open) open.to = ts;
}
const isPositiveInt = (n: number) => Number.isFinite(n) && n > 0 && Math.floor(n) === n;

let recoveryPending = false;
let authNotice: string | null = null;

/** Переход в живой режим: загрузка общей базы и привязка профиля к аккаунту. */
async function enterLive() {
  const session = await getSession();
  if (!session) fail('Сессия истекла. Войдите заново');
  await loadRemote();
  const db = getState();
  let u = db.users.find((x) => (x as User & { authId?: string }).authId === session!.user.id);
  if (!u) {
    const meta = (session!.user.user_metadata ?? {}) as Record<string, string>;
    const deptId = db.departments.some((d) => d.id === meta.deptId) ? meta.deptId : db.departments[0]?.id ?? 'retail';
    const id = 'u_' + session!.user.id.replace(/-/g, '').slice(0, 12);
    const newUser: User & { authId: string } = {
      id, authId: session!.user.id, name: (meta.name || session!.user.email.split('@')[0]).trim(), email: session!.user.email.toLowerCase(), password: '',
      title: meta.title || 'Сотрудник', deptId, role: 'employee', coins: 0, rucoins: 0, color: ['#9E6FC3', '#1F1F24', '#6F3FA0', '#6E9E00', '#3A3A42'][Math.floor(Math.random() * 5)],
      joinedAt: Date.now(), lastActiveAt: Date.now(), pet: { name: 'ОТуПик', xp: 0, fedAt: Date.now() },
    };
    await commit((d) => {
      d.users.push(newUser);
      notify(d, id, 'Добро пожаловать в ОТП Манию! Загляните к питомцу и в магазин', '/cabinet');
      const m = d.departments.find((x) => x.id === deptId)?.managerId;
      if (m) notify(d, m, `В вашу команду добавлен новый сотрудник: ${newUser.name}`, '/manager/kpi');
    });
    u = newUser;
  }
  setLocal((d) => { d.sessionUserId = u!.id; });
  return u!;
}

export const api = {
  remoteEnabled,
  mode: getMode,
  async init() {
    if (remoteEnabled) {
      try {
        const link = await auth.fromUrlHash();
        if (link?.type === 'recovery') recoveryPending = true;
        if (link?.type === 'signup' || link?.type === 'magiclink') authNotice = 'Почта подтверждена. Добро пожаловать!';
      } catch (e) { authNotice = (e as Error).message; }
      if (await getSession()) {
        try { await enterLive(); return getState(); } catch (e) { authNotice = (e as Error).message; await auth.signOut(); leaveLive(); }
      }
    }
    await sleep(350);
    return loadState();
  },
  /** Сообщение после перехода по ссылке из письма (показывается один раз). */
  takeNotice() { const n = authNotice; authNotice = null; return n; },
  takeRecovery() { const r = recoveryPending; recoveryPending = false; return r; },
  async departmentsForSignup() {
    if (!remoteEnabled) return DEPTS_PUBLIC;
    try {
      const rows = await docs.departments();
      return rows.length ? rows.map((r) => r.data as { id: string; name: string }) : DEPTS_PUBLIC;
    } catch { return DEPTS_PUBLIC; }
  },

  /* ---------- Авторизация ---------- */
  async login(email: string, password: string) {
    const e = email.trim().toLowerCase();
    if (!e || !password) fail('Введите почту и пароль');
    if (remoteEnabled && !e.endsWith('@mania.demo')) {
      await auth.signIn(e, password);
      return enterLive();
    }
    if (getMode() !== 'demo') loadState();
    await wait();
    const u = getState().users.find((x) => x.email === e);
    if (!u || u.password !== password) fail(remoteEnabled ? 'Неверная почта или пароль' : 'Неверная почта или пароль. Регистрация заработает после подключения базы');
    await commit((db) => { db.sessionUserId = u!.id; touch(db, u!.id); });
    return u!;
  },
  async register(input: { name: string; email: string; password: string; deptId: string; title: string }) {
    if (!remoteEnabled) fail('Регистрация заработает после подключения базы данных. Пока войдите через демо');
    const name = input.name.trim(), email = input.email.trim().toLowerCase(), title = input.title.trim();
    if (name.split(/\s+/).length < 2) fail('Укажите имя и фамилию');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Проверьте адрес почты');
    if (email.endsWith('@mania.demo')) fail('Этот домен зарезервирован для демо-аккаунтов');
    if (input.password.length < 8) fail('Пароль: минимум 8 символов');
    if (!input.deptId) fail('Выберите подразделение');
    if (title.length < 2) fail('Укажите должность');
    const r = await auth.signUp(email, input.password, { name, deptId: input.deptId, title });
    if (r.confirmed) { await enterLive(); return { needsConfirm: false }; }
    return { needsConfirm: true };
  },
  async recover(email: string) {
    if (!remoteEnabled) fail('Восстановление пароля заработает после подключения базы');
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) fail('Проверьте адрес почты');
    await auth.recover(e);
  },
  async setNewPassword(password: string) {
    if (password.length < 8) fail('Пароль: минимум 8 символов');
    await auth.updatePassword(password);
  },
  async logout() {
    if (getMode() === 'live') {
      await auth.signOut();
      leaveLive();
      loadState();
      setLocal((d) => { d.sessionUserId = null; });
      return;
    }
    await commit((db) => { db.sessionUserId = null; });
  },
  /** Демо-переключение роли: входит под демо-пользователем с этой ролью. */
  async switchRole(role: Role) {
    if (getMode() === 'live') fail('В рабочем режиме роль назначает администратор');
    await wait(200);
    const db = getState();
    const map = { employee: 'a.smirnov@mania.demo', manager: 'i.belova@mania.demo', admin: 's.yusupova@mania.demo' };
    const u = db.users.find((x) => x.email === map[role]) ?? db.users.find((x) => x.role === role);
    if (!u) fail('Нет пользователя с такой ролью');
    await commit((d) => { d.sessionUserId = u!.id; });
    return u!;
  },
  async resetDemo() {
    if (getMode() === 'live') fail('Сброс доступен только в демо-режиме');
    await wait(300);
    resetState();
  },

  /* ---------- Конвертация ---------- */
  async convert(rucoins: number) {
    await wait();
    const db = getState();
    const u = requireUser(db);
    if (!isPositiveInt(rucoins)) fail('Введите целое количество РуКоинов больше нуля');
    if (rucoins > u.rucoins) fail(`Недостаточно РуКоинов: доступно ${u.rucoins.toLocaleString('ru-RU')}`);
    const rate = db.settings.conversionRate;
    const coins = Math.floor(rucoins * rate);
    await commit((d) => {
      const x = requireUser(d);
      const id = uid('cv');
      x.rucoins -= rucoins; x.coins += coins;
      d.conversions.push({ id, ts: Date.now(), userId: x.id, rucoins, coins, rate });
      d.txs.push({ id: uid('tx'), ts: Date.now(), userId: x.id, kind: 'conversion_out', currency: 'rucoins', amount: -rucoins, title: 'Конвертация в коины', refId: id });
      d.txs.push({ id: uid('tx'), ts: Date.now(), userId: x.id, kind: 'conversion_in', currency: 'coins', amount: coins, title: 'Конвертация из РуКоинов', refId: id });
      touch(d, x.id);
    });
    return coins;
  },

  /* ---------- Благодарности ---------- */
  async sendThanks(toId: string, categoryId: string, message: string) {
    await wait();
    const db = getState();
    const u = requireUser(db);
    const to = userById(db, toId);
    if (!to) fail('Выберите коллегу');
    if (to!.id === u.id) fail('Нельзя поблагодарить самого себя');
    if (!db.settings.thanksCategories.some((c) => c.id === categoryId)) fail('Выберите категорию');
    const msg = message.trim();
    if (msg.length < 10) fail('Напишите сообщение хотя бы из 10 символов');
    if (msg.length > 500) fail('Сообщение длиннее 500 символов');
    await commit((d) => {
      d.thanks.push({ id: uid('th'), ts: Date.now(), fromId: u.id, toId: to!.id, categoryId, message: msg });
      notify(d, to!.id, `${u.name} поблагодарил(а) вас: «${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}»`, '/cabinet/thanks');
      touch(d, u.id);
    });
  },

  /* ---------- Корзина и заказы ---------- */
  async addToCart(productId: string, qty = 1) {
    const db = getState();
    const u = requireUser(db);
    const p = db.products.find((x) => x.id === productId);
    if (!p || !p.active) fail('Товар недоступен');
    if (p!.currency === 'rucoins') fail('Эта награда за РуКоины: нажмите «Получить за РуКоины»');
    if (!isUnlocked(p!, u.pet.xp)) fail(`«${p!.name}» откроется на ${productLevel(p!)} уровне питомца (${PET_LEVELS[productLevel(p!) - 1].title})`);
    const cur = (db.carts[u.id] ?? []).find((l) => l.productId === productId)?.qty ?? 0;
    if (cur + qty > p!.stock) fail(`На складе осталось ${p!.stock} шт.`);
    await commit((d) => {
      const lines = d.carts[u.id] ?? (d.carts[u.id] = []);
      const l = lines.find((x) => x.productId === productId);
      if (l) l.qty += qty; else lines.push({ productId, qty });
    });
  },
  async setCartQty(productId: string, qty: number) {
    const db = getState();
    const u = requireUser(db);
    const p = db.products.find((x) => x.id === productId);
    if (p && qty > p.stock) fail(`На складе осталось ${p.stock} шт.`);
    await commit((d) => {
      const lines = d.carts[u.id] ?? [];
      d.carts[u.id] = qty <= 0 ? lines.filter((l) => l.productId !== productId) : lines.map((l) => (l.productId === productId ? { ...l, qty } : l));
    });
  },
  async checkout() {
    await wait(500);
    const db = getState();
    const u = requireUser(db);
    const cart = cartDetailed(db, u.id);
    if (!cart.lines.length) fail('Корзина пуста');
    for (const l of cart.lines) {
      if (l.product.currency === 'rucoins') fail(`«${l.product.name}» получают за РуКоины. Уберите её из корзины`);
      if (!l.product.active) fail(`«${l.product.name}» больше не продаётся. Уберите его из корзины`);
      if (l.qty > l.product.stock) fail(`«${l.product.name}»: на складе ${l.product.stock} шт.`);
      if (!isUnlocked(l.product, u.pet.xp)) fail(`«${l.product.name}» откроется на ${productLevel(l.product)} уровне питомца`);
    }
    if (cart.total > u.coins) fail(`Недостаточно коинов: нужно ${cart.total.toLocaleString('ru-RU')}, на балансе ${u.coins.toLocaleString('ru-RU')}`);
    const orderId = uid('or');
    await commit((d) => {
      const x = requireUser(d);
      x.coins -= cart.total;
      for (const l of cart.lines) { const p = d.products.find((y) => y.id === l.productId)!; p.stock -= l.qty; trackStock(p); }
      d.orders.push({ id: orderId, ts: Date.now(), userId: x.id, total: cart.total, status: 'new', items: cart.lines.map((l) => ({ productId: l.productId, name: l.product.name, qty: l.qty, price: l.product.price, costRub: l.product.costRub })) });
      d.txs.push({ id: uid('tx'), ts: Date.now(), userId: x.id, kind: 'order', currency: 'coins', amount: -cart.total, title: `Заказ из ${cart.count} поз.`, refId: orderId });
      d.carts[x.id] = [];
      notify(d, x.id, `Заказ оформлен: ${cart.total.toLocaleString('ru-RU')} коинов. Статус можно отслеживать в разделе «Заказы»`, '/cabinet/orders');
      touch(d, x.id);
    });
    return orderId;
  },
  /** Нематериальная награда за РуКоины: списывает РуКоины, создаёт заказ, руководитель получает уведомление для согласования. */
  async redeemPerk(productId: string) {
    await wait(400);
    const db = getState();
    const u = requireUser(db);
    const p = db.products.find((x) => x.id === productId);
    if (!p || !p.active || p.currency !== 'rucoins') fail('Награда недоступна');
    if (p!.stock < 1) fail('Места на этот квартал закончились');
    if (u.rucoins < p!.price) fail(`Недостаточно РуКоинов: нужно ${p!.price.toLocaleString('ru-RU')}, на балансе ${u.rucoins.toLocaleString('ru-RU')}`);
    const orderId = uid('or');
    await commit((d) => {
      const x = requireUser(d);
      const prod = d.products.find((y) => y.id === productId)!;
      x.rucoins -= prod.price; prod.stock -= 1; trackStock(prod);
      d.orders.push({ id: orderId, ts: Date.now(), userId: x.id, total: prod.price, status: 'new', currency: 'rucoins', items: [{ productId: prod.id, name: prod.name, qty: 1, price: prod.price, costRub: prod.costRub }] });
      d.txs.push({ id: uid('tx'), ts: Date.now(), userId: x.id, kind: 'order', currency: 'rucoins', amount: -prod.price, title: `Награда: ${prod.name}`, refId: orderId });
      notify(d, x.id, `Вы получили «${prod.name}» за ${prod.price.toLocaleString('ru-RU')} РуКоинов. Согласуйте дату с руководителем`, '/cabinet/orders');
      const mgr = d.departments.find((dep) => dep.id === x.deptId)?.managerId;
      if (mgr && mgr !== x.id) notify(d, mgr, `${x.name} выбрал(а) награду «${prod.name}». Согласуйте дату`, '/cabinet/orders');
      touch(d, x.id);
    });
    return orderId;
  },
  /** Ответ на пульс-опрос: «признание было про мой вклад» или желанность награды. */
  async answerPulse(q: PulseQuestion, refId: string, score: number) {
    await wait(200);
    if (!(score >= 1 && score <= 5 && Math.floor(score) === score)) fail('Оценка от 1 до 5');
    await commit((d) => {
      const u = requireUser(d);
      if (q === 'contribution' && !d.accruals.some((a) => a.id === refId && a.employeeId === u.id)) fail('Начисление не найдено');
      if (q === 'desire' && !d.orders.some((o) => o.id === refId && o.userId === u.id)) fail('Заказ не найден');
      if (d.pulses.some((p) => p.userId === u.id && p.refId === refId && p.q === q)) fail('Вы уже ответили на этот вопрос');
      d.pulses.push({ id: uid('pl'), ts: Date.now(), userId: u.id, q, score, refId });
      touch(d, u.id);
    });
  },
  async rateOrder(orderId: string, csi: number) {
    await wait(200);
    if (!(csi >= 1 && csi <= 5)) fail('Оценка от 1 до 5');
    await commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o || o.userId !== d.sessionUserId) fail('Заказ не найден');
      if (o!.status !== 'delivered') fail('Оценить можно только выданный заказ');
      o!.csi = csi;
    });
  },

  /* ---------- Сборы ---------- */
  async contribute(poolId: string, amount: number) {
    await wait();
    const db = getState();
    const u = requireUser(db);
    const p = db.pools.find((x) => x.id === poolId);
    if (!p || p.status !== 'active') fail('Сбор уже закрыт');
    if (p!.scope !== 'all' && p!.scope !== u.deptId && p!.organizerId !== u.id) fail('Этот сбор для другого подразделения');
    if (!isPositiveInt(amount)) fail('Введите целую сумму больше нуля');
    if (amount < 100) fail('Минимальный вклад 100 коинов');
    if (amount > u.coins) fail(`Недостаточно коинов: на балансе ${u.coins.toLocaleString('ru-RU')}`);
    const left = p!.target - poolRaised(p!);
    if (amount > left) fail(`До цели осталось ${left.toLocaleString('ru-RU')} коинов`);
    await commit((d) => {
      const x = requireUser(d);
      const pool = d.pools.find((y) => y.id === poolId)!;
      x.coins -= amount;
      pool.contributions.push({ userId: x.id, amount, ts: Date.now() });
      d.txs.push({ id: uid('tx'), ts: Date.now(), userId: x.id, kind: 'pool', currency: 'coins', amount: -amount, title: `Сбор: ${pool.title}`, refId: pool.id });
      if (poolRaised(pool) >= pool.target) {
        pool.status = 'completed';
        new Set(pool.contributions.map((c) => c.userId)).forEach((id) => notify(d, id, `Сбор «${pool.title}» собран полностью`, '/cabinet/pools'));
        notify(d, pool.organizerId, `Сбор «${pool.title}» достиг цели`, '/manager/pools');
      }
      touch(d, x.id);
    });
  },
  async createPool(input: { title: string; description: string; goal: string; target: number; deadline: number; scope: string; image: string; kind?: 'team' | 'charity' }) {
    await wait();
    const db = getState();
    const u = requireUser(db);
    if (u.role !== 'manager' && u.role !== 'admin') fail('Создавать сборы могут руководители');
    if (input.title.trim().length < 4) fail('Название: минимум 4 символа');
    if (input.description.trim().length < 10) fail('Описание: минимум 10 символов');
    if (input.goal.trim().length < 4) fail('Укажите цель сбора');
    if (!isPositiveInt(input.target) || input.target < 1000) fail('Сумма: целое число от 1 000 коинов');
    if (input.target > 1_000_000) fail('Сумма не больше 1 000 000 коинов');
    if (!(input.deadline > Date.now())) fail('Срок окончания должен быть в будущем');
    if (u.role === 'manager' && input.scope !== u.deptId && input.scope !== 'all') fail('Руководитель создаёт сборы для своего подразделения или для всех');
    const id = uid('pool');
    await commit((d) => {
      d.pools.push({ id, title: input.title.trim(), description: input.description.trim(), goal: input.goal.trim(), target: input.target, deadline: input.deadline, scope: input.scope, organizerId: u.id, image: input.image, contributions: [], status: 'active', createdAt: Date.now(), kind: input.kind ?? 'team' });
      d.users.filter((x) => x.id !== u.id && (input.scope === 'all' || x.deptId === input.scope)).forEach((x) => notify(d, x.id, `Новый сбор: «${input.title.trim()}»`, '/cabinet/pools'));
    });
    return id;
  },
  async closePool(poolId: string, mode: 'complete' | 'cancel') {
    await wait();
    const db = getState();
    const u = requireUser(db);
    const p = db.pools.find((x) => x.id === poolId);
    if (!p || p.status !== 'active') fail('Сбор уже закрыт');
    if (p!.organizerId !== u.id && u.role !== 'admin') fail('Закрыть сбор может организатор или администратор');
    await commit((d) => {
      const pool = d.pools.find((x) => x.id === poolId)!;
      if (mode === 'complete') {
        pool.status = 'completed';
        new Set(pool.contributions.map((c) => c.userId)).forEach((id) => notify(d, id, `Сбор «${pool.title}» завершён, идея уходит в работу`, '/cabinet/pools'));
      } else {
        pool.status = 'cancelled';
        const per = new Map<string, number>();
        pool.contributions.forEach((c) => per.set(c.userId, (per.get(c.userId) ?? 0) + c.amount));
        per.forEach((amt, id) => {
          const x = d.users.find((y) => y.id === id);
          if (!x) return;
          x.coins += amt;
          d.txs.push({ id: uid('tx'), ts: Date.now(), userId: id, kind: 'refund', currency: 'coins', amount: amt, title: `Возврат: сбор «${pool.title}» отменён`, refId: pool.id });
          notify(d, id, `Сбор «${pool.title}» отменён, ${amt.toLocaleString('ru-RU')} коинов вернулись на баланс`, '/cabinet');
        });
      }
    });
  },

  /* ---------- Начисление РуКоинов ---------- */
  async accrue(employeeIds: string[], categoryId: string, amount: number, comment: string) {
    await wait(450);
    const db = getState();
    const m = requireUser(db);
    if (m.role !== 'manager') fail('Начислять РуКоины может только руководитель');
    const s = db.settings;
    if (!employeeIds.length) fail('Выберите хотя бы одного сотрудника');
    const team = new Set(teamOf(db, m.id).map((u) => u.id));
    if (employeeIds.some((id) => !team.has(id))) fail('Можно начислять только сотрудникам своего подразделения');
    const cat = s.accrualCategories.find((c) => c.id === categoryId);
    if (!cat) fail('Выберите основание начисления');
    if (!isPositiveInt(amount)) fail('Введите целое количество РуКоинов');
    if (amount > s.maxPerAccrual) fail(`Максимум за одно начисление: ${s.maxPerAccrual.toLocaleString('ru-RU')}`);
    const c = comment.trim();
    if (c.length < s.minCommentLength) fail(`Опишите вклад подробнее: минимум ${s.minCommentLength} символов`);
    if (/^(за работу|молодец|спасибо)[.!]?$/i.test(c)) fail('Комментарий слишком общий. Напишите, что именно сделал сотрудник');
    const q = managerQuarter(db, m.id);
    const total = amount * employeeIds.length;
    if (total > q.left) fail(`В квартальном фонде осталось ${q.left.toLocaleString('ru-RU')}, а нужно ${total.toLocaleString('ru-RU')}`);
    for (const id of employeeIds) {
      const got = employeeMonthReceived(db, id);
      if (got + amount > s.maxPerEmployeeMonth) fail(`${userById(db, id)!.name}: превышен месячный лимит ${s.maxPerEmployeeMonth.toLocaleString('ru-RU')} (уже получено ${got.toLocaleString('ru-RU')})`);
    }
    await commit((d) => {
      for (const id of employeeIds) {
        const e = d.users.find((x) => x.id === id)!;
        const aid = uid('ac');
        e.rucoins += amount;
        d.accruals.push({ id: aid, ts: Date.now(), managerId: m.id, employeeId: id, amount, categoryId, comment: c });
        d.txs.push({ id: uid('tx'), ts: Date.now(), userId: id, kind: 'accrual', currency: 'rucoins', amount, title: `${cat!.name}: ${m.name}`, refId: aid });
        notify(d, id, `${m.name} начислил(а) вам ${amount.toLocaleString('ru-RU')} РуКоинов: ${cat!.name}`, '/cabinet');
      }
      touch(d, m.id);
    });
    return total;
  },

  /* ---------- Питомец ---------- */
  async feedPet(cost: number, xp: number, label: string) {
    await wait(200);
    const db = getState();
    const u = requireUser(db);
    if (u.coins < cost) fail(`Недостаточно коинов: нужно ${cost.toLocaleString('ru-RU')}`);
    await commit((d) => {
      const x = requireUser(d);
      x.coins -= cost; x.pet.xp += xp; x.pet.fedAt = Date.now();
      d.txs.push({ id: uid('tx'), ts: Date.now(), userId: x.id, kind: 'pet', currency: 'coins', amount: -cost, title: `Питомец: ${label}` });
      touch(d, x.id);
    });
  },
  async renamePet(name: string) {
    await wait(150);
    const n = name.trim();
    if (n.length < 2 || n.length > 20) fail('Имя от 2 до 20 символов');
    await commit((d) => { requireUser(d).pet.name = n; });
  },

  /* ---------- Колесо удачи ---------- */
  async spin() {
    await wait(200);
    const db = getState();
    const u = requireUser(db);
    const s = db.settings;
    const used = spinsThisMonth(db, u.id);
    if (used >= s.spinLimit) fail(`Лимит ${s.spinLimit} прокруток в месяц исчерпан. Новые будут с 1 числа`);
    if (u.coins < s.spinPrice) fail(`Недостаточно коинов: прокрутка стоит ${s.spinPrice.toLocaleString('ru-RU')}`);
    const prize = pickPrize(s.wheelPrizes, Math.random());
    await commit((d) => {
      const x = requireUser(d);
      const now = Date.now();
      x.coins -= s.spinPrice;
      d.txs.push({ id: uid('tx'), ts: now, userId: x.id, kind: 'wheel', currency: 'coins', amount: -s.spinPrice, title: `Колесо удачи: ${prize.name}` });
      if (prize.coins) {
        x.coins += prize.coins;
        d.txs.push({ id: uid('tx'), ts: now, userId: x.id, kind: 'refund', currency: 'coins', amount: prize.coins, title: 'Выигрыш в колесе удачи' });
      } else {
        d.orders.push({ id: uid('or'), ts: now, userId: x.id, items: [{ productId: prize.id, name: prize.name, qty: 1, price: 0, costRub: prize.costRub }], total: 0, status: prize.digital ? 'delivered' : 'new', wheel: true });
        notify(d, x.id, `Выигрыш в колесе удачи: ${prize.name}. ${prize.digital ? 'Приз уже начислен' : 'Заберите его в офисе, статус в «Моих заказах»'}`, '/cabinet/orders');
      }
      touch(d, x.id);
    });
    return prize;
  },

  /* ---------- Мероприятия, уведомления ---------- */
  async toggleEvent(eventId: string) {
    await wait(200);
    const db = getState();
    const u = requireUser(db);
    const ev = db.events.find((e) => e.id === eventId);
    if (!ev) fail('Мероприятие не найдено');
    const going = ev!.attendees.includes(u.id);
    if (!going && ev!.attendees.length >= ev!.capacity) fail('Мест больше нет');
    await commit((d) => {
      const e = d.events.find((x) => x.id === eventId)!;
      e.attendees = going ? e.attendees.filter((x) => x !== u.id) : [...e.attendees, u.id];
    });
    return !going;
  },
  async markNotificationsRead() {
    const db = getState();
    const u = requireUser(db);
    if (!db.notifications.some((n) => n.userId === u.id && !n.read)) return;
    await commit((d) => d.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; }));
  },
  async updateProfile(patch: { avatar?: string }) {
    await wait(200);
    await commit((d) => { const x = requireUser(d); if (patch.avatar !== undefined) x.avatar = patch.avatar; });
  },

  /* ---------- Администрирование ---------- */
  async setSignalStatus(id: string, status: SignalStatus) {
    await wait(200);
    requireAdmin();
    await commit((d) => { d.signalStatus[id] = status; });
  },
  async setUserRole(userId: string, role: Role) {
    await wait(250);
    const admin = requireAdmin();
    if (userId === admin.id && role !== 'admin') fail('Нельзя снять роль администратора с себя');
    await commit((d) => {
      const u = d.users.find((x) => x.id === userId)!;
      u.role = role;
      const dept = d.departments.find((x) => x.id === u.deptId)!;
      if (role === 'manager') {
        const prev = dept.managerId && dept.managerId !== u.id ? d.users.find((x) => x.id === dept.managerId) : null;
        if (prev && prev.role === 'manager') prev.role = 'employee';
        dept.managerId = u.id;
        if (!d.settings.managerFunds[u.id]) d.settings.managerFunds[u.id] = d.settings.quarterFundDefault;
      } else if (dept.managerId === u.id) dept.managerId = null;
      notify(d, u.id, `Ваша роль изменена: ${role === 'manager' ? 'руководитель' : role === 'admin' ? 'администратор' : 'сотрудник'}`);
    });
  },
  async setUserDept(userId: string, deptId: string) {
    await wait(250);
    requireAdmin();
    const db = getState();
    const u = userById(db, userId)!;
    if (u.role === 'manager') fail('Руководителя нельзя перевести: сначала назначьте ему роль сотрудника');
    await commit((d) => { d.users.find((x) => x.id === userId)!.deptId = deptId; });
  },
  async saveDepartment(input: { id?: string; name: string; city: string }) {
    await wait(250);
    requireAdmin();
    if (input.name.trim().length < 3) fail('Название подразделения: минимум 3 символа');
    await commit((d) => {
      if (input.id) { const x = d.departments.find((y) => y.id === input.id)!; x.name = input.name.trim(); x.city = input.city.trim(); }
      else d.departments.push({ id: uid('dep'), name: input.name.trim(), city: input.city.trim() || '—', managerId: null });
    });
  },
  async updateSettings(patch: Partial<Settings>) {
    await wait(300);
    requireAdmin();
    const s = { ...getState().settings, ...patch };
    if (!(s.conversionRate > 0 && s.conversionRate <= 100)) fail('Курс конвертации: от 0,01 до 100');
    if (!(s.coinCostRub > 0)) fail('Стоимость коина должна быть больше нуля');
    if (!(s.budgetRub > 0)) fail('Укажите бюджет программы');
    if (!isPositiveInt(s.maxPerAccrual)) fail('Лимит на начисление: целое число');
    if (!isPositiveInt(s.maxPerEmployeeMonth)) fail('Лимит на сотрудника: целое число');
    if (s.maxPerAccrual > s.maxPerEmployeeMonth) fail('Лимит одного начисления не может быть больше месячного лимита');
    if (!isPositiveInt(s.spinPrice)) fail('Цена прокрутки: целое число коинов');
    if (!(s.spinLimit >= 0) || Math.floor(s.spinLimit) !== s.spinLimit) fail('Лимит прокруток: целое число от нуля');
    const probSum = s.wheelPrizes.reduce((a, p) => a + p.prob, 0);
    if (s.wheelPrizes.some((p) => !(p.prob >= 0))) fail('Вероятности призов не могут быть отрицательными');
    if (Math.abs(probSum - 100) > 0.01) fail(`Сумма вероятностей призов должна быть 100%, сейчас ${probSum.toFixed(1).replace('.', ',')}%`);
    if (!isPositiveInt(s.quarterFundDefault)) fail('Фонд по умолчанию: целое число');
    const t = s.metricTargets;
    if ([t.er, t.coverage, t.mutualMax, t.top1Max, t.formalMax].some((v) => !(v >= 0 && v <= 1))) fail('Цели и пороги в процентах: от 0 до 100');
    if (!(t.csi > 0 && t.csi <= 5)) fail('Цель CSI: от 0 до 5');
    if (!(t.bankBudgetRub > 0)) fail('Укажите бюджет программы в масштабе банка');
    if (Object.values(s.managerFunds).some((v) => !(v >= 0))) fail('Фонды руководителей не могут быть отрицательными');
    if (s.rules.some((r) => !r.trim()) || s.forbidden.some((r) => !r.trim())) fail('Уберите пустые пункты правил');
    await commit((d) => { d.settings = s; });
  },
  async saveCategory(kind: 'accrual' | 'thanks', cat: Category) {
    await wait(200);
    requireAdmin();
    if (cat.name.trim().length < 3) fail('Название категории: минимум 3 символа');
    if (kind === 'accrual' && (!(cat.min! > 0) || !(cat.max! >= cat.min!))) fail('Проверьте диапазон: минимум больше нуля, максимум не меньше минимума');
    await commit((d) => {
      const list = kind === 'accrual' ? d.settings.accrualCategories : d.settings.thanksCategories;
      const i = list.findIndex((c) => c.id === cat.id);
      if (i >= 0) list[i] = { ...cat, name: cat.name.trim() }; else list.push({ ...cat, id: uid('cat'), name: cat.name.trim() });
    });
  },
  async deleteCategory(kind: 'accrual' | 'thanks', id: string) {
    await wait(200);
    requireAdmin();
    const s = getState().settings;
    const list = kind === 'accrual' ? s.accrualCategories : s.thanksCategories;
    if (list.length <= 1) fail('Должна остаться хотя бы одна категория');
    await commit((d) => {
      if (kind === 'accrual') d.settings.accrualCategories = d.settings.accrualCategories.filter((c) => c.id !== id);
      else d.settings.thanksCategories = d.settings.thanksCategories.filter((c) => c.id !== id);
    });
  },
  async saveProduct(p: Product) {
    await wait(250);
    requireAdmin();
    if (p.name.trim().length < 3) fail('Название товара: минимум 3 символа');
    if (!isPositiveInt(p.price)) fail('Цена: целое число коинов больше нуля');
    if (!(p.costRub >= 0)) fail('Себестоимость не может быть отрицательной');
    if (!(p.stock >= 0) || Math.floor(p.stock) !== p.stock) fail('Остаток: целое число от нуля');
    await commit((d) => {
      const i = d.products.findIndex((x) => x.id === p.id);
      const next = { ...p, name: p.name.trim(), stockouts: i >= 0 ? structuredClone(d.products[i].stockouts) : undefined };
      trackStock(next);
      if (i >= 0) d.products[i] = next; else d.products.push({ ...next, id: uid('p') });
    });
  },
  async setOrderStatus(orderId: string, status: OrderStatus) {
    await wait(250);
    requireAdmin();
    const o = getState().orders.find((x) => x.id === orderId);
    if (!o) fail('Заказ не найден');
    if (o!.status === 'cancelled') fail('Отменённый заказ нельзя изменить');
    if (o!.status === 'delivered' && status !== 'delivered') fail('Выданный заказ нельзя вернуть в работу');
    await commit((d) => {
      const x = d.orders.find((y) => y.id === orderId)!;
      x.status = status;
      if (status === 'cancelled') {
        const u = d.users.find((y) => y.id === x.userId)!;
        const ru = x.currency === 'rucoins';
        if (ru) u.rucoins += x.total; else u.coins += x.total;
        x.items.forEach((i) => { const p = d.products.find((y) => y.id === i.productId); if (p) { p.stock += i.qty; trackStock(p); } });
        d.txs.push({ id: uid('tx'), ts: Date.now(), userId: u.id, kind: 'refund', currency: ru ? 'rucoins' : 'coins', amount: x.total, title: 'Возврат за отменённый заказ', refId: x.id });
        notify(d, u.id, `Заказ отменён, ${x.total.toLocaleString('ru-RU')} ${ru ? 'РуКоинов' : 'коинов'} вернулись на баланс`, '/cabinet/orders');
      } else notify(d, x.userId, `Статус заказа: ${status === 'processing' ? 'собирается' : status === 'delivered' ? 'выдан, оцените его' : 'новый'}`, '/cabinet/orders');
    });
  },
};

function requireAdmin(): User {
  const u = requireUser(getState());
  if (u.role !== 'admin') fail('Действие доступно только администратору');
  return u;
}

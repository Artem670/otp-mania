import { commit, getState, loadState, resetState } from './store';
import type { Category, DB, OrderStatus, Product, Role, Settings, SignalStatus, User } from './types';
import { cartDetailed, employeeMonthReceived, isUnlocked, pickPrize, spinsThisMonth, managerQuarter, PET_LEVELS, poolRaised, productLevel, teamOf, userById } from './selectors';
import { uid } from '../lib/utils';

/**
 * Единый слой работы с данными. Интерфейс асинхронный, как у настоящего API:
 * для перехода на бэкенд достаточно заменить тела функций на HTTP-запросы.
 */
export class ApiError extends Error {}

const LATENCY = 280;
const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));
const fail = (m: string): never => { throw new ApiError(m); };

function requireUser(db: DB, id = db.sessionUserId) {
  const u = id ? userById(db, id) : undefined;
  if (!u) fail('Сессия истекла. Войдите заново');
  return u!;
}
const notify = (db: DB, userId: string, text: string, link?: string) =>
  db.notifications.push({ id: uid('nt'), userId, ts: Date.now(), text, read: false, link });
const touch = (db: DB, userId: string) => { const u = db.users.find((x) => x.id === userId); if (u) u.lastActiveAt = Date.now(); };
const isPositiveInt = (n: number) => Number.isFinite(n) && n > 0 && Math.floor(n) === n;

export const api = {
  async init() {
    await wait(450);
    return loadState();
  },

  /* ---------- Авторизация ---------- */
  async login(email: string, password: string) {
    await wait();
    const e = email.trim().toLowerCase();
    if (!e || !password) fail('Введите почту и пароль');
    const u = getState().users.find((x) => x.email === e);
    if (!u || u.password !== password) fail('Неверная почта или пароль');
    commit((db) => { db.sessionUserId = u!.id; touch(db, u!.id); });
    return u!;
  },
  async logout() {
    commit((db) => { db.sessionUserId = null; });
  },
  /** Демо-переключение роли: входит под демо-пользователем с этой ролью. */
  async switchRole(role: Role) {
    await wait(200);
    const db = getState();
    const map = { employee: 'a.smirnov@mania.demo', manager: 'i.belova@mania.demo', admin: 's.yusupova@mania.demo' };
    const u = db.users.find((x) => x.email === map[role]) ?? db.users.find((x) => x.role === role);
    if (!u) fail('Нет пользователя с такой ролью');
    commit((d) => { d.sessionUserId = u!.id; });
    return u!;
  },
  async resetDemo() {
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
    commit((d) => {
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
    commit((d) => {
      d.thanks.push({ id: uid('th'), ts: Date.now(), fromId: u.id, toId: to!.id, categoryId, message: msg });
      notify(d, to!.id, `${u.name} поблагодарил(а) вас: «${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}»`, '/cabinet/thanks');
      touch(d, u.id);
    });
  },

  /* ---------- Корзина и заказы ---------- */
  addToCart(productId: string, qty = 1) {
    const db = getState();
    const u = requireUser(db);
    const p = db.products.find((x) => x.id === productId);
    if (!p || !p.active) fail('Товар недоступен');
    if (!isUnlocked(p!, u.pet.xp)) fail(`«${p!.name}» откроется на ${productLevel(p!)} уровне питомца (${PET_LEVELS[productLevel(p!) - 1].title})`);
    const cur = (db.carts[u.id] ?? []).find((l) => l.productId === productId)?.qty ?? 0;
    if (cur + qty > p!.stock) fail(`На складе осталось ${p!.stock} шт.`);
    commit((d) => {
      const lines = d.carts[u.id] ?? (d.carts[u.id] = []);
      const l = lines.find((x) => x.productId === productId);
      if (l) l.qty += qty; else lines.push({ productId, qty });
    });
  },
  setCartQty(productId: string, qty: number) {
    const db = getState();
    const u = requireUser(db);
    const p = db.products.find((x) => x.id === productId);
    if (p && qty > p.stock) fail(`На складе осталось ${p.stock} шт.`);
    commit((d) => {
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
      if (!l.product.active) fail(`«${l.product.name}» больше не продаётся. Уберите его из корзины`);
      if (l.qty > l.product.stock) fail(`«${l.product.name}»: на складе ${l.product.stock} шт.`);
      if (!isUnlocked(l.product, u.pet.xp)) fail(`«${l.product.name}» откроется на ${productLevel(l.product)} уровне питомца`);
    }
    if (cart.total > u.coins) fail(`Недостаточно коинов: нужно ${cart.total.toLocaleString('ru-RU')}, на балансе ${u.coins.toLocaleString('ru-RU')}`);
    const orderId = uid('or');
    commit((d) => {
      const x = requireUser(d);
      x.coins -= cart.total;
      for (const l of cart.lines) d.products.find((p) => p.id === l.productId)!.stock -= l.qty;
      d.orders.push({ id: orderId, ts: Date.now(), userId: x.id, total: cart.total, status: 'new', items: cart.lines.map((l) => ({ productId: l.productId, name: l.product.name, qty: l.qty, price: l.product.price, costRub: l.product.costRub })) });
      d.txs.push({ id: uid('tx'), ts: Date.now(), userId: x.id, kind: 'order', currency: 'coins', amount: -cart.total, title: `Заказ из ${cart.count} поз.`, refId: orderId });
      d.carts[x.id] = [];
      notify(d, x.id, `Заказ оформлен: ${cart.total.toLocaleString('ru-RU')} коинов. Статус можно отслеживать в разделе «Заказы»`, '/cabinet/orders');
      touch(d, x.id);
    });
    return orderId;
  },
  async rateOrder(orderId: string, csi: number) {
    await wait(200);
    if (!(csi >= 1 && csi <= 5)) fail('Оценка от 1 до 5');
    commit((d) => {
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
    commit((d) => {
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
  async createPool(input: { title: string; description: string; goal: string; target: number; deadline: number; scope: string; image: string }) {
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
    commit((d) => {
      d.pools.push({ id, title: input.title.trim(), description: input.description.trim(), goal: input.goal.trim(), target: input.target, deadline: input.deadline, scope: input.scope, organizerId: u.id, image: input.image, contributions: [], status: 'active', createdAt: Date.now() });
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
    commit((d) => {
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
    commit((d) => {
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
    commit((d) => {
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
    commit((d) => { requireUser(d).pet.name = n; });
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
    commit((d) => {
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
    commit((d) => {
      const e = d.events.find((x) => x.id === eventId)!;
      e.attendees = going ? e.attendees.filter((x) => x !== u.id) : [...e.attendees, u.id];
    });
    return !going;
  },
  markNotificationsRead() {
    const db = getState();
    const u = requireUser(db);
    if (!db.notifications.some((n) => n.userId === u.id && !n.read)) return;
    commit((d) => d.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; }));
  },
  async updateProfile(patch: { avatar?: string }) {
    await wait(200);
    commit((d) => { const x = requireUser(d); if (patch.avatar !== undefined) x.avatar = patch.avatar; });
  },

  /* ---------- Администрирование ---------- */
  async setSignalStatus(id: string, status: SignalStatus) {
    await wait(200);
    requireAdmin();
    commit((d) => { d.signalStatus[id] = status; });
  },
  async setUserRole(userId: string, role: Role) {
    await wait(250);
    const admin = requireAdmin();
    if (userId === admin.id && role !== 'admin') fail('Нельзя снять роль администратора с себя');
    commit((d) => {
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
    commit((d) => { d.users.find((x) => x.id === userId)!.deptId = deptId; });
  },
  async saveDepartment(input: { id?: string; name: string; city: string }) {
    await wait(250);
    requireAdmin();
    if (input.name.trim().length < 3) fail('Название подразделения: минимум 3 символа');
    commit((d) => {
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
    if (Object.values(s.managerFunds).some((v) => !(v >= 0))) fail('Фонды руководителей не могут быть отрицательными');
    if (s.rules.some((r) => !r.trim()) || s.forbidden.some((r) => !r.trim())) fail('Уберите пустые пункты правил');
    commit((d) => { d.settings = s; });
  },
  async saveCategory(kind: 'accrual' | 'thanks', cat: Category) {
    await wait(200);
    requireAdmin();
    if (cat.name.trim().length < 3) fail('Название категории: минимум 3 символа');
    if (kind === 'accrual' && (!(cat.min! > 0) || !(cat.max! >= cat.min!))) fail('Проверьте диапазон: минимум больше нуля, максимум не меньше минимума');
    commit((d) => {
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
    commit((d) => {
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
    commit((d) => {
      const i = d.products.findIndex((x) => x.id === p.id);
      if (i >= 0) d.products[i] = { ...p, name: p.name.trim() }; else d.products.push({ ...p, id: uid('p'), name: p.name.trim() });
    });
  },
  async setOrderStatus(orderId: string, status: OrderStatus) {
    await wait(250);
    requireAdmin();
    const o = getState().orders.find((x) => x.id === orderId);
    if (!o) fail('Заказ не найден');
    if (o!.status === 'cancelled') fail('Отменённый заказ нельзя изменить');
    if (o!.status === 'delivered' && status !== 'delivered') fail('Выданный заказ нельзя вернуть в работу');
    commit((d) => {
      const x = d.orders.find((y) => y.id === orderId)!;
      x.status = status;
      if (status === 'cancelled') {
        const u = d.users.find((y) => y.id === x.userId)!;
        u.coins += x.total;
        x.items.forEach((i) => { const p = d.products.find((y) => y.id === i.productId); if (p) p.stock += i.qty; });
        d.txs.push({ id: uid('tx'), ts: Date.now(), userId: u.id, kind: 'refund', currency: 'coins', amount: x.total, title: 'Возврат за отменённый заказ', refId: x.id });
        notify(d, u.id, `Заказ отменён, ${x.total.toLocaleString('ru-RU')} коинов вернулись на баланс`, '/cabinet/orders');
      } else notify(d, x.userId, `Статус заказа: ${status === 'processing' ? 'собирается' : status === 'delivered' ? 'выдан, оцените его' : 'новый'}`, '/cabinet/orders');
    });
  },
};

function requireAdmin(): User {
  const u = requireUser(getState());
  if (u.role !== 'admin') fail('Действие доступно только администратору');
  return u;
}

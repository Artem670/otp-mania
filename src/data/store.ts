import { useSyncExternalStore } from 'react';
import type { DB } from './types';
import { ACCRUAL_CATEGORIES, createSeed, DB_VERSION, PRODUCTS, seedPulses } from './seed';
import { ARTICLES } from './articles';
import { docs, RemoteError, type DocRow } from './remote';

/**
 * Единое хранилище. Два режима:
 * - demo: песочница в браузере (localStorage), демо-входы без регистрации;
 * - live: общая база Supabase, данные видят все зарегистрированные пользователи.
 * Чтения идут через useDB(), изменения только через api.ts → commit().
 */
export type Mode = 'demo' | 'live';
const KEY = 'otp-mania-db';

let state: DB | null = null;
let mode: Mode = 'demo';
const listeners = new Set<() => void>();
let persistOk = true;

export const getMode = () => mode;
export function storageAvailable() { return persistOk; }
const emit = () => listeners.forEach((l) => l());

function persist() {
  if (!state || mode !== 'demo') return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { persistOk = false; }
}

export function loadState(): DB {
  mode = 'demo';
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.version === DB_VERSION && Array.isArray(parsed.users)) {
        state = parsed;
        emit();
        return state;
      }
      // Данные прошлой версии: пересоздаём песочницу, но оставляем человека в том же демо-аккаунте
      if (parsed && parsed.sessionUserId) {
        state = createSeed();
        if (state.users.some((u) => u.id === parsed.sessionUserId)) state.sessionUserId = parsed.sessionUserId;
        persist();
        emit();
        return state;
      }
    }
  } catch { persistOk = false; }
  state = createSeed();
  persist();
  emit();
  return state;
}

export function getState(): DB {
  if (!state) throw new Error('Данные ещё не загружены');
  return state;
}

/* ---------- Отображение DB ↔ строки таблицы docs ---------- */
const ARRAYS = ['users', 'departments', 'txs', 'accruals', 'conversions', 'thanks', 'products', 'orders', 'pools', 'notifications', 'events', 'news', 'goals', 'articles', 'pulses', 'tickets'] as const;
type ArrKey = (typeof ARRAYS)[number];
const key = (c: string, id: string) => c + '\u0000' + id;

function toRows(db: DB): Map<string, DocRow> {
  const m = new Map<string, DocRow>();
  for (const c of ARRAYS) for (const item of db[c] as { id: string }[]) m.set(key(c, item.id), { collection: c, id: item.id, data: item });
  m.set(key('settings', 'main'), { collection: 'settings', id: 'main', data: db.settings });
  m.set(key('signalStatus', 'main'), { collection: 'signalStatus', id: 'main', data: db.signalStatus });
  for (const [uid, lines] of Object.entries(db.carts)) m.set(key('carts', uid), { collection: 'carts', id: uid, data: { lines } });
  m.set(key('meta', 'main'), { collection: 'meta', id: 'main', data: { version: db.version, seededAt: db.seededAt } });
  return m;
}

function emptyDB(): DB {
  const s = createSeed(); // берём настройки и справочники по умолчанию, если в базе их ещё нет
  return { ...s, users: [], departments: [], txs: [], accruals: [], conversions: [], thanks: [], products: [], orders: [], pools: [], notifications: [], events: [], news: [], goals: [], articles: [], pulses: [], tickets: [], signalStatus: {}, carts: {}, sessionUserId: null };
}

/** Накатывает строки на состояние: добавляет, заменяет, удаляет. */
function applyRows(db: DB, rows: DocRow[]) {
  for (const r of rows) {
    if ((ARRAYS as readonly string[]).includes(r.collection)) {
      const arr = db[r.collection as ArrKey] as { id: string }[];
      const i = arr.findIndex((x) => x.id === r.id);
      if (r.deleted) { if (i >= 0) arr.splice(i, 1); }
      else if (i >= 0) arr[i] = r.data as { id: string };
      else arr.push(r.data as { id: string });
    } else if (r.collection === 'settings') db.settings = { ...db.settings, ...(r.data as DB['settings']) };
    else if (r.collection === 'signalStatus') db.signalStatus = r.data as DB['signalStatus'];
    else if (r.collection === 'carts') { if (r.deleted) delete db.carts[r.id]; else db.carts[r.id] = (r.data as { lines: DB['carts'][string] }).lines; }
  }
  const byTs = (a: { ts: number }, b: { ts: number }) => a.ts - b.ts;
  db.txs.sort(byTs); db.accruals.sort(byTs); db.thanks.sort(byTs); db.orders.sort(byTs);
}

/* ---------- Живой режим ---------- */
let snapshot = new Map<string, string>(); // сериализованные строки последнего известного состояния
let lastSync = '';
let pollTimer: ReturnType<typeof setInterval> | null = null;
const remember = (db: DB) => { snapshot = new Map([...toRows(db)].map(([k, r]) => [k, JSON.stringify(r.data)])); };
const bumpSync = (rows: DocRow[]) => { for (const r of rows) if (r.updated_at && r.updated_at > lastSync) lastSync = r.updated_at; };

/** Загружает всю базу. Если она пустая, заливает стартовые данные (демо-коллег и историю). */
export async function loadRemote(onProgress?: (t: string) => void): Promise<DB> {
  onProgress?.('Загружаем данные…');
  let rows = await docs.fetch();
  if (!rows.some((r) => r.collection === 'meta')) {
    onProgress?.('Первый запуск: создаём базу…');
    const seed = createSeed();
    const all = [...toRows(seed).values()];
    const meta = all.filter((r) => r.collection === 'meta');
    await docs.upsert(all.filter((r) => r.collection !== 'meta'));
    await docs.upsert(meta); // метка «база создана» последней: до неё триггеры разрешают служебные записи
    rows = await docs.fetch();
  }
  const db = emptyDB();
  applyRows(db, rows);
  await migrate(db);
  db.version = DB_VERSION;
  bumpSync(rows);
  mode = 'live';
  state = db;
  remember(db);
  emit();
  startPolling();
  return db;
}

/**
 * Дозаполняет базу, созданную прошлой версией сайта: пульс-опросы, лимитированные товары,
 * категория формальных активностей. Каждый шаг выполняется один раз и не трогает чужие правки.
 */
async function migrate(db: DB) {
  const now = Date.now();
  const tryUpsert = async (rows: DocRow[], apply: () => void) => {
    if (!rows.length) return;
    try { await docs.upsert(rows); apply(); } catch { /* например, нет прав администратора: доделает следующий вход админа */ }
  };
  if (!db.pulses.length && db.users.some((u) => u.email.endsWith('@mania.demo'))) {
    const list = seedPulses(db.users, db.accruals, db.orders, db.products, now);
    await tryUpsert(list.map((p) => ({ collection: 'pulses', id: p.id, data: p })), () => { db.pulses = list; });
  }
  if (!db.products.some((p) => p.limited !== undefined)) {
    const limited = new Set(PRODUCTS.filter((p) => p.limited).map((p) => p.id));
    const next = db.products.filter((p) => limited.has(p.id)).map((p) => ({ ...p, limited: true }));
    await tryUpsert(next.map((p) => ({ collection: 'products', id: p.id, data: p })), () => { next.forEach((p) => { const i = db.products.findIndex((x) => x.id === p.id); db.products[i] = p; }); });
  }
  // Благотворительность и командные сборы (версия 8)
  if (db.users.some((u) => u.email.endsWith('@mania.demo'))) {
    const fresh = createSeed(now);
    const newProducts = fresh.products.filter((p) => !db.products.some((x) => x.id === p.id) && (p.category === 'charity' || p.currency === 'rucoins'));
    await tryUpsert(newProducts.map((p) => ({ collection: 'products', id: p.id, data: p })), () => { db.products.push(...newProducts); });
    // Сертификаты: новые позиции с номиналами, «маркетплейс» и «кино» снимаются с продажи
    const certs = fresh.products.filter((p) => p.category === 'certificates').flatMap((p) => { const cur = db.products.find((x) => x.id === p.id); return !cur ? [p] : !cur.nominals ? [{ ...p, stock: cur.stock, stockouts: cur.stockouts }] : []; });
    const retired = db.products.filter((p) => ['p-cert-mp', 'p-cert-cinema'].includes(p.id) && p.active).map((p) => ({ ...p, active: false }));
    const certRows = [...certs, ...retired];
    await tryUpsert(certRows.map((p) => ({ collection: 'products', id: p.id, data: p })), () => { certRows.forEach((p) => { const i = db.products.findIndex((x) => x.id === p.id); if (i >= 0) db.products[i] = p; else db.products.push(p); }); });
    // выходной и обед с правлением переезжают на витрину «За РуКоины», остаток сохраняем
    const moved = fresh.products.filter((p) => p.currency === 'rucoins').flatMap((p) => { const cur = db.products.find((x) => x.id === p.id); return cur && cur.currency !== 'rucoins' ? [{ ...p, stock: cur.stock, stockouts: cur.stockouts }] : []; });
    await tryUpsert(moved.map((p) => ({ collection: 'products', id: p.id, data: p })), () => { moved.forEach((p) => { db.products[db.products.findIndex((x) => x.id === p.id)] = p; }); });
    const byU = new Set(db.users.map((u) => u.id));
    const newPools = fresh.pools.filter((p) => !db.pools.some((x) => x.id === p.id) && byU.has(p.organizerId)).map((p) => ({ ...p, contributions: [] })); // вклады в живой базе только настоящие
    await tryUpsert(newPools.map((p) => ({ collection: 'pools', id: p.id, data: p })), () => { db.pools.push(...newPools); });
    const oldCharity = db.pools.filter((p) => p.id === 'pool2' && !p.kind).map((p) => ({ ...p, kind: 'charity' as const }));
    await tryUpsert(oldCharity.map((p) => ({ collection: 'pools', id: p.id, data: p })), () => { oldCharity.forEach((p) => { db.pools[db.pools.findIndex((x) => x.id === p.id)] = p; }); });
  }
  // Питомец теперь зовётся «ОТуПик»: переименовываем старое имя по умолчанию «Пятак» (своё имя, данное человеком, не трогаем)
  const oldPets = db.users.filter((u) => u.pet?.name === 'Пятак').map((u) => ({ ...u, pet: { ...u.pet, name: 'ОТуПик' } }));
  for (const u of oldPets) {
    await tryUpsert([{ collection: 'users', id: u.id, data: u }], () => { db.users[db.users.findIndex((x) => x.id === u.id)] = u; });
  }
  // Без удвоения от банка: обновляем описания пожертвований и сборов
  const doubled = (t?: string) => !!t && /удва|удво|столько же от банка|банк добавит/i.test(t);
  if (db.users.some((u) => u.email.endsWith('@mania.demo'))) {
    const fresh = createSeed(now);
    const prods = db.products.filter((p) => p.category === 'charity' && doubled(p.description)).map((p) => { const f = fresh.products.find((x) => x.id === p.id); return f ? { ...p, description: f.description, costRub: f.costRub } : p; });
    const pls = db.pools.filter((p) => doubled(p.description) || doubled(p.goal)).map((p) => { const f = fresh.pools.find((x) => x.id === p.id); return f ? { ...p, description: f.description, goal: f.goal } : p; });
    await tryUpsert([...prods.map((p) => ({ collection: 'products', id: p.id, data: p })), ...pls.map((p) => ({ collection: 'pools', id: p.id, data: p }))], () => {
      prods.forEach((p) => { db.products[db.products.findIndex((x) => x.id === p.id)] = p; });
      pls.forEach((p) => { db.pools[db.pools.findIndex((x) => x.id === p.id)] = p; });
    });
  }
  // База знаний: новые статьи по всем механикам (пишет только администратор)
  if (!db.articles.some((a) => a.id === 'kb10') || db.articles.some((a) => doubled(a.body)) || !db.articles.some((a) => a.body.includes('{{transferLimit}}')) || db.articles.some((a) => /не стоит банку|Что считает программа|Легенда \(20 000\)|Впечатлени/.test(a.body))) {
    await tryUpsert(ARTICLES.map((a) => ({ collection: 'articles', id: a.id, data: a })), () => { db.articles = [...ARTICLES]; });
  }
  // Пересчёт цен (версия 13): цена = розница аналога × 5, себестоимость = закупка тиражом. Трогаем только цены, которые админ не менял.
  const OLD_PRICES: Record<string, number> = {
    'p-hoodie': 9000, 'p-tee': 3500, 'p-jacket': 14000, 'p-beanie': 2500, 'p-mug': 2800, 'p-backpack': 8500, 'p-umbrella': 3200, 'p-shopper': 1500,
    'p-headphones': 24000, 'p-powerbank': 6000, 'p-speaker': 12000, 'p-watch': 15000, 'p-toy': 2000, 'p-stickers': 600, 'p-notebook': 1200,
    'p-pet': 1800, 'p-masterclass': 7000, 'p-ski': 80000,
  };
  if (db.products.some((p) => OLD_PRICES[p.id] === p.price)) {
    const fresh = createSeed(now);
    const repriced = db.products.flatMap((p) => {
      const f = fresh.products.find((x) => x.id === p.id);
      return f && OLD_PRICES[p.id] === p.price ? [{ ...p, name: f.name, price: f.price, costRub: f.costRub, description: f.description }] : [];
    });
    await tryUpsert(repriced.map((p) => ({ collection: 'products', id: p.id, data: p })), () => { repriced.forEach((p) => { db.products[db.products.findIndex((x) => x.id === p.id)] = p; }); });
  }
  // Психолог вместо мастер-класса, горнолыжный выезд снят с продажи
  if (!db.products.some((p) => p.id === 'p-psy') || db.products.some((p) => (p.id === 'p-masterclass' || p.id === 'p-ski') && p.active)) {
    const fresh = createSeed(now);
    const psy = db.products.some((p) => p.id === 'p-psy') ? [] : fresh.products.filter((p) => p.id === 'p-psy');
    const off = db.products.filter((p) => (p.id === 'p-masterclass' || p.id === 'p-ski') && p.active).map((p) => ({ ...p, active: false }));
    const rows = [...psy, ...off];
    await tryUpsert(rows.map((p) => ({ collection: 'products', id: p.id, data: p })), () => { rows.forEach((p) => { const i = db.products.findIndex((x) => x.id === p.id); if (i >= 0) db.products[i] = p; else db.products.push(p); }); });
  }
  // Партнёры сертификатов и новый блокнот: обновляем названия и описания, если админ их не менял
  const RENAMED: Record<string, string> = { 'p-speaker': 'Колонка JBL Flip 6', 'p-cert-sport': 'Сертификат в спортзал', 'p-cert-books': 'Сертификат в книжный', 'p-notebook': 'Блокнот в точку' };
  if (db.products.some((p) => RENAMED[p.id] === p.name)) {
    const fresh = createSeed(now);
    const renamed = db.products.flatMap((p) => { const f = fresh.products.find((x) => x.id === p.id); return f && RENAMED[p.id] === p.name ? [{ ...p, name: f.name, description: f.description, ...(p.id === 'p-speaker' && p.price === 50000 ? { price: f.price, costRub: f.costRub } : {}) }] : []; });
    await tryUpsert(renamed.map((p) => ({ collection: 'products', id: p.id, data: p })), () => { renamed.forEach((p) => { db.products[db.products.findIndex((x) => x.id === p.id)] = p; }); });
  }
  // Колесо: игрушка подорожала до 650 ₽, поэтому шанс снижен, чтобы прокрутка стоила банку не больше, чем в финмодели
  const wToy = db.settings.wheelPrizes?.find((w) => w.id === 'w-toy');
  if (wToy && wToy.prob === 5 && wToy.costRub === 350) {
    const fresh = createSeed(now).settings.wheelPrizes;
    const prizes = db.settings.wheelPrizes.map((w) => (['w-toy', 'w-badge', 'w-hoodie'].includes(w.id) ? { ...w, prob: fresh.find((f) => f.id === w.id)?.prob ?? w.prob, costRub: fresh.find((f) => f.id === w.id)?.costRub ?? w.costRub } : w));
    const settings = { ...db.settings, wheelPrizes: prizes };
    await tryUpsert([{ collection: 'settings', id: 'main', data: settings }], () => { db.settings = settings; });
  }
  if (!db.settings.accrualCategories.some((c) => c.formal)) {
    const formal = ACCRUAL_CATEGORIES.filter((c) => c.formal);
    const settings = { ...db.settings, accrualCategories: [...db.settings.accrualCategories, ...formal] };
    await tryUpsert([{ collection: 'settings', id: 'main', data: settings }], () => { db.settings = settings; });
  }
}

/** Подтягивает чужие изменения. */
export async function pull() {
  if (mode !== 'live' || !state) return;
  const rows = await docs.fetch(lastSync || undefined);
  if (!rows.length) return;
  const next = structuredClone(state);
  applyRows(next, rows);
  bumpSync(rows);
  state = next;
  for (const r of rows) snapshot.set(key(r.collection, r.id), JSON.stringify(r.data));
  emit();
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => { pull().catch(() => {}); }, 15000);
  try { window.addEventListener('focus', () => pull().catch(() => {})); } catch { /* noop */ }
}

export function leaveLive() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  lastSync = '';
  snapshot = new Map();
}

/** Применяет изменение к копии состояния и уведомляет подписчиков. В живом режиме сохраняет изменения в базе. */
export async function commit(mutator: (draft: DB) => void): Promise<void> {
  const prev = getState();
  const draft = structuredClone(prev);
  mutator(draft);
  state = draft;
  emit();
  if (mode === 'demo') { persist(); return; }
  const next = toRows(draft);
  const changed: DocRow[] = [];
  for (const [k, r] of next) {
    const json = JSON.stringify(r.data);
    if (snapshot.get(k) !== json) changed.push(r);
  }
  for (const k of snapshot.keys()) if (!next.has(k)) { const [c, id] = k.split('\u0000'); changed.push({ collection: c, id, data: {}, deleted: true }); }
  if (!changed.length) return;
  try {
    await docs.upsert(changed);
    for (const r of changed) { if (r.deleted) snapshot.delete(key(r.collection, r.id)); else snapshot.set(key(r.collection, r.id), JSON.stringify(r.data)); }
  } catch (e) {
    state = prev; // откатываем, база не приняла изменение
    emit();
    throw e instanceof RemoteError ? e : new RemoteError('Не удалось сохранить изменения');
  }
}

/** Только локальные поля (сессия), без записи в базу. */
export function setLocal(mutator: (draft: DB) => void) {
  const draft = structuredClone(getState());
  mutator(draft);
  state = draft;
  persist();
  emit();
}

export function resetState() {
  state = createSeed();
  persist();
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getState, getState);
}

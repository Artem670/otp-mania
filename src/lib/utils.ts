export const DAY = 86_400_000;

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

let counter = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
export const fmtRub = (n: number) => `${fmt(n)} ₽`;
export const fmtPct = (n: number, d = 0) => `${(n * 100).toFixed(d).replace('.', ',')}%`;
export const fmtNum = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
export const fmtDateShort = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ago(ts: number, now = Date.now()) {
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'вчера';
  if (d < 30) return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
  return fmtDate(ts);
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const quarterStart = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
};
export const quarterEnd = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 1).getTime();
};
export const monthStart = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};
export const quarterLabel = (ts: number) => {
  const d = new Date(ts);
  return `${Math.floor(d.getMonth() / 3) + 1} квартал ${d.getFullYear()}`;
};
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Индекс Джини: 0 = все получили поровну, 1 = всё у одного. */
export function gini(values: number[]) {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  const n = v.length;
  const total = sum(v);
  if (n < 2 || total === 0) return 0;
  let acc = 0;
  v.forEach((x, i) => (acc += (2 * (i + 1) - n - 1) * x));
  return acc / (n * total);
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

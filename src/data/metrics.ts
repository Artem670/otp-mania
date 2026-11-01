import type { DB, Pulse, PulseQuestion, TxKind } from './types';
import { DAY, quarterEnd, quarterStart, sum } from '../lib/utils';
import { fundOf, managerKpi } from './selectors';

/**
 * Дерево метрик программы ОТП Мания (договорённость команды).
 * Три целевые метрики: Engagement rate, CSI и затраты. Под ними метрики-драйверы,
 * пороги злоупотреблений (E) и диагностика.
 */
export type MetricStatus = 'ok' | 'warn' | 'bad' | 'info';
export interface Metric {
  code: string;
  name: string;
  formula: string;
  value: number | null; // null, когда данных ещё нет
  display: string;
  target?: string;
  baseline?: string; // значение в банке сейчас, из материалов кейса
  status: MetricStatus;
  progress?: number; // 0..1 для полосы прогресса
  hint?: string;
  parts?: { label: string; value: number; color: string }[]; // структура (C4)
}
export interface NorthStar extends Metric { drivers: Metric[] }

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`;
const num = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
const rub = (v: number) => (v >= 1e6 ? `${num(v / 1e6, 1).replace(/,0$/, '')} млн ₽` : `${Math.round(v).toLocaleString('ru-RU')} ₽`);
const higher = (v: number | null, t: number): MetricStatus => (v === null ? 'info' : v >= t ? 'ok' : v >= t * 0.85 ? 'warn' : 'bad');
const lower = (v: number | null, max: number): MetricStatus => (v === null ? 'info' : v <= max ? 'ok' : v <= max * 1.3 ? 'warn' : 'bad');
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (a: number[]) => (a.length ? sum(a) / a.length : null);

/** Списания коинов на награды (за вычетом возвратов). */
const SPEND_KINDS: TxKind[] = ['order', 'pool', 'pet', 'wheel'];
function redeemed(db: DB, from: number, to: number) {
  const tx = db.txs.filter((t) => t.ts >= from && t.ts < to && t.currency === 'coins');
  return sum(tx.filter((t) => SPEND_KINDS.includes(t.kind)).map((t) => -t.amount)) - sum(tx.filter((t) => t.kind === 'refund').map((t) => t.amount));
}

const pulseAvg = (db: DB, q: PulseQuestion, from: number) => {
  const list = db.pulses.filter((p: Pulse) => p.q === q && p.ts >= from);
  return { value: avg(list.map((p) => p.score)), count: list.length };
};

/** Кто был активен в программе: сам что-то сделал (не только получил). */
export function engagedIds(db: DB, from: number, to = Date.now()) {
  const s = new Set<string>();
  db.txs.forEach((t) => { if (t.ts >= from && t.ts < to && t.kind !== 'accrual' && t.kind !== 'refund' && !t.title.startsWith('Перенос баланса')) s.add(t.userId); });
  db.thanks.forEach((t) => { if (t.ts >= from && t.ts < to) s.add(t.fromId); });
  db.accruals.forEach((a) => { if (a.ts >= from && a.ts < to) s.add(a.managerId); });
  db.pulses.forEach((p) => { if (p.ts >= from && p.ts < to) s.add(p.userId); });
  return s;
}

/** Дни без товара в наличии за окно: сумма по позициям. */
export function stockoutDays(db: DB, from: number, to: number) {
  const items = db.products.filter((p) => p.active).map((p) => {
    const days = sum((p.stockouts ?? []).map((s) => Math.max(0, Math.min(s.to ?? to, to) - Math.max(s.from, from)))) / DAY;
    return { product: p, days, now: p.stock <= 0 };
  }).filter((x) => x.days > 0.05 || x.now).sort((a, b) => b.days - a.days);
  return { total: sum(items.map((x) => x.days)), items };
}

export function metricsTree(db: DB, now = Date.now()) {
  const T = db.settings.metricTargets;
  const users = db.users;
  const n = users.length || 1;
  const d30 = now - 30 * DAY, d90 = now - 90 * DAY, d365 = now - 365 * DAY;
  const managers = users.filter((u) => u.role === 'manager');

  /* ---------- Engagement rate ---------- */
  const engaged = engagedIds(db, d30, now);
  const er = users.length ? users.filter((u) => engaged.has(u.id)).length / n : null;
  const recognized = new Set([...db.accruals.filter((a) => a.ts >= d90).map((a) => a.employeeId), ...db.thanks.filter((t) => t.ts >= d90).map((t) => t.toId)]);
  const a1 = users.length ? users.filter((u) => recognized.has(u.id)).length / n : null;
  const activeMgr = new Set(db.accruals.filter((a) => a.ts >= d30).map((a) => a.managerId));
  const a4 = managers.length ? managers.filter((m) => activeMgr.has(m.id)).length / managers.length : null;
  const b2 = pulseAvg(db, 'contribution', d90);

  const erTree: NorthStar = {
    code: 'ER', name: 'Engagement rate', formula: 'Сотрудники, которые сами что-то сделали в программе за 30 дней (поблагодарили, начислили, потратили, конвертировали, ответили на пульс) / все сотрудники',
    value: er, display: er === null ? '—' : pct(er), target: `≥ ${pct(T.er)}`, status: higher(er, T.er), progress: er ?? 0,
    hint: `${users.filter((u) => engaged.has(u.id)).length} из ${users.length} сотрудников`,
    drivers: [
      { code: 'A1', name: 'Охват признанием', formula: 'Сотрудники с ≥1 признанием (РуКоины или «спасибо») за квартал / все сотрудники', value: a1, display: a1 === null ? '—' : pct(a1), target: `≈ ${pct(T.coverage)}`, status: higher(a1, T.coverage), progress: a1 ?? 0, hint: 'окно: последние 90 дней' },
      { code: 'A4', name: 'Активность руководителей', formula: 'Руководители, начислившие РуКоины за месяц / все руководители', value: a4, display: a4 === null ? '—' : pct(a4), status: a4 === null ? 'info' : a4 >= 0.9 ? 'ok' : a4 >= 0.7 ? 'warn' : 'bad', progress: a4 ?? 0, hint: `${managers.filter((m) => activeMgr.has(m.id)).length} из ${managers.length} за 30 дней` },
      { code: 'B2', name: 'Пульс «признание было про мой вклад»', formula: 'Средняя оценка 1–5 в опросе после начисления', value: b2.value, display: b2.value === null ? '—' : `${num(b2.value)} из 5`, status: b2.value === null ? 'info' : b2.value >= 4.3 ? 'ok' : b2.value >= 3.8 ? 'warn' : 'bad', progress: (b2.value ?? 0) / 5, hint: `${b2.count} ответов за 90 дней` },
    ],
  };

  /* ---------- CSI ---------- */
  const rated = db.orders.filter((o) => o.csi && o.ts >= d90);
  const csi = avg(rated.map((o) => o.csi!));
  const buyers = new Set(db.orders.filter((o) => !o.wheel && o.status !== 'cancelled' && o.ts >= d30).map((o) => o.userId));
  const c1 = users.length ? buyers.size / n : null;
  const stock = stockoutDays(db, d30, now);
  const desire = pulseAvg(db, 'desire', d90);
  const csiTree: NorthStar = {
    code: 'CSI', name: 'CSI наград', formula: 'Средняя оценка выданных заказов по шкале 1–5 за 90 дней',
    value: csi, display: csi === null ? '—' : `${num(csi, 2)} из 5`, target: `≥ ${num(T.csi, 2)}`, status: higher(csi, T.csi), progress: (csi ?? 0) / 5,
    hint: `${rated.length} оценок`,
    drivers: [
      { code: 'C1', name: 'Покупатели', formula: 'Купившие в магазине за месяц / все сотрудники', value: c1, display: c1 === null ? '—' : pct(c1), baseline: '≈ 29%', status: c1 === null ? 'info' : c1 >= 0.29 ? 'ok' : 'warn', progress: c1 ?? 0, hint: `${buyers.size} человек за 30 дней` },
      { code: 'C3', name: 'Дефицит', formula: 'Дни без позиции в наличии за 30 дней, сумма по товарам', value: stock.total, display: `${Math.round(stock.total)} дн.`, status: stock.total <= 7 ? 'ok' : stock.total <= 21 ? 'warn' : 'bad', hint: stock.items.length ? stock.items.slice(0, 3).map((x) => `${x.product.name}: ${Math.round(x.days)} дн.${x.now ? ' (нет сейчас)' : ''}`).join(' · ') : 'всё было в наличии' },
      { code: 'C·П', name: 'Желанность наград', formula: 'Средняя оценка 1–5 в опросе «насколько хотелось эту награду»', value: desire.value, display: desire.value === null ? '—' : `${num(desire.value)} из 5`, status: desire.value === null ? 'info' : desire.value >= 4.3 ? 'ok' : desire.value >= 3.8 ? 'warn' : 'bad', progress: (desire.value ?? 0) / 5, hint: `${desire.count} ответов за 90 дней` },
    ],
  };

  /* ---------- Затраты ---------- */
  const cost = db.settings.coinCostRub;
  const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
  const ytdShare = Math.max(0.05, (now - yearStart) / (365 * DAY));
  const d1 = redeemed(db, yearStart, now) * cost;
  const d1Forecast = d1 / ytdShare;
  const emission = sum(db.accruals.filter((a) => a.ts >= d90).map((a) => a.amount)) * db.settings.conversionRate;
  const redeemed90 = redeemed(db, d90, now);
  const d3 = redeemed90 > 0 ? emission / redeemed90 : null;
  const coinsLeft = sum(users.map((u) => u.coins)) + sum(users.map((u) => u.rucoins)) * db.settings.conversionRate;
  const d4 = coinsLeft * cost;
  const coverage = redeemed90 > 0 ? coinsLeft / (redeemed90 / 3) : null;
  const engagedYear = engagedIds(db, yearStart, now).size;
  const perActive = engagedYear ? d1 / engagedYear : null;
  const costTree: NorthStar = {
    code: 'D', name: 'Затраты на награды', formula: 'Погашенные коины с начала года × стоимость коина. Прогноз на год: факт / доля прошедшего года',
    value: d1, display: rub(d1), target: `≤ ${rub(db.settings.budgetRub)} в год`, status: lower(d1Forecast, db.settings.budgetRub), progress: Math.min(1, d1 / db.settings.budgetRub),
    hint: `прогноз на год ${rub(d1Forecast)}. В масштабе банка цель ≤ ${rub(T.bankBudgetRub)}, в прототипе бюджет задан на ${users.length} сотрудников`,
    drivers: [
      { code: 'D1', name: 'Затраты', formula: `Погашенные коины × стоимость коина (${num(cost, 2)} ₽)`, value: d1, display: rub(d1), status: 'info', hint: `${Math.round(d1 / cost).toLocaleString('ru-RU')} коинов с начала года` },
      { code: 'D3', name: 'Баланс эмиссии', formula: 'Эмиссия (начисленные РуКоины в коинах) / погашение за 90 дней', value: d3, display: d3 === null ? '—' : num(d3, 2), status: d3 === null ? 'info' : d3 >= 0.8 && d3 <= 1.2 ? 'ok' : d3 <= 1.5 ? 'warn' : 'bad', hint: d3 === null ? '' : d3 > 1 ? 'начисляем больше, чем тратят: обязательства растут' : 'тратят больше, чем начисляем: копилки уменьшаются' },
      { code: 'D4', name: 'Обязательства', formula: 'Остаток коинов и РуКоинов × стоимость коина; покрытие = остаток / среднее погашение в месяц', value: d4, display: rub(d4), status: coverage === null ? 'info' : coverage <= 12 ? 'ok' : coverage <= 24 ? 'warn' : 'bad', hint: coverage === null ? '' : `покрытие ${num(coverage)} мес. погашений` },
      { code: 'D·₽', name: '₽ на активного', formula: 'Затраты с начала года / сотрудники, активные в программе с начала года', value: perActive, display: perActive === null ? '—' : rub(perActive), status: 'info', hint: `${engagedYear} активных` },
    ],
  };

  /* ---------- Пороги ---------- */
  const th30 = db.thanks.filter((t) => t.ts >= d30);
  const mutual = th30.filter((t) => db.thanks.some((b) => b.fromId === t.toId && b.toId === t.fromId && Math.abs(b.ts - t.ts) <= 30 * DAY));
  const e1 = th30.length ? mutual.length / th30.length : null;
  const acc90 = db.accruals.filter((a) => a.ts >= d90);
  const byEmp = new Map<string, number>();
  acc90.forEach((a) => byEmp.set(a.employeeId, (byEmp.get(a.employeeId) ?? 0) + a.amount));
  const topN = Math.max(1, Math.ceil(users.length * 0.01));
  const sorted = [...byEmp.entries()].sort((a, b) => b[1] - a[1]);
  const total90 = sum(acc90.map((a) => a.amount));
  const e2 = total90 ? sum(sorted.slice(0, topN).map((x) => x[1])) / total90 : null;
  const formalIds = new Set(db.settings.accrualCategories.filter((c) => c.formal).map((c) => c.id));
  const e3 = total90 ? sum(acc90.filter((a) => formalIds.has(a.categoryId)).map((a) => a.amount)) / total90 : null;
  const topNames = sorted.slice(0, topN).map(([id]) => users.find((u) => u.id === id)?.name).filter(Boolean).join(', ');
  const thresholds: Metric[] = [
    { code: 'E1', name: 'Взаимные «спасибо»', formula: 'Благодарности за 30 дней, на которые есть ответная от того же человека в пределах 30 дней / все благодарности', value: e1, display: e1 === null ? '—' : pct(e1), target: `≤ ${pct(T.mutualMax)}`, status: lower(e1, T.mutualMax), progress: e1 ?? 0, hint: `${mutual.length} из ${th30.length}` },
    { code: 'E2', name: 'Топ-1%', formula: 'Доля РуКоинов за 90 дней у верхнего 1% получателей', value: e2, display: e2 === null ? '—' : pct(e2), target: `≤ ${pct(T.top1Max)}`, status: lower(e2, T.top1Max), progress: e2 ?? 0, hint: `верхний 1% = ${topN} чел.${topNames ? `: ${topNames}` : ''}` },
    { code: 'E3', name: 'Формальные активности', formula: 'РуКоины за категории, отмеченные как формальные (посещение, обязательное обучение, опросы) / все РуКоины за 90 дней', value: e3, display: e3 === null ? '—' : pct(e3), target: `≤ ${pct(T.formalMax)}`, status: formalIds.size ? lower(e3, T.formalMax) : 'info', progress: e3 ?? 0, hint: formalIds.size ? db.settings.accrualCategories.filter((c) => c.formal).map((c) => c.name).join(', ') : 'нет категорий с пометкой «формальная»' },
  ];

  /* ---------- Диагностика ---------- */
  const perUser = users.map((u) => db.accruals.filter((a) => a.employeeId === u.id && a.ts >= d30).length + db.thanks.filter((t) => t.toId === u.id && t.ts >= d30).length);
  const a2 = median(perUser);
  const minLen = db.settings.minCommentLength;
  const accAll = db.accruals.filter((a) => a.ts >= d90), thAll = db.thanks.filter((t) => t.ts >= d90);
  const meaningful = accAll.filter((a) => a.categoryId && a.comment.trim().length >= minLen).length + thAll.filter((t) => t.categoryId && t.message.trim().length >= 10).length;
  const b1 = accAll.length + thAll.length ? meaningful / (accAll.length + thAll.length) : null;

  const startDelays: number[] = [];
  for (const u of users) {
    const first = db.accruals.find((a) => a.employeeId === u.id);
    if (!first) continue;
    const spend = db.txs.find((t) => t.userId === u.id && t.ts >= first.ts && SPEND_KINDS.includes(t.kind));
    if (spend) startDelays.push((spend.ts - first.ts) / DAY);
  }
  const c2 = median(startDelays);

  // Структура трат за год
  const spendTx = db.txs.filter((t) => t.ts >= d365 && t.currency === 'coins' && t.amount < 0 && SPEND_KINDS.includes(t.kind));
  const prodOf = new Map(db.products.map((p) => [p.id, p]));
  const orderOf = new Map(db.orders.map((o) => [o.id, o]));
  let cert = 0, limited = 0, pet = 0, wheel = 0, pools = 0, other = 0, charity = 0;
  const poolKind = new Map(db.pools.map((p) => [p.id, p.kind ?? 'team']));
  for (const t of spendTx) {
    const v = -t.amount;
    if (t.kind === 'pet') { pet += v; continue; }
    if (t.kind === 'wheel') { wheel += v; continue; }
    if (t.kind === 'pool') { if (t.refId && poolKind.get(t.refId) === 'charity') charity += v; else pools += v; continue; }
    const o = t.refId ? orderOf.get(t.refId) : undefined;
    if (!o || o.status === 'cancelled') continue;
    for (const i of o.items) {
      const p = prodOf.get(i.productId); const iv = i.price * i.qty;
      if (p?.category === 'charity') charity += iv; else if (p?.category === 'certificates') cert += iv; else if (p?.limited) limited += iv; else other += iv;
    }
  }
  const spendTotal = cert + limited + pet + wheel + pools + other + charity;
  const share = (v: number) => (spendTotal ? v / spendTotal : 0);
  const c4: Metric = {
    code: 'C4', name: 'Структура трат', formula: 'Доли коинов за год: сертификаты, уникальные и лимитированные вещи, тамагочи, колесо, командные сборы, благотворительность, остальное',
    value: share(cert), display: pct(share(cert)), baseline: 'сертификаты 81%', status: 'info', hint: 'доля сертификатов; в банке сейчас 81%',
    parts: [
      { label: 'Сертификаты', value: share(cert), color: '#16161a' },
      { label: 'Уникальные и лимитированные', value: share(limited), color: '#9e6fc3' },
      { label: 'Тамагочи', value: share(pet), color: '#c1ff05' },
      { label: 'Колесо удачи', value: share(wheel), color: '#ff6a13' },
      { label: 'Командные сборы', value: share(pools), color: '#2f9e6a' },
      { label: 'Благотворительность', value: share(charity), color: '#0047bb' },
      { label: 'Другие товары', value: share(other), color: '#d9d9df' },
    ],
  };
  const launched = db.pools.filter((p) => p.createdAt >= d365);
  const closed = launched.filter((p) => p.status === 'completed');
  const c5 = launched.length ? closed.length / launched.length : null;

  const lastMove = new Map<string, number>();
  db.txs.forEach((t) => { if (!t.title.startsWith('Перенос баланса') && (lastMove.get(t.userId) ?? 0) < t.ts) lastMove.set(t.userId, t.ts); });
  const balances = users.map((u) => ({ u, bal: u.coins + u.rucoins * db.settings.conversionRate, last: lastMove.get(u.id) ?? 0 }));
  const allBal = sum(balances.map((b) => b.bal));
  const idle = balances.filter((b) => b.bal > 0 && now - b.last > 180 * DAY);
  const c6 = allBal ? sum(idle.map((b) => b.bal)) / allBal : null;

  const allocated = sum(managers.map((m) => fundOf(db, m.id)));
  const usedQ = sum(managers.map((m) => managerKpi(db, m.id, now).used));
  const qs = quarterStart(now), qe = quarterEnd(now);
  const elapsed = (now - qs) / (qe - qs);
  const d5 = allocated ? usedQ / allocated : null;

  const diagnostics: { title: string; items: Metric[] }[] = [
    { title: 'Вовлечённость', items: [
      { code: 'A2', name: 'Частота признания', formula: 'Медиана числа признаний (РуКоины и «спасибо») за месяц на сотрудника', value: a2, display: a2 === null ? '—' : num(a2, a2 % 1 ? 1 : 0), status: 'info', hint: `в среднем ${num(avg(perUser) ?? 0)}` },
      { code: 'B1', name: 'Осмысленность', formula: `Признания с категорией и содержательным текстом (начисления от ${minLen} символов) / все признания за 90 дней`, value: b1, display: b1 === null ? '—' : pct(b1), status: b1 === null ? 'info' : b1 >= 0.9 ? 'ok' : b1 >= 0.75 ? 'warn' : 'bad', progress: b1 ?? 0 },
    ] },
    { title: 'Награды', items: [
      { code: 'C2', name: 'Старт трат', formula: 'Медиана дней от первого начисления до первой траты', value: c2, display: c2 === null ? '—' : `${Math.round(c2)} дн.`, status: c2 === null ? 'info' : c2 <= 30 ? 'ok' : c2 <= 60 ? 'warn' : 'bad', hint: `${startDelays.length} сотрудников уже потратили` },
      c4,
      { code: 'C5', name: 'Сборы', formula: 'Успешно закрытые сборы / запущенные за год', value: c5, display: c5 === null ? '—' : pct(c5), status: 'info', progress: c5 ?? 0, hint: `${closed.length} из ${launched.length}, ещё идут: ${launched.filter((p) => p.status === 'active').length}` },
      { code: 'C6', name: 'Простой остатков', formula: 'Остатки без движения больше 180 дней / все остатки', value: c6, display: c6 === null ? '—' : pct(c6), status: c6 === null ? 'info' : c6 <= 0.1 ? 'ok' : c6 <= 0.25 ? 'warn' : 'bad', progress: c6 ?? 0, hint: `${idle.length} сотрудников с «замороженным» балансом` },
    ] },
    { title: 'Бюджет', items: [
      { code: 'D5', name: 'Использование фонда', formula: 'Начисленные в квартале РуКоины / фонды руководителей на квартал', value: d5, display: d5 === null ? '—' : pct(d5, 1), baseline: '50,4%', status: d5 === null ? 'info' : d5 >= elapsed * 0.8 ? 'ok' : d5 >= elapsed * 0.5 ? 'warn' : 'bad', progress: d5 ?? 0, hint: `по графику к сегодняшнему дню ≈ ${pct(elapsed)}` },
    ] },
  ];

  return { northStars: [erTree, csiTree, costTree], thresholds, diagnostics };
}

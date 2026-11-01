import type { DB, Pool, Product, ProductCategory, SignalStatus, User, WheelPrize } from './types';
import { DAY, gini, monthStart, quarterEnd, quarterStart, sum, MONTHS_SHORT } from '../lib/utils';

export const userById = (db: DB, id: string) => db.users.find((u) => u.id === id);
export const deptById = (db: DB, id: string) => db.departments.find((d) => d.id === id);
export const deptName = (db: DB, id: string) => (id === 'all' ? 'Весь банк' : deptById(db, id)?.name ?? '—');
export const me = (db: DB) => (db.sessionUserId ? userById(db, db.sessionUserId) ?? null : null);

export const isManager = (u: User) => u.role === 'manager';
export const isAdmin = (u: User) => u.role === 'admin';

/** Команда руководителя: все сотрудники его подразделения, кроме него самого. */
export const teamOf = (db: DB, managerId: string) => {
  const m = userById(db, managerId);
  if (!m) return [];
  return db.users.filter((u) => u.deptId === m.deptId && u.id !== m.id);
};

export const fundOf = (db: DB, managerId: string) => db.settings.managerFunds[managerId] ?? db.settings.quarterFundDefault;

export function accrualsInRange(db: DB, from: number, to: number) {
  return db.accruals.filter((a) => a.ts >= from && a.ts < to);
}

export function managerQuarter(db: DB, managerId: string, now = Date.now()) {
  const qs = quarterStart(now), qe = quarterEnd(now);
  const list = db.accruals.filter((a) => a.managerId === managerId && a.ts >= qs && a.ts < qe);
  const used = sum(list.map((a) => a.amount));
  const fund = fundOf(db, managerId);
  return { list, used, fund, left: Math.max(0, fund - used), qs, qe };
}

export function employeeMonthReceived(db: DB, employeeId: string, now = Date.now()) {
  const ms = monthStart(now);
  return sum(db.accruals.filter((a) => a.employeeId === employeeId && a.ts >= ms).map((a) => a.amount));
}

export const lastRecognition = (db: DB, userId: string) => {
  let t = 0;
  for (const a of db.accruals) if (a.employeeId === userId && a.ts > t) t = a.ts;
  return t;
};

export const poolRaised = (p: Pool) => sum(p.contributions.map((c) => c.amount));
export function charityTotals(db: DB) {
  const fromPools = sum(db.pools.filter((p) => p.kind === 'charity' && p.status !== 'cancelled').map(poolRaised));
  const charityIds = new Set(db.products.filter((p) => p.category === 'charity').map((p) => p.id));
  const fromShop = sum(db.orders.filter((o) => o.status !== 'cancelled').flatMap((o) => o.items.filter((i) => charityIds.has(i.productId)).map((i) => i.price * i.qty)));
  const coins = fromPools + fromShop;
  const rub = coins * db.settings.coinCostRub; // только коины сотрудников, без доплаты банка
  const donors = new Set([...db.pools.filter((p) => p.kind === 'charity').flatMap((p) => p.contributions.map((c) => c.userId)), ...db.orders.filter((o) => o.items.some((i) => charityIds.has(i.productId))).map((o) => o.userId)]).size;
  return { coins, rub, donors };
}
export const poolParticipants = (p: Pool) => new Set(p.contributions.map((c) => c.userId)).size;
export const poolVisibleTo = (p: Pool, u: User) => p.scope === 'all' || p.scope === u.deptId || p.organizerId === u.id;

export const cartOf = (db: DB, userId: string) => db.carts[userId] ?? [];
/** Цена и себестоимость с учётом номинала сертификата (курс как у первого номинала: 1 000 ₽ = 5 000 коинов). */
export const unitPrice = (p: Product, nominal?: number) => (p.nominals?.length && nominal ? Math.round((p.price * nominal) / p.nominals[0]) : p.price);
export const unitCost = (p: Product, nominal?: number) => (p.nominals?.length && nominal ? Math.round((p.costRub * nominal) / p.nominals[0]) : p.costRub);
export const lineTitle = (p: Pick<Product, 'name'>, nominal?: number) => (nominal ? `${p.name}, ${nominal.toLocaleString('ru-RU')} ₽` : p.name);
export const lineKey = (productId: string, nominal?: number) => productId + (nominal ? ':' + nominal : '');

export function cartDetailed(db: DB, userId: string) {
  const lines = cartOf(db, userId)
    .map((l) => ({ ...l, product: db.products.find((p) => p.id === l.productId)! }))
    .filter((l) => l.product)
    .map((l) => ({ ...l, key: lineKey(l.productId, l.nominal), price: unitPrice(l.product, l.nominal), costRub: unitCost(l.product, l.nominal), title: lineTitle(l.product, l.nominal) }));
  const total = sum(lines.map((l) => l.price * l.qty));
  return { lines, total, count: sum(lines.map((l) => l.qty)) };
}

/* ---------------- Рейтинг ---------------- */
export type Period = 'month' | 'quarter' | 'year' | 'all';
export const PERIOD_LABELS: Record<Period, string> = { month: 'Месяц', quarter: 'Квартал', year: 'Год', all: 'Всё время' };
export function periodStart(p: Period, now = Date.now()) {
  if (p === 'month') return monthStart(now);
  if (p === 'quarter') return quarterStart(now);
  if (p === 'year') return new Date(new Date(now).getFullYear(), 0, 1).getTime();
  return 0;
}

export interface RatingRow { user: User; rucoins: number; thanks: number; score: number; place: number }
export const THANKS_WEIGHT = 500;

export function rating(db: DB, opts: { deptId?: string; period: Period }): RatingRow[] {
  const from = periodStart(opts.period);
  const ru = new Map<string, number>();
  const th = new Map<string, number>();
  for (const a of db.accruals) if (a.ts >= from) ru.set(a.employeeId, (ru.get(a.employeeId) ?? 0) + a.amount);
  for (const t of db.thanks) if (t.ts >= from) th.set(t.toId, (th.get(t.toId) ?? 0) + 1);
  const rows = db.users
    .filter((u) => !opts.deptId || opts.deptId === 'all' || u.deptId === opts.deptId)
    .map((u) => {
      const rucoins = ru.get(u.id) ?? 0, thanks = th.get(u.id) ?? 0;
      return { user: u, rucoins, thanks, score: rucoins + thanks * THANKS_WEIGHT, place: 0 };
    })
    .sort((a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name));
  rows.forEach((r, i) => (r.place = i + 1));
  return rows;
}

/* ---------------- KPI руководителя ---------------- */
export function managerKpi(db: DB, managerId: string, now = Date.now()) {
  const team = teamOf(db, managerId);
  const q = managerQuarter(db, managerId, now);
  const byEmp = new Map<string, number>();
  q.list.forEach((a) => byEmp.set(a.employeeId, (byEmp.get(a.employeeId) ?? 0) + a.amount));
  const recognized = team.filter((u) => byEmp.has(u.id)).length;
  const coverage = team.length ? recognized / team.length : 0;
  const g = gini(team.map((u) => byEmp.get(u.id) ?? 0));
  const evenness = q.used ? 1 - g : 0;
  const planPct = q.fund ? q.used / q.fund : 0;
  // Итоговый KPI: выдача плана весит 40%, охват 30%, равномерность 30%. Перевыполнение не добавляет баллов.
  const score = 0.4 * Math.min(1, planPct) + 0.3 * coverage + 0.3 * evenness;
  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); const s = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime(); const e = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
    months.push({ label: MONTHS_SHORT[new Date(s).getMonth()], value: sum(db.accruals.filter((a) => a.managerId === managerId && a.ts >= s && a.ts < e).map((a) => a.amount)) });
  }
  const cats = db.settings.accrualCategories.map((c) => ({ label: c.name, value: sum(q.list.filter((a) => a.categoryId === c.id).map((a) => a.amount)) })).filter((c) => c.value > 0);
  const perEmployee = team
    .map((u) => ({ user: u, amount: byEmp.get(u.id) ?? 0, last: lastRecognition(db, u.id) }))
    .sort((a, b) => b.amount - a.amount);
  return { team, ...q, recognized, coverage, notRecognizedShare: 1 - coverage, gini: g, evenness, planPct, score, months, cats, perEmployee };
}

/** Рекомендация суммы по регламенту для сотрудника. */
export function recommendFor(db: DB, userId: string) {
  const th30 = db.thanks.filter((t) => t.toId === userId && Date.now() - t.ts < 30 * DAY).length;
  const last = lastRecognition(db, userId);
  let v = 2000;
  if (th30 >= 3) v += 1000;
  if (!last || Date.now() - last > 60 * DAY) v += 1000;
  return Math.min(v, db.settings.maxPerAccrual);
}

/* ---------------- Аналитика ---------------- */
export function bucketSeries(points: { ts: number; v: number }[], from: number, to: number, buckets: number) {
  const size = (to - from) / buckets;
  const out = Array.from({ length: buckets }, (_, i) => ({ ts: from + i * size, value: 0 }));
  for (const p of points) {
    if (p.ts < from || p.ts >= to) continue;
    const i = Math.min(buckets - 1, Math.floor((p.ts - from) / size));
    out[i].value += p.v;
  }
  return out;
}

export function analytics(db: DB, days: number, now = Date.now()) {
  const from = now - days * DAY;
  const buckets = days <= 30 ? 15 : days <= 90 ? 13 : 12;
  const employees = db.users;
  const activeIds = new Set(employees.filter((u) => now - u.lastActiveAt < 30 * DAY).map((u) => u.id));
  const participants = new Set<string>();
  db.txs.forEach((t) => { if (t.ts >= from && t.kind !== 'accrual') participants.add(t.userId); });
  db.thanks.forEach((t) => { if (t.ts >= from) participants.add(t.fromId); });

  const acc = db.accruals.filter((a) => a.ts >= from);
  const spentTx = db.txs.filter((t) => t.ts >= from && t.currency === 'coins' && t.amount < 0);
  const refunds = db.txs.filter((t) => t.ts >= from && t.kind === 'refund');
  const spentCoins = sum(spentTx.map((t) => -t.amount)) - sum(refunds.map((t) => t.amount));
  const coinsLeft = sum(employees.map((u) => u.coins));
  const ruLeft = sum(employees.map((u) => u.rucoins));

  const series = {
    accruals: bucketSeries(acc.map((a) => ({ ts: a.ts, v: a.amount })), from, now, buckets),
    conversions: bucketSeries(db.conversions.map((c) => ({ ts: c.ts, v: c.rucoins })), from, now, buckets),
    spending: bucketSeries(spentTx.map((t) => ({ ts: t.ts, v: -t.amount })), from, now, buckets),
    orders: bucketSeries(db.orders.filter((o) => o.status !== 'cancelled').map((o) => ({ ts: o.ts, v: 1 })), from, now, buckets),
    thanks: bucketSeries(db.thanks.map((t) => ({ ts: t.ts, v: 1 })), from, now, buckets),
    pools: bucketSeries(db.pools.flatMap((p) => p.contributions.map((c) => ({ ts: c.ts, v: c.amount }))), from, now, buckets),
  };

  // Вовлечённость по подразделениям
  const depts = db.departments.map((d) => {
    const members = employees.filter((u) => u.deptId === d.id);
    const active = members.filter((u) => participants.has(u.id)).length;
    return { dept: d, members: members.length, active, share: members.length ? active / members.length : 0 };
  }).sort((a, b) => b.share - a.share);
  const thanksSent = db.thanks.filter((t) => t.ts >= from).length;
  const spentAtLeastOne = new Set(spentTx.map((t) => t.userId)).size;
  const senders = new Set(db.thanks.filter((t) => t.ts >= from).map((t) => t.fromId));
  const receivers = new Set(db.thanks.filter((t) => t.ts >= from).map((t) => t.toId));

  // Контроль начислений
  const managers = employees.filter((u) => u.role === 'manager');
  const byManager = managers.map((m) => {
    const k = managerKpi(db, m.id, now);
    const inPeriod = acc.filter((a) => a.managerId === m.id);
    return { manager: m, amount: sum(inPeriod.map((a) => a.amount)), count: inPeriod.length, kpi: k, avg: inPeriod.length ? sum(inPeriod.map((a) => a.amount)) / inPeriod.length : 0 };
  });
  const byDept = db.departments.map((d) => ({ dept: d, amount: sum(acc.filter((a) => userById(db, a.employeeId)?.deptId === d.id).map((a) => a.amount)) }));
  const perEmployee = new Map<string, number>();
  acc.forEach((a) => perEmployee.set(a.employeeId, (perEmployee.get(a.employeeId) ?? 0) + a.amount));
  const avgPerEmployee = employees.length ? sum(acc.map((a) => a.amount)) / employees.length : 0;
  const giniAll = gini(employees.map((u) => perEmployee.get(u.id) ?? 0));
  const neverRecognized = employees.filter((u) => u.role !== 'admin' && !db.accruals.some((a) => a.employeeId === u.id)).length;
  const avgPer = avgPerEmployee || 1;
  const disproportionate = employees.filter((u) => (perEmployee.get(u.id) ?? 0) > avgPer * 3).map((u) => ({ user: u, amount: perEmployee.get(u.id)! }));

  // Финансы
  const okOrders = db.orders.filter((o) => o.status !== 'cancelled');
  const ordersInPeriod = okOrders.filter((o) => o.ts >= from);
  const shopOrders = ordersInPeriod.filter((o) => !o.wheel);
  const spinsInPeriod = db.txs.filter((t) => t.kind === 'wheel' && t.ts >= from).length;
  const ordersCostRub = sum(ordersInPeriod.flatMap((o) => o.items.map((i) => i.costRub * i.qty)));
  const popular = new Map<string, { name: string; qty: number; coins: number }>();
  shopOrders.forEach((o) => o.items.forEach((i) => {
    const p = popular.get(i.productId) ?? { name: i.name, qty: 0, coins: 0 };
    p.qty += i.qty; p.coins += i.price * i.qty; popular.set(i.productId, p);
  }));
  const pending = db.orders.filter((o) => o.status === 'new' || o.status === 'processing');
  const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
  const ytdSpentRub = sum(okOrders.filter((o) => o.ts >= yearStart).flatMap((o) => o.items.map((i) => i.costRub * i.qty)));
  const ytdShare = (now - yearStart) / (365 * DAY);
  const budgetPlanToDate = db.settings.budgetRub * ytdShare;
  const csiList = db.orders.filter((o) => o.csi).map((o) => o.csi!);
  const savers = employees.filter((u) => u.coins > 0 && !db.txs.some((t) => t.userId === u.id && t.currency === 'coins' && t.amount < 0 && now - t.ts < 90 * DAY)).length;

  // HR: фонды руководителей
  const allocated = sum(managers.map((m) => fundOf(db, m.id)));
  const usedQ = sum(byManager.map((b) => b.kpi.used));
  const qs = quarterStart(now), qe = quarterEnd(now);
  const elapsed = Math.max(0.05, (now - qs) / (qe - qs));
  const forecast = usedQ / elapsed;
  const unusedManagers = byManager.filter((b) => b.kpi.planPct < 0.4).length;

  return {
    from, now, days,
    stats: {
      employees: employees.length,
      active: activeIds.size,
      participationShare: employees.length ? participants.size / employees.length : 0,
      accruedTotal: sum(acc.map((a) => a.amount)),
      spentCoins,
      coinsLeft,
      ruLeft,
    },
    series,
    engagement: {
      depts,
      nonUsersShare: employees.length ? 1 - participants.size / employees.length : 0,
      thanksSent,
      thanksPerEmployee: employees.length ? thanksSent / employees.length : 0,
      sendersShare: employees.length ? senders.size / employees.length : 0,
      receiversShare: employees.length ? receivers.size / employees.length : 0,
      spentAtLeastOne,
    },
    control: { byManager, byDept, avgPerEmployee, gini: giniAll, neverRecognizedShare: employees.length ? neverRecognized / employees.length : 0, disproportionate },
    finance: {
      liabilityRub: (coinsLeft + ruLeft * db.settings.conversionRate) * db.settings.coinCostRub,
      ordersCostRub,
      popular: [...popular.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
      avgOrder: shopOrders.length ? sum(shopOrders.map((o) => o.total)) / shopOrders.length : 0,
      spins: spinsInPeriod,
      wheelCostRub: sum(ordersInPeriod.filter((o) => o.wheel).flatMap((o) => o.items.map((i) => i.costRub))),
      pending: pending.length,
      ytdSpentRub,
      budgetPlanToDate,
      budgetUse: budgetPlanToDate ? ytdSpentRub / budgetPlanToDate : 0,
      csi: csiList.length ? sum(csiList) / csiList.length : 0,
      csiCount: csiList.length,
      savers,
      saversShare: employees.length ? savers / employees.length : 0,
    },
    funds: { allocated, usedQ, usedShare: allocated ? usedQ / allocated : 0, forecast, forecastShare: allocated ? forecast / allocated : 0, unusedManagers, unusedShare: managers.length ? unusedManagers / managers.length : 0 },
  };
}

/* ---------------- Подозрительные сценарии ---------------- */
export type Risk = 'high' | 'medium' | 'low';
export const RISK_LABELS: Record<Risk, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
export interface Signal { id: string; type: string; risk: Risk; date: number; participants: string[]; description: string; status: SignalStatus }

export function signals(db: DB, now = Date.now()): Signal[] {
  const out: Omit<Signal, 'status'>[] = [];
  const name = (id: string) => userById(db, id)?.name ?? id;
  const managers = db.users.filter((u) => u.role === 'manager');
  const qs = quarterStart(now);

  for (const m of managers) {
    const recent = db.accruals.filter((a) => a.managerId === m.id && now - a.ts < 30 * DAY);
    // 1. Аномально частые начисления одному сотруднику
    const cnt = new Map<string, number>();
    recent.forEach((a) => cnt.set(a.employeeId, (cnt.get(a.employeeId) ?? 0) + 1));
    cnt.forEach((c, e) => {
      if (c >= 5) out.push({ id: `freq:${m.id}:${e}`, type: 'Аномально частые начисления', risk: c >= 8 ? 'high' : 'medium', date: Math.max(...recent.filter((a) => a.employeeId === e).map((a) => a.ts)), participants: [m.id, e], description: `${name(m.id)} начислил(а) ${name(e)} РуКоины ${c} раз за 30 дней.` });
    });
    // 2. Концентрация у ограниченной группы
    const k = managerKpi(db, m.id, now);
    if (k.used > 0 && k.team.length >= 4) {
      const top = k.perEmployee.slice(0, Math.max(1, Math.round(k.team.length * 0.2)));
      const share = sum(top.map((t) => t.amount)) / k.used;
      if (share > 0.55) out.push({ id: `conc:${m.id}:${qs}`, type: 'Концентрация начислений', risk: share > 0.7 ? 'high' : 'medium', date: Math.max(...k.list.map((a) => a.ts)), participants: [m.id, ...top.map((t) => t.user.id)], description: `${Math.round(share * 100)}% РуКоинов квартала у ${name(m.id)} получили ${top.map((t) => t.user.name).join(', ')}.` });
    }
    // 4. Начисления перед окончанием отчётного периода (прошлый квартал)
    const pqs = quarterStart(qs - DAY);
    const pq = db.accruals.filter((a) => a.managerId === m.id && a.ts >= pqs && a.ts < qs);
    const tail = pq.filter((a) => a.ts >= qs - 5 * DAY);
    const pqSum = sum(pq.map((a) => a.amount));
    if (pqSum > 0 && sum(tail.map((a) => a.amount)) / pqSum > 0.4) out.push({ id: `eop:${m.id}:${pqs}`, type: 'Начисления перед концом периода', risk: 'medium', date: Math.max(...tail.map((a) => a.ts)), participants: [m.id, ...new Set(tail.map((a) => a.employeeId))], description: `${name(m.id)}: ${Math.round(sum(tail.map((a) => a.amount)) / pqSum * 100)}% начислений прошлого квартала выдано за последние 5 дней.` });
    // 5. Резкий рост
    const prev = db.accruals.filter((a) => a.managerId === m.id && a.ts >= now - 120 * DAY && a.ts < now - 30 * DAY);
    const prevAvg = sum(prev.map((a) => a.amount)) / 3;
    const cur = sum(recent.map((a) => a.amount));
    if (prevAvg > 0 && cur > prevAvg * 2) out.push({ id: `grow:${m.id}:${Math.floor(now / (7 * DAY))}`, type: 'Резкий рост начислений', risk: 'medium', date: Math.max(...recent.map((a) => a.ts)), participants: [m.id], description: `За 30 дней ${name(m.id)} начислил(а) ${Math.round(cur).toLocaleString('ru-RU')}, это в ${(cur / prevAvg).toFixed(1).replace('.', ',')} раза больше среднего за прошлые месяцы.` });
    // 6. Много начислений одинакового размера
    const last60 = db.accruals.filter((a) => a.managerId === m.id && now - a.ts < 60 * DAY);
    const sizes = new Map<number, number>();
    last60.forEach((a) => sizes.set(a.amount, (sizes.get(a.amount) ?? 0) + 1));
    sizes.forEach((c, amt) => {
      if (c >= 5 && c / last60.length > 0.6) out.push({ id: `same:${m.id}:${amt}`, type: 'Одинаковые суммы', risk: 'low', date: Math.max(...last60.filter((a) => a.amount === amt).map((a) => a.ts)), participants: [m.id], description: `${c} из ${last60.length} начислений за 60 дней на одну сумму: ${amt.toLocaleString('ru-RU')} РуКоинов.` });
    });
    // Неиспользованный фонд
    if ((now - qs) / (quarterEnd(now) - qs) > 0.25 && k.planPct < 0.5 * (now - qs) / (quarterEnd(now) - qs)) out.push({ id: `unused:${m.id}:${qs}`, type: 'Неиспользованный бюджет', risk: 'low', date: now, participants: [m.id], description: `${name(m.id)} выдал(а) ${Math.round(k.planPct * 100)}% квартального фонда, прошло ${Math.round((now - qs) / (quarterEnd(now) - qs) * 100)}% квартала.` });
  }

  // 3. Взаимные благодарности
  const pairs = new Map<string, number>();
  db.thanks.filter((t) => now - t.ts < 30 * DAY).forEach((t) => pairs.set(`${t.fromId}>${t.toId}`, (pairs.get(`${t.fromId}>${t.toId}`) ?? 0) + 1));
  const seen = new Set<string>();
  pairs.forEach((c, key) => {
    const [a, b] = key.split('>');
    const back = pairs.get(`${b}>${a}`) ?? 0;
    const pk = [a, b].sort().join('~');
    if (c >= 3 && back >= 3 && !seen.has(pk)) {
      seen.add(pk);
      const last = Math.max(...db.thanks.filter((t) => (t.fromId === a && t.toId === b) || (t.fromId === b && t.toId === a)).map((t) => t.ts));
      out.push({ id: `mutual:${pk}`, type: 'Взаимные благодарности', risk: c + back >= 10 ? 'high' : 'medium', date: last, participants: [a, b], description: `${name(a)} и ${name(b)} за 30 дней благодарят друг друга ${c} и ${back} раз. Рейтинг обоих может быть завышен.` });
    }
  });

  // 7. Без обоснования
  db.accruals.filter((a) => a.comment.trim().length < db.settings.minCommentLength).forEach((a) => out.push({ id: `nojust:${a.id}`, type: 'Начисление без обоснования', risk: 'low', date: a.ts, participants: [a.managerId, a.employeeId], description: `Комментарий «${a.comment}» не объясняет вклад. Сумма ${a.amount.toLocaleString('ru-RU')}.` }));

  // 8. Превышение лимитов
  const monthly = new Map<string, number>();
  db.accruals.forEach((a) => { const k = `${a.employeeId}:${monthStart(a.ts)}`; monthly.set(k, (monthly.get(k) ?? 0) + a.amount); });
  monthly.forEach((v, k) => {
    if (v > db.settings.maxPerEmployeeMonth) {
      const [e, ms] = k.split(':');
      const list = db.accruals.filter((a) => a.employeeId === e && monthStart(a.ts) === +ms);
      out.push({ id: `limit:${k}`, type: 'Превышение лимита', risk: 'high', date: Math.max(...list.map((a) => a.ts)), participants: [...new Set(list.map((a) => a.managerId)), e], description: `${name(e)} получил(а) ${v.toLocaleString('ru-RU')} РуКоинов за месяц при лимите ${db.settings.maxPerEmployeeMonth.toLocaleString('ru-RU')}.` });
    }
  });

  const order: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
  return out
    .map((s) => ({ ...s, status: db.signalStatus[s.id] ?? 'new' }))
    .sort((a, b) => order[a.risk] - order[b.risk] || b.date - a.date);
}

/* ---------------- Питомец ---------------- */
/** Каждый уровень питомца открывает новую витрину магазина. Сертификаты, самые дорогие для банка, открываются последними. */
export const PET_LEVELS = [
  { xp: 0, title: 'Малыш', perk: 'Мерч компании: стикеры, блокноты, наборы для питомцев' },
  { xp: 1500, title: 'Непоседа', perk: 'Игрушки ОТуПик и аксессуары' },
  { xp: 4000, title: 'Подросток', perk: 'Одежда' },
  { xp: 8000, title: 'Знаток', perk: 'Электроника' },
  { xp: 13000, title: 'Мастер', perk: 'Впечатления' },
  { xp: 20000, title: 'Легенда', perk: 'Сертификаты' },
];
export const petLevel = (xp: number) => PET_LEVELS.reduce((l, L, i) => (xp >= L.xp ? i + 1 : l), 1);
export const CATEGORY_LEVEL: Record<ProductCategory, number> = { perks: 1, charity: 1, merch: 1, accessories: 2, clothes: 3, electronics: 4, experiences: 5, certificates: 6 };
export const productLevel = (p: Pick<Product, 'category' | 'minLevel'>) => p.minLevel ?? CATEGORY_LEVEL[p.category];
export const isUnlocked = (p: Pick<Product, 'category' | 'minLevel'>, xp: number) => petLevel(xp) >= productLevel(p);

/* ---------------- Колесо удачи ---------------- */
/** Выбирает приз по вероятностям: rnd от 0 до 1. */
export function pickPrize(prizes: WheelPrize[], rnd: number): WheelPrize {
  const total = prizes.reduce((a, p) => a + p.prob, 0);
  let x = rnd * total;
  for (const p of prizes) { x -= p.prob; if (x <= 0) return p; }
  return prizes[prizes.length - 1];
}
export function spinsThisMonth(db: DB, userId: string, now = Date.now()) {
  const ms = monthStart(now);
  return db.txs.filter((t) => t.userId === userId && t.kind === 'wheel' && t.ts >= ms).length;
}
/** Экономика колеса: ожидаемая себестоимость прокрутки и чистое списание коинов. */
export function wheelEconomics(db: DB) {
  const s = db.settings;
  const total = s.wheelPrizes.reduce((a, p) => a + p.prob, 0) || 1;
  const expCost = s.wheelPrizes.reduce((a, p) => a + (p.prob / total) * p.costRub, 0);
  const expBack = s.wheelPrizes.reduce((a, p) => a + (p.prob / total) * (p.coins ?? 0), 0);
  const netCoins = s.spinPrice - expBack;
  return { expCost, expBack, netCoins, nominalRub: netCoins * s.coinCostRub, costPerCoin: netCoins ? expCost / netCoins : 0, probSum: total };
}

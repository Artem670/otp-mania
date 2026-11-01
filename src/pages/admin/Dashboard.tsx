import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { analytics, RISK_LABELS, signals, userById } from '../../data/selectors';
import { fmt, fmtDate, fmtNum, fmtPct, fmtRub, MONTHS_SHORT } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Coin, PageHeader, PageSkeleton, Progress, Seg, Stat, usePageLoading } from '../../components/ui';
import { Donut, HBars, LineChart } from '../../components/charts';
import { Activity, Coins, ShieldAlert, Users, Wallet, Package, Heart, TrendingUp, Alert } from '../../components/icons';
import { useRouter } from '../../lib/router';

type Metric = 'accruals' | 'conversions' | 'spending' | 'orders' | 'thanks' | 'pools';
const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: 'accruals', label: 'Начисления РуКоинов', unit: 'РуКоинов' },
  { value: 'conversions', label: 'Конвертация', unit: 'РуКоинов' },
  { value: 'spending', label: 'Траты коинов', unit: 'коинов' },
  { value: 'orders', label: 'Покупки', unit: 'заказов' },
  { value: 'thanks', label: 'Благодарности', unit: 'шт.' },
  { value: 'pools', label: 'Сборы', unit: 'коинов' },
];

export default function Dashboard() {
  const db = useDB();
  const { navigate } = useRouter();
  const [days, setDays] = useState<'30' | '90' | '365'>('90');
  const [metric, setMetric] = useState<Metric>('accruals');
  const loading = usePageLoading('dash' + days, 400);
  const a = useMemo(() => analytics(db, Number(days)), [db, days]);
  const sig = useMemo(() => signals(db), [db]);
  if (loading) return <PageSkeleton />;

  const labels = a.series.accruals.map((p) => {
    const d = new Date(p.ts);
    return Number(days) > 120 ? MONTHS_SHORT[d.getMonth()] : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  });
  const m = METRICS.find((x) => x.value === metric)!;
  const newSig = sig.filter((s) => s.status === 'new');
  const managers = [...a.control.byManager].sort((x, y) => y.kpi.score - x.kpi.score);

  return (
    <div className="stack-24">
      <PageHeader title="Аналитика программы" crumbs="Администрирование" subtitle="Ключевые показатели ОТП Мания: вовлечённость, начисления, бюджет и сигналы для проверки."
        actions={<Seg value={days} onChange={setDays} ariaLabel="Период" options={[{ value: '30', label: '30 дней' }, { value: '90', label: '90 дней' }, { value: '365', label: 'Год' }]} />} />

      {/* Блок 1 */}
      <div className="grid g4">
        <Stat icon={Users} label="Сотрудников" value={a.stats.employees} hint={`активны за 30 дней: ${a.stats.active}`} />
        <Stat icon={Activity} label="Участвуют в программе" value={fmtPct(a.stats.participationShare)} hint="тратили, конвертировали или благодарили" />
        <Stat icon={Coins} label="Начислено РуКоинов" value={fmt(a.stats.accruedTotal)} hint={`за ${days === '365' ? 'год' : days + ' дней'}`} />
        <Stat icon={Wallet} label="Потрачено коинов" value={fmt(a.stats.spentCoins)} hint={`остаток в системе: ${fmt(a.stats.coinsLeft)} коинов и ${fmt(a.stats.ruLeft)} РуКоинов`} />
      </div>

      {/* Блок 2 */}
      <Card title="Динамика программы" subtitle={`${m.label}, ${m.unit}`} action={<select className="select" style={{ width: 230 }} value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Показатель">{METRICS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>}>
        <LineChart labels={labels} series={[{ name: m.label, color: metric === 'thanks' || metric === 'pools' ? '#9e6fc3' : '#16161a', data: a.series[metric].map((p) => p.value) }]} format={(v) => `${fmt(v)} ${m.unit}`} />
        <div className="grid g3 mt-16" style={{ gap: 12 }}>
          {METRICS.filter((x) => x.value !== metric).slice(0, 3).map((x) => (
            <button key={x.value} className="card soft pad-sm" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setMetric(x.value)}>
              <div className="xs muted">{x.label}</div>
              <div className="strong num mt-4">{fmt(a.series[x.value].reduce((s, p) => s + p.value, 0))} <span className="xs muted">{x.unit}</span></div>
              <LineChart labels={labels} series={[{ name: x.label, color: '#8a8a96', data: a.series[x.value].map((p) => p.value) }]} height={70} />
            </button>
          ))}
        </div>
      </Card>

      {/* Блок 3 */}
      <div className="grid g-main">
        <Card title="Вовлечённость по подразделениям" subtitle="Доля сотрудников, которые пользуются системой">
          <HBars data={a.engagement.depts.map((d) => ({ label: d.dept.name, value: Math.round(d.share * 100), sub: `${d.active}/${d.members}` }))} format={(v) => `${v}%`} />
          <div className="grid g2 mt-16" style={{ gap: 10 }}>
            <div className="card soft pad-sm"><div className="xs muted">Самые активные</div><b className="small">{a.engagement.depts.slice(0, 2).map((d) => d.dept.name).join(', ')}</b></div>
            <div className="card soft pad-sm"><div className="xs muted">Низкая активность</div><b className="small">{a.engagement.depts.slice(-2).map((d) => d.dept.name).join(', ')}</b></div>
          </div>
        </Card>
        <Card title="Активность сотрудников">
          <div className="col" style={{ gap: 12 }}>
            {[
              ['Не пользуются системой', fmtPct(a.engagement.nonUsersShare)],
              ['Отправили благодарность', fmtPct(a.engagement.sendersShare)],
              ['Получили благодарность', fmtPct(a.engagement.receiversShare)],
              ['Благодарностей за период', `${a.engagement.thanksSent} (${fmtNum(a.engagement.thanksPerEmployee, 1)} на чел.)`],
              ['Потратили хотя бы один коин', `${a.engagement.spentAtLeastOne} чел.`],
              ['Ни разу не получали РуКоины', fmtPct(a.control.neverRecognizedShare)],
              ['Копят, но не тратят 90 дней', fmtPct(a.finance.saversShare)],
            ].map(([k, v]) => <div key={k} className="row between small"><span className="muted">{k}</span><b className="num">{v}</b></div>)}
          </div>
        </Card>
      </div>

      {/* Бюджет РуКоинов (HR) */}
      <div className="grid g4">
        <Stat label="Выделено руководителям" value={<>{fmt(a.funds.allocated)} <Coin ru /></>} hint="фонды на квартал" tone="dark" />
        <Stat label="Начислено в квартале" value={fmtPct(a.funds.usedShare)} hint={`${fmt(a.funds.usedQ)} РуКоинов`} />
        <Stat label="Прогноз на конец квартала" value={fmtPct(a.funds.forecastShare)} hint={`≈ ${fmt(a.funds.forecast)} при текущем темпе`} />
        <Stat label="Руководители с фондом < 40%" value={fmtPct(a.funds.unusedShare)} hint={`${a.funds.unusedManagers} из ${a.control.byManager.length}`} />
      </div>

      {/* Блок 4 */}
      <div className="stack-16">
        <Card title="Контроль начислений по руководителям" subtitle="Остаток фонда, охват, равномерность и итоговый KPI" className="pad-0">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Руководитель</th><th className="right">Начислено</th><th className="right">Остаток</th><th className="right">Средний размер</th><th className="right">Охват</th><th className="right">Равномерность</th><th className="right">KPI</th></tr></thead>
              <tbody>
                {managers.map((b) => (
                  <tr key={b.manager.id}>
                    <td><div className="row-sm"><Avatar user={b.manager} size={28} /><div><div className="small strong">{b.manager.name}</div><div className="xs muted">{db.departments.find((d) => d.id === b.manager.deptId)?.name}</div></div></div></td>
                    <td className="right num">{fmt(b.amount)}</td>
                    <td className="right num">{fmt(b.kpi.left)}</td>
                    <td className="right num">{fmt(b.avg)}</td>
                    <td className="right num">{b.kpi.recognized}/{b.kpi.team.length}</td>
                    <td className="right"><Badge tone={b.kpi.evenness >= 0.6 ? 'green' : 'red'}>{fmtNum(b.kpi.evenness)}</Badge></td>
                    <td className="right strong num">{Math.round(b.kpi.score * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Распределение начислений по подразделениям">
          <Donut data={a.control.byDept.filter((d) => d.amount > 0).map((d) => ({ label: d.dept.name, value: d.amount }))} center={<div><div className="strong num">{fmt(a.stats.accruedTotal)}</div><div className="xs muted">РуКоинов</div></div>} />
          <div className="col mt-16" style={{ gap: 8 }}>
            <div className="row between small"><span className="muted">Среднее на сотрудника</span><b className="num">{fmt(a.control.avgPerEmployee)}</b></div>
            <div className="row between small"><span className="muted">Неравномерность (Джини)</span><b className="num">{fmtNum(a.control.gini)}</b></div>
            {a.control.disproportionate.length > 0 && <div className="alert warn small"><Alert size={16} /><span>Получают в 3+ раза больше среднего: {a.control.disproportionate.map((d) => d.user.name).join(', ')}</span></div>}
          </div>
        </Card>
      </div>

      {/* Блок 5 */}
      <div className="grid g4">
        <Stat icon={Wallet} label="Обязательства по коинам" value={fmtRub(a.finance.liabilityRub)} hint={`по ${fmtNum(db.settings.coinCostRub)} ₽ за коин`} />
        <Stat icon={Package} label="Стоимость заказов" value={fmtRub(a.finance.ordersCostRub)} hint={`средний заказ ${fmt(a.finance.avgOrder)} коинов`} />
        <Stat label="Незавершённые заказы" value={a.finance.pending} hint={`колесо удачи: ${a.finance.spins} прокруток, призы на ${fmtRub(a.finance.wheelCostRub)}`} />
        <Stat icon={Heart} label="CSI наград" value={a.finance.csi ? `${fmtNum(a.finance.csi, 1)} из 5` : '—'} hint={`${a.finance.csiCount} оценок`} />
      </div>
      <div className="grid g2">
        <Card title="Использование бюджета" subtitle={`Годовой бюджет ${fmtRub(db.settings.budgetRub)}`}>
          <div className="row between small mb-8"><span>Потрачено с начала года</span><b className="num">{fmtRub(a.finance.ytdSpentRub)}</b></div>
          <Progress value={a.finance.ytdSpentRub / db.settings.budgetRub} tone="orange" label="Использование бюджета" />
          <div className="row between small mt-12"><span className="muted">План на сегодня</span><span className="num">{fmtRub(a.finance.budgetPlanToDate)}</span></div>
          <div className="row between small mt-4"><span className="muted">Эффективность использования</span><b className="num">{fmtPct(a.finance.budgetUse)} от плана</b></div>
          <div className="alert small mt-16"><TrendingUp size={16} />Чем больше трат уходит на питомца, нематериальные награды и сборы, тем меньше реальных расходов на один коин.</div>
        </Card>
        <Card title="Самые популярные товары" subtitle="За выбранный период">
          {a.finance.popular.length ? <HBars data={a.finance.popular.map((p) => ({ label: p.name, value: p.qty, sub: 'шт.' }))} color="#9e6fc3" /> : <p className="small muted">Покупок за период не было</p>}
        </Card>
      </div>

      {/* Блок 6 */}
      <Card title="Подозрительные сценарии" subtitle="Паттерны для проверки, а не обвинения" action={<Button size="sm" variant="secondary" icon={ShieldAlert} onClick={() => navigate('/admin/signals')}>Все сигналы · {newSig.length} новых</Button>}>
        {sig.slice(0, 4).map((s) => (
          <div key={s.id} className="op" style={{ gridTemplateColumns: '10px 1fr auto' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.risk === 'high' ? 'var(--red)' : s.risk === 'medium' ? 'var(--orange)' : 'var(--muted)' }} />
            <div><div className="small strong">{s.type}</div><div className="xs muted">{s.description}</div></div>
            <div style={{ textAlign: 'right' }}><Badge tone={s.risk === 'high' ? 'red' : s.risk === 'medium' ? 'orange' : undefined}>{RISK_LABELS[s.risk]}</Badge><div className="xs muted mt-4">{fmtDate(s.date)}</div></div>
          </div>
        ))}
        {!sig.length && <p className="small muted">Сигналов нет</p>}
        <div className="xs muted mt-8">Участники: {[...new Set(sig.slice(0, 4).flatMap((s) => s.participants))].map((id) => userById(db, id)?.name).filter(Boolean).join(', ')}</div>
      </Card>
    </div>
  );
}

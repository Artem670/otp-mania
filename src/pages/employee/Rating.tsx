import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { deptName, me as selectMe, PERIOD_LABELS, rating, THANKS_WEIGHT, type Period, type RatingRow } from '../../data/selectors';
import { fmt } from '../../lib/utils';
import { Avatar, Card, Coin, Empty, PageHeader, PageSkeleton, Seg, Stat, usePageLoading } from '../../components/ui';
import { Crown, Heart, Trophy, Info } from '../../components/icons';
import { useRouter } from '../../lib/router';

export default function Rating() {
  const db = useDB();
  const u = selectMe(db)!;
  const { navigate } = useRouter();
  const [period, setPeriod] = useState<Period>('quarter');
  const [dept, setDept] = useState<string>('all');
  const loading = usePageLoading('rating:' + period + dept, 250);
  const rows = useMemo(() => rating(db, { period, deptId: dept }), [db, period, dept]);
  const mine = rows.find((r) => r.user.id === u.id);
  const top = rows.slice(0, 10);
  const scored = rows.filter((r) => r.score > 0);

  const Row = ({ r }: { r: RatingRow }) => (
    <tr className={r.user.id === u.id ? 'me-row clickable' : 'clickable'} onClick={() => navigate(`/employees/${r.user.id}`)}>
      <td className="strong num" style={{ width: 56 }}>{r.place}</td>
      <td><div className="row-sm"><Avatar user={r.user} size={32} /><div><div className="strong">{r.user.name}{r.user.id === u.id && <span className="muted"> (вы)</span>}</div><div className="xs muted">{r.user.title}</div></div></div></td>
      <td className="muted small">{deptName(db, r.user.deptId)}</td>
      <td className="right num">{fmt(r.rucoins)} <Coin ru /></td>
      <td className="right num">{r.thanks}</td>
      <td className="right num strong">{fmt(r.score)}</td>
    </tr>
  );

  return (
    <div className="stack-24">
      <PageHeader title="Рейтинг сотрудников" subtitle={`Баллы = полученные РуКоины + ${THANKS_WEIGHT} за каждую благодарность коллег.`}
        actions={<>
          <select className="select" style={{ width: 240 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Подразделение">
            <option value="all">Все подразделения</option>
            {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Seg value={period} onChange={setPeriod} ariaLabel="Период" options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))} />
        </>} />
      {loading ? <PageSkeleton /> : !scored.length ? (
        <div className="card"><Empty icon={Trophy} title="За этот период пока нет признания" text="Выберите другой период или подразделение." /></div>
      ) : (
        <>
          <div className="grid g4">
            <Stat icon={Trophy} label="Ваше место" value={mine ? `${mine.place} из ${rows.length}` : 'не в выборке'} hint={dept === 'all' ? 'по всему банку' : deptName(db, dept)} tone="dark" />
            <Stat label="Ваши РуКоины" value={<>{fmt(mine?.rucoins ?? 0)} <Coin ru /></>} hint={PERIOD_LABELS[period].toLowerCase()} />
            <Stat icon={Heart} label="Ваши благодарности" value={mine?.thanks ?? 0} hint="получено за период" />
            <Stat label="До следующего места" value={mine && mine.place > 1 ? fmt(rows[mine.place - 2].score - mine.score + 1) : '—'} hint={mine && mine.place > 1 ? 'баллов' : 'вы лидер!'} />
          </div>
          <div className="podium">
            {[1, 0, 2].map((i) => {
              const r = rows[i];
              if (!r || r.score === 0) return <div key={i} />;
              return (
                <div key={i} className={`podium-item p${i + 1}`}>
                  <div className="podium-place">{i === 0 ? <Crown size={16} /> : i + 1}</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar user={r.user} size={i === 0 ? 72 : 58} /></div>
                  <div className="strong mt-12">{r.user.name}</div>
                  <div className="xs muted">{deptName(db, r.user.deptId)}</div>
                  <div className="mt-12" style={{ fontSize: i === 0 ? 26 : 20, fontWeight: 700 }}>{fmt(r.score)}</div>
                  <div className="xs muted">{fmt(r.rucoins)} РуКоинов · {r.thanks} благодарностей</div>
                </div>
              );
            })}
          </div>
          <Card className="pad-0" >
            <div className="card-head" style={{ padding: '18px 18px 0' }}><h3>ТОП-10</h3><span className="xs muted row-sm"><Info size={13} />Нажмите на строку, чтобы открыть профиль</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Место</th><th>Сотрудник</th><th>Подразделение</th><th className="right">РуКоины</th><th className="right">Благодарности</th><th className="right">Баллы</th></tr></thead>
                <tbody>
                  {top.map((r) => <Row key={r.user.id} r={r} />)}
                  {mine && mine.place > 10 && <><tr><td colSpan={6} className="muted small" style={{ textAlign: 'center', padding: 6 }}>···</td></tr><Row r={mine} /></>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="pad-0">
            <div className="card-head" style={{ padding: '18px 18px 0' }}><div><h3>Общий рейтинг</h3><p>Места с 11-го, всего {rows.length} сотрудников</p></div></div>
            <div className="table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
              <table className="table"><tbody>{rows.slice(10).map((r) => <Row key={r.user.id} r={r} />)}</tbody></table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

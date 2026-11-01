import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { RISK_LABELS, signals, userById, type Risk } from '../../data/selectors';
import { SIGNAL_STATUS_LABELS, type SignalStatus } from '../../data/types';
import { fmtDate } from '../../lib/utils';
import { Avatar, Badge, Card, Empty, PageHeader, PageSkeleton, Seg, Stat, useAction, usePageLoading } from '../../components/ui';
import { ShieldAlert, Info } from '../../components/icons';

export default function Signals() {
  const db = useDB();
  const loading = usePageLoading('signals');
  const [status, setStatus] = useState<SignalStatus | 'all'>('all');
  const [risk, setRisk] = useState<Risk | 'all'>('all');
  const { run } = useAction();
  const all = useMemo(() => signals(db), [db]);
  const list = all.filter((s) => (status === 'all' || s.status === status) && (risk === 'all' || s.risk === risk));
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Подозрительные сценарии" crumbs="Администрирование" subtitle="Система ищет паттерны и отправляет их на проверку. Сигнал не означает нарушение: решение принимает администратор." />
      <div className="grid g4">
        <Stat label="Всего сигналов" value={all.length} tone="dark" />
        <Stat label="Высокий риск" value={all.filter((s) => s.risk === 'high').length} />
        <Stat label="Ждут проверки" value={all.filter((s) => s.status === 'new' || s.status === 'review').length} />
        <Stat label="Признаны нормой" value={all.filter((s) => s.status === 'dismissed').length} />
      </div>
      <div className="row row-wrap between">
        <Seg value={status} onChange={setStatus} ariaLabel="Статус" options={[{ value: 'all', label: 'Все' }, ...(Object.keys(SIGNAL_STATUS_LABELS) as SignalStatus[]).map((s) => ({ value: s, label: SIGNAL_STATUS_LABELS[s] }))]} />
        <Seg value={risk} onChange={setRisk} ariaLabel="Риск" options={[{ value: 'all', label: 'Любой риск' }, { value: 'high', label: 'Высокий' }, { value: 'medium', label: 'Средний' }, { value: 'low', label: 'Низкий' }]} />
      </div>
      {list.length ? (
        <Card className="pad-0">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Тип</th><th>Риск</th><th>Дата</th><th>Участники</th><th>Описание</th><th>Статус проверки</th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} data-testid="signal-row">
                    <td className="strong small" style={{ minWidth: 170 }}>{s.type}</td>
                    <td><Badge tone={s.risk === 'high' ? 'red' : s.risk === 'medium' ? 'orange' : undefined}>{RISK_LABELS[s.risk]}</Badge></td>
                    <td className="small nowrap muted">{fmtDate(s.date)}</td>
                    <td style={{ minWidth: 160 }}>
                      <div className="col" style={{ gap: 4 }}>
                        {s.participants.slice(0, 3).map((id) => { const u = userById(db, id); return u ? <div key={id} className="row-sm xs"><Avatar user={u} size={20} />{u.name}</div> : null; })}
                        {s.participants.length > 3 && <span className="xs muted">и ещё {s.participants.length - 3}</span>}
                      </div>
                    </td>
                    <td className="small text-2" style={{ maxWidth: 340 }}>{s.description}</td>
                    <td>
                      <select className="select" style={{ width: 160, height: 36 }} value={s.status} aria-label="Статус проверки" onChange={(e) => run('st', () => api.setSignalStatus(s.id, e.target.value as SignalStatus), `Статус: ${SIGNAL_STATUS_LABELS[e.target.value as SignalStatus]}`)}>
                        {(Object.keys(SIGNAL_STATUS_LABELS) as SignalStatus[]).map((k) => <option key={k} value={k}>{SIGNAL_STATUS_LABELS[k]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : <div className="card"><Empty icon={ShieldAlert} title="Сигналов с такими фильтрами нет" /></div>}
      <div className="alert small"><Info size={16} /><span>Что проверяем: аномально частые начисления одному человеку, концентрацию у небольшой группы, взаимные благодарности, всплеск перед концом квартала, резкий рост у руководителя, много одинаковых сумм, начисления без обоснования, превышение лимитов и неиспользованный фонд.</span></div>
    </div>
  );
}

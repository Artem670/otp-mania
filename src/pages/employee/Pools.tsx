import { useMemo, useState, type ReactNode } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { deptName, me as selectMe, poolParticipants, poolRaised, poolVisibleTo, userById } from '../../data/selectors';
import { POOL_STATUS_LABELS, type Pool } from '../../data/types';
import { DAY, fmt, fmtDate, plural } from '../../lib/utils';
import { Amount, Avatar, Badge, Button, Coin, Empty, Field, Modal, PageHeader, PageSkeleton, PoolCover, Progress, Seg, useAction, usePageLoading } from '../../components/ui';
import { PiggyBank, HandHeart } from '../../components/icons';

export function daysLeft(p: Pool) {
  const d = Math.ceil((p.deadline - Date.now()) / DAY);
  return d <= 0 ? 'срок истёк' : `${d} ${plural(d, 'день', 'дня', 'дней')}`;
}

export function PoolCard({ p, actions }: { p: Pool; actions?: ReactNode }) {
  const db = useDB();
  const raised = poolRaised(p);
  const org = userById(db, p.organizerId);
  return (
    <article className="pool" data-testid={`pool-${p.id}`}>
      <PoolCover image={p.image}><Badge tone={p.status === 'active' ? 'orange' : p.status === 'completed' ? 'green' : 'red'}>{POOL_STATUS_LABELS[p.status]}</Badge></PoolCover>
      <div className="pool-body">
        <div className="xs muted">{deptName(db, p.scope)}</div>
        <h3>{p.title}</h3>
        <p className="small text-2">{p.description}</p>
        <div className="small"><span className="muted">Цель:</span> {p.goal}</div>
        {org && <div className="row-sm small"><Avatar user={org} size={22} /><span className="muted">Организатор:</span> {org.name}</div>}
        <div className="mt-4">
          <div className="row between small mb-8"><b className="num">{fmt(raised)} <Coin /></b><span className="muted num">из {fmt(p.target)}</span></div>
          <Progress value={raised / p.target} tone="orange" label={`Собрано ${Math.round((raised / p.target) * 100)}%`} />
        </div>
        <div className="facts">
          <div className="fact"><b>{Math.round((raised / p.target) * 100)}%</b><span>собрано</span></div>
          <div className="fact"><b>{poolParticipants(p)}</b><span>{plural(poolParticipants(p), 'участник', 'участника', 'участников')}</span></div>
          <div className="fact"><b>{p.status === 'active' ? daysLeft(p) : fmtDate(p.deadline)}</b><span>{p.status === 'active' ? 'до конца' : 'окончание'}</span></div>
        </div>
        {actions && <div className="row-sm row-wrap" style={{ marginTop: 'auto', paddingTop: 4 }}>{actions}</div>}
      </div>
    </article>
  );
}

function SupportModal({ p, onClose }: { p: Pool; onClose: () => void }) {
  const db = useDB();
  const u = selectMe(db)!;
  const left = p.target - poolRaised(p);
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { run, busy } = useAction();
  const n = Number(val);
  const submit = async () => {
    let e: string | null = null;
    if (!val) e = 'Введите сумму';
    else if (!Number.isInteger(n) || n <= 0) e = 'Только целое число';
    else if (n < 100) e = 'Минимальный вклад 100 коинов';
    else if (n > u.coins) e = `На балансе только ${fmt(u.coins)} коинов`;
    else if (n > left) e = `До цели осталось ${fmt(left)}`;
    setErr(e); if (e) return;
    const ok = await run('sup', () => api.contribute(p.id, n).then(() => true), `Спасибо! Вы поддержали сбор на ${fmt(n)} коинов`);
    if (ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title="Поддержать сбор" subtitle={p.title} footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button icon={HandHeart} loading={busy === 'sup'} onClick={submit}>Поддержать</Button></>}>
      <div className="col" style={{ gap: 14 }}>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="card soft pad-sm"><div className="xs muted">Ваш баланс</div><Amount value={u.coins} /></div>
          <div className="card soft pad-sm"><div className="xs muted">До цели</div><Amount value={left} /></div>
        </div>
        <Field label="Сумма вклада" error={err} htmlFor="sup-amt">
          <div className="input-wrap"><input id="sup-amt" className={err ? 'input err' : 'input'} style={{ paddingLeft: 14 }} inputMode="numeric" value={val} onChange={(e) => { setVal(e.target.value.replace(/\D/g, '')); setErr(null); }} placeholder="Например, 1000" /><span className="input-suffix">коинов</span></div>
        </Field>
        <div className="chips">{[500, 1000, 2000, 5000].filter((x) => x <= left).map((x) => <button key={x} className="chip" onClick={() => { setVal(String(x)); setErr(null); }}>{fmt(x)}</button>)}</div>
        <p className="xs muted">Если сбор отменят, коины полностью вернутся на баланс.</p>
      </div>
    </Modal>
  );
}

export default function Pools() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('pools');
  const [tab, setTab] = useState<'active' | 'done' | 'mine'>('active');
  const [support, setSupport] = useState<Pool | null>(null);
  const visible = useMemo(() => db.pools.filter((p) => poolVisibleTo(p, u)), [db, u]);
  const list = visible.filter((p) => (tab === 'active' ? p.status === 'active' : tab === 'done' ? p.status !== 'active' : p.contributions.some((c) => c.userId === u.id))).sort((a, b) => b.createdAt - a.createdAt);
  const myTotal = visible.reduce((a, p) => a + p.contributions.filter((c) => c.userId === u.id).reduce((x, c) => x + c.amount, 0), 0);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Корпоративные сборы" subtitle={`Скидываемся коинами на общее дело. Вы вложили всего: ${fmt(myTotal)} коинов.`}
        actions={<Seg value={tab} onChange={setTab} ariaLabel="Фильтр сборов" options={[{ value: 'active', label: 'Активные' }, { value: 'done', label: 'Завершённые' }, { value: 'mine', label: 'С моим участием' }]} />} />
      {list.length ? (
        <div className="pools">
          {list.map((p) => {
            const mine = p.contributions.filter((c) => c.userId === u.id).reduce((a, c) => a + c.amount, 0);
            return (
              <PoolCard key={p.id} p={p} actions={<>
                {p.status === 'active' && <Button icon={HandHeart} onClick={() => setSupport(p)} disabled={!u.coins}>Поддержать сбор</Button>}
                {mine > 0 && <Badge tone="dark">Ваш вклад: {fmt(mine)}</Badge>}
              </>} />
            );
          })}
        </div>
      ) : <div className="card"><Empty icon={PiggyBank} title={tab === 'active' ? 'Сейчас нет активных сборов' : tab === 'mine' ? 'Вы ещё не участвовали в сборах' : 'Завершённых сборов нет'} text="Сборы создают руководители для своей команды или всего банка." /></div>}
      {support && <SupportModal p={support} onClose={() => setSupport(null)} />}
    </div>
  );
}

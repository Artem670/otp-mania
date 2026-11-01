import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { deptName, me as selectMe, rating, userById } from '../../data/selectors';
import { ROLE_LABELS } from '../../data/types';
import { useRouter } from '../../lib/router';
import { ago, fmt } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Coin, Drawer, Empty, PageHeader, Skeleton, usePageLoading } from '../../components/ui';
import { HandHeart, Search, Users } from '../../components/icons';
import { SendThanksModal } from '../employee/Profile';

export default function Employees({ openId }: { openId?: string }) {
  const db = useDB();
  const u = selectMe(db)!;
  const { navigate } = useRouter();
  const loading = usePageLoading('employees', 300);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [thanksTo, setThanksTo] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.users.filter((x) => (dept === 'all' || x.deptId === dept) && (!s || x.name.toLowerCase().includes(s) || x.title.toLowerCase().includes(s))).sort((a, b) => a.name.localeCompare(b.name));
  }, [db, q, dept]);
  const ranks = useMemo(() => new Map(rating(db, { period: 'quarter' }).map((r) => [r.user.id, r])), [db]);
  const person = openId ? userById(db, openId) : null;
  const theirThanks = person ? db.thanks.filter((t) => t.toId === person.id).sort((a, b) => b.ts - a.ts).slice(0, 4) : [];

  return (
    <div className="stack-24">
      <PageHeader title="Сотрудники" subtitle={`${db.users.length} человек в ${db.departments.length} подразделениях`}
        actions={<>
          <div className="input-wrap" style={{ width: 260 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или должность" aria-label="Поиск сотрудника" /></div>
          <select className="select" style={{ width: 240 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Подразделение"><option value="all">Все подразделения</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </>} />
      {loading ? <div className="grid g4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={150} r={22} />)}</div>
        : list.length ? (
          <div className="grid g4">
            {list.map((x) => (
              <button key={x.id} className="card pad-sm" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate(`/employees/${x.id}`)}>
                <div className="row"><Avatar user={x} size={44} /><div className="grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ display: 'block' }}>{x.name}</b><div className="xs muted ellipsis">{x.title}</div></div></div>
                <div className="row between mt-12"><span className="xs muted ellipsis">{deptName(db, x.deptId)}</span>{x.role !== 'employee' && <Badge tone={x.role === 'admin' ? 'dark' : 'orange'}>{ROLE_LABELS[x.role]}</Badge>}</div>
              </button>
            ))}
          </div>
        ) : <div className="card"><Empty icon={Users} title="Никого не нашли" text="Измените запрос или подразделение." /></div>}

      <Drawer open={!!person} onClose={() => navigate('/employees')} title="Профиль сотрудника"
        footer={person && person.id !== u.id && <Button block variant="orange" icon={HandHeart} onClick={() => setThanksTo(person.id)}>Поблагодарить</Button>}>
        {person && (
          <div className="stack-16">
            <div className="row"><Avatar user={person} size={64} /><div><h2>{person.name}</h2><div className="small muted">{person.title}</div><div className="small muted">{deptName(db, person.deptId)}</div></div></div>
            <div className="grid g2" style={{ gap: 10 }}>
              <div className="card soft pad-sm"><div className="xs muted">Место за квартал</div><b style={{ fontSize: 20 }}>{ranks.get(person.id)?.place ?? '—'}</b></div>
              <div className="card soft pad-sm"><div className="xs muted">РуКоины за квартал</div><b style={{ fontSize: 20 }} className="num">{fmt(ranks.get(person.id)?.rucoins ?? 0)} <Coin ru /></b></div>
            </div>
            <div className="small"><span className="muted">Почта:</span> {person.email}</div>
            <div className="small"><span className="muted">Был(а) в системе:</span> {ago(person.lastActiveAt)}</div>
            <h3>Недавние благодарности</h3>
            {theirThanks.length ? theirThanks.map((t) => {
              const f = userById(db, t.fromId)!;
              return <div key={t.id} className="card soft pad-sm"><div className="small"><b>{f.name}</b>: «{t.message}»</div><div className="xs muted mt-4">{ago(t.ts)}</div></div>;
            }) : <p className="small muted">Пока нет</p>}
            {u.role === 'admin' && <Button variant="secondary" block onClick={() => navigate(`/admin/users?u=${person.id}`)}>Открыть в администрировании</Button>}
          </div>
        )}
      </Drawer>
      <SendThanksModal open={!!thanksTo} toId={thanksTo ?? undefined} onClose={() => setThanksTo(null)} />
    </div>
  );
}

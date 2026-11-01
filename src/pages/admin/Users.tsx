import { useEffect, useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { deptName, me as selectMe, userById } from '../../data/selectors';
import { ROLE_LABELS, ORDER_STATUS_LABELS, type Role } from '../../data/types';
import { ago, fmt, fmtDateTime } from '../../lib/utils';
import { useRouter } from '../../lib/router';
import { Avatar, Badge, Button, Card, Coin, Drawer, Empty, Field, Modal, PageHeader, PageSkeleton, Seg, useAction, usePageLoading } from '../../components/ui';
import { Building, Pencil, Plus, Search, Users } from '../../components/icons';

export default function UsersAdmin() {
  const db = useDB();
  const admin = selectMe(db)!;
  const { path, navigate } = useRouter();
  const loading = usePageLoading('users');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'accruals' | 'conversions' | 'orders' | 'given'>('accruals');
  const [deptEdit, setDeptEdit] = useState<{ id?: string; name: string; city: string } | null>(null);
  const { run, busy } = useAction();

  useEffect(() => { const m = path.match(/[?&]u=([^&]+)/); if (m) setOpen(m[1]); }, [path]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.users.filter((u) => (dept === 'all' || u.deptId === dept) && (role === 'all' || u.role === role) && (!s || u.name.toLowerCase().includes(s) || u.email.includes(s) || u.title.toLowerCase().includes(s))).sort((a, b) => a.name.localeCompare(b.name));
  }, [db, q, dept, role]);
  const u = open ? userById(db, open) : null;
  if (loading) return <PageSkeleton />;

  const accr = u ? db.accruals.filter((a) => a.employeeId === u.id).sort((a, b) => b.ts - a.ts) : [];
  const given = u ? db.accruals.filter((a) => a.managerId === u.id).sort((a, b) => b.ts - a.ts) : [];
  const conv = u ? db.conversions.filter((c) => c.userId === u.id).sort((a, b) => b.ts - a.ts) : [];
  const ords = u ? db.orders.filter((o) => o.userId === u.id).sort((a, b) => b.ts - a.ts) : [];

  return (
    <div className="stack-24">
      <PageHeader title="Сотрудники и роли" crumbs="Администрирование" subtitle={`${db.users.length} пользователей, ${db.departments.length} подразделений`} />
      <Card className="pad-0">
        <div className="row row-wrap between" style={{ padding: 18, gap: 10 }}>
          <div className="input-wrap" style={{ width: 280 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, почта или должность" aria-label="Поиск сотрудников" /></div>
          <div className="row-sm row-wrap">
            <select className="select" style={{ width: 240 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Подразделение"><option value="all">Все подразделения</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select className="select" style={{ width: 180 }} value={role} onChange={(e) => setRole(e.target.value as Role | 'all')} aria-label="Роль"><option value="all">Все роли</option>{(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          </div>
        </div>
        {list.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Сотрудник</th><th>Подразделение</th><th>Роль</th><th className="right">Коины</th><th className="right">РуКоины</th><th>Активность</th></tr></thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className="clickable" onClick={() => { setOpen(x.id); setTab(x.role === 'manager' ? 'given' : 'accruals'); }}>
                    <td><div className="row-sm"><Avatar user={x} size={32} /><div><div className="strong small">{x.name}</div><div className="xs muted">{x.email}</div></div></div></td>
                    <td className="small">{deptName(db, x.deptId)}<div className="xs muted">{x.title}</div></td>
                    <td><Badge tone={x.role === 'admin' ? 'dark' : x.role === 'manager' ? 'orange' : undefined}>{ROLE_LABELS[x.role]}</Badge></td>
                    <td className="right num">{fmt(x.coins)}</td>
                    <td className="right num">{fmt(x.rucoins)}</td>
                    <td className="small muted nowrap">{ago(x.lastActiveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={Users} title="Никого не нашли" text="Измените фильтры поиска." />}
      </Card>

      <Card title="Подразделения" subtitle="Название, город и руководитель" action={<Button size="sm" icon={Plus} onClick={() => setDeptEdit({ name: '', city: '' })}>Добавить</Button>}>
        <div className="grid g3" style={{ gap: 10 }}>
          {db.departments.map((d) => {
            const m = d.managerId ? userById(db, d.managerId) : null;
            return (
              <div key={d.id} className="card soft pad-sm">
                <div className="row between"><b className="small row-sm"><Building size={15} />{d.name}</b><Button size="sm" variant="ghost" icon={Pencil} aria-label={`Изменить ${d.name}`} onClick={() => setDeptEdit({ id: d.id, name: d.name, city: d.city })} /></div>
                <div className="xs muted mt-4">{d.city} · {db.users.filter((x) => x.deptId === d.id).length} чел.</div>
                <div className="xs mt-4">{m ? `Руководитель: ${m.name}` : <span style={{ color: 'var(--orange-deep)' }}>Руководитель не назначен</span>}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Drawer open={!!u} onClose={() => { setOpen(null); if (path.includes('?')) navigate('/admin/users'); }} title="Карточка сотрудника">
        {u && (
          <div className="stack-16">
            <div className="row"><Avatar user={u} size={56} /><div><h2>{u.name}</h2><div className="small muted">{u.title}</div><div className="xs muted">{u.email}</div></div></div>
            <div className="grid g2" style={{ gap: 10 }}>
              <div className="card soft pad-sm"><div className="xs muted">Коины</div><b className="num">{fmt(u.coins)} <Coin /></b></div>
              <div className="card soft pad-sm"><div className="xs muted">РуКоины</div><b className="num">{fmt(u.rucoins)} <Coin ru /></b></div>
            </div>
            <Field label="Роль" hint={u.id === admin.id ? 'Свою роль администратора изменить нельзя' : 'Руководитель получает инструменты начисления, администратор — управление системой'}>
              <select className="select" value={u.role} disabled={u.id === admin.id || busy === 'role'} onChange={(e) => run('role', () => api.setUserRole(u.id, e.target.value as Role), `Роль изменена: ${ROLE_LABELS[e.target.value as Role]}`)} aria-label="Роль">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <Field label="Подразделение" hint={u.role === 'manager' ? 'Чтобы перевести руководителя, сначала смените ему роль' : undefined}>
              <select className="select" value={u.deptId} disabled={u.role === 'manager' || busy === 'dept'} onChange={(e) => run('dept', () => api.setUserDept(u.id, e.target.value), 'Подразделение изменено')} aria-label="Подразделение">
                {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Seg value={tab} onChange={setTab} options={[{ value: 'accruals', label: `Получено · ${accr.length}` }, ...(u.role === 'manager' ? [{ value: 'given' as const, label: `Начислил · ${given.length}` }] : []), { value: 'conversions', label: `Конвертации · ${conv.length}` }, { value: 'orders', label: `Заказы · ${ords.length}` }]} />
            <div>
              {tab === 'accruals' && (accr.length ? accr.slice(0, 20).map((a) => <div key={a.id} className="op" style={{ gridTemplateColumns: '1fr auto' }}><div><div className="small strong">{userById(db, a.managerId)?.name}</div><div className="xs muted">{a.comment}</div><div className="xs muted">{fmtDateTime(a.ts)}</div></div><b className="num amount-pos">+{fmt(a.amount)}</b></div>) : <p className="small muted">Начислений не было</p>)}
              {tab === 'given' && (given.length ? given.slice(0, 20).map((a) => <div key={a.id} className="op" style={{ gridTemplateColumns: '1fr auto' }}><div><div className="small strong">{userById(db, a.employeeId)?.name}</div><div className="xs muted">{a.comment}</div><div className="xs muted">{fmtDateTime(a.ts)}</div></div><b className="num">{fmt(a.amount)}</b></div>) : <p className="small muted">Начислений не было</p>)}
              {tab === 'conversions' && (conv.length ? conv.slice(0, 20).map((c) => <div key={c.id} className="op" style={{ gridTemplateColumns: '1fr auto' }}><div><div className="small">{fmt(c.rucoins)} РуКоинов → {fmt(c.coins)} коинов</div><div className="xs muted">курс {c.rate} · {fmtDateTime(c.ts)}</div></div></div>) : <p className="small muted">Конвертаций не было</p>)}
              {tab === 'orders' && (ords.length ? ords.slice(0, 20).map((o) => <div key={o.id} className="op" style={{ gridTemplateColumns: '1fr auto' }}><div><div className="small">{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</div><div className="xs muted">{fmtDateTime(o.ts)} · {ORDER_STATUS_LABELS[o.status]}</div></div><b className="num">{fmt(o.total)}</b></div>) : <p className="small muted">Заказов не было</p>)}
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={!!deptEdit} onClose={() => setDeptEdit(null)} title={deptEdit?.id ? 'Изменить подразделение' : 'Новое подразделение'}
        footer={<><Button variant="secondary" onClick={() => setDeptEdit(null)}>Отмена</Button><Button loading={busy === 'dep'} onClick={async () => { const ok = await run('dep', () => api.saveDepartment(deptEdit!).then(() => true), 'Подразделение сохранено'); if (ok) setDeptEdit(null); }}>Сохранить</Button></>}>
        {deptEdit && (
          <div className="col" style={{ gap: 14 }}>
            <Field label="Название"><input className="input" value={deptEdit.name} onChange={(e) => setDeptEdit({ ...deptEdit, name: e.target.value })} /></Field>
            <Field label="Город"><input className="input" value={deptEdit.city} onChange={(e) => setDeptEdit({ ...deptEdit, city: e.target.value })} /></Field>
            {!deptEdit.id && <p className="xs muted">Руководителя можно назначить после создания: смените роль сотрудника этого подразделения на «Руководитель».</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

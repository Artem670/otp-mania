import { useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { deptName, me as selectMe, poolRaised, userById } from '../../data/selectors';
import type { Pool } from '../../data/types';
import { DAY, ago, cx, fmt } from '../../lib/utils';
import { Avatar, Button, Confirm, Empty, Field, Modal, PageHeader, PageSkeleton, PoolCover, Seg, useAction, usePageLoading, useToast } from '../../components/ui';
import { POOL_PRESETS, PiggyBank, Plus, Upload, Users, Check, Ban } from '../../components/icons';
import { PoolCard } from '../employee/Pools';

export function CreatePoolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDB();
  const u = selectMe(db)!;
  const toast = useToast();
  const { run, busy } = useAction();
  const toDate = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const [f, setF] = useState({ title: '', description: '', goal: '', target: '', deadline: toDate(Date.now() + 21 * DAY), scope: u.role === 'admin' ? 'all' : u.deptId, image: 'coffee', kind: 'team' as 'team' | 'charity' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };
  const scopes = u.role === 'admin' ? [{ id: 'all', name: 'Весь банк' }, ...db.departments] : [{ id: u.deptId, name: deptName(db, u.deptId) }, { id: 'all', name: 'Весь банк' }];

  const onFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('error', 'Нужен файл изображения');
    if (file.size > 2 * 1024 * 1024) return toast('error', 'Изображение до 2 МБ');
    const r = new FileReader();
    r.onload = () => set('image', String(r.result));
    r.readAsDataURL(file);
  };
  const submit = async () => {
    const e: Record<string, string> = {};
    const target = Number(f.target);
    const deadline = new Date(f.deadline + 'T23:59:00').getTime();
    if (f.title.trim().length < 4) e.title = 'Минимум 4 символа';
    if (f.description.trim().length < 10) e.description = 'Минимум 10 символов';
    if (f.goal.trim().length < 4) e.goal = 'Укажите, на что собираем';
    if (!f.target) e.target = 'Укажите сумму';
    else if (!Number.isInteger(target) || target < 1000) e.target = 'Целое число от 1 000';
    else if (target > 1_000_000) e.target = 'Не больше 1 000 000';
    if (!f.deadline || !(deadline > Date.now())) e.deadline = 'Дата должна быть в будущем';
    setErrors(e);
    if (Object.keys(e).length) return;
    const id = await run('create', () => api.createPool({ ...f, target, deadline }), 'Сбор создан и доступен сотрудникам');
    if (id) { onClose(); setF((x) => ({ ...x, title: '', description: '', goal: '', target: '' })); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Новый сбор" subtitle="После создания сбор сразу увидят выбранные сотрудники" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button loading={busy === 'create'} onClick={submit} data-testid="pool-create-submit">Создать сбор</Button></>}>
      <div className="grid g2" style={{ gap: 16 }}>
        <div className="col" style={{ gap: 14 }}>
          <Field label="Тип сбора" hint={f.kind === 'charity' ? 'Собранные коины передаются фонду по курсу программы' : 'Выезд, квиз, кофемашина, подарок: всё, что сплачивает команду'}>
            <div className="seg" role="radiogroup" aria-label="Тип сбора">
              <button type="button" className={f.kind === 'team' ? 'on' : ''} onClick={() => setF((x) => ({ ...x, kind: 'team' }))}>Для команды</button>
              <button type="button" className={f.kind === 'charity' ? 'on' : ''} onClick={() => setF((x) => ({ ...x, kind: 'charity', image: 'heart' }))}>Благотворительность</button>
            </div>
          </Field>
          <Field label="Название" error={errors.title} htmlFor="pl-title"><input id="pl-title" className={cx('input', errors.title && 'err')} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Например, кофемашина на этаж" /></Field>
          <Field label="Описание" error={errors.description} htmlFor="pl-desc"><textarea id="pl-desc" className={cx('textarea', errors.description && 'err')} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Зачем этот сбор и кому он поможет" /></Field>
          <Field label="Цель сбора" error={errors.goal} htmlFor="pl-goal"><input id="pl-goal" className={cx('input', errors.goal && 'err')} value={f.goal} onChange={(e) => set('goal', e.target.value)} placeholder="Что именно купим или организуем" /></Field>
          <div className="grid g2" style={{ gap: 12 }}>
            <Field label="Необходимая сумма" error={errors.target} htmlFor="pl-target"><input id="pl-target" className={cx('input', errors.target && 'err')} inputMode="numeric" value={f.target} onChange={(e) => set('target', e.target.value.replace(/\D/g, ''))} placeholder="50000" /></Field>
            <Field label="Срок окончания" error={errors.deadline} htmlFor="pl-deadline"><input id="pl-deadline" type="date" className={cx('input', errors.deadline && 'err')} value={f.deadline} min={toDate(Date.now() + DAY)} onChange={(e) => set('deadline', e.target.value)} /></Field>
          </div>
          <Field label="Круг участников" htmlFor="pl-scope"><select id="pl-scope" className="select" value={f.scope} onChange={(e) => set('scope', e.target.value)}>{scopes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        </div>
        <div className="col" style={{ gap: 12 }}>
          <div className="label">Изображение сбора</div>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}><PoolCover image={f.image} height={160} /></div>
          <div className="grid g3" style={{ gap: 8 }}>
            {Object.entries(POOL_PRESETS).map(([k, p]) => (
              <button key={k} className={cx('chip', f.image === k && 'on')} style={{ justifyContent: 'center' }} onClick={() => set('image', k)}><p.icon size={14} />{p.label}</button>
            ))}
          </div>
          <label className="btn secondary" style={{ cursor: 'pointer' }}><Upload size={16} />Загрузить своё<input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /></label>
          <p className="xs muted">JPG или PNG до 2 МБ</p>
        </div>
      </div>
    </Modal>
  );
}

export function Contributors({ p }: { p: Pool }) {
  const db = useDB();
  const per = new Map<string, { amount: number; ts: number }>();
  p.contributions.forEach((c) => { const x = per.get(c.userId) ?? { amount: 0, ts: 0 }; per.set(c.userId, { amount: x.amount + c.amount, ts: Math.max(x.ts, c.ts) }); });
  const rows = [...per.entries()].sort((a, b) => b[1].ts - a[1].ts);
  if (!rows.length) return <p className="small muted">Пока никто не поддержал</p>;
  return (
    <div className="col" style={{ gap: 6 }}>
      {rows.map(([id, v]) => {
        const x = userById(db, id);
        return x ? <div key={id} className="row small"><Avatar user={x} size={24} /><span className="grow">{x.name}</span><span className="muted xs">{ago(v.ts)}</span><b className="num">{fmt(v.amount)}</b></div> : null;
      })}
    </div>
  );
}

export default function ManagerPools() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('mpools');
  const [create, setCreate] = useState(false);
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [details, setDetails] = useState<Pool | null>(null);
  const [act, setAct] = useState<{ p: Pool; mode: 'complete' | 'cancel' } | null>(null);
  const { run, busy } = useAction();
  const mine = db.pools.filter((p) => p.organizerId === u.id && (tab === 'active' ? p.status === 'active' : p.status !== 'active')).sort((a, b) => b.createdAt - a.createdAt);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Сборы команды" crumbs="Кабинет руководителя" subtitle="Создавайте сборы для своего подразделения или всего банка и следите за поступлениями."
        actions={<><Seg value={tab} onChange={setTab} options={[{ value: 'active', label: 'Активные' }, { value: 'closed', label: 'Закрытые' }]} /><Button icon={Plus} onClick={() => setCreate(true)}>Создать сбор</Button></>} />
      {mine.length ? (
        <div className="pools">
          {mine.map((p) => (
            <PoolCard key={p.id} p={p} actions={<>
              <Button size="sm" variant="secondary" icon={Users} onClick={() => setDetails(p)}>Участники</Button>
              {p.status === 'active' && <>
                <Button size="sm" icon={Check} onClick={() => setAct({ p, mode: 'complete' })}>Завершить</Button>
                <Button size="sm" variant="danger" icon={Ban} onClick={() => setAct({ p, mode: 'cancel' })}>Отменить</Button>
              </>}
            </>} />
          ))}
        </div>
      ) : <div className="card"><Empty icon={PiggyBank} title={tab === 'active' ? 'У вас нет активных сборов' : 'Закрытых сборов нет'} text="Сбор поможет команде вместе купить оборудование, устроить праздник или сделать подарок." action={<Button icon={Plus} onClick={() => setCreate(true)}>Создать сбор</Button>} /></div>}
      <CreatePoolModal open={create} onClose={() => setCreate(false)} />
      <Modal open={!!details} onClose={() => setDetails(null)} title={details?.title ?? ''} subtitle={details ? `Собрано ${fmt(poolRaised(details))} из ${fmt(details.target)}` : ''}>
        {details && <Contributors p={db.pools.find((x) => x.id === details.id) ?? details} />}
      </Modal>
      <Confirm open={!!act} onClose={() => setAct(null)} loading={busy === 'close'} danger={act?.mode === 'cancel'}
        title={act?.mode === 'cancel' ? 'Отменить сбор?' : 'Завершить сбор?'}
        confirmText={act?.mode === 'cancel' ? 'Отменить и вернуть коины' : 'Завершить сбор'}
        text={act ? (act.mode === 'cancel' ? `Все ${fmt(poolRaised(act.p))} коинов вернутся участникам. Действие нельзя отменить.` : `Собрано ${fmt(poolRaised(act.p))} из ${fmt(act.p.target)}. Участники получат уведомление, что идея уходит в работу.`) : ''}
        onConfirm={async () => { if (!act) return; await run('close', () => api.closePool(act.p.id, act.mode), act.mode === 'cancel' ? 'Сбор отменён, коины возвращены' : 'Сбор завершён'); setAct(null); }} />
    </div>
  );
}

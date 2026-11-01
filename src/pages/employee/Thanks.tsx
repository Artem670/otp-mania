import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { deptName, me as selectMe, userById } from '../../data/selectors';
import type { Thanks } from '../../data/types';
import { ago, cx } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Empty, Field, PageHeader, PageSkeleton, Seg, useAction, usePageLoading } from '../../components/ui';
import { Heart, Search, Send, Check } from '../../components/icons';

export function SendThanksForm({ initialTo, onSent, compact }: { initialTo?: string; onSent?: () => void; compact?: boolean }) {
  const db = useDB();
  const u = selectMe(db)!;
  const cats = db.settings.thanksCategories;
  const [q, setQ] = useState('');
  const [to, setTo] = useState<string | null>(initialTo ?? null);
  const [cat, setCat] = useState(cats[0]?.id ?? '');
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useAction();

  const people = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.users
      .filter((x) => x.id !== u.id && (!s || x.name.toLowerCase().includes(s) || x.title.toLowerCase().includes(s) || deptName(db, x.deptId).toLowerCase().includes(s)))
      .sort((a, b) => Number(b.deptId === u.deptId) - Number(a.deptId === u.deptId) || a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [db, q, u]);
  const target = to ? userById(db, to) : null;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!to) e.to = 'Выберите коллегу';
    if (!cat) e.cat = 'Выберите категорию';
    if (msg.trim().length < 10) e.msg = 'Напишите хотя бы 10 символов: за что вы благодарите';
    if (msg.length > 500) e.msg = 'Не больше 500 символов';
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await run('thx', () => api.sendThanks(to!, cat, msg).then(() => true), `Благодарность отправлена: ${target?.name}`);
    if (ok) { setMsg(''); setTo(initialTo ?? null); setQ(''); onSent?.(); }
  };

  return (
    <div className={cx('grid', !compact && 'g2')} style={{ gap: 18 }}>
      <Field label="Кому" error={errors.to}>
        {target ? (
          <div className="row card soft pad-sm" style={{ borderRadius: 14 }}>
            <Avatar user={target} size={40} />
            <div className="grow"><b>{target.name}</b><div className="xs muted">{target.title}, {deptName(db, target.deptId)}</div></div>
            <Button size="sm" variant="secondary" onClick={() => setTo(null)}>Изменить</Button>
          </div>
        ) : (
          <>
            <div className="input-wrap"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, должность или отдел" aria-label="Поиск коллеги" /></div>
            <div className="pick-list mt-8" role="listbox" aria-label="Коллеги">
              {people.length ? people.map((p) => (
                <button key={p.id} className="pick-item" role="option" aria-selected={false} onClick={() => { setTo(p.id); setErrors((x) => ({ ...x, to: '' })); }}>
                  <Avatar user={p} size={30} /><span className="grow"><span className="small strong">{p.name}</span><div className="xs muted">{p.title} · {deptName(db, p.deptId)}</div></span>
                </button>
              )) : <div className="empty small">Никого не нашли по запросу «{q}»</div>}
            </div>
          </>
        )}
      </Field>
      <div className="col" style={{ gap: 16 }}>
        <Field label="Категория" error={errors.cat}>
          <div className="chips" role="radiogroup" aria-label="Категория благодарности">
            {cats.map((c) => <button key={c.id} role="radio" aria-checked={cat === c.id} className={cx('chip', cat === c.id && 'on')} onClick={() => setCat(c.id)}>{cat === c.id && <Check size={14} />}{c.name}</button>)}
          </div>
        </Field>
        <Field label="Сообщение" error={errors.msg} hint={`${msg.length}/500`} htmlFor="thx-msg">
          <textarea id="thx-msg" className={errors.msg ? 'textarea err' : 'textarea'} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Например: спасибо, что помог разобраться с отчётом, без тебя бы не успели к дедлайну" maxLength={520} />
        </Field>
        <div className="alert small"><Heart size={16} />Благодарность бесплатна и не списывает коины. Она поднимает рейтинг признания коллеги.</div>
        <Button icon={Send} loading={busy === 'thx'} onClick={submit}>Отправить благодарность</Button>
      </div>
    </div>
  );
}

export function ThanksCard({ t, mode }: { t: Thanks; mode: 'in' | 'out' }) {
  const db = useDB();
  const other = userById(db, mode === 'in' ? t.fromId : t.toId);
  const cat = db.settings.thanksCategories.find((c) => c.id === t.categoryId);
  if (!other) return null;
  return (
    <article className="thanks-card">
      <div className="row">
        <Avatar user={other} size={40} />
        <div className="grow"><div className="small muted">{mode === 'in' ? 'От' : 'Для'}</div><b>{other.name}</b></div>
      </div>
      <blockquote>«{t.message}»</blockquote>
      <div className="row between"><Badge tone="orange">{cat?.name ?? 'Спасибо'}</Badge><span className="xs muted">{ago(t.ts)}</span></div>
    </article>
  );
}

export default function ThanksPage() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('thanks');
  const [tab, setTab] = useState<'in' | 'out'>('in');
  const list = useMemo(() => db.thanks.filter((t) => (tab === 'in' ? t.toId === u.id : t.fromId === u.id)).sort((a, b) => b.ts - a.ts), [db, u.id, tab]);
  const inCount = db.thanks.filter((t) => t.toId === u.id).length;
  const outCount = db.thanks.filter((t) => t.fromId === u.id).length;
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Благодарности" subtitle="Скажите спасибо коллеге за помощь. Благодарности формируют рейтинг признания и подсказывают руководителю, кого отметить." />
      <Card title="Новая благодарность"><SendThanksForm /></Card>
      <div>
        <div className="row between mb-16 row-wrap">
          <h2>{tab === 'in' ? 'Полученные' : 'Отправленные'}</h2>
          <Seg value={tab} onChange={setTab} ariaLabel="Полученные или отправленные" options={[{ value: 'in', label: `Полученные · ${inCount}` }, { value: 'out', label: `Отправленные · ${outCount}` }]} />
        </div>
        {list.length ? <div className="grid g3">{list.map((t) => <ThanksCard key={t.id} t={t} mode={tab} />)}</div>
          : <div className="card"><Empty icon={Heart} title={tab === 'in' ? 'Вам пока не говорили спасибо' : 'Вы ещё никого не благодарили'} text={tab === 'out' ? 'Начните с коллеги, который недавно помог.' : 'Помогайте коллегам, и благодарности появятся.'} /></div>}
      </div>
    </div>
  );
}

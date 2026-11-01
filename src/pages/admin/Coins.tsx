import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { COIN_RULES } from '../../data/seed';
import { deptName, userById } from '../../data/selectors';
import type { CoinRule } from '../../data/types';
import { ago, cx, fmt } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Coin, Confirm, Field, PageHeader, PageSkeleton, useAction, usePageLoading } from '../../components/ui';
import { Check, Search } from '../../components/icons';

const HOW: Record<CoinRule['how'], { label: string; tone?: 'green' | 'orange' }> = {
  auto: { label: 'автоматически', tone: 'green' },
  hr: { label: 'из HR-систем' },
  manual: { label: 'вручную', tone: 'orange' },
};

/** Коины за события: правила, ручное начисление и история. */
export default function CoinsAdmin() {
  const db = useDB();
  const loading = usePageLoading('coins');
  const { run, busy } = useAction();
  const rules = db.settings.coinRules ?? COIN_RULES;
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [rule, setRule] = useState<string>(rules[0]?.id ?? 'custom');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState<CoinRule[] | null>(null);

  const people = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.users.filter((u) => (dept === 'all' || u.deptId === dept) && (!s || u.name.toLowerCase().includes(s) || u.title.toLowerCase().includes(s))).sort((a, b) => a.name.localeCompare(b.name));
  }, [db, q, dept]);
  const history = useMemo(() => db.txs.filter((t) => t.kind === 'bonus').sort((a, b) => b.ts - a.ts).slice(0, 30), [db]);
  const year = useMemo(() => db.txs.filter((t) => t.kind === 'bonus' && t.ts > Date.now() - 365 * 864e5).reduce((a, t) => a + t.amount, 0), [db]);
  if (loading) return <PageSkeleton />;

  const r = rules.find((x) => x.id === rule);
  const per = rule === 'custom' ? Number(amount) || 0 : r?.amount ?? 0;
  const toggle = (id: string) => setSelected((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const submit = async () => {
    const res = await run('grant', () => api.grantCoins(selected, rule, Number(amount), reason), (t) => `Начислено ${fmt(t)} коинов: ${selected.length} чел.`);
    setConfirm(false);
    if (res !== undefined) { setSelected([]); setAmount(''); setReason(''); }
  };

  return (
    <div className="stack-24">
      <PageHeader title="Коины за события" crumbs="Администрирование" subtitle="Коины за день рождения, опросы, курсы, испытательный срок и годовщины. Автоматические начисления приходят сами, остальные можно провести здесь." />
      <div className="grid g3">
        <Card><div className="muted small">Правил начисления</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{rules.length}</div></Card>
        <Card><div className="muted small">Начислено за год</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{fmt(year)} <Coin /></div></Card>
        <Card><div className="muted small">Начислений за год</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{fmt(db.txs.filter((t) => t.kind === 'bonus' && t.ts > Date.now() - 365 * 864e5).length)}</div></Card>
      </div>

      <div className="grid g-main">
        <Card title="1. Кому начислить" subtitle={`${selected.length} выбрано`} action={<Button size="sm" variant="ghost" onClick={() => setSelected(selected.length === people.length ? [] : people.map((u) => u.id))}>{selected.length === people.length && people.length ? 'Снять выбор' : 'Выбрать всех'}</Button>}>
          <div className="row-sm row-wrap">
            <div className="input-wrap grow"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или должность" aria-label="Поиск сотрудника" /></div>
            <select className="select" style={{ width: 220 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Подразделение">
              <option value="all">Все подразделения</option>
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="pick-list mt-8" style={{ maxHeight: 440 }}>
            {people.map((u) => {
              const on = selected.includes(u.id);
              return (
                <button key={u.id} className={cx('pick-item', on && 'on')} onClick={() => toggle(u.id)} aria-pressed={on} data-testid={`grant-pick-${u.id}`}>
                  <span className={cx('check', on && 'on')}>{on && <Check size={13} />}</span>
                  <Avatar user={u} size={34} />
                  <span className="grow"><span className="small strong">{u.name}</span><div className="xs muted">{u.title} · {deptName(db, u.deptId)}</div></span>
                  <span className="xs muted num nowrap">{fmt(u.coins)} <Coin /></span>
                </button>
              );
            })}
            {!people.length && <div className="empty small">Никого не нашли</div>}
          </div>
        </Card>

        <Card title="2. За что">
          <div className="col" style={{ gap: 6 }}>
            {[...rules, { id: 'custom', title: 'Другое: своя сумма и основание', amount: 0, how: 'manual' as const }].map((c) => (
              <button key={c.id} className={cx('pick-item card pad-sm', rule === c.id && 'on')} style={{ border: '1px solid var(--border)', borderRadius: 12 }} onClick={() => setRule(c.id)} aria-pressed={rule === c.id} data-testid={`rule-${c.id}`}>
                <span className={cx('check', rule === c.id && 'on')} style={{ borderRadius: '50%' }}>{rule === c.id && <Check size={13} />}</span>
                <span className="grow"><span className="small strong">{c.title}</span>{c.id !== 'custom' && <div className="xs muted">{HOW[c.how].label}{c.once ? ' · разово' : ''}{c.note ? ` · ${c.note}` : ''}</div>}</span>
                {c.id !== 'custom' && <span className="small num nowrap strong">{fmt(c.amount)} <Coin /></span>}
              </button>
            ))}
          </div>
          {rule === 'custom' && (
            <div className="col mt-16" style={{ gap: 12 }}>
              <Field label="Сумма каждому, коинов" htmlFor="grant-amount"><input id="grant-amount" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="Например, 1 000" /></Field>
              <Field label="Основание" htmlFor="grant-reason" hint="Увидит сотрудник в истории операций"><input id="grant-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например, тестирование новой версии" /></Field>
            </div>
          )}
          <div className="row between mt-16">
            <span className="small muted">Итого: <b className="num">{fmt(per * selected.length)}</b> <Coin /></span>
            <Button onClick={() => setConfirm(true)} disabled={!selected.length || !per} data-testid="grant-submit">Начислить</Button>
          </div>
        </Card>
      </div>

      <Card title="Суммы за события" subtitle="Сколько коинов приносит каждое событие. 0 отключает правило." action={edit ? (
        <div className="row-sm"><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Отмена</Button><Button size="sm" loading={busy === 'rules'} onClick={async () => { const ok = await run('rules', () => api.updateSettings({ coinRules: edit }).then(() => true), 'Суммы сохранены'); if (ok) setEdit(null); }}>Сохранить</Button></div>
      ) : <Button size="sm" variant="secondary" onClick={() => setEdit(rules.map((x) => ({ ...x })))}>Изменить суммы</Button>}>
        <table className="table">
          <thead><tr><th>Событие</th><th>Как начисляется</th><th className="right">Коинов</th></tr></thead>
          <tbody>
            {(edit ?? rules).map((c, i) => (
              <tr key={c.id}>
                <td className="small">{c.title}{c.once && <span className="xs muted"> · разово</span>}</td>
                <td><Badge tone={HOW[c.how].tone}>{HOW[c.how].label}</Badge></td>
                <td className="right num">{edit ? <input className="input" style={{ width: 110, textAlign: 'right' }} inputMode="numeric" value={c.amount} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} aria-label={`Сумма: ${c.title}`} /> : fmt(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="xs muted mt-8">Коины за «спасибо» и за заполнение профиля больше не начисляются: благодарности растят рейтинг признания.</div>
      </Card>

      <Card title="Последние начисления">
        {!history.length ? <div className="empty small">Пока пусто</div> : (
          <table className="table">
            <thead><tr><th>Сотрудник</th><th>Основание</th><th className="right">Коинов</th><th className="right">Когда</th></tr></thead>
            <tbody>{history.map((t) => { const u = userById(db, t.userId); return (
              <tr key={t.id}><td className="small">{u?.name ?? t.userId}</td><td className="small">{t.title}</td><td className="right num">+{fmt(t.amount)}</td><td className="right xs muted">{ago(t.ts)}</td></tr>
            ); })}</tbody>
          </table>
        )}
      </Card>

      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Начислить коины?" loading={busy === 'grant'} onConfirm={submit} confirmText={`Начислить ${fmt(per * selected.length)}`}
        text={<>{selected.length} чел. получат по {fmt(per)} коинов: «{rule === 'custom' ? reason || 'без основания' : r?.title}».</>} />
    </div>
  );
}

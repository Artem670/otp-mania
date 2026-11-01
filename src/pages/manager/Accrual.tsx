import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { employeeMonthReceived, lastRecognition, managerQuarter, me as selectMe, recommendFor, teamOf, userById } from '../../data/selectors';
import { ago, cx, fmt, fmtDateTime, quarterLabel } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Coin, Confirm, Empty, Field, PageHeader, PageSkeleton, Progress, useAction, usePageLoading } from '../../components/ui';
import { Alert, Award, Check, Info, Search } from '../../components/icons';
import { useRouter } from '../../lib/router';

export default function Accrual() {
  const db = useDB();
  const m = selectMe(db)!;
  const { navigate } = useRouter();
  const loading = usePageLoading('accrual');
  const s = db.settings;
  const team = teamOf(db, m.id);
  const q = managerQuarter(db, m.id);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [cat, setCat] = useState(s.accrualCategories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [histQ, setHistQ] = useState('');
  const { run, busy } = useAction();

  const category = s.accrualCategories.find((c) => c.id === cat);
  const n = Number(amount);
  const total = Number.isFinite(n) ? n * selected.length : 0;
  const filtered = useMemo(() => {
    const x = query.trim().toLowerCase();
    return team.filter((u) => !x || u.name.toLowerCase().includes(x) || u.title.toLowerCase().includes(x));
  }, [team, query]);
  const history = useMemo(() => {
    const x = histQ.trim().toLowerCase();
    return db.accruals.filter((a) => a.managerId === m.id && (!x || (userById(db, a.employeeId)?.name ?? '').toLowerCase().includes(x) || a.comment.toLowerCase().includes(x))).sort((a, b) => b.ts - a.ts).slice(0, 30);
  }, [db, m.id, histQ]);

  if (loading) return <PageSkeleton />;

  const toggle = (id: string) => { setSelected((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id])); setErrors((e) => ({ ...e, who: '' })); };
  const validate = () => {
    const e: Record<string, string> = {};
    if (!selected.length) e.who = 'Выберите хотя бы одного сотрудника';
    if (!category) e.cat = 'Выберите основание';
    if (!amount) e.amount = 'Укажите количество РуКоинов';
    else if (!Number.isInteger(n) || n <= 0) e.amount = 'Целое число больше нуля';
    else if (n > s.maxPerAccrual) e.amount = `Не больше ${fmt(s.maxPerAccrual)} за одно начисление`;
    else if (total > q.left) e.amount = `Не хватает фонда: осталось ${fmt(q.left)}, нужно ${fmt(total)}`;
    else {
      const over = selected.map((id) => ({ id, got: employeeMonthReceived(db, id) })).find((x) => x.got + n > s.maxPerEmployeeMonth);
      if (over) e.amount = `${userById(db, over.id)?.name}: превысит месячный лимит ${fmt(s.maxPerEmployeeMonth)} (уже ${fmt(over.got)})`;
    }
    if (comment.trim().length < s.minCommentLength) e.comment = `Опишите вклад: минимум ${s.minCommentLength} символов (сейчас ${comment.trim().length})`;
    setErrors(e);
    return !Object.keys(e).length;
  };
  const submit = async () => {
    const r = await run('accrue', () => api.accrue(selected, cat, n, comment), (t) => `Начислено ${fmt(t)} РуКоинов: ${selected.length} ${selected.length === 1 ? 'сотруднику' : 'сотрудникам'}`);
    setConfirm(false);
    if (r !== undefined) { setSelected([]); setAmount(''); setComment(''); }
  };

  return (
    <div className="stack-24">
      <PageHeader title="Начисление РуКоинов" subtitle="Отметьте вклад сотрудников вашей команды. Каждое начисление сохраняется с основанием и комментарием." crumbs="Кабинет руководителя"
        actions={<Button variant="secondary" icon={Info} onClick={() => navigate('/manager/rules')}>Регламент</Button>} />
      <div className="card dark row row-wrap between" style={{ gap: 20 }}>
        <div><div className="muted small">Фонд на {quarterLabel(Date.now())}</div><div style={{ fontSize: 28, fontWeight: 700 }} className="num">{fmt(q.left)} <Coin ru /></div><div className="muted small">осталось из {fmt(q.fund)}</div></div>
        <div className="grow" style={{ maxWidth: 420 }}><Progress value={q.used / q.fund} tone="orange" label="Использование фонда" /><div className="xs muted mt-8">Выдано {fmt(q.used)} ({Math.round((q.used / q.fund) * 100)}%). Лимиты: до {fmt(s.maxPerAccrual)} за раз, до {fmt(s.maxPerEmployeeMonth)} одному сотруднику в месяц.</div></div>
      </div>

      <div className="grid g-main">
        <Card title="1. Кому начислить" subtitle={`${selected.length} выбрано из ${team.length}`} action={team.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSelected(selected.length === filtered.length ? [] : filtered.map((u) => u.id))}>{selected.length === filtered.length && filtered.length ? 'Снять выбор' : 'Выбрать всех'}</Button>}>
          {!team.length ? <Empty title="В подразделении пока нет сотрудников" /> : (
            <>
              <div className="input-wrap"><Search size={16} /><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск сотрудника" aria-label="Поиск сотрудника" /></div>
              {errors.who && <div className="field-err mt-8">{errors.who}</div>}
              <div className="pick-list mt-8" style={{ maxHeight: 420 }}>
                {filtered.length ? filtered.map((u) => {
                  const on = selected.includes(u.id);
                  const got = employeeMonthReceived(db, u.id);
                  const last = lastRecognition(db, u.id);
                  const stale = !last || Date.now() - last > 60 * 864e5;
                  return (
                    <button key={u.id} className={cx('pick-item', on && 'on')} onClick={() => toggle(u.id)} aria-pressed={on} data-testid={`pick-${u.id}`}>
                      <span className={cx('check', on && 'on')}>{on && <Check size={13} />}</span>
                      <Avatar user={u} size={34} />
                      <span className="grow">
                        <span className="small strong">{u.name}</span>
                        <div className="xs muted">{u.title} · последнее признание: {last ? ago(last) : 'не было'}</div>
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        {stale ? <Badge tone="orange">давно</Badge> : null}
                        <div className="xs muted num">{fmt(got)} / {fmt(s.maxPerEmployeeMonth)} в мес.</div>
                        <div className="xs muted">рекомендуем {fmt(recommendFor(db, u.id))}</div>
                      </span>
                    </button>
                  );
                }) : <div className="empty small">Никого не нашли</div>}
              </div>
            </>
          )}
        </Card>

        <Card title="2. Основание и сумма">
          <div className="col" style={{ gap: 16 }}>
            <Field label="Основание начисления" error={errors.cat}>
              <div className="col" style={{ gap: 6 }}>
                {s.accrualCategories.map((c) => (
                  <button key={c.id} className={cx('pick-item card pad-sm', cat === c.id && 'on')} style={{ border: '1px solid var(--border)', borderRadius: 12 }} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}>
                    <span className={cx('check', cat === c.id && 'on')} style={{ borderRadius: '50%' }}>{cat === c.id && <Check size={13} />}</span>
                    <span className="grow"><span className="small strong">{c.name}</span><div className="xs muted">{c.description}</div></span>
                    <span className="xs muted nowrap num">{fmt(c.min ?? 0)}–{fmt(c.max ?? 0)}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="РуКоинов каждому" error={errors.amount} hint={category ? `Рекомендуемый диапазон: ${fmt(category.min ?? 0)}–${fmt(category.max ?? 0)}` : undefined} htmlFor="acc-amount">
              <div className="input-wrap"><input id="acc-amount" className={errors.amount ? 'input err' : 'input'} style={{ paddingLeft: 14 }} inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setErrors((x) => ({ ...x, amount: '' })); }} placeholder="Например, 3000" /><span className="input-suffix">РуКоинов</span></div>
            </Field>
            {category && n > 0 && (n < (category.min ?? 0) || n > (category.max ?? Infinity)) && !errors.amount && <div className="alert warn small"><Alert size={16} />Сумма вне рекомендуемого диапазона категории. Это допустимо, но HR увидит начисление в аналитике.</div>}
            <Field label="Комментарий: что сделал сотрудник" error={errors.comment} hint={`${comment.trim().length} символов, минимум ${s.minCommentLength}`} htmlFor="acc-comment">
              <textarea id="acc-comment" className={errors.comment ? 'textarea err' : 'textarea'} value={comment} onChange={(e) => { setComment(e.target.value); setErrors((x) => ({ ...x, comment: '' })); }} placeholder="Конкретный результат: что сделал и на что это повлияло" />
            </Field>
            <div className="card soft pad-sm">
              <div className="row between small"><span className="muted">Сотрудников</span><b>{selected.length}</b></div>
              <div className="row between small mt-4"><span className="muted">Итого из фонда</span><b className="num">{fmt(total)} <Coin ru /></b></div>
              <div className="row between small mt-4"><span className="muted">Останется в фонде</span><b className="num" style={{ color: total > q.left ? 'var(--red)' : undefined }}>{fmt(q.left - total)}</b></div>
            </div>
            <Button size="lg" icon={Award} onClick={() => validate() && setConfirm(true)} data-testid="accrue-submit">Начислить</Button>
          </div>
        </Card>
      </div>

      <Card className="pad-0">
        <div className="row between row-wrap" style={{ padding: '18px 18px 12px' }}>
          <div><h3>История начислений</h3><p className="small muted">Кто, кому, сколько, за что и когда</p></div>
          <div className="input-wrap" style={{ width: 260 }}><Search size={16} /><input className="input" value={histQ} onChange={(e) => setHistQ(e.target.value)} placeholder="Сотрудник или комментарий" aria-label="Поиск по истории" /></div>
        </div>
        {history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Дата и время</th><th>Начислил</th><th>Кому</th><th>Основание</th><th>Комментарий</th><th className="right">РуКоины</th></tr></thead>
              <tbody>
                {history.map((a) => {
                  const e = userById(db, a.employeeId);
                  return (
                    <tr key={a.id}>
                      <td className="nowrap small muted">{fmtDateTime(a.ts)}</td>
                      <td className="small">{m.name}</td>
                      <td>{e && <div className="row-sm"><Avatar user={e} size={26} /><span className="small strong">{e.name}</span></div>}</td>
                      <td><Badge>{s.accrualCategories.find((c) => c.id === a.categoryId)?.name ?? 'Категория удалена'}</Badge></td>
                      <td className="small text-2" style={{ maxWidth: 320 }}>{a.comment}</td>
                      <td className="right num strong">+{fmt(a.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Начислений пока нет" text="Здесь появится история ваших начислений." />}
      </Card>

      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Подтвердите начисление" confirmText={`Начислить ${fmt(total)} РуКоинов`} loading={busy === 'accrue'} onConfirm={submit}
        text={<div className="col" style={{ gap: 10 }}>
          <div>{selected.map((id) => userById(db, id)?.name).join(', ')}</div>
          <div><b>{fmt(n)}</b> РуКоинов каждому · {category?.name}</div>
          <div className="card soft pad-sm small">«{comment.trim()}»</div>
          <div className="small muted">Из фонда спишется {fmt(total)}, останется {fmt(q.left - total)}.</div>
        </div>} />
    </div>
  );
}

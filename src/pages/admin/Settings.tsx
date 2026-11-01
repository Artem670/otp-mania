import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { wheelEconomics, CATEGORY_LEVEL, deptName, managerQuarter, PET_LEVELS, poolRaised, productLevel, userById } from '../../data/selectors';
import { CATEGORY_LABELS, ORDER_STATUS_LABELS, POOL_STATUS_LABELS, type Category, type OrderStatus, type Product, type ProductCategory, type Settings } from '../../data/types';
import { cx, fmt, fmtDateTime, fmtNum } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Modal, PageHeader, PageSkeleton, ProductArt, Seg, useAction, usePageLoading } from '../../components/ui';
import { Pencil, Plus, Trash, Check, Ban, Package } from '../../components/icons';
import { PRODUCT_ICONS } from '../../components/icons';
import { STATUS_TONE } from '../employee/Orders';
import { CreatePoolModal, Contributors } from '../manager/ManagerPools';

type Tab = 'program' | 'targets' | 'rules' | 'categories' | 'products' | 'wheel' | 'orders' | 'pools';
const TABS: { value: Tab; label: string }[] = [
  { value: 'program', label: 'Программа' }, { value: 'targets', label: 'Цели метрик' }, { value: 'rules', label: 'Правила' }, { value: 'categories', label: 'Категории' },
  { value: 'products', label: 'Товары' }, { value: 'wheel', label: 'Колесо удачи' }, { value: 'orders', label: 'Заказы' }, { value: 'pools', label: 'Сборы' },
];

export default function SettingsPage() {
  const loading = usePageLoading('settings');
  const [tab, setTab] = useState<Tab>('program');
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Настройки программы" crumbs="Администрирование" subtitle="Курс, лимиты, бюджет, правила, справочники, товары, заказы и сборы. Изменения сразу действуют во всех разделах." />
      <div style={{ overflowX: 'auto' }}><Seg value={tab} onChange={setTab} ariaLabel="Раздел настроек" options={TABS} /></div>
      {tab === 'program' && <ProgramTab />}
      {tab === 'targets' && <TargetsTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'wheel' && <WheelTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'pools' && <PoolsTab />}
    </div>
  );
}

function NumField({ label, value, onChange, hint, step, suffix }: { label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number; suffix?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="input-wrap"><input className="input" style={{ paddingLeft: 14 }} type="number" step={step ?? 1} min={0} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />{suffix && <span className="input-suffix">{suffix}</span>}</div>
    </Field>
  );
}

function ProgramTab() {
  const db = useDB();
  const [s, setS] = useState<Settings>(db.settings);
  const { run, busy } = useAction();
  const managers = db.users.filter((u) => u.role === 'manager');
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  return (
    <div className="grid g2">
      <Card title="Валюты и бюджет">
        <div className="col" style={{ gap: 14 }}>
          <NumField label="Курс конвертации: коинов за 1 РуКоин" value={s.conversionRate} step={0.1} onChange={(v) => set('conversionRate', v)} hint="Используется в окне конвертации у всех сотрудников" />
          <NumField label="Стоимость 1 коина для банка" value={s.coinCostRub} step={0.01} suffix="₽" onChange={(v) => set('coinCostRub', v)} hint="Для расчёта обязательств по накопленным коинам" />
          <NumField label="Годовой бюджет программы" value={s.budgetRub} step={1000} suffix="₽" onChange={(v) => set('budgetRub', v)} />
        </div>
      </Card>
      <Card title="Лимиты начисления РуКоинов">
        <div className="col" style={{ gap: 14 }}>
          <NumField label="Максимум за одно начисление" value={s.maxPerAccrual} step={500} onChange={(v) => set('maxPerAccrual', v)} />
          <NumField label="Максимум одному сотруднику в месяц" value={s.maxPerEmployeeMonth} step={500} onChange={(v) => set('maxPerEmployeeMonth', v)} />
          <NumField label="Минимальная длина комментария" value={s.minCommentLength} onChange={(v) => set('minCommentLength', v)} suffix="симв." />
          <NumField label="Фонд руководителя по умолчанию, на квартал" value={s.quarterFundDefault} step={5000} onChange={(v) => set('quarterFundDefault', v)} />
        </div>
      </Card>
      <Card title="Фонды руководителей на квартал" subtitle="Сколько РуКоинов каждый может начислить в текущем квартале">
        <div className="col" style={{ gap: 10 }}>
          {managers.map((m) => {
            const q = managerQuarter(db, m.id);
            return (
              <div key={m.id} className="row">
                <Avatar user={m} size={32} />
                <div className="grow"><div className="small strong">{m.name}</div><div className="xs muted">{deptName(db, m.deptId)} · выдано {fmt(q.used)}</div></div>
                <input className="input" style={{ width: 130 }} type="number" step={5000} min={0} aria-label={`Фонд: ${m.name}`} value={s.managerFunds[m.id] ?? s.quarterFundDefault} onChange={(e) => set('managerFunds', { ...s.managerFunds, [m.id]: Number(e.target.value) })} />
              </div>
            );
          })}
        </div>
      </Card>
      <div className="col">
        <div className="alert info small">Изменения применяются сразу: окно конвертации, проверки лимитов при начислении и аналитика пересчитаются.</div>
        <div className="row-sm">
          <Button loading={busy === 'save'} disabled={!dirty} onClick={() => run('save', () => api.updateSettings(s), 'Настройки сохранены')} data-testid="settings-save">Сохранить настройки</Button>
          <Button variant="secondary" disabled={!dirty} onClick={() => setS(db.settings)}>Отменить изменения</Button>
        </div>
      </div>
    </div>
  );
}

function TargetsTab() {
  const db = useDB();
  const [t, setT] = useState(db.settings.metricTargets);
  const { run, busy } = useAction();
  const dirty = JSON.stringify(t) !== JSON.stringify(db.settings.metricTargets);
  const P = (k: 'er' | 'coverage' | 'mutualMax' | 'top1Max' | 'formalMax', label: string, hint?: string) => (
    <NumField label={label} hint={hint} suffix="%" step={1} value={Math.round(t[k] * 1000) / 10} onChange={(v) => setT({ ...t, [k]: v / 100 })} />
  );
  return (
    <div className="grid g2">
      <Card title="Целевые метрики" subtitle="Используются на странице «Метрики программы»">
        <div className="col" style={{ gap: 14 }}>
          {P('er', 'Engagement rate, цель', 'Доля сотрудников, активных в программе за месяц')}
          {P('coverage', 'A1 Охват признанием, цель', 'Доля сотрудников с признанием за квартал')}
          <NumField label="CSI наград, цель" step={0.05} suffix="из 5" value={t.csi} onChange={(v) => setT({ ...t, csi: v })} />
          <NumField label="Бюджет в масштабе банка" step={1_000_000} suffix="₽" value={t.bankBudgetRub} onChange={(v) => setT({ ...t, bankBudgetRub: v })} hint="Цель по затратам D. Годовой бюджет прототипа задаётся во вкладке «Программа»" />
        </div>
      </Card>
      <Card title="Пороги злоупотреблений" subtitle="Превышение подсвечивается красным и уходит на проверку">
        <div className="col" style={{ gap: 14 }}>
          {P('mutualMax', 'E1 Взаимные «спасибо», не больше')}
          {P('top1Max', 'E2 Доля РуКоинов у топ-1%, не больше')}
          {P('formalMax', 'E3 Доля за формальные активности, не больше', 'Какие категории формальные, отмечается во вкладке «Категории»')}
        </div>
        <div className="row mt-16"><Button disabled={!dirty} loading={busy === 't'} onClick={() => run('t', () => api.updateSettings({ metricTargets: t }), 'Цели метрик сохранены')}>Сохранить</Button>{dirty && <Button variant="ghost" onClick={() => setT(db.settings.metricTargets)}>Отменить</Button>}</div>
      </Card>
    </div>
  );
}

function ListEditor({ title, items, onChange }: { title: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <Card title={title} action={<Button size="sm" variant="secondary" icon={Plus} onClick={() => onChange([...items, ''])}>Пункт</Button>}>
      <div className="col" style={{ gap: 8 }}>
        {items.map((r, i) => (
          <div key={i} className="row-sm">
            <span className="xs muted" style={{ width: 18 }}>{i + 1}</span>
            <input className={cx('input', !r.trim() && 'err')} value={r} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`${title}, пункт ${i + 1}`} />
            <Button size="sm" variant="ghost" icon={Trash} aria-label="Удалить пункт" onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function RulesTab() {
  const db = useDB();
  const [rules, setRules] = useState(db.settings.rules);
  const [forbidden, setForbidden] = useState(db.settings.forbidden);
  const { run, busy } = useAction();
  return (
    <div className="stack-16">
      <div className="grid g2">
        <ListEditor title="Правила начисления" items={rules} onChange={setRules} />
        <ListEditor title="Запрещённые сценарии" items={forbidden} onChange={setForbidden} />
      </div>
      <Button loading={busy === 'r'} onClick={() => run('r', () => api.updateSettings({ rules, forbidden }), 'Регламент обновлён')}>Сохранить регламент</Button>
    </div>
  );
}

function CategoriesTab() {
  const db = useDB();
  const [edit, setEdit] = useState<{ kind: 'accrual' | 'thanks'; cat: Category } | null>(null);
  const [del, setDel] = useState<{ kind: 'accrual' | 'thanks'; cat: Category } | null>(null);
  const { run, busy } = useAction();
  const used = (kind: 'accrual' | 'thanks', id: string) => (kind === 'accrual' ? db.accruals.filter((a) => a.categoryId === id).length : db.thanks.filter((t) => t.categoryId === id).length);
  const block = (kind: 'accrual' | 'thanks', title: string, list: Category[]) => (
    <Card title={title} action={<Button size="sm" icon={Plus} onClick={() => setEdit({ kind, cat: { id: '', name: '', min: 1000, max: 3000, description: '' } })}>Добавить</Button>}>
      <div className="col" style={{ gap: 8 }}>
        {list.map((c) => (
          <div key={c.id} className="row card soft pad-sm">
            <div className="grow"><b className="small">{c.name}</b>{kind === 'accrual' && <div className="xs muted">{fmt(c.min ?? 0)}–{fmt(c.max ?? 0)} · {c.description}</div>}{c.formal && <span className="badge yellow mt-4">формальная · E3</span>}<div className="xs muted">использована {used(kind, c.id)} раз</div></div>
            <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Изменить ${c.name}`} onClick={() => setEdit({ kind, cat: c })} />
            <Button size="sm" variant="ghost" icon={Trash} aria-label={`Удалить ${c.name}`} onClick={() => setDel({ kind, cat: c })} />
          </div>
        ))}
      </div>
    </Card>
  );
  return (
    <div className="grid g2">
      {block('accrual', 'Категории начислений', db.settings.accrualCategories)}
      {block('thanks', 'Категории благодарностей', db.settings.thanksCategories)}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.cat.id ? 'Изменить категорию' : 'Новая категория'}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Отмена</Button><Button loading={busy === 'c'} onClick={async () => { const ok = await run('c', () => api.saveCategory(edit!.kind, edit!.cat).then(() => true), 'Категория сохранена'); if (ok) setEdit(null); }}>Сохранить</Button></>}>
        {edit && (
          <div className="col" style={{ gap: 14 }}>
            <Field label="Название"><input className="input" value={edit.cat.name} onChange={(e) => setEdit({ ...edit, cat: { ...edit.cat, name: e.target.value } })} /></Field>
            {edit.kind === 'accrual' && <>
              <div className="grid g2" style={{ gap: 10 }}>
                <NumField label="От" value={edit.cat.min ?? 0} step={500} onChange={(v) => setEdit({ ...edit, cat: { ...edit.cat, min: v } })} />
                <NumField label="До" value={edit.cat.max ?? 0} step={500} onChange={(v) => setEdit({ ...edit, cat: { ...edit.cat, max: v } })} />
              </div>
              <Field label="Когда использовать"><input className="input" value={edit.cat.description ?? ''} onChange={(e) => setEdit({ ...edit, cat: { ...edit.cat, description: e.target.value } })} /></Field>
              <label className="row-sm small"><input type="checkbox" checked={!!edit.cat.formal} onChange={(e) => setEdit({ ...edit, cat: { ...edit.cat, formal: e.target.checked } })} /> Формальная активность (посещение, обязательное обучение, опросы): считается в пороге E3</label>
            </>}
          </div>
        )}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger loading={busy === 'd'} title="Удалить категорию?" confirmText="Удалить"
        text={del ? `«${del.cat.name}» исчезнет из выбора. Старые записи (${used(del.kind, del.cat.id)}) сохранятся в истории.` : ''}
        onConfirm={async () => { await run('d', () => api.deleteCategory(del!.kind, del!.cat.id), 'Категория удалена'); setDel(null); }} />
    </div>
  );
}

const EMPTY_PRODUCT: Product = { id: '', name: '', category: 'merch', price: 1000, costRub: 200, stock: 50, active: true, description: '', icon: 'gift', tone: '#9E6FC3' };
function ProductsTab() {
  const db = useDB();
  const [edit, setEdit] = useState<Product | null>(null);
  const [q, setQ] = useState('');
  const { run, busy } = useAction();
  const list = db.products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const sold = useMemo(() => { const m = new Map<string, number>(); db.orders.filter((o) => o.status !== 'cancelled').forEach((o) => o.items.forEach((i) => m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty))); return m; }, [db]);
  return (
    <Card className="pad-0">
      <div className="row between row-wrap" style={{ padding: 18, gap: 10 }}>
        <input className="input" style={{ width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск товара" aria-label="Поиск товара" />
        <Button icon={Plus} onClick={() => setEdit({ ...EMPTY_PRODUCT })}>Добавить товар</Button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Товар</th><th>Категория</th><th className="right">Цена, коины</th><th className="right">Себестоимость</th><th className="right">Остаток</th><th className="right">Продано</th><th className="right">Ур. питомца</th><th>Статус</th><th /></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><div className="row-sm"><span style={{ width: 36, height: 36, borderRadius: 10, position: 'relative', overflow: 'hidden', flex: 'none' }}><ProductArt id={p.id} icon={p.icon} tone={p.tone} /></span><span className="small strong">{p.name}</span></div></td>
                <td className="small">{CATEGORY_LABELS[p.category]}</td>
                <td className="right num">{fmt(p.price)}</td>
                <td className="right num">{fmt(p.costRub)} ₽</td>
                <td className="right num">{p.stock > 900 ? '∞' : p.stock}</td>
                <td className="right num">{sold.get(p.id) ?? 0}</td>
                <td className="right num">{productLevel(p)}</td>
                <td><Badge tone={p.active ? 'green' : undefined}>{p.active ? 'В продаже' : 'Скрыт'}</Badge></td>
                <td className="right nowrap">
                  <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Изменить ${p.name}`} onClick={() => setEdit(p)} />
                  <Button size="sm" variant="ghost" onClick={() => run('t' + p.id, () => api.saveProduct({ ...p, active: !p.active }), p.active ? 'Товар скрыт из магазина' : 'Товар снова в продаже')} loading={busy === 't' + p.id}>{p.active ? 'Скрыть' : 'Вернуть'}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Редактировать товар' : 'Новый товар'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Отмена</Button><Button loading={busy === 'p'} onClick={async () => { const ok = await run('p', () => api.saveProduct(edit!).then(() => true), 'Товар сохранён'); if (ok) setEdit(null); }}>Сохранить</Button></>}>
        {edit && (
          <div className="grid g2" style={{ gap: 16 }}>
            <div className="col" style={{ gap: 12 }}>
              <Field label="Название"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <div className="grid g2" style={{ gap: 8 }}>
                <Field label="Категория"><select className="select" value={edit.category} onChange={(e) => { const c = e.target.value as ProductCategory; setEdit({ ...edit, category: c, currency: c === 'perks' ? 'rucoins' : edit.currency }); }}>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Продаётся за"><select className="select" value={edit.currency ?? 'coins'} onChange={(e) => setEdit({ ...edit, currency: e.target.value as 'coins' | 'rucoins' })}><option value="coins">Коины</option><option value="rucoins">РуКоины</option></select></Field>
              </div>
              <div className="grid g3" style={{ gap: 8 }}>
                <NumField label="Цена" value={edit.price} step={100} onChange={(v) => setEdit({ ...edit, price: v })} />
                <NumField label="Себест., ₽" value={edit.costRub} step={50} onChange={(v) => setEdit({ ...edit, costRub: v })} />
                <NumField label="Остаток" value={edit.stock} onChange={(v) => setEdit({ ...edit, stock: v })} />
              </div>
              <Field label="Доступен с уровня питомца" hint="По умолчанию уровень зависит от категории">
                <select className="select" value={edit.minLevel ?? ''} onChange={(e) => setEdit({ ...edit, minLevel: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">По категории (уровень {CATEGORY_LEVEL[edit.category]})</option>
                  {PET_LEVELS.map((L, i) => <option key={i} value={i + 1}>{i + 1} · {L.title}</option>)}
                </select>
              </Field>
              <label className="row-sm small"><input type="checkbox" checked={!!edit.limited} onChange={(e) => setEdit({ ...edit, limited: e.target.checked })} /> Уникальная или лимитированная позиция (метрика C4)</label>
              <Field label="Описание"><textarea className="textarea" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            </div>
            <div className="col" style={{ gap: 12 }}>
              <div style={{ aspectRatio: '1.3', position: 'relative', borderRadius: 16, overflow: 'hidden' }}><ProductArt id={edit.id || undefined} icon={edit.icon} tone={edit.tone} /></div>
              <div className="label">Иллюстрация</div>
              <div className="chips">{Object.entries(PRODUCT_ICONS).map(([k, I]) => <button key={k} className={cx('chip', edit.icon === k && 'on')} style={{ width: 38, padding: 0, justifyContent: 'center' }} aria-label={k} onClick={() => setEdit({ ...edit, icon: k })}><I size={16} /></button>)}</div>
              <div className="chips">{['#9E6FC3', '#6F3FA0', '#FF6A13', '#6E9E00', '#1F1F24', '#3A3A42', '#6E6E78', '#8E8E99'].map((c) => <button key={c} className={cx('chip', edit.tone === c && 'on')} style={{ width: 34, padding: 0, background: c, borderColor: edit.tone === c ? '#16161a' : c }} aria-label={`Цвет ${c}`} onClick={() => setEdit({ ...edit, tone: c })}>{edit.tone === c && <Check size={14} color="#fff" />}</button>)}</div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function OrdersTab() {
  const db = useDB();
  const [f, setF] = useState<OrderStatus | 'all'>('all');
  const [cancel, setCancel] = useState<string | null>(null);
  const { run, busy } = useAction();
  const list = db.orders.filter((o) => f === 'all' || o.status === f).sort((a, b) => b.ts - a.ts).slice(0, 60);
  const counts = (s: OrderStatus) => db.orders.filter((o) => o.status === s).length;
  return (
    <div className="stack-16">
      <Seg value={f} onChange={setF} ariaLabel="Статус заказов" options={[{ value: 'all', label: 'Все' }, ...(['new', 'processing', 'delivered', 'cancelled'] as OrderStatus[]).map((s) => ({ value: s, label: `${ORDER_STATUS_LABELS[s]} · ${counts(s)}` }))]} />
      {list.length ? (
        <Card className="pad-0"><div className="table-wrap"><table className="table">
          <thead><tr><th>Дата</th><th>Сотрудник</th><th>Состав</th><th className="right">Сумма</th><th>Статус</th><th>Действие</th></tr></thead>
          <tbody>
            {list.map((o) => {
              const u = userById(db, o.userId);
              return (
                <tr key={o.id}>
                  <td className="small muted nowrap">{fmtDateTime(o.ts)}</td>
                  <td>{u && <div className="row-sm"><Avatar user={u} size={24} /><span className="small">{u.name}</span></div>}</td>
                  <td className="small" style={{ maxWidth: 280 }}>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</td>
                  <td className="right num">{fmt(o.total)}{o.currency === 'rucoins' ? ' РуК' : ''}</td>
                  <td><Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge></td>
                  <td className="nowrap">
                    {o.status === 'new' && <Button size="sm" variant="secondary" loading={busy === o.id} onClick={() => run(o.id, () => api.setOrderStatus(o.id, 'processing'), 'Заказ передан в сборку')}>В сборку</Button>}
                    {o.status === 'processing' && <Button size="sm" loading={busy === o.id} onClick={() => run(o.id, () => api.setOrderStatus(o.id, 'delivered'), 'Заказ выдан')}>Выдан</Button>}
                    {(o.status === 'new' || o.status === 'processing') && <Button size="sm" variant="ghost" icon={Ban} onClick={() => setCancel(o.id)}>Отменить</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></Card>
      ) : <div className="card"><Empty icon={Package} title="Заказов с таким статусом нет" /></div>}
      <Confirm open={!!cancel} onClose={() => setCancel(null)} danger loading={busy === 'cancel'} title="Отменить заказ?" confirmText="Отменить и вернуть коины" text="Коины вернутся сотруднику, товар вернётся на склад."
        onConfirm={async () => { await run('cancel', () => api.setOrderStatus(cancel!, 'cancelled'), 'Заказ отменён, коины возвращены'); setCancel(null); }} />
    </div>
  );
}

function PoolsTab() {
  const db = useDB();
  const [create, setCreate] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [act, setAct] = useState<{ id: string; mode: 'complete' | 'cancel' } | null>(null);
  const { run, busy } = useAction();
  const list = [...db.pools].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.createdAt - a.createdAt);
  const pv = view ? db.pools.find((p) => p.id === view) : null;
  return (
    <Card className="pad-0">
      <div className="row between" style={{ padding: 18 }}><b>Все сборы</b><Button icon={Plus} onClick={() => setCreate(true)}>Создать сбор</Button></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Сбор</th><th>Организатор</th><th>Для кого</th><th className="right">Собрано</th><th>Статус</th><th /></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td className="small strong">{p.title}</td>
              <td className="small">{userById(db, p.organizerId)?.name}</td>
              <td className="small">{deptName(db, p.scope)}</td>
              <td className="right num small">{fmt(poolRaised(p))} / {fmt(p.target)}</td>
              <td><Badge tone={p.status === 'active' ? 'orange' : p.status === 'completed' ? 'green' : 'red'}>{POOL_STATUS_LABELS[p.status]}</Badge></td>
              <td className="nowrap right">
                <Button size="sm" variant="ghost" onClick={() => setView(p.id)}>Участники</Button>
                {p.status === 'active' && <><Button size="sm" variant="ghost" icon={Check} onClick={() => setAct({ id: p.id, mode: 'complete' })}>Завершить</Button><Button size="sm" variant="ghost" icon={Ban} onClick={() => setAct({ id: p.id, mode: 'cancel' })}>Отменить</Button></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <CreatePoolModal open={create} onClose={() => setCreate(false)} />
      <Modal open={!!pv} onClose={() => setView(null)} title={pv?.title ?? ''}>{pv && <Contributors p={pv} />}</Modal>
      <Confirm open={!!act} onClose={() => setAct(null)} danger={act?.mode === 'cancel'} loading={busy === 'pc'} title={act?.mode === 'cancel' ? 'Отменить сбор?' : 'Завершить сбор?'} confirmText={act?.mode === 'cancel' ? 'Отменить и вернуть коины' : 'Завершить'}
        text={act?.mode === 'cancel' ? 'Все вклады вернутся участникам.' : 'Участники получат уведомление о завершении.'}
        onConfirm={async () => { await run('pc', () => api.closePool(act!.id, act!.mode), act!.mode === 'cancel' ? 'Сбор отменён' : 'Сбор завершён'); setAct(null); }} />
    </Card>
  );
}

function WheelTab() {
  const db = useDB();
  const [price, setPrice] = useState(db.settings.spinPrice);
  const [limit, setLimit] = useState(db.settings.spinLimit);
  const [prizes, setPrizes] = useState(db.settings.wheelPrizes);
  const { run, busy } = useAction();
  const eco = wheelEconomics({ ...db, settings: { ...db.settings, spinPrice: price, wheelPrizes: prizes } });
  const spins = db.txs.filter((t) => t.kind === 'wheel').length;
  const sum = prizes.reduce((a, p) => a + (Number.isFinite(p.prob) ? p.prob : 0), 0);
  return (
    <div className="grid g-main">
      <Card title="Призы и вероятности" subtitle={`Сумма вероятностей: ${sum.toFixed(1).replace('.', ',')}% (должно быть 100%)`} className="pad-0">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Приз</th><th className="right">Шанс, %</th><th className="right">Себестоимость, ₽</th><th className="right">Возврат коинов</th></tr></thead>
          <tbody>
            {prizes.map((p, i) => (
              <tr key={p.id}>
                <td className="small">{p.name}</td>
                <td className="right"><input className={cx('input', Math.abs(sum - 100) > 0.01 && 'err')} style={{ width: 90, height: 34, textAlign: 'right' }} type="number" step={0.1} min={0} value={Number.isFinite(p.prob) ? p.prob : ''} aria-label={`Шанс: ${p.name}`} onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, prob: e.target.value === '' ? NaN : Number(e.target.value) } : x)))} /></td>
                <td className="right num small">{fmt(p.costRub)}</td>
                <td className="right num small">{p.coins ? fmt(p.coins) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      <div className="stack-16">
        <Card title="Параметры">
          <div className="col" style={{ gap: 14 }}>
            <NumField label="Цена прокрутки" value={price} step={100} suffix="коинов" onChange={setPrice} />
            <NumField label="Лимит прокруток в месяц на человека" value={limit} onChange={setLimit} />
            <Button loading={busy === 'w'} onClick={() => run('w', () => api.updateSettings({ spinPrice: price, spinLimit: limit, wheelPrizes: prizes }), 'Настройки колеса сохранены')}>Сохранить</Button>
          </div>
        </Card>
        <Card title="Экономика прокрутки" className="dark">
          <div className="col" style={{ gap: 8 }}>
            <div className="row between small"><span className="muted">Чистое списание коинов</span><b className="num">{fmt(eco.netCoins)}</b></div>
            <div className="row between small"><span className="muted">Номинал списанных коинов</span><b className="num">{fmt(eco.nominalRub)} ₽</b></div>
            <div className="row between small"><span className="muted">Ожидаемая себестоимость призов</span><b className="num">{fmtNum(eco.expCost, 1)} ₽</b></div>
            <div className="row between small"><span className="muted">Себестоимость 1 коина в колесе</span><b className="num">{fmtNum(eco.costPerCoin, 3)} ₽</b></div>
            <div className="row between small"><span className="muted">Для сравнения: в сертификатах</span><b className="num">{fmtNum(db.settings.coinCostRub, 3)} ₽</b></div>
            <div className="row between small"><span className="muted">Прокруток за всё время</span><b className="num">{spins}</b></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

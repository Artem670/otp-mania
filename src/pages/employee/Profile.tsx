import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { deptName, me as selectMe, petLevel, poolRaised, poolVisibleTo, rating, userById } from '../../data/selectors';
import type { Tx } from '../../data/types';
import { useRouter, Link } from '../../lib/router';
import { ago, fmt, fmtDate, fmtNum } from '../../lib/utils';
import { Amount, Avatar, Badge, Button, Card, Coin, Empty, Field, Modal, PageSkeleton, Progress, Seg, Stat, useAction, usePageLoading, useToast } from '../../components/ui';
import { Sparkles, Convert, HandHeart, Award, Package, Paw, Trophy, Store, PiggyBank, Upload, ArrowRight, Receipt, Gift, Heart } from '../../components/icons';
import { SendThanksForm } from './Thanks';
import { PulseCard } from '../../components/PulseCard';
import { CharityBanner } from '../../components/CharityBanner';
import type { IconType } from 'react-icons';

export const TX_ICONS: Record<Tx['kind'], IconType> = {
  accrual: Award, conversion_in: Convert, conversion_out: Convert, order: Store, pool: PiggyBank, refund: Receipt, pet: Paw, wheel: Sparkles,
};

export function OpRow({ t }: { t: Tx }) {
  const Icon = TX_ICONS[t.kind];
  return (
    <div className="op">
      <span className="op-ic"><Icon size={17} /></span>
      <div className="grow"><div className="small strong ellipsis">{t.title}</div><div className="xs muted">{ago(t.ts)}</div></div>
      <span className={`num small ${t.amount > 0 ? 'amount-pos' : 'amount-neg'}`}>{t.amount > 0 ? '+' : '−'}{fmt(Math.abs(t.amount))} <Coin ru={t.currency === 'rucoins'} /></span>
    </div>
  );
}

export function ConvertModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDB();
  const u = selectMe(db)!;
  const rate = db.settings.conversionRate;
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { run, busy } = useAction();
  const n = Number(val.replace(/\s/g, ''));
  const coins = Number.isFinite(n) && n > 0 ? Math.floor(n * rate) : 0;
  const validate = () => {
    if (!val.trim()) return 'Введите количество РуКоинов';
    if (!Number.isInteger(n) || n <= 0) return 'Только целое число больше нуля';
    if (n > u.rucoins) return `Недостаточно РуКоинов: доступно ${fmt(u.rucoins)}`;
    return null;
  };
  const submit = async () => {
    const e = validate(); setErr(e); if (e) return;
    const r = await run('cv', () => api.convert(n), (c) => `Готово: +${fmt(c)} коинов на балансе`);
    if (r !== undefined) { setVal(''); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Конвертация РуКоинов в коины" subtitle="РуКоины отражают признание. Коины тратятся в магазине, на сборы и питомца."
      footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button loading={busy === 'cv'} onClick={submit} disabled={!u.rucoins}>Подтвердить конвертацию</Button></>}>
      <div className="col" style={{ gap: 16 }}>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="card soft pad-sm"><div className="xs muted">Доступно РуКоинов</div><div className="mt-4"><Amount value={u.rucoins} ru /></div></div>
          <div className="card soft pad-sm"><div className="xs muted">Курс</div><div className="mt-4 strong">1 <Coin ru /> = {fmtNum(rate, rate % 1 ? 2 : 0)} <Coin /></div></div>
        </div>
        <Field label="Сколько РуКоинов конвертировать" error={err} htmlFor="cv-amount">
          <div className="input-wrap"><input id="cv-amount" className={err ? 'input err' : 'input'} inputMode="numeric" value={val} onChange={(e) => { setVal(e.target.value.replace(/[^\d]/g, '')); setErr(null); }} placeholder="Например, 2000" style={{ paddingLeft: 14 }} /><span className="input-suffix">РуКоинов</span></div>
        </Field>
        <div className="chips">
          {[0.25, 0.5, 1].map((p) => <button key={p} className="chip" onClick={() => { setVal(String(Math.floor(u.rucoins * p))); setErr(null); }} disabled={!u.rucoins}>{p === 1 ? 'Всё' : `${p * 100}%`}</button>)}
        </div>
        <div className="card dark pad-sm row between">
          <span className="muted">Вы получите</span>
          <span className="price" style={{ fontSize: 22 }}>{fmt(coins)} <Coin /></span>
        </div>
        {!u.rucoins && <div className="alert info small">РуКоинов пока нет. Их начисляет руководитель за вклад в работу.</div>}
      </div>
    </Modal>
  );
}

export default function Profile() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('profile');
  const { navigate } = useRouter();
  const [convert, setConvert] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [filter, setFilter] = useState<'all' | 'coins' | 'rucoins'>('all');
  const [showAll, setShowAll] = useState(false);
  const { run } = useAction();
  const toast = useToast();

  const ops = useMemo(() => db.txs.filter((t) => t.userId === u.id && (filter === 'all' || t.currency === filter)).sort((a, b) => b.ts - a.ts), [db, u.id, filter]);
  const place = useMemo(() => rating(db, { period: 'quarter' }).find((r) => r.user.id === u.id), [db, u.id]);
  const gotThanks = useMemo(() => db.thanks.filter((t) => t.toId === u.id).sort((a, b) => b.ts - a.ts), [db, u.id]);
  const pools = db.pools.filter((p) => p.status === 'active' && poolVisibleTo(p, u)).slice(0, 2);
  const orders = db.orders.filter((o) => o.userId === u.id);
  const lvl = petLevel(u.pet.xp);

  if (loading) return <PageSkeleton />;

  const onPhoto = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('error', 'Нужен файл изображения: JPG или PNG');
    if (f.size > 1.5 * 1024 * 1024) return toast('error', 'Фото должно быть не больше 1,5 МБ');
    const r = new FileReader();
    r.onload = () => run('ph', () => api.updateProfile({ avatar: String(r.result) }), 'Фото обновлено');
    r.readAsDataURL(f);
  };

  return (
    <div className="stack-24">
      <div className="card hero-profile">
        <label style={{ position: 'relative', cursor: 'pointer' }} title="Загрузить фото">
          <Avatar user={u} size={84} />
          <span style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: '50%', background: '#fff', border: '1px solid var(--border)', display: 'grid', placeItems: 'center' }}><Upload size={14} /></span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} aria-label="Загрузить фото профиля" />
        </label>
        <div>
          <h1>{u.name}</h1>
          <div className="text-2 mt-4">{u.title} · {deptName(db, u.deptId)}</div>
          <div className="row-sm row-wrap mt-8">
            <Badge tone="dark">{u.role === 'employee' ? 'Сотрудник' : u.role === 'manager' ? 'Руководитель' : 'Администратор'}</Badge>
            <Badge>В банке с {new Date(u.joinedAt).getFullYear()} года</Badge>
            {lvl >= 5 && <Badge tone="orange">Легенда</Badge>}
          </div>
        </div>
        <div className="row-sm row-wrap">
          <Button icon={Convert} onClick={() => setConvert(true)}>Конвертировать</Button>
          <Button variant="orange" icon={HandHeart} onClick={() => setThanks(true)}>Отправить благодарность</Button>
        </div>
      </div>
      <CharityBanner />
      <PulseCard />

      <div className="grid g-main">
        <div className="stack-16">
          <div className="wallets">
            <div className="wallet coins">
              <div className="row-sm muted small"><Coin /> Коины</div>
              <div className="amount num" data-testid="balance-coins">{fmt(u.coins)}</div>
              <div className="small muted mt-8">Тратятся в магазине, на сборы и питомца</div>
              <div className="row-sm mt-16"><Button size="sm" variant="orange" icon={Store} onClick={() => navigate('/cabinet/shop')}>В магазин</Button></div>
              <div className="deco" />
            </div>
            <div className="wallet ru">
              <div className="row-sm text-2 small"><Coin ru /> РуКоины</div>
              <div className="amount num" data-testid="balance-rucoins">{fmt(u.rucoins)}</div>
              <div className="small text-2 mt-8">Признание от руководителя. Курс: 1 = {fmtNum(db.settings.conversionRate, db.settings.conversionRate % 1 ? 2 : 0)} коин</div>
              <div className="row-sm mt-16"><Button size="sm" icon={Convert} onClick={() => setConvert(true)} disabled={!u.rucoins}>Конвертировать</Button></div>
            </div>
          </div>
          <div className="grid g4" style={{ gap: 12 }}>
            <Stat icon={Trophy} label="Место в рейтинге" value={place ? `${place.place}` : '—'} hint="за квартал" />
            <Stat icon={Heart} label="Благодарностей" value={gotThanks.length} hint="получено всего" />
            <Stat icon={Package} label="Заказов" value={orders.length} hint={`${orders.filter((o) => o.status === 'new' || o.status === 'processing').length} в работе`} />
            <Stat icon={Paw} label="Питомец" value={`ур. ${lvl}`} hint={u.pet.name} />
          </div>
          <Card title="История операций" subtitle="Все начисления, конвертации и траты" action={<Seg value={filter} onChange={setFilter} ariaLabel="Фильтр операций" options={[{ value: 'all', label: 'Все' }, { value: 'coins', label: 'Коины' }, { value: 'rucoins', label: 'РуКоины' }]} />}>
            {ops.length ? (
              <>
                {(showAll ? ops : ops.slice(0, 8)).map((t) => <OpRow key={t.id} t={t} />)}
                {ops.length > 8 && <Button variant="ghost" size="sm" className="mt-8" onClick={() => setShowAll(!showAll)}>{showAll ? 'Свернуть' : `Показать все (${ops.length})`}</Button>}
              </>
            ) : <Empty title="Операций пока нет" text="Здесь появятся начисления РуКоинов, конвертации и покупки." />}
          </Card>
        </div>
        <div className="stack-16">
          <Card title="Мне говорят спасибо" action={<Link to="/cabinet/thanks" className="small row-sm">Все <ArrowRight size={14} /></Link>}>
            {gotThanks.length ? gotThanks.slice(0, 3).map((t) => {
              const f = userById(db, t.fromId);
              const cat = db.settings.thanksCategories.find((c) => c.id === t.categoryId);
              return (
                <div key={t.id} className="op" style={{ gridTemplateColumns: '36px 1fr' }}>
                  {f && <Avatar user={f} size={36} />}
                  <div><div className="small"><b>{f?.name}</b> <span className="muted">· {cat?.name ?? 'Спасибо'}</span></div><div className="small text-2 mt-4">«{t.message}»</div><div className="xs muted mt-4">{ago(t.ts)}</div></div>
                </div>
              );
            }) : <Empty icon={Heart} title="Пока тихо" text="Благодарности коллег появятся здесь." />}
          </Card>
          <Card title="Сборы для вас" action={<Link to="/cabinet/pools" className="small row-sm">Все <ArrowRight size={14} /></Link>}>
            {pools.length ? pools.map((p) => (
              <div key={p.id} className="mb-12">
                <div className="row between small"><b className="ellipsis">{p.title}</b><span className="muted nowrap">до {fmtDate(p.deadline)}</span></div>
                <div className="mt-8"><Progress value={poolRaised(p) / p.target} tone="orange" thin label={p.title} /></div>
                <div className="xs muted mt-4">{fmt(poolRaised(p))} из {fmt(p.target)} коинов</div>
              </div>
            )) : <Empty icon={PiggyBank} title="Активных сборов нет" />}
          </Card>
          <Card className="accent">
            <div className="row"><Gift size={22} /><div><b>Зимний дроп 15 ноября</b><div className="small text-2">Худи, шапки и термокружки. {lvl < 3 ? 'Одежда откроется на 3 уровне питомца.' : 'Витрина одежды у вас уже открыта.'}</div></div></div>
          </Card>
        </div>
      </div>
      <ConvertModal open={convert} onClose={() => setConvert(false)} />
      <SendThanksModal open={thanks} onClose={() => setThanks(false)} />
    </div>
  );
}

export function SendThanksModal({ open, onClose, toId }: { open: boolean; onClose: () => void; toId?: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Отправить благодарность" subtitle="Благодарность бесплатная. Она поднимает рейтинг коллеги, который видит руководитель." size="lg">
      <SendThanksForm initialTo={toId} onSent={onClose} compact />
    </Modal>
  );
}

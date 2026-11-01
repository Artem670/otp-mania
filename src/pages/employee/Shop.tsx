import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { cartOf, CATEGORY_LEVEL, isUnlocked, me as selectMe, petLevel, PET_LEVELS, productLevel } from '../../data/selectors';
import { CATEGORY_LABELS, type Product, type ProductCategory } from '../../data/types';
import { useRouter } from '../../lib/router';
import { cx, fmt } from '../../lib/utils';
import { Amount, Badge, Button, Coin, Empty, Modal, PageHeader, ProductArt, Skeleton, useAction, usePageLoading } from '../../components/ui';
import { Cart, Check, Lock, Minus, Plus, Search, Store } from '../../components/icons';

export const isLocked = (p: Product, xp: number) => !isUnlocked(p, xp);

type Sort = 'popular' | 'cheap' | 'expensive';

export default function Shop({ productId, initialCat }: { productId?: string; initialCat?: string }) {
  const db = useDB();
  const u = selectMe(db)!;
  const { navigate } = useRouter();
  const loading = usePageLoading('shop');
  const [cat, setCat] = useState<ProductCategory | 'all'>(initialCat && initialCat in CATEGORY_LABELS ? (initialCat as ProductCategory) : 'all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('popular');
  const { run, busy } = useAction();
  const cart = cartOf(db, u.id);

  const popularity = useMemo(() => {
    const m = new Map<string, number>();
    db.orders.forEach((o) => o.items.forEach((i) => m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty)));
    return m;
  }, [db]);
  const hits = useMemo(() => new Set([...popularity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0])), [popularity]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const items = db.products.filter((p) => p.active && (cat === 'all' || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s)));
    return items.sort((a, b) => (sort === 'cheap' ? a.price - b.price : sort === 'expensive' ? b.price - a.price : (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0)));
  }, [db, cat, q, sort, popularity]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    db.products.filter((p) => p.active).forEach((p) => { c.all++; c[p.category] = (c[p.category] ?? 0) + 1; });
    return c;
  }, [db]);

  const add = (p: Product) => run('add-' + p.id, () => api.addToCart(p.id), `«${p.name}» в корзине`);
  const redeem = (p: Product) => run('ru-' + p.id, () => api.redeemPerk(p.id), `«${p.name}» ваша! Согласуйте дату с руководителем`);
  const open = productId ? db.products.find((p) => p.id === productId) : null;

  return (
    <div className="stack-24">
      <PageHeader title="Магазин" subtitle={<>Ваш баланс: <Amount value={u.coins} /> и <Amount value={u.rucoins} ru />. Нематериальные награды получают за РуКоины. Электронные сертификаты приходят на почту, физические товары выдаются в офисе.</>}
        actions={<Button variant="secondary" icon={Cart} onClick={() => navigate('/cabinet/cart')}>Корзина{cart.length ? ` · ${cart.reduce((a, l) => a + l.qty, 0)}` : ''}</Button>} />
      <PetShopBanner />
      <div className="row row-wrap between" style={{ gap: 12 }}>
        <div className="chips" role="tablist" aria-label="Категории">
          {(['all', ...Object.keys(CATEGORY_LABELS)] as (ProductCategory | 'all')[]).map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} className={cx('chip', cat === c && 'on')} onClick={() => setCat(c)}>
              {c !== 'all' && petLevel(u.pet.xp) < CATEGORY_LEVEL[c] && <Lock size={12} />}{c === 'all' ? 'Все товары' : CATEGORY_LABELS[c]}<span className="count">{counts[c] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="row-sm">
          <div className="input-wrap" style={{ width: 240 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск товара" aria-label="Поиск товара" /></div>
          <select className="select" style={{ width: 170 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
            <option value="popular">Популярные</option><option value="cheap">Сначала дешевле</option><option value="expensive">Сначала дороже</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="products">{Array.from({ length: 8 }, (_, i) => <div key={i}><Skeleton h={220} r={22} /><div className="mt-8"><Skeleton h={14} w="70%" /></div></div>)}</div>
      ) : list.length ? (
        <div className="products">
          {list.map((p) => {
            const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0;
            const locked = isLocked(p, u.pet.xp);
            return (
              <article key={p.id} className="product" data-testid={`product-${p.id}`}>
                <button className="product-img" onClick={() => navigate(`/cabinet/shop/${p.id}`)} aria-label={`Открыть «${p.name}»`}>
                  <ProductArt id={p.id} icon={p.icon} tone={p.tone} />
                  <span className="tag">{p.stock <= 10 ? <Badge tone="orange">Осталось {p.stock}</Badge> : hits.has(p.id) ? <Badge tone="dark">Хит</Badge> : null}</span>
                </button>
                <div className="product-body">
                  <div className="xs muted">{CATEGORY_LABELS[p.category]}</div>
                  <button className="product-name" onClick={() => navigate(`/cabinet/shop/${p.id}`)}>{p.name}</button>
                  <div className="row between mt-4" style={{ marginTop: 'auto' }}>
                    <Amount value={p.price} ru={p.currency === 'rucoins'} />
                    {p.currency === 'rucoins' ? (p.stock === 0 ? <Badge tone="red">Мест нет</Badge>
                      : <Button size="sm" variant="orange" loading={busy === 'ru-' + p.id} disabled={u.rucoins < p.price} onClick={() => redeem(p)} aria-label={`Получить «${p.name}» за РуКоины`} data-testid={`redeem-${p.id}`}>{u.rucoins < p.price ? 'Не хватает' : 'Получить'}</Button>)
                      : locked ? <Badge><Lock size={12} />Питомец ур. {productLevel(p)}</Badge>
                      : p.stock === 0 ? <Badge tone="red">Нет в наличии</Badge>
                      : <Button size="sm" variant={inCart ? 'soft' : 'primary'} icon={inCart ? Check : Plus} loading={busy === 'add-' + p.id} onClick={() => add(p)} aria-label={`Добавить «${p.name}» в корзину`}>{inCart ? `${inCart} в корзине` : 'В корзину'}</Button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card"><Empty icon={Store} title="Ничего не нашлось" text="Попробуйте другую категорию или запрос." action={<Button variant="secondary" onClick={() => { setQ(''); setCat('all'); }}>Сбросить фильтры</Button>} /></div>
      )}
      {open && <ProductModal p={open} onClose={() => navigate('/cabinet/shop')} />}
      {productId && !open && !loading && <Modal open onClose={() => navigate('/cabinet/shop')} title="Товар не найден"><Empty title="Товар снят с продажи" /></Modal>}
    </div>
  );
}

function ProductModal({ p, onClose }: { p: Product; onClose: () => void }) {
  const db = useDB();
  const u = selectMe(db)!;
  const { navigate } = useRouter();
  const [qty, setQty] = useState(1);
  const { run, busy } = useAction();
  const locked = isLocked(p, u.pet.xp);
  const sold = db.orders.reduce((a, o) => a + o.items.filter((i) => i.productId === p.id).reduce((x, i) => x + i.qty, 0), 0);
  const ru = p.currency === 'rucoins';
  const enough = u.coins >= p.price * qty;
  const add = async (thenCart: boolean) => {
    const ok = await run('m-add', () => api.addToCart(p.id, qty).then(() => true), `«${p.name}» × ${qty} в корзине`);
    if (ok && thenCart) navigate('/cabinet/cart');
  };
  return (
    <Modal open onClose={onClose} title={p.name} size="lg">
      <div className="grid g2" style={{ gap: 22 }}>
        <div className="product-img" style={{ borderRadius: 18, cursor: 'default', aspectRatio: '1' }}><ProductArt id={p.id} icon={p.icon} tone={p.tone} size="lg" /></div>
        <div className="col" style={{ gap: 14 }}>
          <div className="row-sm row-wrap"><Badge>{CATEGORY_LABELS[p.category]}</Badge>{sold > 0 && <Badge tone="orange">Купили {sold} раз</Badge>}</div>
          <p className="text-2">{p.description}</p>
          <div className="price" style={{ fontSize: 28 }}>{fmt(p.price)} <Coin ru={ru} /></div>
          <div className="small muted">{p.stock > 100 ? 'В наличии' : `На складе: ${p.stock} шт.`}</div>
          {ru ? (
            <>
              <div className="alert info small">Нематериальная награда за РуКоины: банку она ничего не стоит, а сотруднику даёт время. После получения согласуйте дату с руководителем.</div>
              {u.rucoins < p.price && <div className="alert warn small">На балансе {fmt(u.rucoins)} РуКоинов, не хватает {fmt(p.price - u.rucoins)}.</div>}
              <div><Button variant="orange" loading={busy === 'm-ru'} disabled={u.rucoins < p.price || p.stock === 0} onClick={async () => { const ok = await run('m-ru', () => api.redeemPerk(p.id).then(() => true), `«${p.name}» ваша! Согласуйте дату с руководителем`); if (ok) onClose(); }}>Получить за {fmt(p.price)} РуКоинов</Button></div>
            </>
          ) : locked ? (
            <div className="alert info small"><Lock size={16} /><span className="grow">Откроется на {productLevel(p)} уровне питомца ({PET_LEVELS[productLevel(p) - 1].title}). Сейчас у вас {petLevel(u.pet.xp)} уровень.</span><Button size="sm" variant="secondary" onClick={() => navigate('/cabinet/pet')}>К питомцу</Button></div>
          ) : p.stock === 0 ? <div className="alert err small">Товар закончился</div> : (
            <>
              <div className="row">
                <div className="qty" aria-label="Количество">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Меньше"><Minus size={14} /></button>
                  <span className="num">{qty}</span>
                  <button onClick={() => setQty(Math.min(p.stock, qty + 1))} aria-label="Больше"><Plus size={14} /></button>
                </div>
                <span className="small muted">Итого: <b className="num">{fmt(p.price * qty)}</b></span>
              </div>
              {!enough && <div className="alert warn small">На балансе {fmt(u.coins)} коинов. Не хватает {fmt(p.price * qty - u.coins)}, но товар можно отложить в корзину.</div>}
              <div className="row-sm row-wrap">
                <Button icon={Cart} loading={busy === 'm-add'} onClick={() => add(false)}>В корзину</Button>
                <Button variant="secondary" onClick={() => add(true)}>Купить сейчас</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Баннер: какие витрины открыл питомец и что откроет следующий уровень. */
function PetShopBanner() {
  const db = useDB();
  const u = selectMe(db)!;
  const { navigate } = useRouter();
  const lvl = petLevel(u.pet.xp);
  const next = PET_LEVELS[lvl];
  return (
    <div className="card accent row row-wrap" style={{ gap: 16, padding: 16 }}>
      <div className="grow" style={{ minWidth: 240 }}>
        <div className="small strong">Питомец {u.pet.name}: уровень {lvl} из {PET_LEVELS.length}</div>
        <div className="xs text-2 mt-4">Открыто: {PET_LEVELS.slice(0, lvl).map((L) => L.perk.split(':')[0].toLowerCase()).join(', ')}.</div>
        {next && <div className="xs text-2 mt-4">Следующий уровень откроет: <b>{next.perk.toLowerCase()}</b>. Нужно ещё {fmt(next.xp - u.pet.xp)} опыта.</div>}
        {next && <div className="progress thin orange mt-8" style={{ maxWidth: 360, background: 'var(--card)' }}><i style={{ width: `${((u.pet.xp - PET_LEVELS[lvl - 1].xp) / (next.xp - PET_LEVELS[lvl - 1].xp)) * 100}%` }} /></div>}
      </div>
      {next && <Button size="sm" onClick={() => navigate('/cabinet/pet')}>Прокачать питомца</Button>}
    </div>
  );
}

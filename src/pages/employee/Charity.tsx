import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { charityTotals, me as selectMe, poolRaised, poolVisibleTo } from '../../data/selectors';
import type { Pool } from '../../data/types';
import { fmt, fmtDate, plural } from '../../lib/utils';
import { Badge, Button, Card, Coin, Empty, PageHeader, PageSkeleton, ProductArt, Seg, useAction, usePageLoading } from '../../components/ui';
import { HandHeart, Heart, PiggyBank } from '../../components/icons';
import { PoolCard, SupportModal } from './Pools';

/** Отдельная вкладка благотворительности: сборы для фондов, пожертвование в один клик, мой вклад. */
export default function Charity() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('charity');
  const { run, busy } = useAction();
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [support, setSupport] = useState<Pool | null>(null);
  const t = useMemo(() => charityTotals(db), [db]);
  const rate = db.settings.coinCostRub;
  const pools = db.pools.filter((p) => p.kind === 'charity' && poolVisibleTo(p, u));
  const list = pools.filter((p) => (tab === 'active' ? p.status === 'active' : p.status !== 'active')).sort((a, b) => b.createdAt - a.createdAt);
  const products = db.products.filter((p) => p.active && p.category === 'charity');
  const charityIds = new Set(products.map((p) => p.id).concat(db.products.filter((p) => p.category === 'charity').map((p) => p.id)));
  const mine = useMemo(() => {
    const fromPools = pools.flatMap((p) => p.contributions.filter((c) => c.userId === u.id).map((c) => ({ ts: c.ts, title: p.title, coins: c.amount })));
    const fromShop = db.orders.filter((o) => o.userId === u.id && o.status !== 'cancelled').flatMap((o) => o.items.filter((i) => charityIds.has(i.productId)).map((i) => ({ ts: o.ts, title: i.name, coins: i.price * i.qty })));
    return [...fromPools, ...fromShop].sort((a, b) => b.ts - a.ts);
  }, [db, u.id]);
  const myCoins = mine.reduce((a, x) => a + x.coins, 0);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Благотворительность" subtitle="Помогаем фондам вместе: можно поддержать сбор всем банком или пожертвовать сразу." />

      <section className="charity-banner" data-testid="charity-hero">
        <div className="charity-copy">
          <span className="badge" style={{ background: 'var(--orange)', color: 'var(--black)' }}><Heart size={12} /> Помогаем вместе</span>
          <h2 className="mt-12">Вместе уже направили {fmt(t.rub)} ₽</h2>
          <p className="mt-8">{fmt(t.coins)} коинов от {t.donors} {plural(t.donors, 'сотрудника', 'сотрудников', 'сотрудников')}. 1 000 коинов = {fmt(1000 * rate)} ₽ фонду.</p>
        </div>
        <div className="charity-pools">
          <div className="charity-pool" style={{ cursor: 'default' }}><span className="xs">Ваш вклад</span><b style={{ fontSize: 26 }}>{fmt(myCoins)} <Coin /></b><span className="xs">≈ {fmt(myCoins * rate)} ₽ фондам</span></div>
          <div className="charity-pool" style={{ cursor: 'default' }}><span className="xs">Активных сборов</span><b style={{ fontSize: 26 }}>{pools.filter((p) => p.status === 'active').length}</b><span className="xs">для фондов, всем банком</span></div>
        </div>
      </section>

      {products.length > 0 && (
        <div>
          <div className="row between mb-12 row-wrap"><h2>Пожертвовать сразу</h2><span className="small muted">Без сбора и корзины, в один клик</span></div>
          <div className="grid g3">
            {products.map((p) => (
              <Card key={p.id} className="pad-0 charity-card">
                <div className="product-img" style={{ cursor: 'default' }}><ProductArt id={p.id} icon={p.icon} tone={p.tone} /></div>
                <div style={{ padding: 16 }} className="col">
                  <b>{p.name}</b>
                  <span className="small text-2">{p.description}</span>
                  <div className="row between row-wrap mt-4">
                    <span className="small muted">{fmt(p.price)} <Coin /> → {fmt(p.price * rate)} ₽ фонду</span>
                    <Button size="sm" variant="orange" icon={HandHeart} loading={busy === 'don-' + p.id} disabled={u.coins < p.price} onClick={() => run('don-' + p.id, () => api.donate(p.id), `Спасибо! ${fmt(p.price)} коинов направлены в фонд`)} data-testid={`donate-${p.id}`}>{u.coins < p.price ? 'Не хватает коинов' : `Пожертвовать ${fmt(p.price)}`}</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="row between mb-12 row-wrap"><h2>Сборы для фондов</h2><Seg value={tab} onChange={setTab} ariaLabel="Сборы" options={[{ value: 'active', label: 'Идут сейчас' }, { value: 'done', label: 'Завершённые' }]} /></div>
        {list.length ? (
          <div className="pools">
            {list.map((p) => {
              const my = p.contributions.filter((c) => c.userId === u.id).reduce((a, c) => a + c.amount, 0);
              return <PoolCard key={p.id} p={p} actions={<>
                {p.status === 'active' && <Button icon={HandHeart} onClick={() => setSupport(p)} disabled={!u.coins} data-testid={`support-${p.id}`}>Поддержать сбор</Button>}
                {my > 0 && <Badge tone="dark">Ваш вклад: {fmt(my)}</Badge>}
              </>} />;
            })}
          </div>
        ) : <div className="card"><Empty icon={PiggyBank} title={tab === 'active' ? 'Сейчас нет благотворительных сборов' : 'Завершённых сборов пока нет'} text="Благотворительные сборы создают руководители и HR. Пока можно пожертвовать сразу выше." /></div>}
      </div>

      <Card title="Мои пожертвования" subtitle={myCoins ? `Всего ${fmt(myCoins)} коинов, это ≈ ${fmt(myCoins * rate)} ₽ фондам` : undefined}>
        {mine.length ? (
          <div className="col" style={{ gap: 0 }}>
            {mine.slice(0, 12).map((x, i) => (
              <div key={i} className="row between" style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0 }}>
                <span className="row-sm"><Heart size={16} style={{ color: 'var(--purple)' }} /><span><b className="small">{x.title}</b><div className="xs muted">{fmtDate(x.ts)}</div></span></span>
                <span className="small num strong">{fmt(x.coins)} <Coin /></span>
              </div>
            ))}
          </div>
        ) : <Empty icon={Heart} title="Вы ещё не жертвовали" text="Начните с 1 000 коинов: это 200 ₽ фонду." />}
      </Card>
      {support && <SupportModal p={support} onClose={() => setSupport(null)} />}
    </div>
  );
}

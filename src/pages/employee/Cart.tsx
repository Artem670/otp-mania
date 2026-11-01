import { useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { cartDetailed, me as selectMe } from '../../data/selectors';
import { CATEGORY_LABELS } from '../../data/types';
import { useRouter } from '../../lib/router';
import { fmt } from '../../lib/utils';
import { Amount, Button, Card, Coin, Confirm, Empty, PageHeader, PageSkeleton, ProductArt, useAction, usePageLoading } from '../../components/ui';
import { Cart, CircleCheck, Minus, Plus, Trash, Store, Alert } from '../../components/icons';

export default function CartPage() {
  const db = useDB();
  const u = selectMe(db)!;
  const { navigate } = useRouter();
  const loading = usePageLoading('cart', 250);
  const { lines, total, count } = cartDetailed(db, u.id);
  const { run, busy } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const enough = u.coins >= total;

  if (loading) return <PageSkeleton />;

  if (done) {
    const o = db.orders.find((x) => x.id === done);
    return (
      <div className="card" style={{ maxWidth: 560, margin: '24px auto' }}>
        <Empty icon={CircleCheck} title="Заказ оформлен" text={o ? `Списано ${fmt(o.total)} коинов. Остаток на балансе: ${fmt(u.coins)}. Мы пришлём уведомление, когда заказ будет готов.` : ''}
          action={<div className="row-sm" style={{ justifyContent: 'center' }}><Button onClick={() => navigate('/cabinet/orders')}>Мои заказы</Button><Button variant="secondary" onClick={() => navigate('/cabinet/shop')}>Вернуться в магазин</Button></div>} />
      </div>
    );
  }

  const setQty = (id: string, q: number) => run('q-' + id, () => api.setCartQty(id, q));
  const checkout = async () => {
    const id = await run('checkout', () => api.checkout());
    setConfirm(false);
    if (id) setDone(id);
  };

  return (
    <div className="stack-24">
      <PageHeader title="Корзина" subtitle={count ? `${count} ${count === 1 ? 'товар' : count < 5 ? 'товара' : 'товаров'} на сумму ${fmt(total)} коинов` : undefined} />
      {!lines.length ? (
        <div className="card"><Empty icon={Cart} title="Корзина пуста" text="Добавьте товары из магазина, и они появятся здесь." action={<Button icon={Store} onClick={() => navigate('/cabinet/shop')}>Перейти в магазин</Button>} /></div>
      ) : (
        <div className="grid g-main">
          <Card className="pad-0">
            {lines.map((l) => (
              <div key={l.productId} className="row" style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 76, height: 76, borderRadius: 14, position: 'relative', overflow: 'hidden', flex: 'none' }}><ProductArt icon={l.product.icon} tone={l.product.tone} /></div>
                <div className="grow">
                  <div className="xs muted">{CATEGORY_LABELS[l.product.category]}</div>
                  <b>{l.product.name}</b>
                  <div className="small muted mt-4">{fmt(l.product.price)} <Coin /> за шт.{l.qty > l.product.stock && <span style={{ color: 'var(--red)' }}> · на складе {l.product.stock}</span>}</div>
                </div>
                <div className="qty" aria-label={`Количество: ${l.qty}`}>
                  <button onClick={() => setQty(l.productId, l.qty - 1)} aria-label="Меньше" disabled={!!busy}><Minus size={14} /></button>
                  <span className="num">{l.qty}</span>
                  <button onClick={() => setQty(l.productId, l.qty + 1)} aria-label="Больше" disabled={!!busy}><Plus size={14} /></button>
                </div>
                <div style={{ width: 110, textAlign: 'right' }}><Amount value={l.product.price * l.qty} /></div>
                <Button variant="ghost" size="sm" icon={Trash} aria-label={`Удалить «${l.product.name}»`} onClick={() => setQty(l.productId, 0)} />
              </div>
            ))}
          </Card>
          <div className="stack-16">
            <Card title="Оформление заказа">
              <div className="col" style={{ gap: 10 }}>
                <div className="row between"><span className="muted">Товары</span><span className="num">{count} шт.</span></div>
                <div className="row between"><span className="muted">Ваш баланс</span><Amount value={u.coins} /></div>
                <div className="row between" style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}><b>Итого</b><span className="price" style={{ fontSize: 22 }}>{fmt(total)} <Coin /></span></div>
                <div className="row between small"><span className="muted">Останется после покупки</span><span className="num" style={{ color: enough ? undefined : 'var(--red)' }}>{fmt(u.coins - total)}</span></div>
              </div>
              {!enough && <div className="alert err small mt-16"><Alert size={16} />Не хватает {fmt(total - u.coins)} коинов. Конвертируйте РуКоины в профиле или уберите часть товаров.</div>}
              <Button block size="lg" className="mt-16" disabled={!enough} onClick={() => setConfirm(true)} data-testid="checkout">Оформить заказ</Button>
              <Button block variant="ghost" className="mt-8" onClick={() => navigate('/cabinet/shop')}>Продолжить покупки</Button>
            </Card>
            <div className="alert small">Электронные сертификаты приходят на почту в течение часа. Остальные товары выдаются в офисе, статус видно в разделе «Мои заказы».</div>
          </div>
        </div>
      )}
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Подтвердите заказ" confirmText={`Списать ${fmt(total)} коинов`} loading={busy === 'checkout'} onConfirm={checkout}
        text={<>С баланса спишется <b>{fmt(total)}</b> коинов, останется <b>{fmt(u.coins - total)}</b>. Отменить заказ после оформления может только администратор.</>} />
    </div>
  );
}

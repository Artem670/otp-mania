import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { me as selectMe } from '../../data/selectors';
import { ORDER_STATUS_LABELS, type OrderStatus } from '../../data/types';
import { useRouter } from '../../lib/router';
import { fmt, fmtDateTime } from '../../lib/utils';
import { Amount, Badge, Button, Card, Empty, PageHeader, PageSkeleton, Seg, useAction, usePageLoading } from '../../components/ui';
import { Package, Star, Store } from '../../components/icons';

export const STATUS_TONE: Record<OrderStatus, 'orange' | 'dark' | 'green' | 'red' | undefined> = { new: 'orange', processing: 'dark', delivered: 'green', cancelled: 'red' };

export default function Orders() {
  const db = useDB();
  const u = selectMe(db)!;
  const { navigate } = useRouter();
  const loading = usePageLoading('orders');
  const [f, setF] = useState<'all' | 'active' | 'done'>('all');
  const { run } = useAction();
  const list = useMemo(() => db.orders.filter((o) => o.userId === u.id && (f === 'all' || (f === 'active' ? o.status === 'new' || o.status === 'processing' : o.status === 'delivered' || o.status === 'cancelled'))).sort((a, b) => b.ts - a.ts), [db, u.id, f]);
  const spent = db.orders.filter((o) => o.userId === u.id && o.status !== 'cancelled' && o.currency !== 'rucoins').reduce((a, o) => a + o.total, 0);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Мои заказы" subtitle={`Всего потрачено в магазине: ${fmt(spent)} коинов`} actions={<Seg value={f} onChange={setF} ariaLabel="Фильтр заказов" options={[{ value: 'all', label: 'Все' }, { value: 'active', label: 'В работе' }, { value: 'done', label: 'Завершённые' }]} />} />
      {list.length ? list.map((o) => (
        <Card key={o.id}>
          <div className="row between row-wrap">
            <div className="row-sm"><Package size={18} /><b>{o.wheel ? 'Приз из колеса удачи' : o.currency === 'rucoins' ? 'Награда за РуКоины' : 'Заказ'} от {fmtDateTime(o.ts)}</b></div>
            <div className="row-sm"><Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge><Amount value={o.total} ru={o.currency === 'rucoins'} /></div>
          </div>
          <div className="mt-12">{o.items.map((i) => <div key={i.productId} className="row between small" style={{ padding: '6px 0' }}><span>{i.name} × {i.qty}</span><span className="num muted">{fmt(i.price * i.qty)}</span></div>)}</div>
          {o.status === 'delivered' && (
            <div className="row between mt-12 row-wrap" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span className="small muted">{o.csi ? 'Ваша оценка' : 'Оцените, насколько довольны наградой'}</span>
              <div className="row-sm" role="radiogroup" aria-label="Оценка заказа">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} role="radio" aria-checked={o.csi === s} aria-label={`${s} из 5`} onClick={() => run('csi', () => api.rateOrder(o.id, s), 'Спасибо за оценку!')} style={{ border: 0, background: 'none', padding: 2, color: (o.csi ?? 0) >= s ? 'var(--orange)' : 'var(--border-strong)' }}>
                    <Star size={20} fill={(o.csi ?? 0) >= s ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )) : <div className="card"><Empty icon={Package} title={f === 'all' ? 'Заказов пока нет' : 'Здесь пусто'} text="Загляните в магазин: мерч, сертификаты и впечатления." action={<Button icon={Store} onClick={() => navigate('/cabinet/shop')}>В магазин</Button>} /></div>}
    </div>
  );
}

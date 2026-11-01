import { useDB } from '../data/store';
import { charityTotals, poolRaised } from '../data/selectors';
import { fmt } from '../lib/utils';
import { useRouter } from '../lib/router';
import { Button, Progress } from './ui';
import { HandHeart, Heart } from './icons';

/** Баннер благотворительности на главном экране: сборы фондам и пожертвование в магазине, банк удваивает. */
export function CharityBanner() {
  const db = useDB();
  const { navigate } = useRouter();
  const pools = db.pools.filter((p) => p.kind === 'charity' && p.status === 'active').sort((a, b) => b.target - a.target).slice(0, 2);
  if (!pools.length) return null;
  const t = charityTotals(db);
  return (
    <section className="charity-banner" data-testid="charity-banner">
      <div className="charity-copy">
        <span className="badge" style={{ background: 'var(--orange)', color: 'var(--black)' }}><Heart size={12} /> Помогаем вместе</span>
        <h2 className="mt-12">Каждый ваш коин банк удвоит</h2>
        <p className="mt-8">Поддержите фонды коинами: через сбор всем банком или пожертвованием в магазине. Вместе уже направили <b>{fmt(t.rub)} ₽</b>.</p>
        <div className="row-sm row-wrap mt-16">
          <Button variant="orange" icon={HandHeart} onClick={() => navigate('/cabinet/pools')}>Поддержать сбор</Button>
          <Button variant="secondary" onClick={() => navigate('/cabinet/shop/c/charity')}>Пожертвовать 1 000 коинов</Button>
        </div>
      </div>
      <div className="charity-pools">
        {pools.map((p) => (
          <button key={p.id} type="button" className="charity-pool" onClick={() => navigate('/cabinet/pools')}>
            <b className="small">{p.title}</b>
            <span className="xs">{fmt(poolRaised(p))} из {fmt(p.target)} коинов + столько же от банка</span>
            <Progress value={poolRaised(p) / p.target} tone="orange" thin label={`Собрано ${Math.round((poolRaised(p) / p.target) * 100)}%`} />
          </button>
        ))}
      </div>
    </section>
  );
}

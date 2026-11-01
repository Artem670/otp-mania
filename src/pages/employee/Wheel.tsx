import { useMemo, useRef, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { me as selectMe, spinsThisMonth } from '../../data/selectors';
import type { WheelPrize } from '../../data/types';
import { ago, fmt, fmtNum } from '../../lib/utils';
import { Badge, Button, Card, Coin, Empty, PageHeader, PageSkeleton, useAction, usePageLoading, useToast } from '../../components/ui';
import { Sparkles, Info, Gift } from '../../components/icons';

/** Фирменная палитра ОТП: лайм, чёрный, фиолетовый и оттенки серого. */
export const WHEEL_COLORS = ['#c1ff05', '#16161a', '#e4ff8a', '#9e6fc3', '#f3f4f6', '#6f3fa0', '#ffffff', '#f1e9f8', '#ff6a13', '#3a3a42', '#9e6fc3'];
const DARK = new Set(['#16161a', '#9e6fc3', '#6f3fa0', '#ff6a13', '#3a3a42']);
export const wheelColor = (i: number) => WHEEL_COLORS[i % WHEEL_COLORS.length];

/** Сектор каждого приза пропорционален его шансу: 28% шанса = 28% круга. */
export function wheelSegments(prizes: WheelPrize[]) {
  const total = prizes.reduce((a, p) => a + p.prob, 0) || 1;
  let acc = 0;
  return prizes.map((p) => {
    const start = (acc / total) * 360;
    acc += p.prob;
    return { prize: p, start, end: (acc / total) * 360 };
  });
}

function WheelSvg({ prizes, rotation }: { prizes: WheelPrize[]; rotation: number }) {
  const R = 190;
  const segs = wheelSegments(prizes);
  const pt = (deg: number, r: number) => { const a = ((deg - 90) * Math.PI) / 180; return `${r * Math.cos(a)} ${r * Math.sin(a)}`; };
  return (
    <svg viewBox="-200 -200 400 400" style={{ width: '100%', height: '100%', transform: `rotate(${rotation}deg)`, transition: 'transform 4.2s cubic-bezier(.12,.75,.12,1)' }} aria-hidden="true">
      <circle r={R + 6} fill="#16161a" />
      {segs.map(({ prize, start, end }, i) => {
        const span = end - start;
        if (span <= 0) return null;
        const c = wheelColor(i);
        const large = span > 180 ? 1 : 0;
        const mid = (start + end) / 2;
        const fs = span >= 40 ? 13 : span >= 16 ? 11.5 : 10;
        return (
          <g key={prize.id}>
            <path d={`M0 0 L${pt(start, R)} A${R} ${R} 0 ${large} 1 ${pt(end, R)} Z`} fill={c} stroke="#16161a" strokeWidth={span < 2 ? 0.4 : 1.2} />
            {span >= 9 && <text transform={`rotate(${mid - 90}) translate(${span >= 40 ? 112 : 124},0)`} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={600} fill={DARK.has(c) ? '#fff' : '#16161a'}>{prize.short}</text>}
          </g>
        );
      })}
      <circle r="38" fill="#16161a" stroke="#fff" strokeWidth="4" />
      <circle r="12" fill="#c1ff05" />
    </svg>
  );
}

export default function WheelPage() {
  const db = useDB();
  const u = selectMe(db)!;
  const s = db.settings;
  const loading = usePageLoading('wheel', 250);
  const toast = useToast();
  const { run } = useAction();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelPrize | null>(null);
  const rot = useRef(0);
  const used = spinsThisMonth(db, u.id);
  const left = Math.max(0, s.spinLimit - used);
  /** Пока колесо крутится, итог прокрутки не показываем ни в истории, ни в балансе. */
  const [hold, setHold] = useState<{ since: number; coins: number } | null>(null);
  const wins = useMemo(() => db.txs.filter((t) => t.userId === u.id && t.kind === 'wheel' && (!hold || t.ts < hold.since)).sort((a, b) => b.ts - a.ts).slice(0, 8), [db, u.id, hold]);
  const shownCoins = hold ? hold.coins : u.coins;
  if (loading) return <PageSkeleton />;

  const spin = async () => {
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    setHold({ since: Date.now(), coins: u.coins - s.spinPrice });
    const prize = await run('spin', () => api.spin());
    if (!prize) { setSpinning(false); setHold(null); return; }
    const seg = wheelSegments(s.wheelPrizes).find((x) => x.prize.id === prize.id)!;
    const angle = seg.start + (seg.end - seg.start) * (0.2 + Math.random() * 0.6);
    const target = 360 - angle;
    rot.current += 360 * 5 + ((((target - (rot.current % 360)) % 360) + 360) % 360);
    setRotation(rot.current);
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      setSpinning(false);
      setHold(null);
      setResult(prize);
      toast('success', prize.coins ? `Выпало: ${prize.name}. Коины уже на балансе` : `Выпало: ${prize.name}`);
    }, reduced ? 50 : 4300);
  };

  return (
    <div className="stack-24">
      <PageHeader title="Колесо удачи" subtitle={`Прокрутка стоит ${fmt(s.spinPrice)} коинов. Шансы открыты, лимит ${s.spinLimit} прокруток в месяц.`} />
      <div className="grid g2">
        <Card>
          <div style={{ position: 'relative', width: 'min(420px, 100%)', aspectRatio: '1', margin: '0 auto' }}>
            <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '28px solid #16161a', zIndex: 2 }} />
            <WheelSvg prizes={s.wheelPrizes} rotation={rotation} />
          </div>
          <div className="row between row-wrap mt-16" style={{ gap: 12 }}>
            <div className="small text-2">Баланс <b className="num">{fmt(shownCoins)}</b> <Coin /> · осталось прокруток: <b data-testid="spins-left">{left}</b> из {s.spinLimit}</div>
            <Button size="lg" variant="orange" icon={Sparkles} loading={spinning} disabled={spinning || left === 0 || u.coins < s.spinPrice} onClick={spin} data-testid="spin">Крутить за {fmt(s.spinPrice)}</Button>
          </div>
          {result && (
            <div className="card dark mt-16 row" style={{ padding: 16 }} role="status">
              <Gift size={22} color="#c1ff05" />
              <div><b>Выпало: {result.name}</b><div className="small muted">{result.coins ? `${fmt(result.coins)} коинов вернулись на баланс` : result.digital ? 'Приз уже начислен' : 'Заберите приз в офисе, статус в «Моих заказах»'}</div></div>
            </div>
          )}
          {left === 0 && <div className="alert warn small mt-16"><Info size={16} />Лимит прокруток на этот месяц исчерпан. Новые появятся 1 числа.</div>}
          {left > 0 && u.coins < s.spinPrice && <div className="alert warn small mt-16"><Info size={16} />Не хватает коинов на прокрутку. Конвертируйте РуКоины в профиле.</div>}
        </Card>
        <div className="stack-16">
          <Card title="Призы и шансы" subtitle="Размер сектора на колесе равен шансу. Шансы одинаковы для всех и не зависят от числа прокруток" className="pad-0">
            <div className="table-wrap"><table className="table">
              <tbody>
                {s.wheelPrizes.map((p, i) => (
                  <tr key={p.id}>
                    <td className="small"><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: wheelColor(i), border: '1px solid #16161a', marginRight: 8, verticalAlign: -1 }} />{p.name}{p.prob <= 0.1 && <> <Badge tone="orange">джекпот</Badge></>}</td>
                    <td className="right num strong">{fmtNum(p.prob, p.prob < 1 ? 1 : 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
          <Card title="Мои прокрутки">
            {wins.length ? wins.map((t) => (
              <div key={t.id} className="op" style={{ gridTemplateColumns: '36px 1fr auto' }}>
                <span className="op-ic"><Sparkles size={16} /></span>
                <div><div className="small strong">{t.title.replace('Колесо удачи: ', '')}</div><div className="xs muted">{ago(t.ts)}</div></div>
                <span className="small num">−{fmt(-t.amount)} <Coin /></span>
              </div>
            )) : <Empty icon={Sparkles} title="Вы ещё не крутили колесо" text="Попробуйте удачу: в колесе есть выходной, худи и сертификат." />}
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { fmt } from '../lib/utils';

export interface Series { name: string; color: string; data: number[] }

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.0', '')}м` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace('.0', '')}к` : `${Math.round(v)}`);

/** Линейный график с подсказкой при наведении. */
export function LineChart({ labels, series, height = 220, format = fmt, area = true }: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string; area?: boolean }) {
  const W = 640, H = height, pad = height >= 100 ? { l: 40, r: 12, t: 12, b: 26 } : { l: 4, r: 4, t: 6, b: 6 };
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.data)));
  const n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const [hover, setHover] = useState<number | null>(null);
  const step = Math.ceil(n / 7);
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(', ')}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}>
        {height >= 100 && [0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#ececf0" />
            <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize="10.5" fill="#8a8a96">{short(max * t)}</text>
          </g>
        ))}
        {height >= 100 && labels.map((l, i) => (i % step === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#8a8a96">{l}</text>)}
        {series.map((s) => {
          const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ');
          return (
            <g key={s.name}>
              {area && series.length === 1 && <path d={`${d} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#d9d9df" strokeDasharray="3 3" />
            {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.data[hover])} r={4.5} fill="#fff" stroke={s.color} strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(Math.min(...series.map((s) => y(s.data[hover]))) / H) * 100}%` }}>
          <div className="xs" style={{ opacity: 0.7 }}>{labels[hover]}</div>
          {series.map((s) => <div key={s.name}><span style={{ color: s.color === '#16161a' ? '#fff' : s.color }}>●</span> {series.length > 1 ? `${s.name}: ` : ''}{format(s.data[hover])}</div>)}
        </div>
      )}
      {series.length > 1 && <div className="legend mt-8">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>}
    </div>
  );
}

/** Столбчатая диаграмма. */
export function BarChart({ data, height = 200, color = '#16161a', highlightLast, format = fmt }: { data: { label: string; value: number }[]; height?: number; color?: string; highlightLast?: boolean; format?: (v: number) => string }) {
  const W = 640, H = height, pad = { l: 40, r: 8, t: 14, b: 26 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Столбчатая диаграмма" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#ececf0" />
            <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize="10.5" fill="#8a8a96">{short(max * t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 0, H - pad.b - y(d.value));
          const on = hover === i || (highlightLast && i === data.length - 1);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect x={pad.l + i * bw + bw * 0.2} y={H - pad.b - h} width={bw * 0.6} height={h} rx={Math.min(8, bw * 0.15)} fill={on ? '#9e6fc3' : color} />
              <text x={pad.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#8a8a96">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          {data[hover].label}: {format(data[hover].value)}
        </div>
      )}
    </div>
  );
}

const PALETTE = ['#16161a', '#c1ff05', '#9e6fc3', '#8a8a96', '#6f3fa0', '#e4ff8a', '#d9d9df'];

/** Кольцевая диаграмма с легендой. */
export function Donut({ data, size = 170, center, format = fmt }: { data: { label: string; value: number; color?: string }[]; size?: number; center?: ReactNode; format?: (v: number) => string }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const R = 70, r = 46;
  let a0 = -Math.PI / 2;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="row row-wrap" style={{ gap: 20 }}>
      <div style={{ width: size, position: 'relative' }}>
        <svg viewBox="-80 -80 160 160" role="img" aria-label="Кольцевая диаграмма">
          {data.map((d, i) => {
            const a1 = a0 + (d.value / total) * Math.PI * 2;
            const large = a1 - a0 > Math.PI ? 1 : 0;
            const p = (ang: number, rad: number) => `${Math.cos(ang) * rad} ${Math.sin(ang) * rad}`;
            const path = d.value / total >= 0.9999
              ? `M${p(0, R)} A${R} ${R} 0 1 1 ${p(Math.PI, R)} A${R} ${R} 0 1 1 ${p(0, R)} M${p(0, r)} A${r} ${r} 0 1 0 ${p(Math.PI, r)} A${r} ${r} 0 1 0 ${p(0, r)}`
              : `M${p(a0, R)} A${R} ${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
            const el = <path key={i} d={path} fill={d.color ?? PALETTE[i % PALETTE.length]} opacity={hover === null || hover === i ? 1 : 0.35} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} stroke="#fff" strokeWidth={1.5} />;
            a0 = a1;
            return el;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          {hover !== null ? <div><div className="strong num">{format(data[hover].value)}</div><div className="xs muted">{Math.round((data[hover].value / total) * 100)}%</div></div> : center}
        </div>
      </div>
      <div className="col grow" style={{ gap: 6, minWidth: 160 }}>
        {data.map((d, i) => (
          <div key={i} className="row between small" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="row-sm"><i style={{ width: 10, height: 10, borderRadius: 3, background: d.color ?? PALETTE[i % PALETTE.length], display: 'inline-block' }} />{d.label}</span>
            <span className="num muted">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBars({ data, format = fmt, color }: { data: { label: string; value: number; sub?: string }[]; format?: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d, i) => (
        <div className="hbar" key={i}>
          <span className="ellipsis" title={d.label}>{d.label}</span>
          <span className="bar"><i style={{ width: `${(d.value / max) * 100}%`, background: color }} /></span>
          <span className="num strong small">{format(d.value)}{d.sub && <span className="muted"> {d.sub}</span>}</span>
        </div>
      ))}
    </div>
  );
}

import type { ReactNode } from 'react';
import puffin from '../assets/pet/main.jpg';

/**
 * Иллюстрации товаров магазина (вектор, без внешних картинок).
 * Подбираются по id товара, затем по иконке; для новых товаров админа есть запасной подарок.
 */
const LIME = '#c1ff05', INK = '#16161a', CREAM = '#f6f4ee';
const Shade = ({ d, o = 0.14 }: { d: string; o?: number }) => <path d={d} fill="#000" opacity={o} />;
const Shine = ({ d, o = 0.22 }: { d: string; o?: number }) => <path d={d} fill="#fff" opacity={o} />;
/** Знак ОТП: кольцо с разрывом и точка. */
const Mark = ({ x, y, r = 9, c = LIME }: { x: number; y: number; r?: number; c?: string }) => (
  <g>
    <path d={`M${x + r * 0.2} ${y - r} A${r} ${r} 0 1 0 ${x + r} ${y - r * 0.15}`} fill="none" stroke={c} strokeWidth={r * 0.42} strokeLinecap="round" />
    <circle cx={x + r * 0.95} cy={y - r * 0.95} r={r * 0.26} fill={c} />
  </g>
);

function GiftCard({ tone, label, amount, emblem }: { tone: string; label: string; amount: string; emblem: ReactNode }) {
  return (
    <g>
      <g transform="rotate(-8 100 104)">
        <rect x="38" y="62" width="128" height="82" rx="12" fill={INK} opacity=".18" transform="translate(6 8)" />
        <rect x="38" y="62" width="128" height="82" rx="12" fill={tone} />
        <Shine d="M38 74 Q38 62 50 62 H166 V84 Q110 96 38 92 Z" o={0.16} />
        <rect x="38" y="62" width="128" height="82" rx="12" fill="none" stroke="#fff" strokeOpacity=".25" />
        <Mark x={58} y={84} r={8} c="#fff" />
        <text x="152" y="86" textAnchor="end" fontSize="10" fontWeight="600" fill="#fff" opacity=".85">{label}</text>
        <text x="52" y="132" fontSize="20" fontWeight="700" fill="#fff">{amount}</text>
        <g transform="translate(138 108) scale(.82)">{emblem}</g>
      </g>
      <circle cx="160" cy="58" r="7" fill={LIME} /><circle cx="44" cy="150" r="4" fill={LIME} opacity=".7" />
    </g>
  );
}

const ART: Record<string, (tone: string) => ReactNode> = {
  'p-hoodie': (t) => (
    <g>
      <path d="M70 52 Q100 30 130 52 L156 64 Q170 70 172 86 L178 140 Q178 148 170 148 L158 148 L152 104 L150 160 Q150 168 142 168 H58 Q50 168 50 160 L48 104 L42 148 L30 148 Q22 148 22 140 L28 86 Q30 70 44 64 Z" fill={t} />
      <path d="M74 54 Q100 40 126 54 Q122 82 100 86 Q78 82 74 54 Z" fill="#000" opacity=".22" />
      <path d="M80 56 Q100 48 120 56 Q116 76 100 78 Q84 76 80 56 Z" fill="#000" opacity=".25" />
      <path d="M94 80 L92 108 M106 80 L108 108" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
      <circle cx="92" cy="110" r="2.6" fill="#fff" /><circle cx="108" cy="110" r="2.6" fill="#fff" />
      <path d="M70 130 H130 L126 156 H74 Z" fill="#000" opacity=".12" />
      <Mark x={100} y={118} r={7} />
      <Shade d="M150 104 L150 160 Q150 168 142 168 H128 Q140 140 140 104 Z" />
      <Shine d="M44 64 L70 52 Q62 80 60 120 L48 104 L42 148 L30 148 Z" o={0.12} />
    </g>
  ),
  'p-tee': (t) => (
    <g>
      <path d="M72 46 Q100 58 128 46 L166 64 L152 96 L138 90 L138 162 Q138 168 132 168 H68 Q62 168 62 162 L62 90 L48 96 L34 64 Z" fill={t} />
      <path d="M78 46 Q100 64 122 46 Q100 54 78 46 Z" fill="#000" opacity=".35" />
      <Shine d="M34 64 L72 46 Q70 70 68 168 H68 Q62 168 62 162 L62 90 L48 96 Z" o={0.1} />
      <Shade d="M138 90 V162 Q138 168 132 168 H118 Q126 130 126 90 Z" />
      <Mark x={100} y={100} r={11} />
      <text x="100" y="132" textAnchor="middle" fontSize="11" fontWeight="700" fill={LIME}>МАНИЯ</text>
    </g>
  ),
  'p-jacket': (t) => (
    <g>
      <path d="M70 46 L100 56 L130 46 L162 62 Q172 68 172 82 L176 144 Q176 150 170 150 H156 L152 104 L150 162 Q150 168 144 168 H56 Q50 168 50 162 L48 104 L44 150 H30 Q24 150 24 144 L28 82 Q28 68 38 62 Z" fill={t} />
      <path d="M70 46 L82 36 Q100 30 118 36 L130 46 L112 70 L100 58 L88 70 Z" fill={t} />
      <path d="M70 46 L82 36 Q100 30 118 36 L130 46 L112 70 L100 58 L88 70 Z" fill="#000" opacity=".18" />
      <path d="M100 58 V168" stroke="#d9d9df" strokeWidth="3" />
      <path d="M100 58 V168" stroke={INK} strokeWidth="1" strokeDasharray="2 3" />
      <rect x="97" y="74" width="6" height="12" rx="2" fill="#d9d9df" />
      <path d="M62 118 h22 M116 118 h22" stroke="#000" strokeOpacity=".25" strokeWidth="2.5" strokeLinecap="round" />
      {Array.from({ length: 14 }).map((_, i) => <circle key={i} cx={58 + (i % 7) * 14} cy={140 + Math.floor(i / 7) * 12} r="1.6" fill="#fff" opacity=".18" />)}
      <Shade d="M150 104 L150 162 Q150 168 144 168 H130 Q140 136 140 104 Z" />
      <Mark x={128} y={88} r={5} />
    </g>
  ),
  'p-beanie': (t) => (
    <g>
      <circle cx="100" cy="44" r="16" fill={CREAM} /><circle cx="94" cy="40" r="5" fill="#fff" />
      {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${100 + Math.cos(i) * 10} ${44 + Math.sin(i) * 10} l${Math.cos(i) * 6} ${Math.sin(i) * 6}`} stroke="#d8d4c8" strokeWidth="2" />)}
      <path d="M46 128 Q46 58 100 58 Q154 58 154 128 Z" fill={t} />
      {[62, 76, 90, 104, 118, 132].map((x) => <path key={x} d={`M${x + 4} 126 Q${x + 4} 80 ${100 + (x - 97) * 0.3} 62`} stroke="#000" strokeOpacity=".12" strokeWidth="3" fill="none" />)}
      <rect x="40" y="122" width="120" height="36" rx="12" fill={t} />
      <rect x="40" y="122" width="120" height="36" rx="12" fill="#000" opacity=".16" />
      {Array.from({ length: 11 }).map((_, i) => <path key={i} d={`M${50 + i * 10} 126 v28`} stroke="#000" strokeOpacity=".12" strokeWidth="3" />)}
      <rect x="84" y="128" width="32" height="22" rx="4" fill={INK} /><Mark x={100} y={139} r={6} />
      <Shine d="M54 112 Q56 72 96 62 Q70 78 66 112 Z" o={0.18} />
    </g>
  ),
  'p-mug': (t) => (
    <g>
      <rect x="66" y="34" width="68" height="18" rx="6" fill={INK} />
      <rect x="72" y="28" width="56" height="10" rx="5" fill="#3a3a42" />
      <path d="M68 52 H132 L128 166 Q128 172 122 172 H78 Q72 172 72 166 Z" fill={t} />
      <rect x="68" y="52" width="64" height="8" fill="#000" opacity=".2" />
      <Shine d="M76 62 H86 L84 164 H78 Z" o={0.3} />
      <Shade d="M118 60 H130 L126 166 Q126 170 122 170 H116 Z" />
      <Mark x={100} y={112} r={11} c={INK} />
      <path d="M140 74 q10 -8 2 -18 M146 82 q12 -10 4 -22" stroke="#bbb" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".7" />
    </g>
  ),
  'p-backpack': (t) => (
    <g>
      <path d="M78 46 Q78 28 100 28 Q122 28 122 46" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="52" y="44" width="96" height="124" rx="26" fill={t} />
      <Shine d="M64 52 Q58 100 62 160 L56 156 Q50 100 58 56 Z" o={0.18} />
      <Shade d="M130 48 Q148 60 148 90 V142 Q148 166 124 168 Q140 120 130 48 Z" />
      <rect x="64" y="104" width="72" height="50" rx="14" fill="#000" opacity=".2" />
      <rect x="64" y="104" width="72" height="12" rx="6" fill="#000" opacity=".15" />
      <rect x="94" y="100" width="12" height="8" rx="3" fill={LIME} />
      <path d="M66 66 H134" stroke="#000" strokeOpacity=".2" strokeWidth="3" strokeLinecap="round" />
      <Mark x={100} y={84} r={8} />
    </g>
  ),
  'p-umbrella': (t) => (
    <g>
      <path d="M100 40 V146 Q100 162 86 162 Q74 162 74 150" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M100 30 L100 40" stroke={INK} strokeWidth="4" />
      <path d="M26 104 Q30 44 100 40 Q170 44 174 104 Q160 92 146 104 Q132 92 118 104 Q100 90 82 104 Q68 92 54 104 Q40 92 26 104 Z" fill={t} />
      <path d="M100 40 Q78 70 82 104 Q100 90 118 104 Q122 70 100 40 Z" fill="#fff" opacity=".22" />
      <path d="M100 40 Q50 60 54 104 Q68 92 82 104 Q78 70 100 40 Z" fill="#000" opacity=".1" />
      <path d="M100 40 Q160 64 146 104 Q160 92 174 104 Q170 50 100 40 Z" fill="#000" opacity=".18" />
      <Mark x={128} y={76} r={7} />
    </g>
  ),
  'p-shopper': (t) => (
    <g>
      <path d="M76 70 Q76 30 100 30 Q124 30 124 70" stroke="#e9e3d2" strokeWidth="7" fill="none" />
      <path d="M58 64 H142 L150 168 H50 Z" fill={t === '#9E6FC3' ? '#efe8d8' : CREAM} />
      <path d="M58 64 H142 L150 168 H50 Z" fill={t} opacity=".18" />
      <path d="M76 70 Q76 40 100 40 Q124 40 124 70" stroke="#d9d0b8" strokeWidth="6" fill="none" />
      <Shade d="M130 64 H142 L150 168 H134 Z" o={0.08} />
      <circle cx="100" cy="116" r="26" fill={t} />
      <Mark x={100} y={116} r={11} c="#fff" />
      <text x="100" y="158" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK} opacity=".7">ОТП МАНИЯ</text>
    </g>
  ),
  'p-headphones': (t) => (
    <g>
      <path d="M46 116 V96 Q46 40 100 40 Q154 40 154 96 V116" stroke={t} strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M58 70 Q76 48 100 48" stroke="#fff" strokeOpacity=".25" strokeWidth="4" fill="none" strokeLinecap="round" />
      {[46, 154].map((x, i) => (
        <g key={x}>
          <rect x={x - (i ? 4 : 30)} y="100" width="34" height="62" rx="16" fill={t} />
          <rect x={x - (i ? 4 : 30) + (i ? 0 : 20)} y="104" width="14" height="54" rx="7" fill="#000" opacity=".3" />
          <rect x={x - (i ? 4 : 30) + (i ? 22 : 4)} y="108" width="6" height="34" rx="3" fill="#fff" opacity=".18" />
        </g>
      ))}
      <circle cx="166" cy="148" r="3" fill={LIME} />
      <Mark x={36} y={128} r={6} />
    </g>
  ),
  'p-powerbank': (t) => (
    <g>
      <path d="M134 150 Q160 160 160 130 Q160 108 176 104" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="170" y="96" width="10" height="16" rx="3" fill="#3a3a42" />
      <g transform="rotate(-10 100 104)">
        <rect x="58" y="40" width="80" height="136" rx="18" fill={INK} opacity=".18" transform="translate(6 8)" />
        <rect x="58" y="40" width="80" height="136" rx="18" fill={t} />
        <Shine d="M66 48 H80 V168 H70 Q66 168 66 160 Z" o={0.22} />
        <Shade d="M122 42 Q138 44 138 60 V158 Q138 174 122 176 Z" />
        {[0, 1, 2, 3].map((i) => <circle key={i} cx={84 + i * 10} cy="150" r="3.2" fill={i < 3 ? LIME : '#fff'} opacity={i < 3 ? 1 : 0.4} />)}
        <rect x="88" y="40" width="20" height="5" rx="2.5" fill={INK} />
        <Mark x={98} y={92} r={13} c="#fff" />
        <text x="98" y="128" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" opacity=".9">10 000</text>
      </g>
    </g>
  ),
  'p-speaker': (t) => (
    <g>
      <rect x="54" y="56" width="92" height="116" rx="44" fill={t} />
      <ellipse cx="100" cy="62" rx="40" ry="12" fill="#000" opacity=".35" />
      <ellipse cx="100" cy="60" rx="34" ry="8" fill={INK} />
      {[[-1, 0], [0, 0], [1, 0]].map(([d], i) => <circle key={i} cx={86 + i * 14} cy="60" r="2.4" fill={i === 1 ? LIME : '#555'} />)}
      {Array.from({ length: 48 }).map((_, i) => <circle key={i} cx={68 + (i % 8) * 9 + (Math.floor(i / 8) % 2) * 4.5} cy={84 + Math.floor(i / 8) * 13} r="2" fill="#000" opacity=".25" />)}
      <Shine d="M60 92 Q58 130 66 160 L62 158 Q52 128 56 90 Z" o={0.25} />
      <Shade d="M128 66 Q146 80 146 110 V130 Q146 166 112 172 Q140 130 128 66 Z" />
      <rect x="84" y="164" width="32" height="8" rx="4" fill={INK} />
    </g>
  ),
  'p-watch': (t) => (
    <g>
      <rect x="80" y="20" width="40" height="64" rx="12" fill={t} />
      <rect x="80" y="122" width="40" height="64" rx="12" fill={t} />
      {[34, 46, 58, 144, 156, 168].map((y) => <rect key={y} x="96" y={y} width="8" height="4" rx="2" fill="#000" opacity=".25" />)}
      <rect x="66" y="64" width="68" height="78" rx="20" fill={INK} />
      <rect x="72" y="70" width="56" height="66" rx="15" fill="#0d0d10" />
      <path d="M80 104 H92 L97 92 L104 118 L110 100 L114 104 H122" stroke={LIME} strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <text x="100" y="128" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">72</text>
      <text x="100" y="86" textAnchor="middle" fontSize="8" fill="#9a9aa6">10:24</text>
      <rect x="134" y="94" width="5" height="16" rx="2" fill="#3a3a42" />
    </g>
  ),
  'p-cert-mp': (t) => <GiftCard tone={t} label="Маркетплейс" amount="1 000 ₽" emblem={<g><path d="M0 4 H22 L20 24 H2 Z" fill="#fff" opacity=".9" /><path d="M6 6 Q6 -4 11 -4 Q16 -4 16 6" stroke="#fff" strokeWidth="2.5" fill="none" /></g>} />,
  'p-cert-sport': (t) => <GiftCard tone={t} label="Фитнес" amount="3 000 ₽" emblem={<g fill={LIME}><rect x="-2" y="6" width="6" height="16" rx="2" /><rect x="22" y="6" width="6" height="16" rx="2" /><rect x="4" y="12" width="18" height="4" /></g>} />,
  'p-cert-books': (t) => <GiftCard tone={t} label="Книги" amount="1 000 ₽" emblem={<g><path d="M0 4 Q8 0 13 4 V26 Q8 22 0 26 Z" fill="#fff" /><path d="M26 4 Q18 0 13 4 V26 Q18 22 26 26 Z" fill="#fff" opacity=".75" /></g>} />,
  'p-cert-cinema': (t) => <GiftCard tone={t} label="Кино" amount="500 ₽" emblem={<g><rect x="0" y="2" width="26" height="22" rx="3" fill="#fff" /><path d="M10 7 L19 13 L10 19 Z" fill={t} /></g>} />,
  'p-stickers': (t) => (
    <g>
      <rect x="44" y="40" width="116" height="132" rx="12" fill={INK} opacity=".12" transform="translate(5 6)" />
      <rect x="44" y="40" width="116" height="132" rx="12" fill="#fff" />
      <circle cx="78" cy="76" r="22" fill={LIME} /><Mark x={78} y={76} r={10} c={INK} />
      <path d="M128 56 l6 13 l14 2 l-10 10 l2 14 l-12 -7 l-12 7 l2 -14 l-10 -10 l14 -2 z" fill={t} />
      <path d="M62 122 q-2 -12 10 -12 q8 0 8 8 q0 -8 8 -8 q12 0 10 12 q-4 14 -18 22 q-14 -8 -18 -22 z" fill="#9e6fc3" />
      <rect x="110" y="110" width="38" height="38" rx="10" fill={INK} /><text x="129" y="135" textAnchor="middle" fontSize="16" fontWeight="800" fill={LIME}>OK</text>
      <path d="M148 172 Q160 172 160 160 L160 150 Q150 152 148 162 Z" fill="#e8e8ec" />
    </g>
  ),
  'p-notebook': (t) => (
    <g>
      <rect x="56" y="36" width="96" height="136" rx="8" fill={INK} opacity=".16" transform="translate(6 6)" />
      <rect x="56" y="36" width="96" height="136" rx="8" fill={t} />
      <rect x="56" y="36" width="14" height="136" rx="6" fill="#000" opacity=".3" />
      <rect x="132" y="36" width="7" height="136" fill={LIME} />
      <path d="M118 172 v18 l6 -5 l6 5 v-18 z" fill="#9e6fc3" />
      <Mark x={104} y={94} r={14} />
      <text x="104" y="132" textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff" opacity=".8">A5 · в точку</text>
      <Shine d="M74 40 H82 V168 H74 Z" o={0.08} />
    </g>
  ),
  'p-pet': (t) => (
    <g>
      <path d="M40 100 L160 100 L104 164 Z" fill="#2f9e6a" />
      <path d="M40 100 L160 100 L104 164 Z" fill="#000" opacity=".08" />
      <path d="M40 100 Q30 92 36 86 M160 100 Q172 92 166 86" stroke="#2f9e6a" strokeWidth="8" strokeLinecap="round" />
      <Mark x={104} y={124} r={10} c="#fff" />
      <ellipse cx="100" cy="76" rx="54" ry="16" fill={t} />
      <path d="M46 76 Q50 100 62 104 H138 Q150 100 154 76" fill={t} />
      <ellipse cx="100" cy="74" rx="44" ry="10" fill="#000" opacity=".3" />
      <path d="M78 72 q4 -8 10 -2 M102 70 q6 -8 12 0 M88 76 q6 -4 10 2" stroke="#c98a4b" strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  'p-dayoff': (t) => (
    <g>
      <rect x="46" y="44" width="108" height="122" rx="14" fill={INK} opacity=".14" transform="translate(5 6)" />
      <rect x="46" y="44" width="108" height="122" rx="14" fill="#fff" />
      <path d="M46 58 Q46 44 60 44 H140 Q154 44 154 58 V76 H46 Z" fill={t} />
      {[72, 128].map((x) => <rect key={x} x={x - 4} y="34" width="8" height="20" rx="4" fill={INK} />)}
      <text x="100" y="68" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">ПЯТНИЦА</text>
      <text x="100" y="128" textAnchor="middle" fontSize="44" fontWeight="800" fill={INK}>13</text>
      <circle cx="140" cy="148" r="22" fill={LIME} />
      <path d="M140 160 V144 M140 144 q-12 -10 -18 2 M140 144 q12 -10 18 2 M140 144 q-2 -14 -12 -12 M140 144 q2 -14 12 -12" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ),
  'p-lunch': (t) => (
    <g>
      <ellipse cx="100" cy="150" rx="70" ry="14" fill="#000" opacity=".12" />
      <ellipse cx="100" cy="142" rx="66" ry="16" fill="#fff" stroke="#e1e1e6" strokeWidth="2" />
      <path d="M48 140 Q48 70 100 70 Q152 70 152 140 Z" fill="#c9c9d1" />
      <path d="M48 140 Q48 70 100 70 Q152 70 152 140 Z" fill={t} opacity=".55" />
      <Shine d="M62 132 Q62 88 96 78 Q74 96 72 132 Z" o={0.45} />
      <circle cx="100" cy="66" r="8" fill={INK} />
      <path d="M30 70 V104 M24 70 V88 Q24 96 30 96 Q36 96 36 88 V70" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M170 70 Q160 84 166 100 V124" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="84" y="40" width="32" height="12" rx="6" fill={LIME} />
    </g>
  ),
  'p-masterclass': (t) => (
    <g>
      <ellipse cx="100" cy="168" rx="56" ry="8" fill="#000" opacity=".12" />
      <path d="M74 60 H126 Q120 74 124 88 Q150 110 140 146 Q134 166 100 166 Q66 166 60 146 Q50 110 76 88 Q80 74 74 60 Z" fill="#d98a5b" />
      <path d="M74 60 H126 Q120 74 124 88 Q150 110 140 146 Q134 166 100 166 Q66 166 60 146 Q50 110 76 88 Q80 74 74 60 Z" fill={t} opacity=".35" />
      <ellipse cx="100" cy="60" rx="26" ry="6" fill="#a7603b" />
      <path d="M62 118 Q100 128 138 118" stroke="#fff" strokeOpacity=".6" strokeWidth="5" fill="none" />
      <path d="M66 134 Q100 144 134 134" stroke={INK} strokeOpacity=".3" strokeWidth="3" fill="none" />
      <Shine d="M74 98 Q64 120 70 148 L66 146 Q58 120 70 96 Z" o={0.35} />
      <path d="M150 52 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" fill={LIME} />
      <path d="M44 70 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill="#9e6fc3" />
    </g>
  ),
  'p-ski': (t) => (
    <g>
      <circle cx="148" cy="54" r="16" fill={LIME} />
      <path d="M14 168 L74 70 L100 108 L124 80 L188 168 Z" fill={t} />
      <path d="M74 70 L60 94 L70 90 L78 98 L86 88 L94 98 Z" fill="#fff" />
      <path d="M124 80 L112 96 L120 94 L128 102 L134 94 Z" fill="#fff" />
      <path d="M100 108 L124 80 L188 168 H150 Z" fill="#000" opacity=".2" />
      <path d="M40 176 L160 140 M50 186 L170 150" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M160 140 q10 -4 12 -12 M170 150 q10 -4 12 -12" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  ),
  'p-late': (t) => (
    <g>
      <circle cx="100" cy="104" r="64" fill={INK} opacity=".15" transform="translate(5 6)" />
      <circle cx="100" cy="104" r="64" fill={t} />
      <circle cx="100" cy="104" r="52" fill="#fff" />
      {Array.from({ length: 12 }).map((_, i) => <rect key={i} x="98" y="56" width="4" height={i % 3 ? 6 : 10} rx="2" fill={INK} transform={`rotate(${i * 30} 100 104)`} />)}
      <path d="M100 104 V72" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M100 104 L124 116" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M100 104 A40 40 0 0 1 138 92" stroke={LIME} strokeWidth="10" fill="none" strokeLinecap="round" opacity=".9" />
      <circle cx="100" cy="104" r="6" fill={LIME} stroke={INK} strokeWidth="2" />
      <path d="M150 44 l10 -10 M160 54 l14 -4 M140 38 l2 -14" stroke={t} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
  'p-remote': (t) => (
    <g>
      <path d="M36 92 L100 42 L164 92 V168 H36 Z" fill={CREAM} />
      <path d="M26 96 L100 36 L174 96" stroke={t} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="132" y="48" width="16" height="30" rx="3" fill={t} />
      <rect x="56" y="104" width="88" height="54" rx="6" fill={INK} />
      <rect x="62" y="110" width="76" height="42" rx="3" fill="#2a2a31" />
      <Mark x={100} y={131} r={9} />
      <path d="M44 158 H156 L150 168 H50 Z" fill="#3a3a42" />
      <path d="M152 140 h14 q0 16 -7 16 q-7 0 -7 -16 z" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M156 132 q3 -5 0 -9 M161 132 q3 -5 0 -9" stroke="#bbb" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  ),
  'p-mentor': (t) => (
    <g>
      <rect x="28" y="44" width="96" height="62" rx="18" fill={t} />
      <path d="M50 104 L44 126 L72 106 Z" fill={t} />
      <path d="M48 66 H104 M48 82 H90" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".85" />
      <rect x="80" y="96" width="94" height="58" rx="18" fill={LIME} />
      <path d="M150 152 L158 172 L130 154 Z" fill={LIME} />
      <path d="M100 118 H154 M100 132 H138" stroke={INK} strokeWidth="6" strokeLinecap="round" opacity=".75" />
      <circle cx="170" cy="56" r="12" fill="#9e6fc3" /><path d="M164 56 l4 4 l8 -8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ),
  'p-don-mayak': () => (
    <g>
      <circle cx="100" cy="102" r="70" fill="#fff" opacity=".5" />
      <path d="M128 64 L176 44 L176 84 Z" fill={LIME} opacity=".55" />
      <path d="M88 168 L94 80 H106 L112 168 Z" fill="#fff" stroke={INK} strokeWidth="3" />
      <path d="M90 110 H110 M89 136 H111" stroke="#e5484d" strokeWidth="10" />
      <rect x="88" y="64" width="24" height="18" rx="3" fill={LIME} stroke={INK} strokeWidth="3" />
      <path d="M84 64 L100 50 L116 64 Z" fill={INK} />
      <path d="M40 170 Q70 150 100 168 Q130 150 160 170" stroke="#0047bb" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M150 112 q-12 -12 -24 0 q-12 14 24 34 q36 -20 24 -34 q-12 -12 -24 0z" fill="#e5484d" transform="translate(-6 0) scale(.6) translate(140 60)" />
    </g>
  ),
  'p-don-bereginya': (t) => (
    <g>
      <path d="M100 150 Q52 118 52 86 Q52 60 76 60 Q92 60 100 76 Q108 60 124 60 Q148 60 148 86 Q148 118 100 150 Z" fill={t} />
      <Shine d="M64 82 Q64 68 78 68 Q70 74 70 90 Z" o={0.4} />
      <path d="M30 120 Q44 160 100 170 Q156 160 170 120 Q154 132 140 132 Q126 150 100 152 Q74 150 60 132 Q46 132 30 120 Z" fill={LIME} />
      <path d="M30 120 Q44 160 100 170 Q156 160 170 120" stroke={INK} strokeOpacity=".2" strokeWidth="3" fill="none" />
      <circle cx="100" cy="98" r="10" fill="#fff" opacity=".9" />
    </g>
  ),
  'p-don-shelter': (t) => (
    <g>
      <path d="M60 52 H140 L150 170 H50 Z" fill="#d9a15f" />
      <path d="M60 52 H140 L142 70 H58 Z" fill="#000" opacity=".15" />
      <path d="M58 52 Q100 40 142 52" stroke="#b8803f" strokeWidth="4" fill="none" />
      <rect x="66" y="88" width="68" height="62" rx="10" fill="#fff" />
      <g fill={t}><ellipse cx="100" cy="126" rx="13" ry="11" /><circle cx="84" cy="108" r="5.5" /><circle cx="96" cy="102" r="5.5" /><circle cx="108" cy="102" r="5.5" /><circle cx="118" cy="110" r="5.5" /></g>
      <text x="100" y="164" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">КОРМ · 10 КГ</text>
      <Shade d="M128 52 H140 L150 170 H136 Z" o={0.12} />
    </g>
  ),
};

/** Запасные рисунки по иконке для новых товаров. */
const BY_ICON: Record<string, string> = {
  shirt: 'p-tee', snowflake: 'p-beanie', coffee: 'p-mug', backpack: 'p-backpack', umbrella: 'p-umbrella', shoppingbag: 'p-shopper',
  headphones: 'p-headphones', battery: 'p-powerbank', speaker: 'p-speaker', watch: 'p-watch', gift: 'p-cert-mp', dumbbell: 'p-cert-sport',
  book: 'p-cert-books', film: 'p-cert-cinema', sticker: 'p-stickers', notebook: 'p-notebook', paw: 'p-pet', heart: 'p-don-bereginya',
  palm: 'p-dayoff', clock: 'p-late', home: 'p-remote', mentor: 'p-mentor', utensils: 'p-lunch', sparkles: 'p-masterclass', mountain: 'p-ski',
};

export function ProductIllustration({ id, icon, tone }: { id?: string; icon: string; tone: string }) {
  if (id === 'p-toy' || (!id && icon === 'baby')) {
    return <img src={puffin} alt="" style={{ width: '86%', height: '86%', objectFit: 'contain', position: 'relative', mixBlendMode: 'multiply' }} />;
  }
  const key = id && ART[id] ? id : BY_ICON[icon] ?? 'p-cert-mp';
  return (
    <svg viewBox="0 0 200 200" style={{ width: '82%', height: '82%', position: 'relative', overflow: 'visible' }} aria-hidden="true">
      <ellipse cx="100" cy="182" rx="62" ry="7" fill="#000" opacity=".08" />
      {ART[key](tone)}
    </svg>
  );
}

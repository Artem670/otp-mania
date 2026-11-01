import { useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { me as selectMe, petLevel, PET_LEVELS } from '../../data/selectors';
import { fmt } from '../../lib/utils';
import { Badge, Button, Card, Coin, Field, PageHeader, PageSkeleton, Progress, useAction, usePageLoading, useToast } from '../../components/ui';
import { Cookie, Puzzle, Trees, Pencil, Check } from './petIcons';

const ACTIONS = [
  { id: 'feed', label: 'Покормить', cost: 500, xp: 500, icon: Cookie },
  { id: 'play', label: 'Игрушка', cost: 1500, xp: 1600, icon: Puzzle },
  { id: 'walk', label: 'Прогулка', cost: 3000, xp: 3400, icon: Trees },
];

export function PetSvg({ level, happy, size = 220 }: { level: number; happy: boolean; size?: number }) {
  const hats = [
    null,
    <path key="h" d="M70 44 L100 14 L130 44 Z" fill="#16161a" />,
    <g key="h"><path d="M66 46 L100 10 L134 46 Z" fill="#9e6fc3" /><circle cx="100" cy="10" r="6" fill="#16161a" /></g>,
    <path key="h" d="M62 46 L72 18 L86 36 L100 12 L114 36 L128 18 L138 46 Z" fill="#16161a" />,
    <g key="h"><path d="M60 46 L70 16 L85 34 L100 6 L115 34 L130 16 L140 46 Z" fill="#9e6fc3" /><circle cx="100" cy="8" r="6" fill="#16161a" /><circle cx="70" cy="18" r="4" fill="#16161a" /><circle cx="130" cy="18" r="4" fill="#16161a" /></g>,
    <g key="h"><path d="M58 46 L68 12 L84 32 L100 2 L116 32 L132 12 L142 46 Z" fill="#16161a" /><circle cx="100" cy="4" r="7" fill="#9e6fc3" /><circle cx="68" cy="14" r="5" fill="#9e6fc3" /><circle cx="132" cy="14" r="5" fill="#9e6fc3" /><rect x="58" y="40" width="84" height="8" rx="4" fill="#9e6fc3" /></g>,
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={`Питомец, уровень ${level}`}>
      <ellipse cx="100" cy="184" rx="58" ry="9" fill="#16161a" opacity=".08" />
      <circle cx="100" cy="106" r="70" fill="#c1ff05" />
      <circle cx="100" cy="106" r="56" fill="none" stroke="#8dba00" strokeWidth="4" strokeDasharray="6 7" />
      <ellipse cx="78" cy="98" rx="9" ry="12" fill="#16161a" /><ellipse cx="122" cy="98" rx="9" ry="12" fill="#16161a" />
      <circle cx="81" cy="93" r="3" fill="#fff" /><circle cx="125" cy="93" r="3" fill="#fff" />
      <path d={happy ? 'M84 126 Q100 140 116 126' : 'M86 132 Q100 122 114 132'} stroke="#16161a" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="64" cy="120" rx="9" ry="6" fill="#9e6fc3" opacity=".35" /><ellipse cx="136" cy="120" rx="9" ry="6" fill="#9e6fc3" opacity=".35" />
      {hats[level - 1]}
    </svg>
  );
}

export default function PetPage() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('pet', 250);
  const { run, busy } = useAction();
  const toast = useToast();
  const [bounce, setBounce] = useState(0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(u.pet.name);
  if (loading) return <PageSkeleton />;
  const lvl = petLevel(u.pet.xp);
  const cur = PET_LEVELS[lvl - 1].xp, next = PET_LEVELS[lvl]?.xp;
  const hours = (Date.now() - u.pet.fedAt) / 3600_000;
  const mood = hours < 24 ? 'Сыт и доволен' : hours < 72 ? 'Немного скучает' : 'Соскучился, давно не виделись';
  const act = async (a: (typeof ACTIONS)[number]) => {
    const before = lvl;
    const ok = await run(a.id, () => api.feedPet(a.cost, a.xp, a.label.toLowerCase()).then(() => true));
    if (ok) {
      setBounce((b) => b + 1);
      const after = petLevel(u.pet.xp + a.xp);
      toast('success', after > before ? `${u.pet.name} вырос до уровня ${after}: ${PET_LEVELS[after - 1].perk.toLowerCase()}` : `+${fmt(a.xp)} опыта`);
    }
  };
  return (
    <div className="stack-24">
      <PageHeader title={`Питомец ${u.pet.name}`} subtitle="Коины на питомца не стоят банку денег. Каждый уровень открывает новую витрину магазина: от мерча до сертификатов." />
      <div className="grid g2">
        <div className="pet-stage">
          <div key={bounce} className={bounce ? 'pet-bounce' : undefined}><PetSvg level={lvl} happy={hours < 72} /></div>
          <div style={{ position: 'absolute', top: 16, left: 16 }}><Badge tone="dark">Уровень {lvl} · {PET_LEVELS[lvl - 1].title}</Badge></div>
          <div className="card pad-sm" style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}><span className="small">{mood}</span></div>
        </div>
        <div className="stack-16">
          <Card>
            <div className="row between">
              {editing ? (
                <div className="row-sm grow">
                  <Field><input className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} aria-label="Имя питомца" /></Field>
                  <Button size="sm" icon={Check} loading={busy === 'rename'} onClick={async () => { const ok = await run('rename', () => api.renamePet(name).then(() => true), 'Имя сохранено'); if (ok) setEditing(false); }}>Сохранить</Button>
                </div>
              ) : <h3 className="row-sm">{u.pet.name}<Button variant="ghost" size="sm" icon={Pencil} aria-label="Переименовать" onClick={() => setEditing(true)} /></h3>}
              <span className="small muted num">{next ? `${fmt(u.pet.xp - cur)} / ${fmt(next - cur)} опыта` : 'Максимальный уровень'}</span>
            </div>
            <div className="mt-12"><Progress value={next ? (u.pet.xp - cur) / (next - cur) : 1} tone="orange" label="Опыт до следующего уровня" /></div>
            <div className="grid g3 mt-16" style={{ gap: 10 }}>
              {ACTIONS.map((a) => (
                <button key={a.id} className="card pad-sm col" style={{ alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => act(a)} disabled={!!busy} aria-label={`${a.label} за ${a.cost} коинов`}>
                  <a.icon size={26} />
                  <b className="small">{a.label}</b>
                  <span className="small num">{fmt(a.cost)} <Coin /></span>
                  <span className="xs muted">+{fmt(a.xp)} опыта</span>
                </button>
              ))}
            </div>
            <div className="small muted mt-12">На балансе {fmt(u.coins)} коинов</div>
          </Card>
          <Card title="Уровни и витрины магазина" subtitle="Растите питомца, чтобы открыть новые товары">
            <div className="col" style={{ gap: 8 }}>
              {PET_LEVELS.map((L, i) => (
                <div key={L.title} className={`level-row ${lvl > i ? 'done' : ''}`}>
                  <span className="n">{i + 1}</span>
                  <span><b className="small">{L.title}</b><div className="xs muted">{L.perk}</div></span>
                  <span className="xs muted num">{i ? `${fmt(L.xp)} оп.` : 'старт'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

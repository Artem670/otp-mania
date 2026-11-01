import { useEffect, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { me as selectMe, petLevel, PET_LEVELS } from '../../data/selectors';
import { fmt } from '../../lib/utils';
import { Badge, Button, Card, Coin, Field, PageHeader, PageSkeleton, Progress, useAction, usePageLoading, useToast } from '../../components/ui';
import { Cookie, Puzzle, Trees, Pencil, Check, Lock } from './petIcons';
import puffMain from '../../assets/pet/main.jpg';
import puffJoy from '../../assets/pet/joy.jpg';
import puffCurious from '../../assets/pet/curious.jpg';
import puffCare from '../../assets/pet/care.jpg';
import puffCard from '../../assets/pet/card.jpg';
import puffGoal from '../../assets/pet/goal.jpg';

const ACTIONS = [
  { id: 'feed', label: 'Покормить', cost: 500, xp: 500, icon: Cookie },
  { id: 'play', label: 'Игрушка', cost: 1500, xp: 1600, icon: Puzzle },
  { id: 'walk', label: 'Прогулка', cost: 3000, xp: 3400, icon: Trees },
];

/** Позы тупика ОТуПика: настроение питомца и стикеры, которые открываются с уровнями. */
export const PET_POSES = [
  { id: 'main', src: puffMain, title: 'Ближе к важному', level: 1 },
  { id: 'joy', src: puffJoy, title: 'Радостно', level: 2 },
  { id: 'curious', src: puffCurious, title: 'Любопытно', level: 3 },
  { id: 'care', src: puffCare, title: 'Забота', level: 4 },
  { id: 'card', src: puffCard, title: 'Удобно', level: 5 },
  { id: 'goal', src: puffGoal, title: 'Вместе к целям', level: 6 },
] as const;

export function PetImage({ pose = 'main', size = 300 }: { pose?: (typeof PET_POSES)[number]['id']; size?: number }) {
  const p = PET_POSES.find((x) => x.id === pose)!;
  return <img className={pose === 'main' ? 'pet-img' : 'pet-img bust'} src={p.src} alt={`ОТуПик: ${p.title.toLowerCase()}`} style={{ height: size, maxHeight: '100%', width: 'auto', display: 'block' }} />;
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
  const [joy, setJoy] = useState(false);
  useEffect(() => { if (!joy) return; const t = setTimeout(() => setJoy(false), 2600); return () => clearTimeout(t); }, [joy, bounce]);
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
      setJoy(true);
      const after = petLevel(u.pet.xp + a.xp);
      toast('success', after > before ? `${u.pet.name} вырос до уровня ${after}: ${PET_LEVELS[after - 1].perk.toLowerCase()}` : `+${fmt(a.xp)} опыта`);
    }
  };
  return (
    <div className="stack-24">
      <PageHeader title={`Питомец ${u.pet.name}`} subtitle="Коины на питомца не стоят банку денег. Каждый уровень открывает новую витрину магазина: от мерча до сертификатов." />
      <div className="grid g2">
        <div className="pet-stage">
          <div key={bounce} className={bounce ? 'pet-bounce' : undefined}><PetImage pose={joy ? 'joy' : hours < 24 ? 'main' : hours < 72 ? 'curious' : 'care'} size={joy || hours >= 24 ? 330 : 400} /></div>
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
          <Card title="Стикеры ОТуПика" subtitle="Новая эмоция с каждым уровнем">
            <div className="pet-stickers">
              {PET_POSES.map((p) => (
                <div key={p.id} className={lvl >= p.level ? 'pet-sticker' : 'pet-sticker locked'} title={lvl >= p.level ? p.title : `Откроется на ${p.level} уровне`}>
                  <img src={p.src} alt={p.title} />
                  {lvl < p.level && <span className="pet-lock"><Lock size={14} /> ур. {p.level}</span>}
                  <span className="xs">{p.title}</span>
                </div>
              ))}
            </div>
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

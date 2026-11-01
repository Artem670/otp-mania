import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { me as selectMe, THANKS_WEIGHT } from '../../data/selectors';
import type { DB } from '../../data/types';
import { useRouter } from '../../lib/router';
import { cx, fmt, fmtDate, plural } from '../../lib/utils';
import { Badge, Button, Card, Empty, PageHeader, PageSkeleton, Progress, useAction, usePageLoading } from '../../components/ui';
import { BookOpen, Calendar, Check, MapPin, News, Search, Target, Users } from '../../components/icons';

export function NewsPage() {
  const db = useDB();
  const loading = usePageLoading('news', 250);
  const [tag, setTag] = useState('Все');
  const tags = ['Все', ...new Set(db.news.map((n) => n.tag))];
  const list = db.news.filter((n) => tag === 'Все' || n.tag === tag).sort((a, b) => b.ts - a.ts);
  if (loading) return <PageSkeleton />;
  const [first, ...rest] = list;
  return (
    <div className="stack-24">
      <PageHeader title="Новости" subtitle="Что происходит в банке и в программе ОТП Мания" actions={<div className="chips">{tags.map((t) => <button key={t} className={cx('chip', tag === t && 'on')} onClick={() => setTag(t)}>{t}</button>)}</div>} />
      {!first ? <div className="card"><Empty icon={News} title="Новостей нет" /></div> : (
        <>
          <div className="card dark" style={{ padding: 28 }}>
            <Badge tone="orange">{first.tag}</Badge>
            <h2 className="mt-12" style={{ fontSize: 26, maxWidth: '24ch' }}>{first.title}</h2>
            <p className="muted mt-12" style={{ maxWidth: '64ch' }}>{first.body}</p>
            <div className="xs muted mt-16">{fmtDate(first.ts)}</div>
          </div>
          <div className="grid g2">
            {rest.map((n) => (
              <Card key={n.id}>
                <div className="row between"><Badge>{n.tag}</Badge><span className="xs muted">{fmtDate(n.ts)}</span></div>
                <h3 className="mt-12">{n.title}</h3>
                <p className="small text-2 mt-8">{n.body}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EventsPage() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('events', 250);
  const { run, busy } = useAction();
  const list = [...db.events].sort((a, b) => a.date - b.date);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Мероприятия" subtitle="Записывайтесь на события банка. За участие в некоторых начисляются РуКоины." />
      {list.length ? (
        <div className="grid g2">
          {list.map((e) => {
            const going = e.attendees.includes(u.id);
            const left = e.capacity - e.attendees.length;
            return (
              <Card key={e.id}>
                <div className="row">
                  <div className="card soft pad-sm" style={{ textAlign: 'center', minWidth: 64, padding: 10 }}>
                    <div className="strong" style={{ fontSize: 22, lineHeight: 1 }}>{new Date(e.date).getDate()}</div>
                    <div className="xs muted">{new Date(e.date).toLocaleDateString('ru-RU', { month: 'short' })}</div>
                  </div>
                  <div className="grow"><h3>{e.title}</h3><div className="small muted row-sm mt-4"><MapPin size={14} />{e.place}</div></div>
                </div>
                <p className="small text-2 mt-12">{e.description}</p>
                <div className="row between mt-16">
                  <span className="small muted row-sm"><Users size={14} />{e.attendees.length} {plural(e.attendees.length, 'участник', 'участника', 'участников')} · осталось {left} {plural(left, 'место', 'места', 'мест')}</span>
                  <Button size="sm" variant={going ? 'soft' : 'primary'} icon={going ? Check : Calendar} loading={busy === e.id} disabled={!going && left <= 0}
                    onClick={() => run(e.id, () => api.toggleEvent(e.id), (r) => (r ? `Вы записаны: ${e.title}` : 'Запись отменена'))}>{going ? 'Вы идёте' : 'Записаться'}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : <div className="card"><Empty icon={Calendar} title="Ближайших мероприятий нет" /></div>}
    </div>
  );
}

export function StrategyPage() {
  const db = useDB();
  const loading = usePageLoading('strategy', 250);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Стратегия и цели" subtitle="Ключевые цели банка на год. Вклад в них руководители отмечают категорией «Вклад в развитие компании»." />
      <div className="grid g2">
        {db.goals.map((g) => (
          <Card key={g.id}>
            <div className="row between"><Badge>{g.owner}</Badge><span className="xs muted">{g.due}</span></div>
            <h3 className="mt-12 row-sm"><Target size={18} />{g.title}</h3>
            <p className="small text-2 mt-8">{g.description}</p>
            <div className="row between small mt-16"><span className="muted">Прогресс</span><b>{Math.round(g.progress * 100)}%</b></div>
            <div className="mt-8"><Progress value={g.progress} tone="orange" label={g.title} /></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Подставляет значения из настроек программы: {{rate}}, {{maxPerAccrual}} и т. д. */
function fill(text: string, st: DB['settings']) {
  const v: Record<string, string> = {
    rate: String(st.conversionRate).replace('.', ','), maxPerAccrual: fmt(st.maxPerAccrual), maxPerEmployeeMonth: fmt(st.maxPerEmployeeMonth),
    minComment: String(st.minCommentLength), spinPrice: fmt(st.spinPrice), spinLimit: String(st.spinLimit), thanksWeight: fmt(THANKS_WEIGHT), transferLimit: fmt(st.transferLimitMonth ?? 1000),
  };
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? m);
}
const plain = (t: string) => t.replace(/\*\*/g, '').replace(/^## /gm, '').replace(/^- /gm, '');
const excerpt = (t: string) => plain(t).split(/\n\n/)[0].replace(/\n/g, ' ');

/** Жирный текст внутри строки. */
function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part))}</>;
}
/** Простая разметка статьи: заголовки, списки, абзацы. Без innerHTML. */
function ArticleBody({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="kb-body">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines[0].startsWith('## ')) {
          const rest = lines.slice(1);
          return <div key={i}><h2 id={`s${i}`}>{lines[0].slice(3)}</h2>{rest.length > 0 && <ArticleBody text={rest.join('\n')} />}</div>;
        }
        if (lines.every((l) => l.startsWith('- '))) return <ul key={i}>{lines.map((l, j) => <li key={j}><Inline text={l.slice(2)} /></li>)}</ul>;
        return <p key={i}><Inline text={lines.join(' ')} /></p>;
      })}
    </div>
  );
}

export function KbPage({ openId }: { openId?: string }) {
  const db = useDB();
  const { navigate } = useRouter();
  const loading = usePageLoading('kb' + (openId ?? ''), 250);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const cats = useMemo(() => [...new Set(db.articles.map((a) => a.category))], [db]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.articles.filter((a) => (cat === 'all' || a.category === cat) && (!s || (a.title + ' ' + fill(a.body, db.settings)).toLowerCase().includes(s)));
  }, [db, q, cat]);
  if (loading) return <PageSkeleton />;

  if (openId) {
    const a = db.articles.find((x) => x.id === openId);
    if (!a) return <div className="card"><Empty icon={BookOpen} title="Статья не найдена" text="Возможно, её удалили или ссылка устарела." action={<Button onClick={() => navigate('/kb')}>Ко всем статьям</Button>} /></div>;
    const text = fill(a.body, db.settings);
    const toc = text.split(/\n\s*\n/).map((b, i) => (b.startsWith('## ') ? { id: `s${i}`, title: b.split('\n')[0].slice(3) } : null)).filter(Boolean) as { id: string; title: string }[];
    const related = db.articles.filter((x) => x.id !== a.id && x.category === a.category).concat(db.articles.filter((x) => x.id !== a.id && x.category !== a.category)).slice(0, 4);
    return (
      <div className="stack-24">
        <div><button type="button" className="link-btn" onClick={() => navigate('/kb')} data-testid="kb-back">← Все статьи</button></div>
        <div className="kb-layout">
          <article className="card kb-article" data-testid="kb-article">
            <Badge tone={a.category === 'Начало работы' ? 'orange' : undefined}>{a.category}</Badge>
            <h1 className="mt-12">{a.title}</h1>
            <ArticleBody text={text} />
          </article>
          <aside className="stack-16">
            {toc.length > 1 && <Card title="В этой статье"><div className="col" style={{ gap: 6 }}>{toc.map((t) => <button key={t.id} type="button" className="link-btn" style={{ textAlign: 'left', textDecoration: 'none', fontWeight: 500 }} onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t.title}</button>)}</div></Card>}
            <Card title="Ещё по теме"><div className="col" style={{ gap: 8 }}>{related.map((r) => <button key={r.id} type="button" className="kb-mini" onClick={() => navigate(`/kb/${r.id}`)}><BookOpen size={15} /><span>{r.title}</span></button>)}</div></Card>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-24">
      <PageHeader title="База знаний" subtitle="Как работает ОТП Мания: валюты, магазин, питомец, сборы, вход и правила для руководителей" actions={<div className="input-wrap" style={{ width: 280 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по статьям" aria-label="Поиск по статьям" data-testid="kb-search" /></div>} />
      <div className="chips" role="tablist" aria-label="Разделы">
        {['all', ...cats].map((c) => <button key={c} role="tab" aria-selected={cat === c} className={cx('chip', cat === c && 'on')} onClick={() => setCat(c)}>{c === 'all' ? 'Все статьи' : c}<span className="count">{c === 'all' ? db.articles.length : db.articles.filter((a) => a.category === c).length}</span></button>)}
      </div>
      {list.length ? (
        <div className="grid g3 kb-grid">
          {list.map((a) => (
            <button key={a.id} type="button" className="card kb-card" onClick={() => navigate(`/kb/${a.id}`)} data-testid={`kb-${a.id}`}>
              <Badge tone={a.category === 'Начало работы' ? 'orange' : undefined}>{a.category}</Badge>
              <h3 className="mt-12 row-sm"><BookOpen size={17} />{a.title}</h3>
              <p className="small text-2 mt-8 kb-excerpt">{excerpt(fill(a.body, db.settings))}</p>
              <span className="small strong mt-12" style={{ marginTop: 'auto', paddingTop: 12 }}>Читать →</span>
            </button>
          ))}
        </div>
      ) : <div className="card"><Empty icon={BookOpen} title="Ничего не найдено" text={q ? `По запросу «${q}» статей нет. Попробуйте другое слово.` : 'В этом разделе пока нет статей.'} action={<Button variant="secondary" onClick={() => { setQ(''); setCat('all'); }}>Сбросить</Button>} /></div>}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api } from '../../data/api';
import { me as selectMe } from '../../data/selectors';
import { cx, fmtDate, plural } from '../../lib/utils';
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

export function KbPage() {
  const db = useDB();
  const loading = usePageLoading('kb', 250);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => db.articles.filter((a) => !q.trim() || (a.title + a.body).toLowerCase().includes(q.trim().toLowerCase())), [db, q]);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="База знаний" subtitle="Правила программы, инструкции и регламенты" actions={<div className="input-wrap" style={{ width: 280 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по статьям" aria-label="Поиск по статьям" /></div>} />
      {list.length ? (
        <div className="grid g2">
          {list.map((a) => (
            <Card key={a.id}>
              <Badge tone={a.category === 'ОТП Мания' ? 'orange' : undefined}>{a.category}</Badge>
              <h3 className="mt-12 row-sm"><BookOpen size={17} />{a.title}</h3>
              <p className={cx('small text-2 mt-8', open !== a.id && 'ellipsis')}>{a.body}</p>
              <Button variant="ghost" size="sm" className="mt-8" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? 'Свернуть' : 'Читать полностью'}</Button>
            </Card>
          ))}
        </div>
      ) : <div className="card"><Empty icon={BookOpen} title="Ничего не найдено" text={`По запросу «${q}» статей нет`} /></div>}
    </div>
  );
}

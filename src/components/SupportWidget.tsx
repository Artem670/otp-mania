import { useEffect, useMemo, useRef, useState } from 'react';
import { useDB } from '../data/store';
import { api } from '../data/api';
import { userById } from '../data/selectors';
import type { Ticket, User } from '../data/types';
import { ago, cx, fmtDateTime } from '../lib/utils';
import { Avatar, useAction } from './ui';
import { Check, ChevronDown, Message, Send, X } from './icons';

const TOPICS = ['Заказ и доставка', 'Коины и РуКоины', 'Вход и аккаунт', 'Ошибка на сайте', 'Другое'];

const lastTs = (t: Ticket) => t.messages[t.messages.length - 1]?.ts ?? t.createdAt;
/** Есть ли в обращении непрочитанные сообщения для этой стороны переписки. */
const unreadFor = (t: Ticket, staff: boolean) =>
  t.messages.some((m) => m.staff !== staff && m.ts > (staff ? t.staffReadAt : t.userReadAt));

/** Плавающая техподдержка: сотрудник пишет в чат, администраторы отвечают из того же окна. */
export function SupportWidget({ me }: { me: User }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const staff = me.role === 'admin';
  const tickets = db.tickets ?? [];
  const unread = staff
    ? tickets.filter((t) => t.status === 'open' && (unreadFor(t, true) || t.staffReadAt === 0)).length
    : tickets.filter((t) => t.userId === me.id && unreadFor(t, false)).length;

  return (
    <>
      {open && (
        <div className="support-panel" role="dialog" aria-label="Техподдержка">
          {staff ? <StaffView me={me} tickets={tickets} onClose={() => setOpen(false)} /> : <UserView me={me} tickets={tickets} onClose={() => setOpen(false)} />}
        </div>
      )}
      <button className={cx('support-fab', open && 'is-open')} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Свернуть поддержку' : 'Открыть техподдержку'} data-testid="support-fab">
        {open ? <ChevronDown size={24} /> : <Message size={24} />}
        {!open && unread > 0 && <span className="support-dot">{unread}</span>}
      </button>
    </>
  );
}

function Head({ title, sub, onClose, onBack }: { title: string; sub: string; onClose: () => void; onBack?: () => void }) {
  return (
    <div className="support-head">
      {onBack && <button className="icon-btn support-icon" onClick={onBack} aria-label="Назад" style={{ transform: 'rotate(90deg)' }}><ChevronDown size={18} /></button>}
      <div className="grow">
        <div className="strong">{title}</div>
        <div className="xs support-sub"><span className="support-online" />{sub}</div>
      </div>
      <button className="icon-btn support-icon" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
    </div>
  );
}

function Thread({ ticket, me, db }: { ticket?: Ticket; me: User; db: ReturnType<typeof useDB> }) {
  const end = useRef<HTMLDivElement>(null);
  const count = ticket?.messages.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [count, ticket?.id]);
  return (
    <div className="support-thread">
      {ticket?.messages.map((m) => {
        const mine = m.authorId === me.id;
        const author = userById(db, m.authorId);
        return (
          <div key={m.id} className={cx('support-msg', mine ? 'mine' : 'theirs', m.staff && 'staff')}>
            {!mine && <div className="xs support-author">{m.staff ? `${author?.name ?? 'Администратор'} · поддержка` : author?.name ?? 'Сотрудник'}</div>}
            <div className="support-bubble">{m.text}</div>
            <div className="xs support-time" title={fmtDateTime(m.ts)}>{ago(m.ts)}</div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({ onSend, busy, placeholder }: { onSend: (t: string) => Promise<unknown>; busy: boolean; placeholder: string }) {
  const [text, setText] = useState('');
  const send = async () => { if (!text.trim() || busy) return; const r = await onSend(text); if (r !== undefined) setText(''); };
  return (
    <div className="support-compose">
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={1} maxLength={1000} aria-label="Сообщение"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
      />
      <button className="support-send" onClick={send} disabled={!text.trim() || busy} aria-label="Отправить" data-testid="support-send"><Send size={18} /></button>
    </div>
  );
}

function UserView({ me, tickets, onClose }: { me: User; tickets: Ticket[]; onClose: () => void }) {
  const db = useDB();
  const { run, busy } = useAction();
  const mine = useMemo(() => tickets.filter((t) => t.userId === me.id).sort((a, b) => lastTs(b) - lastTs(a)), [tickets, me.id]);
  const current = mine.find((t) => t.status === 'open') ?? mine[0];
  const [fresh, setFresh] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const showThread = current && !(fresh && current.status === 'closed');
  useEffect(() => { if (current && showThread) api.supportRead(current.id, false).catch(() => {}); }, [current?.id, current?.messages.length, showThread]);

  const send = (text: string) => run('send', async () => { await api.supportSend(text, topic ?? current?.topic ?? 'Другое'); setFresh(false); return true; });

  return (
    <>
      <Head title="Техподдержка ОТП Мании" sub="Отвечаем в рабочее время, обычно в течение часа" onClose={onClose} />
      {showThread ? (
        <>
          <div className="support-topic xs">
            <span>Тема: <b>{current!.topic}</b></span>
            {current!.status === 'closed' ? <span className="badge green">Решено</span> : <button className="support-link" onClick={() => run('close', () => api.supportClose(current!.id), 'Обращение закрыто')}>Вопрос решён</button>}
          </div>
          <Thread ticket={current} me={me} db={db} />
          {current!.status === 'closed'
            ? <div className="support-foot"><button className="btn secondary sm block" onClick={() => { setFresh(true); setTopic(null); }}>Новое обращение</button></div>
            : <Composer onSend={send} busy={busy === 'send'} placeholder="Напишите сообщение" />}
        </>
      ) : (
        <>
          <div className="support-thread">
            <div className="support-msg theirs staff">
              <div className="xs support-author">Поддержка</div>
              <div className="support-bubble">Здравствуйте, {me.name.split(' ')[0]}! Выберите тему и опишите вопрос, администратор ответит прямо здесь.</div>
            </div>
            <div className="support-topics">
              {TOPICS.map((t) => <button key={t} className={cx('chip', topic === t && 'on')} onClick={() => setTopic(t)}>{topic === t && <Check size={14} />}{t}</button>)}
            </div>
          </div>
          <Composer onSend={send} busy={busy === 'send'} placeholder={topic ? 'Опишите вопрос' : 'Выберите тему или сразу напишите вопрос'} />
        </>
      )}
    </>
  );
}

function StaffView({ me, tickets, onClose }: { me: User; tickets: Ticket[]; onClose: () => void }) {
  const db = useDB();
  const { run, busy } = useAction();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const list = tickets.filter((t) => t.status === tab).sort((a, b) => lastTs(b) - lastTs(a));
  const t = tickets.find((x) => x.id === sel);
  useEffect(() => { if (t) api.supportRead(t.id, true).catch(() => {}); }, [t?.id, t?.messages.length]);

  if (t) {
    const author = userById(db, t.userId);
    return (
      <>
        <Head title={author?.name ?? 'Сотрудник'} sub={`${t.topic} · ${author?.title ?? ''}`} onClose={onClose} onBack={() => setSel(null)} />
        <div className="support-topic xs">
          <span>{t.status === 'open' ? 'Открыто' : 'Закрыто'} {ago(t.createdAt)}</span>
          {t.status === 'open' && <button className="support-link" onClick={() => run('close', () => api.supportClose(t.id), 'Обращение закрыто')}>Закрыть обращение</button>}
        </div>
        <Thread ticket={t} me={me} db={db} />
        <Composer onSend={(text) => run('reply', async () => { await api.supportReply(t.id, text); return true; }, 'Ответ отправлен')} busy={busy === 'reply'} placeholder="Ответ сотруднику" />
      </>
    );
  }
  const openCount = tickets.filter((x) => x.status === 'open').length;
  return (
    <>
      <Head title="Обращения сотрудников" sub="Вы отвечаете как поддержка" onClose={onClose} />
      <div className="support-tabs">
        <button className={cx('chip', tab === 'open' && 'on')} onClick={() => setTab('open')}>Открытые {openCount}</button>
        <button className={cx('chip', tab === 'closed' && 'on')} onClick={() => setTab('closed')}>Закрытые</button>
      </div>
      <div className="support-list">
        {!list.length && <div className="muted sm" style={{ padding: 24, textAlign: 'center' }}>{tab === 'open' ? 'Новых обращений нет' : 'Закрытых обращений пока нет'}</div>}
        {list.map((x) => {
          const u = userById(db, x.userId);
          const last = x.messages[x.messages.length - 1];
          const unread = x.status === 'open' && (unreadFor(x, true) || x.staffReadAt === 0);
          return (
            <button key={x.id} className={cx('support-row', unread && 'unread')} onClick={() => setSel(x.id)} data-testid={`ticket-${x.id}`}>
              {u && <Avatar user={u} size={34} />}
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="support-row-top"><span className="strong sm support-ellipsis">{u?.name ?? 'Сотрудник'}</span><span className="xs muted">{ago(lastTs(x))}</span></div>
                <div className="xs muted">{x.topic}</div>
                <div className="xs support-ellipsis">{last?.staff ? 'Вы: ' : ''}{last?.text}</div>
              </div>
              {unread && <span className="support-dot static" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

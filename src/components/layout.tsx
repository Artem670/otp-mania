import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDB } from '../data/store';
import { api } from '../data/api';
import { cartDetailed, deptName, signals } from '../data/selectors';
import type { Role, User } from '../data/types';
import { ROLE_LABELS } from '../data/types';
import { useRouter } from '../lib/router';
import { ago, cx, fmt } from '../lib/utils';
import { Avatar, Coin, ThemeToggle, useAction } from './ui';
import { OtpLogo, TeamCredit } from './brand';
import { toggleTheme, useTheme } from '../lib/theme';
import {
  Bell, BookOpen, Briefcase, Calendar, Cart, ChevronDown, Dashboard, LogOut, Menu, News, Reset, Search, Settings, ShieldAlert, Target, UserIcon, Users, X, Check,
  Sun, Moon,
} from './icons';
import type { IconType } from 'react-icons';

interface NavNode { label: string; to?: string; icon: IconType; roles?: Role[]; children?: { label: string; to: string; badge?: number }[] }

export function useNav(me: User, signalCount: number): NavNode[] {
  return [
    { label: 'Новости', to: '/news', icon: News },
    { label: 'Мероприятия', to: '/events', icon: Calendar },
    {
      label: 'Кабинет сотрудника', icon: UserIcon, children: [
        { label: 'Профиль', to: '/cabinet' },
        { label: 'Магазин', to: '/cabinet/shop' },
        { label: 'Мои заказы', to: '/cabinet/orders' },
        { label: 'Благодарности', to: '/cabinet/thanks' },
        { label: 'Рейтинг', to: '/cabinet/rating' },
        { label: 'Сборы', to: '/cabinet/pools' },
        { label: 'Благотворительность', to: '/cabinet/charity' },
        { label: 'Питомец', to: '/cabinet/pet' },
        { label: 'Колесо удачи', to: '/cabinet/wheel' },
      ],
    },
    { label: 'Сотрудники', to: '/employees', icon: Users },
    {
      label: 'Кабинет руководителя', icon: Briefcase, roles: ['manager'], children: [
        { label: 'Начисление РуКоинов', to: '/manager/accrual' },
        { label: 'KPI руководителя', to: '/manager/kpi' },
        { label: 'Регламент', to: '/manager/rules' },
        { label: 'Сборы команды', to: '/manager/pools' },
      ],
    },
    {
      label: 'Администрирование', icon: Dashboard, roles: ['admin'], children: [
        { label: 'Дашборд', to: '/admin' },
        { label: 'Метрики программы', to: '/admin/metrics' },
        { label: 'Сигналы', to: '/admin/signals', badge: signalCount },
        { label: 'Сотрудники и роли', to: '/admin/users' },
        { label: 'Настройки программы', to: '/admin/settings' },
      ],
    },
    { label: 'Стратегия и цели', to: '/strategy', icon: Target },
    { label: 'База знаний', to: '/kb', icon: BookOpen },
  ].filter((n) => !n.roles || n.roles.includes(me.role)) as NavNode[];
}

function Sidebar({ me, open, onNavigate }: { me: User; open: boolean; onNavigate: () => void }) {
  const db = useDB();
  const { path, navigate } = useRouter();
  const sigCount = useMemo(() => (me.role === 'admin' ? signals(db).filter((s) => s.status === 'new').length : 0), [db, me.role]);
  const nav = useNav(me, sigCount);
  const isActive = (to: string) => path === to || (to !== '/cabinet' && to !== '/admin' && path.startsWith(to + '/'));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const go = (to: string) => { navigate(to); onNavigate(); };
  return (
    <nav className={cx('sidebar', open && 'open')} aria-label="Главное меню">
      {nav.map((n) => {
        if (!n.children) return (
          <button key={n.label} className={cx('nav-item', isActive(n.to!) && 'active')} onClick={() => go(n.to!)} aria-current={isActive(n.to!) ? 'page' : undefined}>
            <n.icon size={18} />{n.label}
          </button>
        );
        const isOpen = expanded[n.label] ?? true;
        return (
          <div key={n.label}>
            <button className={cx('nav-item', isOpen && 'open')} onClick={() => setExpanded((e) => ({ ...e, [n.label]: !isOpen }))} aria-expanded={isOpen}>
              <n.icon size={18} />{n.label}<ChevronDown size={16} className="chev" />
            </button>
            {isOpen && (
              <div className="nav-sub">
                {n.children.map((c) => (
                  <button key={c.to} className={cx('nav-item', isActive(c.to) && 'active')} onClick={() => go(c.to)} aria-current={isActive(c.to) ? 'page' : undefined}>
                    {c.label}{!!c.badge && <span className="nav-badge">{c.badge}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="role-card">
        <div className="xs muted">Вы вошли как</div>
        <div className="strong mt-4">{ROLE_LABELS[me.role]}</div>
        <div className="xs muted mt-4">{me.role === 'employee' ? 'Доступен кабинет сотрудника' : me.role === 'manager' ? 'Кабинет сотрудника + инструменты руководителя' : 'Кабинет сотрудника + администрирование'}</div>
        <div className="mt-8"><span className={api.mode() === 'live' ? 'badge green' : 'badge'}>{api.mode() === 'live' ? 'Рабочая база' : 'Демо-песочница'}</span></div>
      </div>
      <div className="sidebar-credit"><TeamCredit /></div>
    </nav>
  );
}

function GlobalSearch({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const db = useDB();
  const { navigate } = useRouter();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mobileOpen) ref.current?.focus(); }, [mobileOpen]);
  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return null;
    return {
      people: db.users.filter((u) => u.name.toLowerCase().includes(s) || u.title.toLowerCase().includes(s)).slice(0, 5),
      products: db.products.filter((p) => p.active && p.name.toLowerCase().includes(s)).slice(0, 4),
      news: db.news.filter((n) => n.title.toLowerCase().includes(s)).slice(0, 3),
      kb: db.articles.filter((a) => (a.title + ' ' + a.body).toLowerCase().includes(s)).slice(0, 3),
    };
  }, [q, db]);
  const go = (to: string) => { navigate(to); setQ(''); setFocus(false); onClose(); };
  const total = res ? res.people.length + res.products.length + res.news.length + res.kb.length : 0;
  return (
    <div className={cx('top-search', mobileOpen && 'mobile-open')}>
      <Search size={16} />
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => { setFocus(false); if (mobileOpen && !q) onClose(); }, 150)} placeholder="Поиск по порталу: люди, товары, статьи" aria-label="Поиск по порталу" />
      {focus && res && (
        <div className="search-results">
          {!total && <div className="empty small" style={{ padding: 16 }}>Ничего не найдено по запросу «{q}»</div>}
          {!!res.people.length && <div className="search-group">Сотрудники</div>}
          {res.people.map((u) => <button key={u.id} className="search-item" onMouseDown={() => go(`/employees/${u.id}`)}><Avatar user={u} size={28} /><span><div className="strong small">{u.name}</div><div className="xs muted">{u.title}, {deptName(db, u.deptId)}</div></span></button>)}
          {!!res.products.length && <div className="search-group">Магазин</div>}
          {res.products.map((p) => <button key={p.id} className="search-item" onMouseDown={() => go(`/cabinet/shop/${p.id}`)}><span className="strong small grow">{p.name}</span><span className="small num">{fmt(p.price)} <Coin /></span></button>)}
          {!!res.news.length && <div className="search-group">Новости</div>}
          {res.news.map((n) => <button key={n.id} className="search-item small" onMouseDown={() => go('/news')}>{n.title}</button>)}
          {!!res.kb.length && <div className="search-group">База знаний</div>}
          {res.kb.map((a) => <button key={a.id} className="search-item small" onMouseDown={() => go(`/kb/${a.id}`)}>{a.title}</button>)}
        </div>
      )}
    </div>
  );
}

function Topbar({ me, onMenu }: { me: User; onMenu: () => void }) {
  const db = useDB();
  const { navigate } = useRouter();
  const theme = useTheme();
  const [pop, setPop] = useState<null | 'notif' | 'user'>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { run, busy } = useAction();
  const notes = useMemo(() => db.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.ts - a.ts).slice(0, 12), [db, me.id]);
  const unread = notes.filter((n) => !n.read).length;
  const cart = cartDetailed(db, me.id);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setPop(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const switchRole = (r: Role) => run('role', async () => { await api.switchRole(r); setPop(null); navigate(r === 'admin' ? '/admin' : r === 'manager' ? '/manager/accrual' : '/cabinet'); }, `Демо-вход: ${ROLE_LABELS[r].toLowerCase()}`);
  return (
    <header className="topbar">
      <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Открыть меню"><Menu size={18} /></button>
      <button className="logo" onClick={() => navigate('/cabinet')} aria-label="ОТП Мания, на главную">
        <OtpLogo size={34} />
        <span style={{ textAlign: 'left' }}>ОТП Мания<small>Корпоративный портал</small></span>
      </button>
      <GlobalSearch mobileOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <div className="top-actions" ref={wrap}>
        <button className="icon-btn menu-toggle" onClick={() => setSearchOpen(true)} aria-label="Поиск"><Search size={18} /></button>
        <div className="balance-chip" title="Коины: тратятся в магазине">
          <button onClick={() => navigate('/cabinet')} aria-label={`Коины: ${fmt(me.coins)}`}><Coin /><span className="num">{fmt(me.coins)}</span><span className="lbl muted" style={{ fontWeight: 500 }}>коинов</span></button>
        </div>
        <div className="balance-chip ru" title="РуКоины: валюта признания">
          <button onClick={() => navigate('/cabinet')} aria-label={`РуКоины: ${fmt(me.rucoins)}`}><Coin ru /><span className="num">{fmt(me.rucoins)}</span><span className="lbl muted" style={{ fontWeight: 500 }}>РуКоинов</span></button>
        </div>
        <ThemeToggle />
        <button className="icon-btn cart-btn" onClick={() => navigate('/cabinet/cart')} aria-label={`Корзина, товаров: ${cart.count}`}>
          <Cart size={18} />{cart.count > 0 && <span className="dot">{cart.count}</span>}
        </button>
        <button className="icon-btn" onClick={() => { setPop(pop === 'notif' ? null : 'notif'); if (pop !== 'notif') setTimeout(() => { api.markNotificationsRead().catch(() => {}); }, 1200); }} aria-label={`Уведомления, непрочитанных: ${unread}`} aria-expanded={pop === 'notif'}>
          <Bell size={18} />{unread > 0 && <span className="dot">{unread}</span>}
        </button>
        <button className="avatar-btn" onClick={() => setPop(pop === 'user' ? null : 'user')} aria-label="Меню пользователя" aria-expanded={pop === 'user'}>
          <Avatar user={me} size={38} />
        </button>
        {pop === 'notif' && (
          <div className="popover">
            <div className="popover-head row between"><b>Уведомления</b><span className="xs muted">{unread ? `${unread} новых` : 'Все прочитаны'}</span></div>
            {!notes.length && <div className="empty small">Уведомлений пока нет</div>}
            <div style={{ maxHeight: 380, overflow: 'auto' }}>
              {notes.map((n) => (
                <button key={n.id} className={cx('notif', !n.read && 'unread')} onClick={() => { setPop(null); if (n.link) navigate(n.link); }}>
                  <div className="small">{n.text}</div><div className="xs muted mt-4">{ago(n.ts)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {pop === 'user' && (
          <div className="popover" style={{ width: 300 }}>
            <div className="popover-head row">
              <Avatar user={me} size={40} />
              <div className="grow"><div className="strong ellipsis">{me.name}</div><div className="xs muted ellipsis">{me.title}</div><div className="xs muted ellipsis">{deptName(db, me.deptId)}</div></div>
            </div>
            <button className="menu-item" onClick={() => { setPop(null); navigate('/cabinet'); }}><UserIcon size={16} />Мой профиль</button>
            {api.mode() === 'demo' ? <>
            <div className="nav-label" style={{ paddingTop: 8 }}>Демо: войти с ролью</div>
            {(['employee', 'manager', 'admin'] as Role[]).map((r) => (
              <button key={r} className={cx('menu-item', me.role === r && 'active')} onClick={() => switchRole(r)} disabled={busy === 'role'}>
                {r === 'employee' ? <UserIcon size={16} /> : r === 'manager' ? <Briefcase size={16} /> : <ShieldAlert size={16} />}
                <span className="grow">{ROLE_LABELS[r]}</span>{me.role === r && <Check size={16} />}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
            <button className="menu-item" onClick={() => run('reset', async () => { await api.resetDemo(); setPop(null); navigate('/'); }, 'Демо-данные восстановлены')}><Reset size={16} />Сбросить демо-данные</button>
            </> : <div className="nav-label" style={{ paddingTop: 8 }}>Рабочий режим: данные в общей базе</div>}
            <button className="menu-item cart-item" onClick={() => { setPop(null); navigate('/cabinet/cart'); }}><Cart size={16} />Корзина{cart.count ? ` · ${cart.count}` : ''}</button>
            <button className="menu-item theme-item" onClick={() => toggleTheme()}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</button>
            <button className="menu-item" onClick={() => run('logout', async () => { await api.logout(); navigate('/'); })}><LogOut size={16} />Выйти</button>
          </div>
        )}
      </div>
    </header>
  );
}

export function AppLayout({ me, children }: { me: User; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const { path } = useRouter();
  useEffect(() => setMenu(false), [path]);
  return (
    <div className="app">
      <Topbar me={me} onMenu={() => setMenu((m) => !m)} />
      <div className="shell">
        <Sidebar me={me} open={menu} onNavigate={() => setMenu(false)} />
        {menu && <div className="drawer-overlay" style={{ zIndex: 70 }} onClick={() => setMenu(false)} />}
        <main className="main" id="main">{children}</main>
      </div>
    </div>
  );
}

export { Settings, X };

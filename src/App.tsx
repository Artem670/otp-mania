import { Component, useEffect, useState, type ReactNode } from 'react';
import { api } from './data/api';
import { useDB } from './data/store';
import { me as selectMe } from './data/selectors';
import type { Role } from './data/types';
import { match, useRouter } from './lib/router';
import { AppLayout } from './components/layout';
import { OtpLogo } from './components/brand';
import { Button, Empty, Field, Modal, PageSkeleton, Skeleton, useAction, useToast } from './components/ui';
import { Alert, Lock } from './components/icons';
import Login from './pages/Login';
import Profile from './pages/employee/Profile';
import Shop from './pages/employee/Shop';
import CartPage from './pages/employee/Cart';
import Orders from './pages/employee/Orders';
import ThanksPage from './pages/employee/Thanks';
import Rating from './pages/employee/Rating';
import Pools from './pages/employee/Pools';
import PetPage from './pages/employee/Pet';
import WheelPage from './pages/employee/Wheel';
import Accrual from './pages/manager/Accrual';
import Kpi from './pages/manager/Kpi';
import Rules from './pages/manager/Rules';
import ManagerPools from './pages/manager/ManagerPools';
import Dashboard from './pages/admin/Dashboard';
import Signals from './pages/admin/Signals';
import UsersAdmin from './pages/admin/Users';
import SettingsPage from './pages/admin/Settings';
import { NewsPage, EventsPage, StrategyPage, KbPage } from './pages/portal/Portal';
import Employees from './pages/portal/Employees';

type R = { pattern: string; roles?: Role[]; render: (p: Record<string, string>) => ReactNode };
const ROUTES: R[] = [
  { pattern: '/news', render: () => <NewsPage /> },
  { pattern: '/events', render: () => <EventsPage /> },
  { pattern: '/strategy', render: () => <StrategyPage /> },
  { pattern: '/kb', render: () => <KbPage /> },
  { pattern: '/employees', render: () => <Employees /> },
  { pattern: '/employees/:id', render: (p) => <Employees openId={p.id} /> },
  { pattern: '/cabinet', render: () => <Profile /> },
  { pattern: '/cabinet/shop', render: () => <Shop /> },
  { pattern: '/cabinet/shop/:id', render: (p) => <Shop productId={p.id} /> },
  { pattern: '/cabinet/cart', render: () => <CartPage /> },
  { pattern: '/cabinet/orders', render: () => <Orders /> },
  { pattern: '/cabinet/thanks', render: () => <ThanksPage /> },
  { pattern: '/cabinet/rating', render: () => <Rating /> },
  { pattern: '/cabinet/pools', render: () => <Pools /> },
  { pattern: '/cabinet/pet', render: () => <PetPage /> },
  { pattern: '/cabinet/wheel', render: () => <WheelPage /> },
  { pattern: '/manager/accrual', roles: ['manager'], render: () => <Accrual /> },
  { pattern: '/manager/kpi', roles: ['manager'], render: () => <Kpi /> },
  { pattern: '/manager/rules', roles: ['manager'], render: () => <Rules /> },
  { pattern: '/manager/pools', roles: ['manager'], render: () => <ManagerPools /> },
  { pattern: '/admin', roles: ['admin'], render: () => <Dashboard /> },
  { pattern: '/admin/signals', roles: ['admin'], render: () => <Signals /> },
  { pattern: '/admin/users', roles: ['admin'], render: () => <UsersAdmin /> },
  { pattern: '/admin/settings', roles: ['admin'], render: () => <SettingsPage /> },
];

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) return (
      <div className="card"><Empty icon={Alert} title="Раздел не загрузился" text="Произошла ошибка при отображении страницы. Попробуйте обновить раздел или вернитесь позже." action={<Button variant="secondary" onClick={() => this.setState({ error: null })}>Обновить раздел</Button>} /></div>
    );
    return this.props.children;
  }
}

function Routed() {
  const db = useDB();
  const user = selectMe(db);
  const { path, navigate } = useRouter();
  useEffect(() => {
    if (user && (path === '/' || path === '/login')) navigate(user.role === 'admin' ? '/admin' : '/cabinet');
  }, [user, path, navigate]);
  if (!user) return <Login />;
  let found: ReactNode = null;
  for (const r of ROUTES) {
    const p = match(r.pattern, path);
    if (!p) continue;
    found = r.roles && !r.roles.includes(user.role)
      ? <div className="card"><Empty icon={Lock} title="Нет доступа" text={`Раздел доступен роли «${r.roles.map((x) => (x === 'manager' ? 'Руководитель' : 'Администратор')).join(', ')}». Переключить роль для демо можно в меню профиля.`} action={<Button onClick={() => navigate('/cabinet')}>В кабинет сотрудника</Button>} /></div>
      : r.render(p);
    break;
  }
  if (!found) found = <div className="card"><Empty title="Страница не найдена" text="Возможно, ссылка устарела." action={<Button onClick={() => navigate('/cabinet')}>В кабинет</Button>} /></div>;
  return <AppLayout me={user}><ErrorBoundary resetKey={path}>{found}</ErrorBoundary></AppLayout>;
}

export default function App() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const toast = useToast();
  const [recovery, setRecovery] = useState(false);
  const load = () => {
    setState('loading');
    api.init().then(() => {
      setState('ready');
      const n = api.takeNotice();
      if (n) toast(n.includes('подтверждена') ? 'success' : 'error', n);
      if (api.takeRecovery()) setRecovery(true);
    }).catch(() => setState('error'));
  };
  useEffect(load, []);
  if (state === 'loading') return (
    <div style={{ padding: 24 }} aria-busy="true">
      <div className="row between"><div className="row"><OtpLogo size={34} /><b>ОТП Мания</b><span className="small muted">Загружаем портал…</span></div><Skeleton h={38} w={260} r={999} /></div>
      <div className="mt-24" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28 }}>
        <div className="col">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={38} />)}</div>
        <PageSkeleton />
      </div>
    </div>
  );
  if (state === 'error') return <div className="main"><Empty icon={Alert} title="Не удалось загрузить портал" text="Проверьте подключение и попробуйте снова." action={<Button onClick={load}>Повторить</Button>} /></div>;
  return <><Routed />{recovery && <NewPassword onDone={() => setRecovery(false)} />}</>;
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { run, busy } = useAction();
  const save = async () => {
    if (pw.length < 8) return setErr('Минимум 8 символов');
    const ok = await run('pw', () => api.setNewPassword(pw).then(() => true), 'Пароль обновлён');
    if (ok) onDone();
  };
  return (
    <Modal open onClose={onDone} title="Новый пароль" subtitle="Вы перешли по ссылке для восстановления. Задайте новый пароль" footer={<Button loading={busy === 'pw'} onClick={save}>Сохранить пароль</Button>}>
      <Field label="Новый пароль" error={err} htmlFor="newpw"><input id="newpw" type="password" className={err ? 'input err' : 'input'} autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} /></Field>
    </Modal>
  );
}

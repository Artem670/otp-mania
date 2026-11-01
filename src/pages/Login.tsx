import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/seed';
import type { Role } from '../data/types';
import { Button, Field, useAction } from '../components/ui';
import { Briefcase, Key, Mail, ShieldAlert, UserIcon, ArrowRight } from '../components/icons';
import { useRouter } from '../lib/router';
import { OtpLogo } from '../components/brand';

const ROLES: { role: Role; title: string; text: string; icon: typeof UserIcon }[] = [
  { role: 'employee', title: 'Сотрудник', text: 'Алексей Смирнов, аналитик продаж', icon: UserIcon },
  { role: 'manager', title: 'Руководитель', text: 'Ирина Белова, розничный бизнес', icon: Briefcase },
  { role: 'admin', title: 'Администратор', text: 'Светлана Юсупова, HR', icon: ShieldAlert },
];

type Tab = 'login' | 'register' | 'recover';

export default function Login() {
  const { navigate } = useRouter();
  const { run, busy } = useAction();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [deptId, setDeptId] = useState('');
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [sent, setSent] = useState<null | 'confirm' | 'recover'>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const live = api.remoteEnabled;
  useEffect(() => { if (tab === 'register' && !depts.length) api.departmentsForSignup().then((d) => { setDepts(d); setDeptId((x) => x || d[0]?.id || ''); }); }, [tab, depts.length]);
  const okEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

  const submit = () => {
    const e: Record<string, string> = {};
    if (!okEmail(email)) e.email = 'Введите почту, например name@company.ru';
    if (tab !== 'recover' && !pass) e.pass = 'Введите пароль';
    if (tab === 'register') {
      if (name.trim().split(/\s+/).length < 2) e.name = 'Укажите имя и фамилию';
      if (pass && pass.length < 8) e.pass = 'Минимум 8 символов';
      if (title.trim().length < 2) e.title = 'Укажите должность';
      if (!deptId) e.dept = 'Выберите подразделение';
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    if (tab === 'login') run('login', async () => { const u = await api.login(email, pass); navigate(u.role === 'admin' ? '/admin' : '/cabinet'); return u; }, (u) => `Добро пожаловать, ${u.name.split(' ')[0]}!`);
    if (tab === 'register') run('reg', async () => { const r = await api.register({ name, email, password: pass, deptId, title }); if (r.needsConfirm) setSent('confirm'); else navigate('/cabinet'); return r; });
    if (tab === 'recover') run('rec', async () => { await api.recover(email); setSent('recover'); });
  };
  const demo = (r: Role) => run('demo-' + r, async () => { const u = await api.login(DEMO_ACCOUNTS[r], DEMO_PASSWORD); navigate(r === 'admin' ? '/admin' : r === 'manager' ? '/manager/accrual' : '/cabinet'); return u; }, (u) => `Демо-вход: ${u.name}`);
  const switchTab = (t: Tab) => { setTab(t); setErrors({}); setSent(null); };

  return (
    <div className="login">
      <div className="login-art">
        <div className="row" style={{ position: 'relative' }}><OtpLogo size={40} radius={11} /><b style={{ fontSize: 18 }}>ОТП Мания</b></div>
        <div className="login-ring" /><div className="login-ring two" />
        <div style={{ position: 'relative' }}>
          <div className="badge orange mb-16">Программа признания</div>
          <h1>Признание за дело, а не за клик</h1>
          <p className="muted mt-16" style={{ maxWidth: 420, fontSize: 15 }}>Руководители отмечают вклад РуКоинами, коллеги говорят спасибо, а коины превращаются в мерч, сертификаты и впечатления.</p>
        </div>
        <p className="xs muted" style={{ position: 'relative' }}>Прототип команды для кейс-чемпионата. Все люди и данные вымышлены.</p>
      </div>
      <div className="login-form">
        <div className="login-box">
          <div className="row mb-16"><OtpLogo size={44} radius={12} /><div><div className="strong">ОТП Банк</div><div className="xs muted">Программа признания ОТП Мания</div></div></div>
          {sent ? (
            <div className="card soft" data-testid="check-email">
              <Mail size={28} />
              <h2 className="mt-12" style={{ fontSize: 22 }}>Проверьте почту</h2>
              <p className="text-2 mt-8">{sent === 'confirm' ? <>Мы отправили письмо на <b>{email}</b>. Перейдите по ссылке в нём, чтобы подтвердить почту и войти.</> : <>Если аккаунт с почтой <b>{email}</b> есть, на неё придёт ссылка для нового пароля.</>}</p>
              <p className="xs muted mt-8">Письма нет несколько минут? Проверьте папку «Спам».</p>
              <Button variant="secondary" className="mt-16" onClick={() => switchTab('login')}>Вернуться ко входу</Button>
            </div>
          ) : <>
          <h2 style={{ fontSize: 24 }}>{tab === 'login' ? 'Вход в портал' : tab === 'register' ? 'Регистрация' : 'Восстановление пароля'}</h2>
          <div className="seg mt-12" role="tablist">
            <button role="tab" className={tab === 'login' ? 'on' : ''} onClick={() => switchTab('login')}>Вход</button>
            <button role="tab" className={tab === 'register' ? 'on' : ''} onClick={() => switchTab('register')}>Регистрация</button>
          </div>
          {!live && tab !== 'login' && <div className="alert warn small mt-12">База данных ещё не подключена: регистрация и восстановление пароля заработают после её подключения. Пока войдите через демо ниже.</div>}
          <form className="col mt-16" style={{ gap: 14 }} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {tab === 'register' && <Field label="Имя и фамилия" error={errors.name} htmlFor="name"><input id="name" className={errors.name ? 'input err' : 'input'} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Мария Иванова" /></Field>}
            <Field label="Почта" error={errors.email} htmlFor="email">
              <div className="input-wrap"><Mail size={16} /><input id="email" className={errors.email ? 'input err' : 'input'} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.ru" /></div>
            </Field>
            {tab !== 'recover' && <Field label="Пароль" error={errors.pass} hint={tab === 'register' ? 'Минимум 8 символов' : undefined} htmlFor="pass">
              <div className="input-wrap"><Key size={16} /><input id="pass" className={errors.pass ? 'input err' : 'input'} type="password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} /></div>
            </Field>}
            {tab === 'register' && <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Подразделение" error={errors.dept} htmlFor="dept"><select id="dept" className="select" value={deptId} onChange={(e) => setDeptId(e.target.value)}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              <Field label="Должность" error={errors.title} htmlFor="title"><input id="title" className={errors.title ? 'input err' : 'input'} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Менеджер" /></Field>
            </div>}
            <Button type="button" size="lg" block loading={busy === 'login' || busy === 'reg' || busy === 'rec'} onClick={submit} data-testid="auth-submit">{tab === 'login' ? 'Войти' : tab === 'register' ? 'Создать аккаунт' : 'Прислать ссылку'}</Button>
            {tab === 'login' && <button type="button" className="btn ghost sm" onClick={() => switchTab('recover')}>Забыли пароль?</button>}
            {tab === 'recover' && <button type="button" className="btn ghost sm" onClick={() => switchTab('login')}>Вспомнил пароль</button>}
            {tab === 'register' && <p className="xs muted">После регистрации придёт письмо для подтверждения почты. Роль руководителя или администратора назначает администратор программы.</p>}
          </form>
          </>}
          <div className="row mt-24 mb-12"><div className="grow" style={{ height: 1, background: 'var(--border)' }} /><span className="xs muted">демо без регистрации</span><div className="grow" style={{ height: 1, background: 'var(--border)' }} /></div>
          <div className="col" style={{ gap: 8 }}>
            {ROLES.map(({ role, title, text, icon: Icon }) => (
              <button key={role} className="demo-role" onClick={() => demo(role)} disabled={!!busy} data-testid={`demo-${role}`}>
                <span className="op-ic" style={{ background: role === 'admin' ? 'var(--black)' : role === 'manager' ? 'var(--orange-soft)' : 'var(--surface)', color: role === 'admin' ? '#fff' : undefined }}><Icon size={18} /></span>
                <span className="grow"><b>{title}</b><div className="xs muted">{text}</div></span>
                {busy === 'demo-' + role ? <span className="xs muted">Входим…</span> : <ArrowRight size={16} />}
              </button>
            ))}
          </div>
          <p className="xs muted mt-16">Демо работает в песочнице вашего браузера и не меняет общую базу. Пароль демо-аккаунтов: <b>{DEMO_PASSWORD}</b>.</p>
        </div>
      </div>
    </div>
  );
}

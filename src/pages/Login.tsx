import { useState } from 'react';
import { api } from '../data/api';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/seed';
import type { Role } from '../data/types';
import { Button, Field, useAction } from '../components/ui';
import { Briefcase, Key, Mail, ShieldAlert, UserIcon, ArrowRight } from '../components/icons';
import { useRouter } from '../lib/router';
import { OtpLogo, SpaceDots } from '../components/brand';

const ROLES: { role: Role; title: string; text: string; icon: typeof UserIcon }[] = [
  { role: 'employee', title: 'Сотрудник', text: 'Алексей Смирнов, аналитик продаж', icon: UserIcon },
  { role: 'manager', title: 'Руководитель', text: 'Ирина Белова, розничный бизнес', icon: Briefcase },
  { role: 'admin', title: 'Администратор', text: 'Светлана Юсупова, HR', icon: ShieldAlert },
];

export default function Login() {
  const { navigate } = useRouter();
  const { run, busy } = useAction();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [errors, setErrors] = useState<{ email?: string; pass?: string }>({});

  const submit = () => {
    const e: typeof errors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = 'Введите рабочую почту, например name@mania.demo';
    if (!pass) e.pass = 'Введите пароль';
    setErrors(e);
    if (Object.keys(e).length) return;
    run('login', async () => { const u = await api.login(email, pass); navigate(u.role === 'admin' ? '/admin' : '/cabinet'); return u; }, (u) => `Добро пожаловать, ${u.name.split(' ')[0]}!`);
  };
  const demo = (r: Role) => run('demo-' + r, async () => { const u = await api.login(DEMO_ACCOUNTS[r], DEMO_PASSWORD); navigate(r === 'admin' ? '/admin' : r === 'manager' ? '/manager/accrual' : '/cabinet'); return u; }, (u) => `Демо-вход: ${u.name}`);

  return (
    <div className="login">
      <div className="login-art">
        <div className="row" style={{ position: 'relative' }}><OtpLogo size={40} radius={11} /><b style={{ fontSize: 18 }}>ОТП Мания</b><SpaceDots height={9} /></div>
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
          <div className="row mb-16"><OtpLogo size={44} radius={12} /><div><div className="strong">ОТП Банк</div><div className="xs muted row-sm">Программа признания ОТП Мания <SpaceDots height={7} /></div></div></div>
          <h2 style={{ fontSize: 24 }}>Вход в портал</h2>
          <p className="muted mt-4">Используйте корпоративную почту и пароль</p>
          <form className="col mt-24" style={{ gap: 14 }} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <Field label="Рабочая почта" error={errors.email} htmlFor="email">
              <div className="input-wrap"><Mail size={16} /><input id="email" className={errors.email ? 'input err' : 'input'} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mania.demo" /></div>
            </Field>
            <Field label="Пароль" error={errors.pass} htmlFor="pass">
              <div className="input-wrap"><Key size={16} /><input id="pass" className={errors.pass ? 'input err' : 'input'} type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
            </Field>
            <Button type="button" size="lg" block loading={busy === 'login'} onClick={submit}>Войти</Button>
          </form>
          <div className="row mt-24 mb-12"><div className="grow" style={{ height: 1, background: 'var(--border)' }} /><span className="xs muted">или демо-вход</span><div className="grow" style={{ height: 1, background: 'var(--border)' }} /></div>
          <div className="col" style={{ gap: 8 }}>
            {ROLES.map(({ role, title, text, icon: Icon }) => (
              <button key={role} className="demo-role" onClick={() => demo(role)} disabled={!!busy} data-testid={`demo-${role}`}>
                <span className="op-ic" style={{ background: role === 'admin' ? 'var(--black)' : role === 'manager' ? 'var(--orange-soft)' : 'var(--surface)', color: role === 'admin' ? '#fff' : undefined }}><Icon size={18} /></span>
                <span className="grow"><b>{title}</b><div className="xs muted">{text}</div></span>
                {busy === 'demo-' + role ? <span className="xs muted">Входим…</span> : <ArrowRight size={16} />}
              </button>
            ))}
          </div>
          <p className="xs muted mt-16">Пароль у демо-аккаунтов: <b>{DEMO_PASSWORD}</b>. Позже роль будет определяться корпоративной авторизацией.</p>
        </div>
      </div>
    </div>
  );
}

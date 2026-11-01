import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/seed';
import type { Role } from '../data/types';
import { Button, Field, PasswordInput, ThemeToggle, useAction, useToast } from '../components/ui';
import { ApiError } from '../data/errors';
import { Briefcase, Mail, ShieldAlert, UserIcon, ArrowRight, Alert, CircleCheck } from '../components/icons';
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
  const [formError, setFormError] = useState<ApiError | null>(() => api.takeLoginError());
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const toast = useToast();
  /** Выполняет действие формы: ошибку показываем прямо в форме, с причиной и подсказкой. */
  const act = async <T,>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setPending(key); setFormError(null); setInfo(null);
    try { return await fn(); }
    catch (e) { setFormError(e instanceof ApiError ? e : new ApiError('Не получилось выполнить действие', 'unknown', 'Обновите страницу и попробуйте снова.')); if (!(e instanceof ApiError)) console.error(e); return undefined; }
    finally { setPending(null); }
  };
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
    if (tab === 'login') act('login', async () => { const u = await api.login(email, pass); toast('success', `Добро пожаловать, ${u.name.split(' ')[0]}!`); navigate(u.role === 'admin' ? '/admin' : '/cabinet'); });
    if (tab === 'register') act('reg', async () => { const r = await api.register({ name, email, password: pass, deptId, title }); if (r.needsConfirm) setSent('confirm'); else navigate('/cabinet'); });
    if (tab === 'recover') act('rec', async () => { await api.recover(email); setSent('recover'); });
  };
  const demo = (r: Role) => run('demo-' + r, async () => { const u = await api.login(DEMO_ACCOUNTS[r], DEMO_PASSWORD); navigate(r === 'admin' ? '/admin' : r === 'manager' ? '/manager/accrual' : '/cabinet'); return u; }, (u) => `Демо-вход: ${u.name}`);
  const switchTab = (t: Tab) => { setTab(t); setErrors({}); setSent(null); setFormError(null); setInfo(null); };
  const resend = () => act('resend', async () => { await api.resendConfirmation(email); setInfo(`Письмо отправлено ещё раз на ${email.trim()}. Проверьте «Входящие» и «Спам».`); });
  /** Кнопки под ошибкой: что можно сделать прямо сейчас. */
  const errorActions = (e: ApiError) => {
    const b: { label: string; on: () => void; id: string }[] = [];
    if (e.code === 'invalid_credentials' && live) { b.push({ id: 'to-recover', label: 'Восстановить пароль', on: () => switchTab('recover') }); if (tab === 'login') b.push({ id: 'to-register', label: 'Зарегистрироваться', on: () => switchTab('register') }); }
    if (e.code === 'email_not_confirmed' || (e.code === 'link_expired' && okEmail(email))) b.push({ id: 'resend', label: 'Отправить письмо ещё раз', on: resend });
    if (e.code === 'link_expired') b.push({ id: 'to-recover', label: 'Восстановить пароль', on: () => switchTab('recover') });
    if (e.code === 'user_exists') { b.push({ id: 'to-login', label: 'Войти', on: () => switchTab('login') }); b.push({ id: 'to-recover', label: 'Восстановить пароль', on: () => switchTab('recover') }); }
    if (e.code === 'network' || e.code === 'server') b.push({ id: 'retry', label: 'Повторить', on: submit });
    return b;
  };

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
      <div className="login-form" style={{ position: 'relative' }}>
        <ThemeToggle className="login-theme" />
        <div className="login-box">
          <div className="row mb-16"><OtpLogo size={44} radius={12} /><div><div className="strong">ОТП Банк</div><div className="xs muted">Программа признания ОТП Мания</div></div></div>
          {sent ? (
            <div className="card soft" data-testid="check-email">
              <Mail size={28} />
              <h2 className="mt-12" style={{ fontSize: 22 }}>Проверьте почту</h2>
              <p className="text-2 mt-8">{sent === 'confirm' ? <>Мы отправили письмо на <b>{email}</b>. Перейдите по ссылке в нём, чтобы подтвердить почту и войти.</> : <>Если аккаунт с почтой <b>{email}</b> есть, на неё придёт ссылка для нового пароля.</>}</p>
              <p className="xs muted mt-8">Письма нет несколько минут? Проверьте папку «Спам» и правильность адреса.</p>
              {formError && <div className="auth-error small mt-12" role="alert"><Alert size={16} style={{ color: 'var(--red)', flex: 'none' }} /><div><b>{formError.message}</b>{formError.hint && <div className="text-2 mt-4">{formError.hint}</div>}</div></div>}
              {info && <div className="auth-ok small mt-12" role="status"><CircleCheck size={16} style={{ color: 'var(--green)', flex: 'none' }} /><span>{info}</span></div>}
              <div className="row-sm row-wrap mt-16">
                <Button variant="secondary" onClick={() => switchTab('login')}>Вернуться ко входу</Button>
                <Button variant="ghost" loading={pending === 'resend2'} onClick={() => act('resend2', async () => { if (sent === 'confirm') await api.resendConfirmation(email); else await api.recover(email); setInfo('Отправили письмо ещё раз. Проверьте «Входящие» и «Спам».'); })} data-testid="resend-again">Отправить ещё раз</Button>
              </div>
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
            {tab !== 'recover' && <Field label="Пароль" error={errors.pass} hint={tab === 'register' ? <span style={{ color: pass.length >= 8 ? 'var(--green)' : undefined }}>{pass.length >= 8 ? '✓ ' : ''}Минимум 8 символов{pass ? ` · сейчас ${pass.length}` : ''}</span> : undefined} htmlFor="pass">
              <PasswordInput id="pass" invalid={!!errors.pass} autoComplete={tab === 'register' ? 'new-password' : 'current-password'} value={pass} onChange={(v) => { setPass(v); setErrors((x) => ({ ...x, pass: '' })); }} />
            </Field>}
            {tab === 'login' && <div className="row between" style={{ marginTop: -6 }}><span /><button type="button" className="link-btn" onClick={() => switchTab('recover')} data-testid="forgot">Забыли пароль?</button></div>}
            {formError && (
              <div className="auth-error" role="alert" data-testid="auth-error">
                <Alert size={18} style={{ color: 'var(--red)', flex: 'none', marginTop: 1 }} />
                <div className="grow">
                  <b>{formError.message}</b>
                  {formError.hint && <div className="small text-2 mt-4">{formError.hint}</div>}
                  {errorActions(formError).length > 0 && <div className="actions">{errorActions(formError).map((x) => <Button key={x.id} size="sm" variant="secondary" loading={pending === x.id} onClick={x.on} data-testid={`err-${x.id}`}>{x.label}</Button>)}</div>}
                </div>
              </div>
            )}
            {info && <div className="auth-ok small" role="status"><CircleCheck size={18} style={{ color: 'var(--green)', flex: 'none' }} /><span>{info}</span></div>}
            {tab === 'register' && <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Подразделение" error={errors.dept} htmlFor="dept"><select id="dept" className="select" value={deptId} onChange={(e) => setDeptId(e.target.value)}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              <Field label="Должность" error={errors.title} htmlFor="title"><input id="title" className={errors.title ? 'input err' : 'input'} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Менеджер" /></Field>
            </div>}
            <Button type="button" size="lg" block loading={pending === 'login' || pending === 'reg' || pending === 'rec'} onClick={submit} data-testid="auth-submit">{tab === 'login' ? 'Войти' : tab === 'register' ? 'Создать аккаунт' : 'Прислать ссылку'}</Button>
            {tab === 'recover' && <>
              <p className="xs muted">Пришлём на почту ссылку. По ней можно задать новый пароль, ссылка работает один раз.</p>
              <button type="button" className="btn ghost sm" onClick={() => switchTab('login')}>Вспомнил пароль, вернуться ко входу</button>
            </>}
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

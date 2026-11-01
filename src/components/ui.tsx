import { ProductIllustration } from './productArt';
import { toggleTheme, useTheme } from '../lib/theme';
import { Sun, Moon, Eye, EyeOff, Key } from './icons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { cx, initials, fmt } from '../lib/utils';
import { Alert, CircleCheck, Info, Loader, X, Coins as CoinsIcon } from './icons';
import type { IconType } from 'react-icons';
import { ApiError } from '../data/api';
import type { User } from '../data/types';
import { POOL_PRESETS } from './icons';

/* ---------- Тосты ---------- */
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; text: string }
const ToastCtx = createContext<(kind: ToastKind, text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 5200 : 3400);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('toast', t.kind)}>
            {t.kind === 'error' ? <Alert size={18} /> : t.kind === 'success' ? <CircleCheck size={18} /> : <Info size={18} />}
            <span>{t.text}</span>
            <button aria-label="Закрыть" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Запускает действие API: показывает загрузку на кнопке, тост об успехе или ошибке. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T> | T, success?: string | ((r: T) => string)): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      if (success) toast('success', typeof success === 'function' ? success(r) : success);
      return r;
    } catch (e) {
      toast('error', e instanceof ApiError ? (e.hint ? `${e.message}. ${e.hint}` : e.message) : 'Что-то пошло не так. Попробуйте ещё раз');
      if (!(e instanceof ApiError)) console.error(e);
      return undefined;
    } finally {
      setBusy(null);
    }
  }, [toast]);
  return { run, busy };
}

/** Имитация загрузки раздела с сервера: скелетон при первом открытии. */
export function usePageLoading(key: string, ms = 350) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return loading;
}

/* ---------- Кнопки и поля ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'orange' | 'soft' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: IconType; block?: boolean };
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, block, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button {...rest} disabled={disabled || loading} className={cx('btn', variant !== 'primary' && variant, size !== 'md' && size, block && 'block', !children && 'icon', className)}>
      {loading ? <Loader size={16} className="spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, htmlFor }: { label?: string; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="field-err" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={cx(o.value === value && 'on')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Отображение ---------- */
export function Card({ children, className, title, subtitle, action }: { children?: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <div className="card-head">
          <div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: ReactNode; actions?: ReactNode; crumbs?: string }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row-sm row-wrap">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconType; tone?: 'dark' | 'accent' }) {
  return (
    <div className={cx('stat', tone === 'dark' && 'card dark', tone === 'accent' && 'card accent')} style={tone ? { padding: 18 } : undefined}>
      <div className="label">{Icon && <Icon size={14} />}{label}</div>
      <div className="value num">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export const Badge = ({ children, tone }: { children: ReactNode; tone?: 'orange' | 'dark' | 'green' | 'red' | 'yellow' }) => <span className={cx('badge', tone)}>{children}</span>;

export const Progress = ({ value, tone, thin, label }: { value: number; tone?: 'orange' | 'green'; thin?: boolean; label?: string }) => (
  <div className={cx('progress', tone, thin && 'thin')} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
  </div>
);

export function Avatar({ user, size = 36 }: { user: Pick<User, 'name' | 'color' | 'avatar'>; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: user.avatar ? `center/cover url(${user.avatar})` : user.color }} aria-hidden="true">
      {!user.avatar && initials(user.name)}
    </span>
  );
}

/** Значки валют: коин — лаймовый с искрой (за активность), РуКоин — фиолетовый с сердцем (признание руководителя). */
export const Coin = ({ ru, size }: { ru?: boolean; size?: number }) => (
  <svg className={cx('coin', ru && 'ru')} viewBox="0 0 100 100" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
    {ru ? <>
      <circle cx="50" cy="50" r="48" fill="#6f3fa0" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="3" />
      <path d="M50 80 C16 58 18 30 35 27 C44 25.5 48.5 31 50 37 C51.5 31 56 25.5 65 27 C82 30 84 58 50 80 Z" fill="#fff" />
    </> : <>
      <circle cx="50" cy="50" r="48" fill="#c1ff05" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#16161a" strokeOpacity=".14" strokeWidth="3" />
      <path d="M50 16 C54 40 60 46 84 50 C60 54 54 60 50 84 C46 60 40 54 16 50 C40 46 46 40 50 16 Z" fill="#16161a" />
    </>}
  </svg>
);
export const Amount = ({ value, ru, className }: { value: number; ru?: boolean; className?: string }) => (
  <span className={cx('price num', className)}>{fmt(value)} <Coin ru={ru} /><span className="sr-only">{ru ? 'РуКоинов' : 'коинов'}</span></span>
);

export function Empty({ icon: Icon = CoinsIcon, title, text, action }: { icon?: IconType; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic"><Icon size={22} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export const Skeleton = ({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <Skeleton h={30} w={260} />
      <div className="mt-8"><Skeleton h={14} w={420} /></div>
      <div className="grid g4 mt-24">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={104} r={16} />)}</div>
      <div className="grid g-main mt-16"><Skeleton h={300} r={22} /><Skeleton h={300} r={22} /></div>
    </div>
  );
}

/* ---------- Модальные окна ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, size }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Закрыть окно"])')?.focus(), 30);
    return () => { window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', size)} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <Button variant="ghost" size="sm" icon={X} aria-label="Закрыть окно" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head"><h2>{title}</h2><Button variant="ghost" size="sm" icon={X} aria-label="Закрыть" onClick={onClose} /></div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

export function Confirm({ open, title, text, confirmText, danger, loading, onConfirm, onClose }: { open: boolean; title: string; text: ReactNode; confirmText: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmText}</Button></>}>
      <div className="text-2">{text}</div>
    </Modal>
  );
}

/** Поле пароля: кнопка «показать пароль» и предупреждение о включённом Caps Lock. */
export function PasswordInput({ id, value, onChange, autoComplete, invalid, placeholder }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; placeholder?: string }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const onKey = (e: { getModifierState?: (k: string) => boolean }) => setCaps(!!e.getModifierState?.('CapsLock'));
  return (
    <>
      <div className="input-wrap pw-wrap">
        <Key size={16} />
        <input id={id} className={invalid ? 'input err' : 'input'} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} onKeyUp={onKey} onKeyDown={onKey} onBlur={() => setCaps(false)} spellCheck={false} autoCapitalize="off" />
        <button type="button" className="pw-eye" onClick={() => setShow((x) => !x)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={show} title={show ? 'Скрыть пароль' : 'Показать пароль'} data-testid={`${id}-eye`}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {caps && <div className="field-hint" style={{ color: 'var(--red)' }} role="status">Включён Caps Lock</div>}
    </>
  );
}

/** Кнопка смены темы: светлая ↔ тёмная. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTheme();
  return (
    <button type="button" className={cx('icon-btn theme-toggle', className)} onClick={toggleTheme} aria-label={t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={t === 'dark' ? 'Светлая тема' : 'Тёмная тема'} data-testid="theme-toggle">
      {t === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

/* ---------- Иллюстрации ---------- */
export function ProductArt({ id, icon, tone, nominal }: { id?: string; icon: string; tone: string; size?: 'md' | 'lg'; nominal?: number }) {
  const dark = ['#16161a', '#1f1f24', '#3a3a42'].includes(tone.toLowerCase());
  const bg = dark ? 'linear-gradient(150deg, #fafafa 0%, #ececf0 100%)' : `linear-gradient(150deg, #ffffff 0%, ${tone}14 55%, ${tone}30 100%)`;
  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, display: 'grid', placeItems: 'center' }} aria-hidden="true">
      <ProductIllustration id={id} icon={icon} tone={tone} nominal={nominal} />
    </div>
  );
}

export function PoolCover({ image, children, height = 140 }: { image: string; children?: ReactNode; height?: number }) {
  const preset = POOL_PRESETS[image];
  if (!preset) return <div className="pool-cover" style={{ height, backgroundImage: `url(${image})` }}>{children}</div>;
  const Icon = preset.icon;
  return (
    <div className="pool-cover" style={{ height, background: preset.bg }}>
      <Icon size={height * 0.42} color={preset.fg} strokeWidth={1.5} aria-hidden="true" />
      {children}
    </div>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="card"><Empty icon={Alert} title="Не удалось загрузить данные" text={text} action={onRetry && <Button variant="secondary" onClick={onRetry}>Повторить</Button>} /></div>
  );
}

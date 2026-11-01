/**
 * Клиент Supabase без SDK: авторизация (GoTrue) и таблица docs (PostgREST).
 * Ключ anon публичный по замыслу Supabase: доступ ограничивают политики RLS в supabase/schema.sql.
 */
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

export const SUPABASE_URL = (typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '').replace(/\/$/, '');
export const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';
export const remoteEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

import { ApiError, type ErrorCode } from './errors';
export { ApiError as RemoteError };
const RemoteError = ApiError;

export interface AuthUser { id: string; email: string; user_metadata?: Record<string, unknown>; email_confirmed_at?: string | null }
export interface Session { access_token: string; refresh_token: string; expires_at: number; user: AuthUser }
export interface DocRow { collection: string; id: string; data: unknown; deleted?: boolean; updated_at?: string }

const SESSION_KEY = 'otp-mania-session';
let session: Session | null = null;

function readStored(): Session | null {
  try { const r = localStorage.getItem(SESSION_KEY); return r ? (JSON.parse(r) as Session) : null; } catch { return null; }
}
function store(s: Session | null) {
  session = s;
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch { /* приватный режим */ }
}

/** Адрес, куда Supabase вернёт пользователя из письма. */
export const siteUrl = () => {
  try { return window.location.origin + window.location.pathname; } catch { return ''; }
};

type Mapped = { code: ErrorCode; text: string; hint?: string | ((raw: string) => string) };
const ERRORS: [RegExp, Mapped][] = [
  [/email not confirmed|email_not_confirmed/i, { code: 'email_not_confirmed', text: 'Почта ещё не подтверждена', hint: 'Откройте письмо от ОТП Мании и перейдите по ссылке. Письма нет? Проверьте папку «Спам» или отправьте письмо ещё раз.' }],
  [/invalid login credentials|invalid_credentials|invalid_grant/i, { code: 'invalid_credentials', text: 'Неверная почта или пароль', hint: 'Проверьте раскладку клавиатуры и Caps Lock. Если не помните пароль, восстановите его. Если ещё не регистрировались, создайте аккаунт.' }],
  [/already registered|already been registered|user_already_exists|email_exists/i, { code: 'user_exists', text: 'Эта почта уже зарегистрирована', hint: 'Войдите с этой почтой. Если не помните пароль, восстановите его.' }],
  [/same_password|should be different/i, { code: 'same_password', text: 'Новый пароль совпадает со старым', hint: 'Придумайте другой пароль.' }],
  [/password should be at least|weak_password|password is too weak/i, { code: 'weak_password', text: 'Пароль слишком простой', hint: 'Нужно минимум 8 символов. Лучше добавить цифры и буквы разного регистра.' }],
  [/email rate limit|over_email_send_rate_limit/i, { code: 'email_rate_limit', text: 'Лимит писем на этот час исчерпан', hint: (raw) => { const n = raw.match(/after (\d+) seconds?/i)?.[1]; return n ? `Повторить можно через ${n} сек.` : 'Supabase отправляет ограниченное число писем в час. Попробуйте позже. Администратору: лимит меняется в Authentication → Rate Limits.'; } }],
  [/rate limit|too many|over_request_rate_limit|for security purposes/i, { code: 'rate_limit', text: 'Слишком много попыток подряд', hint: (raw) => { const n = raw.match(/after (\d+) seconds?/i)?.[1]; return n ? `Подождите ${n} сек. и попробуйте снова.` : 'Подождите минуту и попробуйте снова.'; } }],
  [/email_address_not_authorized|not authorized to send/i, { code: 'email_not_authorized', text: 'Письмо на этот адрес не отправлено', hint: 'Встроенная почта Supabase пишет только участникам проекта. Администратору: подключите свою почту в Authentication → Emails → SMTP Settings.' }],
  [/error sending|smtp|sending .*email|mail.*fail/i, { code: 'email_send', text: 'Не удалось отправить письмо', hint: 'Почтовый сервер не принял письмо. Администратору: проверьте Authentication → Emails → SMTP Settings (адрес, порт, пароль приложения).' }],
  [/unable to validate email|invalid email|email_address_invalid|invalid format/i, { code: 'invalid_email', text: 'Некорректный адрес почты', hint: 'Проверьте, нет ли опечатки или лишнего пробела.' }],
  [/signups? not allowed|signup_disabled|email_provider_disabled/i, { code: 'signup_disabled', text: 'Регистрация сейчас выключена', hint: 'Администратору: включите вход по почте в Authentication → Sign In / Providers → Email.' }],
  [/jwt expired|invalid jwt|refresh token|session_not_found|bad_jwt/i, { code: 'session', text: 'Сессия истекла', hint: 'Войдите заново.' }],
  [/otp_expired|link.*expired|token has expired|flow_state/i, { code: 'link_expired', text: 'Ссылка из письма устарела', hint: 'Ссылка работает один раз и ограниченное время. Запросите новую: «Забыли пароль?» или «Отправить письмо ещё раз».' }],
  [/row-level security|permission denied|42501/i, { code: 'forbidden', text: 'Недостаточно прав для этого действия' }],
  [/Только администратор/i, { code: 'forbidden', text: 'Только администратор может менять роли и настройки' }],
];
export function toError(raw: string, status?: number): ApiError {
  for (const [re, m] of ERRORS) if (re.test(raw)) return new RemoteError(m.text, m.code, typeof m.hint === 'function' ? m.hint(raw) : m.hint);
  if (status && status >= 500) return new RemoteError('Сервер базы данных временно недоступен', 'server', 'Попробуйте через минуту. Если не помогает, проверьте в панели Supabase, что проект не на паузе.');
  return new RemoteError(raw ? `Ошибка сервера: ${raw}` : 'Сервер не ответил', 'unknown', 'Попробуйте ещё раз. Если повторяется, сообщите администратору текст ошибки.');
}

async function call<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (init.auth !== false) {
    const s = await getSession();
    headers.Authorization = `Bearer ${s ? s.access_token : SUPABASE_ANON_KEY}`;
  } else headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  let res: Response;
  try {
    res = await fetch(SUPABASE_URL + path, { ...init, headers });
  } catch {
    throw new RemoteError('Нет связи с сервером', 'network', 'Проверьте интернет. Если он есть, сервер может блокировать сеть (например, корпоративная сеть или без VPN). Демо-вход работает без сервера.');
  }
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const raw = body && typeof body === 'object' ? [body.error_code, body.code, body.msg, body.message, body.error_description, body.error, body.hint].filter(Boolean).join(' ') : String(body ?? res.status);
    throw toError(raw, res.status);
  }
  return body as T;
}

function toSession(b: any): Session {
  return { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (b.expires_in ?? 3600), user: b.user };
}

export async function getSession(): Promise<Session | null> {
  if (!session) session = readStored();
  if (!session) return null;
  if (session.expires_at - 60 < Date.now() / 1000) {
    try {
      const b = await call<any>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: JSON.stringify({ refresh_token: session.refresh_token }) });
      store(toSession(b));
    } catch { store(null); return null; }
  }
  return session;
}
export const hasStoredSession = () => remoteEnabled && !!readStored();

export const auth = {
  async signUp(email: string, password: string, meta: Record<string, string>) {
    const b = await call<any>(`/auth/v1/signup?redirect_to=${encodeURIComponent(siteUrl())}`, { method: 'POST', auth: false, body: JSON.stringify({ email, password, data: meta }) });
    if (b?.access_token) { store(toSession(b)); return { confirmed: true }; }
    return { confirmed: false };
  },
  async signIn(email: string, password: string) {
    const b = await call<any>('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: JSON.stringify({ email, password }) });
    const s = toSession(b);
    store(s);
    return s;
  },
  async recover(email: string) {
    await call(`/auth/v1/recover?redirect_to=${encodeURIComponent(siteUrl())}`, { method: 'POST', auth: false, body: JSON.stringify({ email }) });
  },
  /** Повторно отправляет письмо с подтверждением почты. */
  async resend(email: string) {
    await call(`/auth/v1/resend?redirect_to=${encodeURIComponent(siteUrl())}`, { method: 'POST', auth: false, body: JSON.stringify({ type: 'signup', email }) });
  },
  async updatePassword(password: string) {
    await call('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) });
  },
  async signOut() {
    try { if (session) await call('/auth/v1/logout', { method: 'POST' }); } catch { /* всё равно выходим */ }
    store(null);
  },
  /** Разбирает ссылку из письма: #access_token=...&type=signup|recovery. */
  async fromUrlHash(): Promise<null | { type: string }> {
    let h = '';
    try { h = window.location.hash.slice(1); } catch { return null; }
    if (!h.includes('access_token=') && !h.includes('error_description=')) return null;
    const p = new URLSearchParams(h);
    try { window.history.replaceState(null, '', window.location.pathname + '#/'); } catch { /* песочница */ }
    if (p.get('error_description') || p.get('error_code')) {
      const e = toError([p.get('error_code'), p.get('error_description')].filter(Boolean).join(' '));
      throw e.code === 'unknown' ? new RemoteError('Ссылка из письма не сработала', 'link_expired', 'Возможно, она устарела или уже использована. Запросите новую.') : e;
    }
    const access_token = p.get('access_token')!;
    let user: AuthUser;
    try {
      const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}` } });
      if (!r.ok) throw new Error();
      user = await r.json();
    } catch { throw new RemoteError('Ссылка из письма устарела', 'link_expired', 'Ссылка работает один раз и ограниченное время. Войдите или запросите новую.'); }
    store({ access_token, refresh_token: p.get('refresh_token') ?? '', expires_at: Math.floor(Date.now() / 1000) + Number(p.get('expires_in') ?? 3600), user });
    return { type: p.get('type') ?? 'signup' };
  },
  current: () => session ?? readStored(),
};

export const docs = {
  /** Все строки, изменённые после since (или все), постранично. */
  async fetch(since?: string): Promise<DocRow[]> {
    const out: DocRow[] = [];
    const page = 1000;
    for (let offset = 0; ; offset += page) {
      const q = `select=collection,id,data,deleted,updated_at&order=updated_at.asc,collection.asc,id.asc&limit=${page}&offset=${offset}` + (since ? `&updated_at=gt.${encodeURIComponent(since)}` : '');
      const rows = await call<DocRow[]>(`/rest/v1/docs?${q}`);
      out.push(...rows);
      if (rows.length < page) break;
    }
    return out;
  },
  async departments(): Promise<DocRow[]> {
    return call<DocRow[]>('/rest/v1/docs?select=collection,id,data&collection=eq.departments&deleted=eq.false', { auth: false });
  },
  async upsert(rows: DocRow[]) {
    for (let i = 0; i < rows.length; i += 400) {
      await call('/rest/v1/docs?on_conflict=collection,id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(i, i + 400).map((r) => ({ collection: r.collection, id: r.id, data: r.data, deleted: !!r.deleted }))),
      });
    }
  },
};

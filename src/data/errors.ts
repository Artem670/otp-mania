/** Коды ошибок, по которым форма входа подбирает подсказку и кнопки. */
export type ErrorCode =
  | 'invalid_credentials' | 'email_not_confirmed' | 'user_exists' | 'weak_password' | 'same_password' | 'rate_limit' | 'email_rate_limit'
  | 'invalid_email' | 'email_send' | 'email_not_authorized' | 'signup_disabled' | 'link_expired' | 'session' | 'forbidden'
  | 'network' | 'server' | 'demo_only' | 'unknown';

/** Ошибка, текст которой можно показать пользователю. hint объясняет причину и что делать. */
export class ApiError extends Error {
  code?: ErrorCode;
  hint?: string;
  constructor(message: string, code?: ErrorCode, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

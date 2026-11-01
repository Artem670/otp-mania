import otpLogo from '../assets/otp-logo.png';
import teamDark from '../assets/team-dark.png';
import teamLight from '../assets/team-light.png';

/** Логотип ОТП Банка (файл предоставлен командой). */
export function OtpLogo({ size = 32, radius = 9 }: { size?: number; radius?: number }) {
  return <img src={otpLogo} width={size} height={size} alt="ОТП Банк" style={{ borderRadius: radius, display: 'block', flex: 'none' }} />;
}

/** Фирменный знак: две точки. */
export function SpaceDots({ height = 10 }: { height?: number }) {
  return (
    <svg viewBox="0 0 44 18" height={height} width={(height * 44) / 18} aria-hidden="true" style={{ display: 'inline-block', flex: 'none' }}>
      <circle cx="9" cy="9" r="8" fill="#0047bb" />
      <circle cx="35" cy="9" r="8" fill="#568eff" />
    </svg>
  );
}

export const OTP_LOGO_URL = otpLogo;

/** Логотип команды «Нетворкинг» (дизайнер Илья): три точки и надпись. Светлая и тёмная версии меняются вместе с темой. */
export function TeamLogo({ height = 22, on }: { height?: number; on?: 'dark' | 'light' }) {
  return (
    <span className="team-logo" role="img" aria-label="Команда «Нетворкинг»">
      {on !== 'dark' && <img className={on ? undefined : 'tl-l'} src={teamLight} alt="" style={{ height }} />}
      {on !== 'light' && <img className={on ? undefined : 'tl-d'} src={teamDark} alt="" style={{ height }} />}
    </span>
  );
}

/** Подпись «сделано командой». */
export function TeamCredit({ on, text = 'Прототип команды' }: { on?: 'dark' | 'light'; text?: string }) {
  return <span className="team-credit"><span className="xs muted">{text}</span><TeamLogo height={24} on={on} /></span>;
}

import otpLogo from '../assets/otp-logo.png';

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

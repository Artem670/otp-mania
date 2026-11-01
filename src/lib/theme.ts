import { useSyncExternalStore } from 'react';

/** Тема оформления: выбор пользователя запоминается в браузере, без выбора берётся из настроек системы. */
export type Theme = 'light' | 'dark';
const KEY = 'otp-mania-theme';
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch { return null; }
}
function system(): Theme {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}
export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function applyTheme(t: Theme = stored() ?? system()) {
  document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}
export function toggleTheme() {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, next); } catch { /* тема просто не запомнится */ }
  applyTheme(next);
}
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!stored()) applyTheme(); });
} catch { /* старый браузер */ }

export function useTheme(): Theme {
  return useSyncExternalStore((l: () => void) => { listeners.add(l); return () => listeners.delete(l); }, currentTheme, currentTheme);
}

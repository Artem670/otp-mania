import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type MouseEvent } from 'react';

/** Лёгкий роутер без перезагрузки страницы. Работает и в песочнице предпросмотра. */
interface RouterValue { path: string; navigate: (to: string) => void }
const Ctx = createContext<RouterValue>({ path: '/', navigate: () => {} });

const readHash = () => {
  try {
    const h = window.location.hash.slice(1);
    return h.startsWith('/') ? h : '/';
  } catch { return '/'; }
};

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(readHash);
  const navigate = useCallback((to: string) => {
    setPath(to);
    try { window.history.pushState(null, '', '#' + to); } catch { /* песочница */ }
    try { window.scrollTo({ top: 0 }); } catch { /* noop */ }
  }, []);
  useEffect(() => {
    const on = () => setPath(readHash());
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('hashchange', on); };
  }, []);
  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>;
}

export const useRouter = () => useContext(Ctx);

/** Сопоставляет путь с шаблоном вида /cabinet/shop/:id. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = path.split('?')[0].split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, onClick, title }: { to: string; children: ReactNode; className?: string; onClick?: () => void; title?: string }) {
  const { navigate } = useRouter();
  return (
    <a href={'#' + to} className={className} title={title} onClick={(e: MouseEvent) => { e.preventDefault(); onClick?.(); navigate(to); }}>
      {children}
    </a>
  );
}

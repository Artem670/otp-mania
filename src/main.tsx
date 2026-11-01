import { applyTheme } from './lib/theme';
import { initResponsiveTables } from './lib/tables';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RouterProvider } from './lib/router';
import { ToastProvider } from './components/ui';
import './styles.css';
applyTheme();
initResponsiveTables();

createRoot(document.getElementById('root')!).render(
  <RouterProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </RouterProvider>,
);

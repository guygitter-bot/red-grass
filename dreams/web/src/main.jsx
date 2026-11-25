import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme } from './lib/theme';
import './index.css';

applyTheme();

// שמירת קובצי האפליקציה – כדי שתיפתח גם בלי רשת
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // כבר בביקור הראשון: לשמור את הקבצים שנטענו, כדי שהאפליקציה תיפתח גם בלי רשת
    try {
      const urls = performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => u.startsWith(window.location.origin) && !u.includes('/sw.js'));
      caches.open('zc-v1').then((c) => c.addAll(['./', ...new Set(urls)])).catch(() => {});
    } catch {
      // אין מטמון בדפדפן הזה
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

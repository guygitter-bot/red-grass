import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ApiError, reportClientError } from './lib/api';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// שיתוף לאפליקציה (קישורים וצ'אטים מווטסאפ) עובר דרך ה-service worker
// (באפליקציה מהחנות אין service worker – הקבצים כבר בתוך האפליקציה)
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// שגיאות שלא נתפסו (גם בתוך פעולה שלא קרסה למסך "משהו השתבש") – נרשמות במסך התקלות. כל הודעה פעם אחת
const reported = new Set();
const report = (message) => {
  const text = String(message || '').slice(0, 300);
  if (!text || reported.has(text) || reported.size > 20) return;
  reported.add(text);
  reportClientError(`${window.location.hash || 'home'} (לא נתפס)`, text);
};
window.addEventListener('error', (e) => report(e.error?.message || e.message));
// תשובת שגיאה מהשרת (כמו בלי אינטרנט) היא לא באג – לא נרשמת
window.addEventListener('unhandledrejection', (e) => {
  if (!(e.reason instanceof ApiError)) report(e.reason?.message || e.reason);
});

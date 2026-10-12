import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
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

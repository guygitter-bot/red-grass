import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme } from './lib/theme';
import { unlockAudio } from './lib/audio';
import './index.css';

applyTheme();
// השמע בטלפון נפתח רק אחרי נגיעה – לכן בכל לחיצה "פותחים" אותו (כדי שהשיר יתנגן לבד בתחילת כל שאלה)
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme } from './lib/theme';
import './index.css';

applyTheme();
// מצב "אוטומטי" עוקב אחרי המכשיר גם כשהוא מתחלף באמצע
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
} catch {
  // דפדפן ישן
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

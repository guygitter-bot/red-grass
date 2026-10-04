import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// בכל בנייה: גרסה חדשה ל-service worker ורשימת הקבצים לשמירה מראש (כדי שהאפליקציה תיפתח בלי רשת כבר מהפעם הראשונה)
function serviceWorkerVersion() {
  return {
    name: 'mat-kon-sw-version',
    apply: 'build',
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const assets = readdirSync(join(dist, 'assets')).map((f) => `./assets/${f}`);
      const files = ['./', './manifest.webmanifest', './icon.svg', ...assets].filter((f) => f === './' || f.startsWith('./assets/') || safeExists(join(dist, f)));
      const sw = join(dist, 'sw.js');
      writeFileSync(sw, readFileSync(sw, 'utf8')
        .replace('__BUILD__', String(Date.now()))
        .replace('[/*PRECACHE*/]', JSON.stringify(files)));
    },
  };
}

function safeExists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), serviceWorkerVersion()],
  server: { fs: { allow: ['..'] } },
});

// רינדור פריימים שקופים (PNG) מתוך scene.html באמצעות Playwright.
// שימוש: node render.mjs config.json outDir   (config.json: W,H,fps,duration,... + מצב)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/usr/local/lib/node_modules_global', 'playwright')));
}
const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });
cfg.fontUrl = pathToFileURL(path.join(here, '..', 'video-tools', 'fonts', 'Rubik.ttf')).href;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: cfg.W, height: cfg.H }, deviceScaleFactor: 1 });
await page.addInitScript((c) => { window.__CONFIG = c; }, cfg);
await page.addInitScript((url) => {
  // טעינת הפונט המקומי לפני הציור
  window.addEventListener('DOMContentLoaded', () => {
    const f = new FontFace('Rubik', `url(${url})`, { weight: '300 900' });
    window.__fontReady = f.load().then(ff => { document.fonts.add(ff); });
  });
}, cfg.fontUrl);
await page.goto(pathToFileURL(path.join(here, 'scene.html')).href);
await page.evaluate(() => window.__fontReady);

if (cfg.mode === 'bg') {
  await page.screenshot({ path: path.join(outDir, 'bg.png'), type: 'png' });
} else {
  const n = Math.ceil(cfg.duration * cfg.fps);
  let prevSig = null, prevFile = null;
  for (let i = 0; i < n; i++) {
    const sig = await page.evaluate((t) => window.seek(t), i / cfg.fps);
    const file = path.join(outDir, `f${String(i).padStart(5, '0')}.png`);
    if (sig === prevSig && prevFile) {      // פריים זהה לקודם: קישור במקום צילום חדש
      fs.linkSync(prevFile, file);
    } else {
      await page.screenshot({ path: file, type: 'png', omitBackground: true });
      prevSig = sig; prevFile = file;
    }
  }
}
await browser.close();

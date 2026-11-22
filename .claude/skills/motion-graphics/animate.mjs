// רינדור אנימציית HTML חופשית לפריימים (PNG), פריים אחרי פריים, בצורה דטרמיניסטית.
// שימוש: node animate.mjs page.html outDir W H fps seconds
// השעון של הדף מזויף (Date, setTimeout, requestAnimationFrame, performance.now) ומתקדם בדיוק פריים בכל צעד;
// אנימציות CSS / WAAPI מוקפאות ומוצבות על הזמן הנכון. אם בדף יש window.seek(t) (שניות) – קוראים לו במקום.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/usr/local/lib/node_modules_global', 'playwright')));
}
const [file, outDir, W, H, FPS, SECONDS] = process.argv.slice(2);
const w = Number(W), h = Number(H), fps = Number(FPS), n = Math.round(Number(SECONDS) * fps);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
// תקרת זמן כוללת: דף תקוע לא תוקע את כל העבודה
const killer = setTimeout(() => { console.error('animation render timed out'); process.exit(3); }, 15 * 60 * 1000);
try {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(30000);
  await page.clock.install({ time: 0 });
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 30000 }).catch((e) => console.error('load:', e.message));
  // גופנים (Google Fonts וגם מקומיים) – מחכים, אבל לא לנצח
  await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 8000))]);
  await page.clock.pauseAt(1000);
  const hasSeek = await page.evaluate(() => typeof window.seek === 'function');

  // מוקפא על הזמן t (במילישניות): כל אנימציה נמדדת מהרגע שנראתה לראשונה
  await page.evaluate(() => {
    window.__first = new WeakMap();
    window.__freeze = (t) => {
      for (const a of document.getAnimations()) {
        if (!window.__first.has(a)) window.__first.set(a, t);
        a.pause();
        a.currentTime = Math.max(0, t - window.__first.get(a));
      }
    };
  });

  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = Math.round((i * 1000) / fps);
    if (t > last) { await page.clock.runFor(t - last); last = t; }
    if (hasSeek) await page.evaluate((s) => window.seek(s), t / 1000);
    await page.evaluate((ms) => window.__freeze(ms), t);
    await page.screenshot({ path: path.join(outDir, `f${String(i).padStart(5, '0')}.png`), type: 'png', animations: 'allow' });
  }
} finally {
  clearTimeout(killer);
  await browser.close();
}

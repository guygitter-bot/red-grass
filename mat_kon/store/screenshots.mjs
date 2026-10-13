// תמונות לחנות Google Play של mat-kon, נוצרות אוטומטית מהאפליקציה (שרת מדומה, בלי AI ובלי עלות).
// הרצה: קודם לבנות את האפליקציה (cd mat_kon/web && npm run build), ואז מהשורש או מהתיקייה הזו:
//   node mat_kon/store/screenshots.mjs        (או: cd mat_kon/store && node screenshots.mjs)
// הפלט ב-mat_kon/store/images/:
//   01-book.png … 06-fridge.png – צילומי טלפון 1080x2160 (חלון 360x720 ב-dpr 3, מצב יום)
//   feature.png – גרפיקת פיצ'ר 1024x500
//   icon-512.png – אייקון 512x512
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, mockApi, demo } from '../tutorials/kit.mjs';

const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'images');
const FONTS = join(HERE, '..', 'tutorials', 'fonts');
const API = 'https://mat-kon-api.guygitter.workers.dev';
mkdirSync(OUT, { recursive: true });

const fontCss = readFileSync(join(FONTS, 'rubik.css'), 'utf8').replace(/https:\/\/fonts\.gstatic\.com\/s\/rubik\/v\d+\//g, 'https://fonts.gstatic.com/local/');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

// הגופן Rubik מקומי (בלי רשת)
async function routeFonts(ctx) {
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: fontCss, contentType: 'text/css' }));
  await ctx.route('https://fonts.gstatic.com/**', (r) => {
    const file = join(FONTS, new URL(r.request().url()).pathname.split('/').pop());
    return existsSync(file) ? r.fulfill({ body: readFileSync(file), contentType: 'font/woff2' }) : r.abort();
  });
}

// ---------- צילומי טלפון ----------
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const pad = (n) => String(n).padStart(2, '0');
const key = (offset) => { const d = new Date(Date.now() + offset * 86400000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const plan = [
  { id: 'm1', day: key(0), recipeId: 'r-shakshuka', title: 'שקשוקה ביתית', meal: 'ארוחת בוקר' },
  { id: 'm2', day: key(0), recipeId: 'r-chicken', title: 'עוף בתנור', meal: 'ארוחת ערב' },
  { id: 'm3', day: key(1), title: 'סלט גדול ולחם', meal: 'ארוחת צהריים' },
  { id: 'm4', day: key(2), recipeId: 'r-chocolate-cake', title: 'עוגת שוקולד בחושה', meal: 'קינוח' },
];
const mock = mockApi({ delay: 0, plan: plan.filter((m) => demo.RECIPES.some((r) => r.id === m.recipeId) || !m.recipeId), shopping: [] });

async function shot(name, run) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 720 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block', colorScheme: 'light' });
  await routeFonts(ctx);
  await ctx.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* אין גוף */ }
    const out = await mock.handle(req.method(), url.pathname + url.search, body);
    const [status, json] = Array.isArray(out) ? out : [200, out];
    await route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (r.request().url().startsWith(API) || r.request().url().includes('fonts.g') ? r.fallback() : r.abort()));
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(base);
  await page.waitForLoadState('networkidle').catch(() => {});
  await run(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log('נשמר', name);
  await ctx.close();
}

await shot('01-book', async (page) => { await page.waitForSelector('img'); });
await shot('02-recipe', async (page) => {
  await page.evaluate(() => { window.location.hash = '#/r/r-shakshuka'; });
  await page.getByText('עגבניות בשלות').first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 560)); // מראים מצרכים ושלבים
});
await shot('03-categories', async (page) => {
  await page.evaluate(() => { window.location.hash = '#/categories'; });
  await page.waitForTimeout(800);
});
await shot('04-shopping', async (page) => {
  await page.evaluate(() => { window.location.hash = '#/r/r-shakshuka'; });
  await page.getByRole('button', { name: 'לרשימת קניות', exact: true }).click();
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.location.hash = '#/shopping'; });
  await page.getByRole('button', { name: /סידור חכם/ }).click();
  await page.getByRole('heading', { name: 'ירקות ופירות' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /סימון/ }).nth(0).click();
  await page.getByRole('button', { name: /סימון/ }).nth(1).click();
  await page.waitForTimeout(3500); // שההודעה הקופצת תיעלם
});
await shot('05-add', async (page) => {
  await page.getByPlaceholder('קישור או שם של מנה').fill('https://www.example-food.co.il/spinach-quiche');
});
await shot('06-plan', async (page) => {
  await page.evaluate(() => { window.location.hash = '#/plan'; });
  await page.waitForTimeout(1000);
});
server.close();

// ---------- גרפיקת פיצ'ר ואייקון ----------
const icon = readFileSync(join(HERE, '..', 'web', 'public', 'icon.svg'), 'utf8');
const iconUri = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;
const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1, locale: 'he-IL' });
await routeFonts(ctx);
const page = await ctx.newPage();
await page.setContent(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
html,body{margin:0;background:#ea580c}
.w{position:absolute;left:0;top:0;width:1024px;height:500px;overflow:hidden;font-family:Rubik,system-ui,sans-serif;color:#fff;direction:rtl;
 background:linear-gradient(135deg,#f97316 0%,#ea580c 55%,#c2410c 100%);display:flex;align-items:center;justify-content:center;gap:56px;}
.blob{position:absolute;border-radius:50%;background:rgba(255,255,255,.09)}
img{width:230px;height:230px;border-radius:52px;box-shadow:0 18px 40px rgba(0,0,0,.28);position:relative}
.t{position:relative}
h1{margin:0;font-size:104px;font-weight:900;line-height:1;direction:ltr;text-align:right;letter-spacing:-1px}
p{margin:18px 0 0;font-size:40px;font-weight:600;opacity:.96}
</style></head><body><div class="w">
<div class="blob" style="width:520px;height:520px;left:-170px;top:-200px"></div>
<div class="blob" style="width:380px;height:380px;right:-120px;bottom:-190px"></div>
<img src="${iconUri}" alt=""><div class="t"><h1>mat-kon</h1><p>כל המתכונים שלך במקום אחד</p></div></div>
</body></html>`);
await page.waitForLoadState('networkidle').catch(() => {});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'feature.png') });
console.log('נשמר feature');
await ctx.close();

// אייקון 512: האייקון המלא (בלי פינות מעוגלות, כנדרש ב-Play) מ-mobile/assets, מוקטן
const iconPng = readFileSync(join(HERE, '..', 'mobile', 'assets', 'icon-only.png')).toString('base64');
const ictx = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
const ip = await ictx.newPage();
await ip.setContent(`<body style="margin:0"><img src="data:image/png;base64,${iconPng}" style="width:512px;height:512px;display:block"></body>`);
await ip.waitForTimeout(300);
await ip.screenshot({ path: join(OUT, 'icon-512.png') });
console.log('נשמר icon-512');
await ictx.close();
await browser.close();

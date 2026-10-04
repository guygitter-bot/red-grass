// ערכת הקלטה לסרטוני ההדרכה: מריצה את האפליקציה (dist) בדפדפן בגודל טלפון, עם שרת מדומה
// (אין פניות לשרת האמיתי ואין עלות AI), כתוביות בעברית ו"אצבע" שמראה איפה לוחצים.
// הפלט: web/public/tutorials/<name>.mp4 + <name>.jpg
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as demo from './demo.mjs';

const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'web', 'dist');
const OUT = join(HERE, '..', 'web', 'public', 'tutorials');
const TMP = join(HERE, '.rec');
const API = 'https://mat-kon-api.guygitter.workers.dev';
const VOICE = join(HERE, 'voice');
const MUSIC = join(HERE, 'music.m4a');
const W = 390;
const H = 844;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

// שרת סטטי קטן ל-dist
function serve() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(DIST, path);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const clone = (x) => JSON.parse(JSON.stringify(x));

// שרת API מדומה עם מצב (מתכונים, קניות, מקרר, תכנון)
function mockApi(opts = {}) {
  const state = {
    recipes: clone(opts.recipes ?? demo.RECIPES),
    shopping: clone(opts.shopping ?? demo.SHOPPING),
    pantry: clone(opts.pantry ?? demo.PANTRY),
    plan: clone(opts.plan ?? []), // רשימה שטוחה עם day
    custom: clone(opts.custom ?? []),
    jobs: {},
    members: clone(opts.members ?? { holder: { name: 'דנה כהן', email: 'dana@example.com' }, members: [{ id: 'u2', name: 'יוסי כהן', email: 'yossi@example.com' }], pending: [], max: 5 }),
    newRecipe: clone(opts.newRecipe ?? demo.NEW_RECIPE),
    delay: opts.delay ?? 2500,
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const created = (extra = {}) => {
    const r = { ...clone(state.newRecipe), ...extra, createdAt: new Date().toISOString() };
    state.recipes = [r, ...state.recipes.filter((x) => x.id !== r.id)];
    return r;
  };
  const applyOps = (list, ops) => {
    const out = [...list];
    for (const o of ops) {
      const at = out.findIndex((x) => x.id === o.id);
      if (o.op === 'remove') { if (at >= 0) out.splice(at, 1); } else if (o.op === 'update') { if (at >= 0) out[at] = o.item; } else if (o.op === 'add' && at < 0) out.push(o.item);
    }
    return out;
  };
  const toPlan = (items) => {
    const plan = {};
    for (const { day, ...m } of items) (plan[day] ||= []).push(m);
    return plan;
  };
  async function handle(method, path, body) {
    const p = path.split('?')[0];
    if (p === '/auth-config') return { googleClientId: '', ownerLocked: false };
    if (p === '/me') return { owner: true, user: null, categories: state.custom, paymentUrl: '' };
    if (p === '/recipes' && method === 'GET') return { recipes: state.recipes };
    if (p === '/recipes' && method === 'POST') {
      const id = `job-${Date.now()}`;
      state.jobs[id] = { at: Date.now(), url: body.url };
      return [202, { job: { id, status: 'pending' } }];
    }
    let m = p.match(/^\/jobs\/(.+)$/);
    if (m) {
      const job = state.jobs[m[1]];
      if (Date.now() - job.at < state.delay) return { job: { id: m[1], status: 'running' } };
      if (!job.recipe) job.recipe = created({ source: { url: job.url, kind: 'web' } });
      return { job: { id: m[1], status: 'done', recipeId: job.recipe.id, title: job.recipe.title, category: job.recipe.category } };
    }
    if (p === '/recipes/photo') { await sleep(state.delay); return { recipe: created({ source: { kind: 'photo' } }) }; }
    if (p === '/recipes/text') { await sleep(state.delay); return { recipe: created({ source: { kind: 'whatsapp', ...(body.url ? { url: body.url } : {}), text: body.text } }) }; }
    if (p === '/recipes/manual') {
      const r = { id: `r-${Date.now()}`, tags: [], tips: [], ...body, ...(body.recipe || {}), source: { kind: 'manual' }, createdAt: new Date().toISOString() };
      delete r.recipe;
      state.recipes = [r, ...state.recipes];
      return { recipe: r };
    }
    m = p.match(/^\/recipes\/([\w-]+)(\/refresh)?$/);
    if (m) {
      const r = state.recipes.find((x) => x.id === m[1]);
      if (m[2]) { await sleep(1500); return { recipe: r }; }
      if (method === 'GET') return { recipe: r };
      if (method === 'PUT') { Object.assign(r, body); return { recipe: r }; }
      if (method === 'DELETE') { state.recipes = state.recipes.filter((x) => x.id !== m[1]); return { ok: true }; }
    }
    if (p === '/categories') { state.custom = [...state.custom, body.name]; return { custom: state.custom }; }
    if (p === '/categories/remove') { state.custom = state.custom.filter((c) => c !== body.name); return { custom: state.custom }; }
    if (p === '/search') { await sleep(state.delay); return { results: opts.searchResults ?? demo.SEARCH_RESULTS }; }
    if (p === '/shopping/organize') {
      await sleep(state.delay);
      return { groups: opts.groups ?? [
        { title: 'ירקות ופירות', items: body.items.filter((i) => /עגבני|מלפפון|בצל|לימון|פטרוזיליה|תפוח|גזר|פלפל|שום/.test(i)) },
        { title: 'מוצרי חלב וביצים', items: body.items.filter((i) => /חלב|ביצ|גבינ|פטה|שמנת|חמאה/.test(i)) },
        { title: 'מאפים ומזווה', items: body.items.filter((i) => !/עגבני|מלפפון|בצל|לימון|פטרוזיליה|תפוח|גזר|פלפל|שום|חלב|ביצ|גבינ|פטה|שמנת|חמאה/.test(i)) },
      ].filter((g) => g.items.length) };
    }
    if (p === '/stores') { await sleep(state.delay); return opts.stores ?? demo.STORES; }
    if (p === '/pantry/scan') { await sleep(state.delay); return { items: ['one', 'single'].includes(body.mode) ? demo.SCAN_SINGLE : demo.SCAN_MANY }; }
    if (p === '/pantry/ideas') { await sleep(state.delay); return { results: demo.IDEAS }; }
    for (const list of ['shopping', 'pantry', 'plan']) {
      if (p === `/${list}` && method === 'GET') return list === 'plan' ? { plan: toPlan(state.plan) } : { items: state[list] };
      if (p === `/${list}/ops`) {
        state[list] = applyOps(state[list], body.ops);
        return list === 'plan' ? { plan: toPlan(state.plan) } : { items: state[list] };
      }
      if (p === `/${list}` && method === 'PUT') {
        if (list === 'plan') state.plan = Object.entries(body.plan).flatMap(([day, ms]) => ms.map((x) => ({ ...x, day })));
        else state[list] = body.items;
        return list === 'plan' ? { plan: body.plan } : { items: state[list] };
      }
    }
    if (p === '/members' && method === 'GET') return state.members;
    if (p === '/members' && method === 'POST') {
      const join = { token: 'demo-join-link', expiresAt: Date.now() + 30 * 86400000 };
      state.members.pending = [...state.members.pending, join];
      return { join };
    }
    if (p === '/logout' || p === '/client-error') return { ok: true };
    return { ok: true };
  }
  return { state, handle };
}

// שכבת הכתוביות והאצבע (מוזרקת לכל דף)
const OVERLAY = () => {
  if (window.__tut) return;
  const css = document.createElement('style');
  css.textContent = `
  #tut-cap{position:fixed;left:12px;right:12px;bottom:96px;z-index:2147483646;pointer-events:none;display:flex;justify-content:center;transition:opacity .35s,transform .35s;opacity:0;transform:translateY(8px)}
  #tut-cap.on{opacity:1;transform:none}
  #tut-cap.top{bottom:auto;top:calc(12px + env(safe-area-inset-top))}
  #tut-cap div{background:rgba(28,25,23,.9);color:#fff;font:600 17px/1.45 Rubik,system-ui,sans-serif;padding:12px 16px;border-radius:18px;text-align:center;direction:rtl;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:360px}
  #tut-cap b{color:#fdba74}
  #tut-dot{position:fixed;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(249,115,22,.35);border:3px solid rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1),opacity .3s,transform .15s;opacity:0;left:50%;top:70%}
  #tut-dot.on{opacity:1}
  #tut-dot.press{transform:scale(.75);background:rgba(249,115,22,.7)}
  .tut-ring{position:fixed;z-index:2147483646;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #f97316;pointer-events:none;animation:tutring .6s ease-out forwards}
  @keyframes tutring{to{transform:scale(2.6);opacity:0}}
  #tut-card{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:linear-gradient(160deg,#f97316,#f59e0b);color:#fff;direction:rtl;text-align:center;padding:32px;font-family:Rubik,system-ui,sans-serif;transition:opacity .5s}
  #tut-card .k{font-size:15px;font-weight:600;opacity:.9;background:rgba(255,255,255,.2);padding:4px 12px;border-radius:99px}
  #tut-card h1{font-size:34px;font-weight:900;line-height:1.2;margin:0}
  #tut-card p{font-size:18px;line-height:1.5;margin:0;opacity:.95;max-width:320px}
  #tut-card .e{font-size:72px;line-height:1}
  `;
  document.documentElement.appendChild(css);
  const cap = document.createElement('div');
  cap.id = 'tut-cap';
  cap.innerHTML = '<div></div>';
  const dot = document.createElement('div');
  dot.id = 'tut-dot';
  document.documentElement.append(cap, dot);
  window.__tut = {
    say(html, top) {
      cap.classList.toggle('top', Boolean(top));
      if (!html) return cap.classList.remove('on');
      cap.firstChild.innerHTML = html;
      cap.classList.add('on');
    },
    move(x, y) { dot.style.left = `${x}px`; dot.style.top = `${y}px`; dot.classList.add('on'); },
    press(x, y) {
      dot.classList.add('press');
      const ring = document.createElement('div');
      ring.className = 'tut-ring';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      document.documentElement.appendChild(ring);
      setTimeout(() => ring.remove(), 700);
      setTimeout(() => dot.classList.remove('press'), 180);
    },
    hide() { dot.classList.remove('on'); },
    card(emoji, kicker, title, text) {
      let c = document.getElementById('tut-card');
      if (!c) { c = document.createElement('div'); c.id = 'tut-card'; document.documentElement.appendChild(c); }
      c.style.opacity = '1';
      c.innerHTML = `<div class="e">${emoji}</div>${kicker ? `<div class="k">${kicker}</div>` : ''}<h1>${title}</h1>${text ? `<p>${text}</p>` : ''}`;
    },
    uncard() { const c = document.getElementById('tut-card'); if (c) { c.style.opacity = '0'; setTimeout(() => c.remove(), 500); } },
  };
};

// תמונות לדוגמה ל"צילום": דף מתכון בכתב יד, מקרר, מוצר בודד
async function samplePhotos(browser) {
  const dir = join(TMP, 'photos');
  if (existsSync(join(dir, 'fridge.png'))) return dir;
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  const shots = {
    'note.png': `<body style="margin:0;background:#fef9c3;font:28px/1.7 'DejaVu Sans';direction:rtl;padding:40px;color:#1e3a8a;background-image:repeating-linear-gradient(#fef9c3 0 46px,#93c5fd 46px 48px)"><h2 style="margin:0 0 10px">פשטידת תרד של סבתא</h2>חצי קילו תרד<br>4 ביצים<br>גביע גבינה לבנה<br>150 גרם פטה<br>2 כפות קמח<br>לערבב הכל ולאפות 45 דק' ב-180</body>`,
    'fridge.png': `<body style="margin:0;background:#e7e5e4;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:30px;font-size:110px;text-align:center;border:24px solid #d6d3d1;box-sizing:border-box;height:800px">🥛🧀🥕<br>🫑🍋🥚<br>🧈🍅🥒</body>`,
    'yogurt.png': `<body style="margin:0;background:#f5f5f4;display:flex;align-items:center;justify-content:center;height:800px;font-size:300px">🥣</body>`,
  };
  for (const [name, html] of Object.entries(shots)) {
    await page.setContent(html);
    await page.screenshot({ path: join(dir, name) });
  }
  await page.close();
  return dir;
}

// ---------- הקראה ----------
// כל כתובית נקראת בקול. הקבצים: voice/<key>.mp3 (נוצרים ב-GitHub Actions עם Google TTS – mat-kon-voice.yml),
// והטקסטים לרשימה voice/lines.json. משפט בלי קובץ עדיין נרשם לרשימה, והסרטון נבנה בינתיים בלי הקול שלו.
const SAY_WORDS = [
  [/mat-kon/gi, 'מַט-קוֹן'], [/YouTube/g, 'יוטיוב'], [/TikTok/g, 'טיקטוק'], [/Instagram/g, 'אינסטגרם'], [/Waze/g, 'וֵייז'],
  [/Safari/g, 'ספארי'], [/Chrome/g, 'כרום'], [/PDF/g, 'פי-די-אף'], [/##/g, 'שתי סולמיות'], [/א-ב/g, 'אלף-בית'],
  [/⋮/g, 'שלוש הנקודות'], [/✕/g, 'האיקס'], [/\s*←\s*/g, ', ואז '], [/\+\s*(?=קטגוריה|ליד|והכמויות)/g, 'פלוס '], [/על \+/g, 'על פלוס'],
];
export function speakable(html) {
  let text = String(html).replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]+>/g, '');
  for (const [re, to] of SAY_WORDS) text = text.replace(re, to);
  return text
    .replace(/💡\s*טיפ:?/g, 'טיפ:')
    .replace(/[\p{Extended_Pictographic}\ufe0f]+\s*\/\s*[\p{Extended_Pictographic}\ufe0f]+/gu, '')
    .replace(/\p{Extended_Pictographic}|\u200d|\ufe0f/gu, '')
    .replace(/…/g, '.')
    .replace(/(?<=\p{L})\s*\/\s*(?=\p{L})/gu, ' או ')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/"\s*(?=[֐-׿])/g, '" ')
    .replace(/\.\s*\./g, '.')
    .replace(/^[\s.,–-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const voiceKey = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);
function voiceClip(text) {
  if (!text) return null;
  const key = voiceKey(text);
  mkdirSync(VOICE, { recursive: true });
  const listFile = join(VOICE, 'lines.json');
  const lines = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : {};
  if (lines[key] !== text) {
    lines[key] = text;
    writeFileSync(listFile, `${JSON.stringify(Object.fromEntries(Object.entries(lines).sort()), null, 1)}\n`);
  }
  const file = join(VOICE, `${key}.mp3`);
  if (!existsSync(file)) return null;
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
  return { file, dur };
}

// הקלטה של סרטון אחד
export async function record(name, script, opts = {}) {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const photos = await samplePhotos(browser);
  const vdir = join(TMP, name);
  rmSync(vdir, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: false,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    serviceWorkers: 'block',
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    geolocation: { latitude: 32.08, longitude: 34.78 },
  });
  const mock = mockApi(opts.mock);
  await ctx.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* אין גוף */ }
    const out = await mock.handle(req.method(), url.pathname + url.search, body);
    const [status, json] = Array.isArray(out) ? out : [200, out];
    await route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
  });
  // הגופן של האפליקציה (Rubik) מקומית
  const fontCss = readFileSync(join(HERE, 'fonts', 'rubik.css'), 'utf8').replace(/https:\/\/fonts\.gstatic\.com\/s\/rubik\/v\d+\//g, 'https://fonts.gstatic.com/local/');
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: fontCss, contentType: 'text/css' }));
  await ctx.route('https://fonts.gstatic.com/**', (r) => {
    const file = join(HERE, 'fonts', new URL(r.request().url()).pathname.split('/').pop());
    return existsSync(file) ? r.fulfill({ body: readFileSync(file), contentType: 'font/woff2' }) : r.abort();
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
    const u = r.request().url();
    if (u.startsWith(API) || u.includes('fonts.g')) return r.fallback();
    return r.abort();
  });
  await ctx.addInitScript(`document.addEventListener('DOMContentLoaded', ${OVERLAY});`);
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem('tut-seeded')) {
      localStorage.clear();
      for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, JSON.stringify(v));
      sessionStorage.setItem('tut-seeded', '1');
    }
  }, opts.storage || {});

  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(base + (opts.start || ''));
  await page.evaluate(OVERLAY);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  // צילום המסך ברזולוציה מלאה (DevTools screencast): ההקלטה המובנית של Playwright מקליטה בגודל CSS בלבד
  mkdirSync(vdir, { recursive: true });
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
    const file = join(vdir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });

  const wait = (ms) => page.waitForTimeout(ms);
  // הקראה: משפט חדש מחכה שהקודם יסתיים, והכתובית נשארת לפחות עד סוף המשפט
  const voice = [];
  let voiceUntil = 0;
  const waitVoice = async () => {
    const left = voiceUntil - Date.now();
    if (left > 0) await wait(left);
  };
  const speak = (text) => {
    const clip = voiceClip(speakable(text));
    if (!clip) return 0;
    voice.push({ file: clip.file, t: Date.now() / 1000 });
    voiceUntil = Date.now() + clip.dur * 1000 + 350;
    return clip.dur * 1000 + 350;
  };
  const center = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const box = await loc.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const helpers = {
    page,
    mock,
    photos,
    base,
    wait,
    // כתובית. top=true מציג אותה למעלה (כשהחלק התחתון של המסך חשוב)
    async say(html, ms = 2600, top = false) {
      await waitVoice();
      await page.evaluate(([h, t]) => window.__tut.say(h, t), [html, top]);
      const spoken = speak(html);
      if (ms) await wait(Math.max(ms, spoken));
    },
    async unsay() { await page.evaluate(() => window.__tut.say('')); },
    async point(loc, ms = 700) {
      const { x, y } = await center(loc);
      await page.evaluate(([a, b]) => window.__tut.move(a, b), [x, y]);
      await wait(ms);
      return { x, y };
    },
    async tap(loc, { after = 900 } = {}) {
      await loc.waitFor({ state: 'visible' });
      const { x, y } = await helpers.point(loc);
      await page.evaluate(([a, b]) => window.__tut.press(a, b), [x, y]);
      await wait(180);
      await loc.click();
      await wait(after);
    },
    async type(loc, text, { delay = 70, after = 500 } = {}) {
      await helpers.tap(loc, { after: 300 });
      await loc.pressSequentially(text, { delay });
      await wait(after);
    },
    // "צילום" / בחירת קובץ: מראים לחיצה על הכפתור ומכניסים תמונה לדוגמה
    async upload(trigger, inputLoc, files) {
      const { x, y } = await helpers.point(trigger);
      await page.evaluate(([a, b]) => window.__tut.press(a, b), [x, y]);
      await wait(400);
      await inputLoc.setInputFiles(files.map((f) => join(photos, f)));
      await wait(900);
    },
    async scroll(dy, ms = 900) {
      await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), dy);
      await wait(ms);
    },
    async hideDot() { await page.evaluate(() => window.__tut.hide()); },
    async card(emoji, kicker, title, text, ms = 2800) {
      await waitVoice();
      await page.evaluate(([a, b, c, d]) => window.__tut.card(a, b, c, d), [emoji, kicker, title, text]);
      const spoken = speak([kicker, title, text].filter(Boolean).map((x) => String(x).replace(/[.!?]?$/, '.')).join(' '));
      await wait(Math.max(ms, spoken + 300));
    },
    async uncard(ms = 600) { await page.evaluate(() => window.__tut.uncard()); await wait(ms); },
    async go(hash) { await page.evaluate((h) => { window.location.hash = h; }, hash); await wait(900); },
  };

  try {
    await script(helpers);
    await waitVoice();
    await wait(800);
  } finally {
    const end = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await ctx.close();
    await browser.close();
    server.close();
    encode(vdir, frames, end, name, opts.poster ?? 1.2, voice);
  }
}

// פריימים -> mp4 (H.264, נפתח בכל טלפון) + תמונת שער. כל פריים מוצג עד שמגיע הבא
function encode(dir, frames, end, name, posterAt, voice = []) {
  if (!frames.length) throw new Error('no frames recorded');
  const mp4 = join(OUT, `${name}.mp4`);
  const jpg = join(OUT, `${name}.jpg`);
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(3)}`);
  writeFileSync(join(dir, 'list.txt'), `${list.join('\n')}\nfile '${frames.at(-1).file}'\n`);
  const length = end - frames[0].t;
  // קול: כל משפט בזמן שלו. מוזיקה: ברקע, יורדת כשמדברים (sidechain), נכנסת ויוצאת בהדרגה
  const inputs = ['-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt')];
  const music = existsSync(MUSIC) && process.env.NO_MUSIC !== '1';
  if (music) inputs.push('-stream_loop', '-1', '-i', MUSIC);
  for (const v of voice) inputs.push('-i', v.file);
  const first = music ? 2 : 1;
  const parts = [];
  const fadeOut = Math.max(0, length - 2.5).toFixed(2);
  if (music) parts.push(`[1:a]atrim=0:${length.toFixed(2)},volume=0.30,afade=t=in:d=1.5,afade=t=out:st=${fadeOut}:d=2.5[m]`);
  voice.forEach((v, i) => {
    const ms = Math.max(0, Math.round((v.t - frames[0].t) * 1000));
    parts.push(`[${first + i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=1.6[v${i}]`);
  });
  let audioMap = null;
  if (voice.length) {
    parts.push(`${voice.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voice.length}:normalize=0:duration=longest,apad,atrim=0:${length.toFixed(2)}[vo]`);
    if (music) {
      parts.push('[vo]asplit[vo1][vo2]');
      parts.push('[m][vo2]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=450[md]');
      parts.push('[md][vo1]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]');
    } else parts.push('[vo]alimiter=limit=0.95[a]');
    audioMap = '[a]';
  } else if (music) audioMap = '[m]';
  const audioArgs = audioMap ? ['-filter_complex', parts.join(';'), '-map', '0:v', '-map', audioMap, '-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, ...audioArgs,
    '-vf', 'scale=720:-2:flags=lanczos,fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-t', length.toFixed(2), mp4]);
  if (voice.length) console.log(`  voice: ${voice.length} lines`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(posterAt), '-i', mp4, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '5', jpg]);
  const sec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim());
  console.log(`${name}: ${Math.round(sec)}s, ${(statSync(mp4).size / 1e6).toFixed(1)}MB`);
}

export { demo };

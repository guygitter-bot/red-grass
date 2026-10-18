// ערכת הקלטה לסרטוני ההדרכה של Isport (באותה שיטה כמו mat_kon/tutorials/kit.mjs):
// מריצה את האתר (web/dist) בדפדפן בגודל טלפון, עם השרת האמיתי (api/worker.js) בזיכרון – סוכן מדומה, בלי AI ובלי עלות –
// כתוביות בעברית, "אצבע" שמראה איפה לוחצים, הקראה (ElevenLabs, הקול "נועה") ומוזיקת רקע.
// הפלט: web/public/tutorials/<name>.mp4 + <name>.jpg
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'web', 'dist');
const OUT = join(HERE, '..', 'web', 'public', 'tutorials');
const TMP = join(HERE, '.rec');
const API = 'https://isport-api.guygitter.workers.dev';
const VOICE = join(HERE, 'voice');
const MUSIC = join(HERE, 'music.m4a');
const W = 390;
const H = 844;
export const PASSWORD = 'demo-password-2026';

const { default: worker, Shop } = await import(join(HERE, '..', 'api', 'worker.js'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webp': 'image/webp' };

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

// ---------- חולצות לדוגמה ----------
// ציור פשוט של מוצר: חולצה / גופייה (צבע ראשי, צבע משני, דוגמה), נעל או תיק
function shoeSvg({ c1, c2, num }) {
  const flip = num ? 'transform="translate(64 0) scale(-1 1)"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 64 64"><rect width="64" height="64" fill="#fff"/><g ${flip}>
  <path d="M6 40 C6 34 9 30 14 29 L24 24 C27 22 30 22 32 25 L36 30 C40 33 48 34 54 36 C58 37 59 40 58 43 L58 45 L6 45 Z" fill="${c1}" stroke="#0003" stroke-width=".4"/>
  <path d="M6 44 H58 V47 C58 48 57 49 56 49 H8 C7 49 6 48 6 47 Z" fill="${c2}"/>
  <path d="M14 36 C22 33 30 34 40 38" fill="none" stroke="${c2}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M25 26 L29 30 M28 24.5 L32 28.5" stroke="${c2}" stroke-width=".9"/></g></svg>`;
}

function bagSvg({ c1, c2, num }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 64 64"><rect width="64" height="64" fill="#fff"/>
  <path d="M20 22 C20 12 44 12 44 22" fill="none" stroke="${c2}" stroke-width="2.5"/>
  <rect x="12" y="22" width="40" height="32" rx="6" fill="${c1}" stroke="#0003" stroke-width=".4"/>
  <rect x="12" y="32" width="40" height="3" fill="${c2}"/>
  ${num ? '<rect x="22" y="40" width="20" height="9" rx="2" fill="#0002"/>' : `<circle cx="32" cy="44" r="3" fill="${c2}"/>`}</svg>`;
}

function shirtSvg(look) {
  if (look.shape === 'shoe') return shoeSvg(look);
  if (look.shape === 'bag') return bagSvg(look);
  const { c1, c2, style = 'plain', num } = look;
  const body = look.shape === 'tank'
    ? 'M23 9 L18 10 L18 20 C18 24 16 26 15 27 L15 55 L49 55 L49 27 C48 26 46 24 46 20 L46 10 L41 9 C39.5 14 36 17 32 17 C28 17 24.5 14 23 9 Z'
    : 'M24 10 L13 14.5 L6 26 L13.5 31 L17 27 L17 54 L47 54 L47 27 L50.5 31 L58 26 L51 14.5 L40 10 C38.5 13.5 35.5 15.5 32 15.5 C28.5 15.5 25.5 13.5 24 10 Z';
  const pattern = {
    plain: '',
    band: `<path d="M17 30 H47 V34 H17Z" fill="${c2}"/>`,
    stripes: [19, 25, 31, 37, 43].map((x) => `<rect x="${x}" y="12" width="3" height="42" fill="${c2}"/>`).join(''),
    sash: `<path d="M17 22 L23 16 L47 46 L47 52 Z" fill="${c2}"/>`,
    halves: `<path d="M32 15.5 V54 H47 V27 L50.5 31 L58 26 L51 14.5 L40 10 C38.5 13.5 35.5 15.5 32 15.5Z" fill="${c2}"/>`,
  }[style];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 64 64"><rect width="64" height="64" fill="#fff"/>
  <defs><clipPath id="c"><path d="${body}"/></clipPath></defs>
  <path d="${body}" fill="${c1}"/><g clip-path="url(#c)">${pattern}</g>
  ${look.shape === 'tank' ? '' : `<path d="M26.5 11.3 C28 13.8 30 14.8 32 14.8 C34 14.8 36 13.8 37.5 11.3" fill="none" stroke="${c2}" stroke-width="1.2"/>
  <path d="M6.6 25 L13.4 29.5 M57.4 25 L50.6 29.5" stroke="${c2}" stroke-width="1.2"/>`}
  ${num ? `<text x="32" y="44" text-anchor="middle" font-size="16" font-family="Arial Black,Arial" font-weight="900" fill="${c2}">${num}</text>` : `<circle cx="38.5" cy="22" r="2.2" fill="${c2}"/>`}
  <path d="${body}" fill="none" stroke="#0002" stroke-width=".35"/></svg>`;
}

export const SHIRTS = [
  { team: 'Liverpool', teamHe: 'ליברפול', kind: 'club', type: 'Home', year: '2025/26', color: 'Red', colorHe: 'אדום', country: 'England', countryHe: 'אנגליה', league: 'Premier League', leagueHe: 'הפרמייר ליג', longSleeve: true, look: { c1: '#c8102e', c2: '#f6eb61' }, description: 'חולצת הבית האדומה של ליברפול, עם צווארון עגול בפס צהוב דק, סמל רקום על החזה ושרוולים קצרים עם עיטור בקצה.' },
  { team: 'Barcelona', teamHe: 'ברצלונה', kind: 'club', type: 'Home', year: '2025/26', color: 'Blaugrana', colorHe: 'כחול-אדום', country: 'Spain', countryHe: 'ספרד', league: 'La Liga', leagueHe: 'לה ליגה', look: { c1: '#a50044', c2: '#004d98', style: 'stripes' }, description: 'פסים אנכיים בכחול ובאדום, צווארון V כחול וסמל המועדון על החזה.' },
  { team: 'Argentina', teamHe: 'ארגנטינה', kind: 'national', type: 'Home', year: '2026', color: 'Light Blue', colorHe: 'תכלת', country: 'Argentina', countryHe: 'ארגנטינה', league: 'CONMEBOL', leagueHe: 'קונמבול', look: { c1: '#ffffff', c2: '#75aadb', style: 'stripes' }, description: 'הפסים התכולים-לבנים המפורסמים, צווארון עגול שחור ושלושה כוכבים מעל הסמל.' },
  { team: 'Real Madrid', teamHe: 'ריאל מדריד', kind: 'club', type: 'Away', year: '2025/26', color: 'Navy', colorHe: 'כחול כהה', country: 'Spain', countryHe: 'ספרד', league: 'La Liga', leagueHe: 'לה ליגה', look: { c1: '#1b2a4a', c2: '#d4af37', style: 'band' }, description: 'חולצת חוץ בכחול כהה עם פס מוזהב על החזה וצווארון מוזהב.' },
  { team: 'Brazil', teamHe: 'ברזיל', kind: 'national', type: 'Home', year: '2026', color: 'Yellow', colorHe: 'צהוב', country: 'Brazil', countryHe: 'ברזיל', league: 'CONMEBOL', leagueHe: 'קונמבול', longSleeve: true, look: { c1: '#ffdf00', c2: '#009c3b' }, description: 'הצהוב הקלאסי עם צווארון ירוק ועיטורים ירוקים בשרוולים.' },
  { team: 'AC Milan', teamHe: 'מילאן', kind: 'club', type: 'Home', year: '2025/26', color: 'Red Black', colorHe: 'אדום-שחור', country: 'Italy', countryHe: 'איטליה', league: 'Serie A', leagueHe: 'הסרייה A', look: { c1: '#111111', c2: '#d71920', style: 'stripes' }, description: 'פסים אדומים ושחורים, צווארון עגול שחור.' },
  { team: 'Israel', teamHe: 'ישראל', kind: 'national', type: 'Home', year: '2026', color: 'Blue', colorHe: 'כחול', country: 'Israel', countryHe: 'ישראל', league: 'UEFA', leagueHe: 'אופ"א', look: { c1: '#0038b8', c2: '#ffffff', style: 'band' }, description: 'חולצת הבית הכחולה של נבחרת ישראל, עם פס לבן על החזה.' },
  { team: 'Maccabi Haifa', teamHe: 'מכבי חיפה', kind: 'club', type: 'Home', year: '2025/26', color: 'Green', colorHe: 'ירוק', country: 'Israel', countryHe: 'ישראל', league: 'Ligat HaAl', leagueHe: 'ליגת העל', look: { c1: '#00843d', c2: '#ffffff', style: 'sash' }, description: 'ירוק עם אלכסון לבן, צווארון עגול לבן.' },
  { category: 'basketball', team: 'Golden State Warriors', teamHe: 'גולדן סטייט ווריורס', kind: 'club', type: 'Icon', year: '2025/26', color: 'Blue', colorHe: 'כחול', country: 'USA', countryHe: 'ארה"ב', league: 'NBA', leagueHe: 'NBA', look: { c1: '#1d428a', c2: '#ffc72c', shape: 'tank', style: 'band' }, description: 'גופיית Icon כחולה עם עיטורים צהובים בצוואר ובכתפיים.' },
  { category: 'basketball', team: 'Maccabi Tel Aviv', teamHe: 'מכבי תל אביב', kind: 'club', type: 'Home', year: '2025/26', color: 'Yellow', colorHe: 'צהוב', country: 'Israel', countryHe: 'ישראל', league: 'EuroLeague', leagueHe: 'יורוליג', look: { c1: '#ffd200', c2: '#003b7a', shape: 'tank' }, description: 'הגופייה הצהובה עם עיטורים כחולים.' },
  { category: 'shoes', team: 'Nike', teamHe: 'נייקי', kind: 'club', type: 'Air Max 90', year: '', color: 'White Red', colorHe: 'לבן-אדום', country: 'USA', countryHe: 'ארה"ב', league: 'Running', leagueHe: 'ריצה', look: { c1: '#f4f4f4', c2: '#d7262e', shape: 'shoe' }, description: 'נעל ריצה קלאסית בלבן עם פסים אדומים וסוליית אוויר.' },
  { category: 'shoes', team: 'Adidas', teamHe: 'אדידס', kind: 'club', type: 'Samba', year: '', color: 'Black', colorHe: 'שחור', country: 'Germany', countryHe: 'גרמניה', league: 'Originals', leagueHe: 'אוריג׳ינלס', look: { c1: '#1a1a1a', c2: '#e8e1cf', shape: 'shoe' }, description: 'נעל סמבה שחורה עם שלושת הפסים וסוליית גומי.' },
  { category: 'bags', team: 'Nike', teamHe: 'נייקי', kind: 'club', type: 'Brasilia Duffel', year: '', color: 'Black', colorHe: 'שחור', country: 'USA', countryHe: 'ארה"ב', league: 'Training', leagueHe: 'אימון', look: { c1: '#222222', c2: '#c4f43a', shape: 'bag' }, description: 'תיק ספורט בינוני עם תא נעליים ורצועת כתף.' },
];

// הסוכן המדומה: מכיר את ריאל מדריד (לסרטון הניהול)
const NEW_SHIRT = {
  kind: 'club', team: 'Real Madrid', teamHe: 'ריאל מדריד', type: 'Home', year: '2025/26', color: 'White', colorHe: 'לבן',
  country: 'Spain', countryHe: 'ספרד', league: 'La Liga', leagueHe: 'לה ליגה',
  description: 'חולצת הבית הלבנה של ריאל מדריד לעונת 2025/26. צווארון עגול עם פס מוזהב דק, סמל המועדון רקום על החזה ועיטורים מוזהבים בקצות השרוולים.',
  tags: ['לה ליגה', 'ספרד', 'הלבנים', 'Los Blancos'],
};
const SUGGESTED = [
  ['rm-front', { c1: '#f7f7f7', c2: '#d4af37' }],
  ['rm-back', { c1: '#f7f7f7', c2: '#d4af37', num: '10' }],
  ['rm-other', { c1: '#f7f7f7', c2: '#1b2a4a', style: 'band' }],
  ['rm-old', { c1: '#7a2a8b', c2: '#ffffff' }],
];

function fakeAI(delay) {
  return {
    beta: {
      messages: {
        async create(req) {
          await new Promise((r) => setTimeout(r, delay));
          const tool = req.tools.find((t) => t.name !== 'web_search').name;
          const input = tool === 'shirt_details' ? NEW_SHIRT : { pages: ['https://shop.example.com/real-madrid-home', 'https://kits.example.org/real-madrid'] };
          return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: tool, input }], usage: { input_tokens: 0, output_tokens: 0 } };
        },
      },
    },
  };
}

// תמונות PNG מהציורים (נוצרות פעם אחת)
async function renderImages(browser) {
  const dir = join(TMP, 'img');
  const all = [...SHIRTS.map((s, i) => [`s${i}`, s.look]), ...SHIRTS.map((s, i) => [`s${i}b`, { ...s.look, num: '10' }]), ...SUGGESTED];
  if (all.every(([n]) => existsSync(join(dir, `${n}.png`)))) return dir;
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  for (const [name, look] of all) {
    await page.setContent(`<body style="margin:0">${shirtSvg(look)}</body>`);
    await page.screenshot({ path: join(dir, `${name}.png`) });
  }
  await page.close();
  return dir;
}

// השרת האמיתי בזיכרון, עם חולצות לדוגמה
async function backend(imgDir, origin, { seed = true, delay = 2500 } = {}) {
  const map = new Map();
  const storage = {
    async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => map.has(x)).map((x) => [x, structuredClone(map.get(x))])) : structuredClone(map.get(k)); },
    async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) map.set(a, structuredClone(b)); else map.set(k, structuredClone(v)); },
    async delete(k) { for (const x of [k].flat()) map.delete(x); },
    async list({ prefix = '' } = {}) { return new Map([...map.keys()].filter((x) => x.startsWith(prefix)).sort().map((x) => [x, structuredClone(map.get(x))])); },
  };
  const bucket = new Map();
  const IMAGES = {
    async put(k, bytes, o) { bucket.set(k, { bytes, type: o.httpMetadata.contentType }); },
    async get(k) { const o = bucket.get(k); return o ? { body: o.bytes, httpMetadata: { contentType: o.type } } : null; },
    async delete(ks) { for (const k of [ks].flat()) bucket.delete(k); },
  };
  const FETCH = async (url) => {
    const u = new URL(url);
    if (u.hostname === 'shop.example.com') return new Response('<meta property="og:image" content="https://cdn.example.org/rm-front.png">', { headers: { 'content-type': 'text/html' } });
    if (u.hostname === 'kits.example.org') {
      const ld = JSON.stringify({ image: ['https://cdn.example.org/rm-back.png', 'https://cdn.example.org/rm-other.png', 'https://cdn.example.org/rm-old.png'] });
      return new Response(`<script type="application/ld+json">${ld}</script>`, { headers: { 'content-type': 'text/html' } });
    }
    const f = join(imgDir, u.pathname);
    if (u.hostname === 'cdn.example.org' && existsSync(f)) return new Response(readFileSync(f), { headers: { 'content-type': 'image/png' } });
    return new Response('no', { status: 404 });
  };
  const env = { ALLOWED_ORIGINS: origin, ADMIN_PASSWORD: PASSWORD, AI_CLIENT: fakeAI(delay), FETCH, IMAGES };
  const shop = new Shop({ storage }, env);
  env.SHOP = { idFromName: (n) => n, get: () => ({ fetch: (r) => shop.fetch(r) }) };

  if (seed) {
    const call = async (path, body, token) => (await worker.fetch(new Request(`${API}${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }), env)).json();
    const { token } = await call('/login', { password: PASSWORD });
    // הכי חדשה ראשונה – מוסיפים מהסוף
    for (let i = SHIRTS.length - 1; i >= 0; i--) {
      const { look, ...s } = SHIRTS[i];
      const images = [];
      for (const n of [`s${i}`, `s${i}b`]) images.push((await call('/admin/image-upload', { data: readFileSync(join(imgDir, `${n}.png`)).toString('base64') }, token)).key);
      await call('/admin/shirt', { ...s, images, tags: [s.leagueHe, s.countryHe], flyLink: `https://flylinking.example/p/${i}`, published: true }, token);
    }
    await call('/admin/settings', { whatsapp: '972500000000', instagram: 'isport', announcement: '' }, token);
    await call('/logout', {}, token);
  }
  return env;
}

// ---------- שכבת הכתוביות והאצבע ----------
const OVERLAY = () => {
  if (window.__tut) return;
  const css = document.createElement('style');
  css.textContent = `
  #tut-cap{position:fixed;left:12px;right:12px;bottom:96px;z-index:2147483646;pointer-events:none;display:flex;justify-content:center;transition:opacity .35s,transform .35s;opacity:0;transform:translateY(8px)}
  #tut-cap.on{opacity:1;transform:none}
  #tut-cap.top{bottom:auto;top:calc(76px + env(safe-area-inset-top))}
  #tut-cap div{background:rgba(12,13,15,.92);color:#fff;font:600 17px/1.45 Heebo,system-ui,sans-serif;padding:12px 16px;border-radius:18px;text-align:center;direction:rtl;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:360px;border:1px solid rgba(196,244,58,.35)}
  #tut-cap b{color:#c4f43a}
  #tut-dot{position:fixed;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(196,244,58,.4);border:3px solid rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:none;transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1),opacity .3s,transform .15s;opacity:0;left:50%;top:70%}
  #tut-dot.on{opacity:1}
  #tut-dot.press{transform:scale(.75);background:rgba(196,244,58,.8)}
  .tut-ring{position:fixed;z-index:2147483646;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #c4f43a;pointer-events:none;animation:tutring .6s ease-out forwards}
  @keyframes tutring{to{transform:scale(2.6);opacity:0}}
  #tut-card{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0c0d0f;background-image:repeating-linear-gradient(115deg,rgba(196,244,58,.08) 0 2px,transparent 2px 46px);color:#fff;direction:rtl;text-align:center;padding:32px;font-family:Heebo,system-ui,sans-serif;transition:opacity .5s}
  #tut-card .k{font-size:15px;font-weight:700;color:#0c0d0f;background:#c4f43a;padding:4px 12px;border-radius:99px}
  #tut-card h1{font-size:34px;font-weight:900;line-height:1.2;margin:0}
  #tut-card p{font-size:18px;line-height:1.5;margin:0;opacity:.8;max-width:320px}
  #tut-card .e{font-size:72px;line-height:1}
  #tut-card .e img{width:220px;height:auto;display:block}
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

// הלוגו לכרטיס הפתיחה (מהאתר עצמו)
export const MARK = '<img src="logo.webp" alt="">';

// ---------- הקראה ----------
// כל כתובית נקראת בקול. הקבצים: voice/eleven/<key>.mp3 (ElevenLabs) או voice/<key>.mp3 (Google TTS), נוצרים ב-GitHub Actions (isport-voice.yml),
// והטקסטים לרשימה voice/lines.json. משפט בלי קובץ עדיין נרשם לרשימה, והסרטון נבנה בינתיים בלי הקול שלו.
const SAY_WORDS = [
  [/FlyLinking/g, 'פליי-לינקינג'], [/Isport/gi, 'איי-ספורט'], [/ISRAEL/g, 'ישראל'], [/WhatsApp/g, 'וואטסאפ'],
  [/✕/g, 'האיקס'], [/♡/g, 'הלב'], [/\s*←\s*/g, ', ואז '],
];
export function speakable(html) {
  let text = String(html).replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]+>/g, '');
  for (const [re, to] of SAY_WORDS) text = text.replace(re, to);
  return text
    .replace(/💡\s*טיפ:?/g, 'טיפ:')
    .replace(/\p{Extended_Pictographic}|‍|️/gu, '')
    .replace(/…/g, '.')
    .replace(/(?<=\p{L})\s*\/\s*(?=\p{L})/gu, ' או ')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/^[\s.,–-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const voiceKey = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);
const usedKeys = [];
function voiceClip(text) {
  if (!text) return null;
  const key = voiceKey(text);
  usedKeys.push(key);
  mkdirSync(VOICE, { recursive: true });
  const listFile = join(VOICE, 'lines.json');
  const lines = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : {};
  if (lines[key] !== text) {
    lines[key] = text;
    writeFileSync(listFile, `${JSON.stringify(Object.fromEntries(Object.entries(lines).sort()), null, 1)}\n`);
  }
  const file = [join(VOICE, 'eleven', `${key}.mp3`), join(VOICE, `${key}.mp3`)].find((f) => existsSync(f));
  if (!file) return null;
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
  return { file, dur };
}

// הקלטה של סרטון אחד
export async function record(name, script, opts = {}) {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const origin = base.slice(0, -1);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const imgDir = await renderImages(browser);
  const env = await backend(imgDir, origin, opts);
  const vdir = join(TMP, name);
  rmSync(vdir, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    isMobile: true,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: opts.dark ? 'dark' : 'light',
    serviceWorkers: 'block',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  // פניות לשרת -> השרת האמיתי בזיכרון
  await ctx.route(`${API}/**`, async (route) => {
    const req = route.request();
    const res = await worker.fetch(new Request(req.url(), { method: req.method(), headers: { ...req.headers(), origin }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() }), env);
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) }).catch(() => {});
  });
  // תמונות "מהרשת" שהסוכן מצא
  await ctx.route('https://cdn.example.org/**', (r) => r.fulfill({ body: readFileSync(join(imgDir, new URL(r.request().url()).pathname)), contentType: 'image/png' }));
  // הגופנים של האתר מקומית
  const fontCss = readFileSync(join(HERE, 'fonts', 'fonts.css'), 'utf8');
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: fontCss, contentType: 'text/css' }));
  await ctx.route('https://fonts.gstatic.com/**', (r) => {
    const file = join(HERE, 'fonts', new URL(r.request().url()).pathname.split('/').pop());
    return existsSync(file) ? r.fulfill({ body: readFileSync(file), contentType: 'font/woff2' }) : r.abort();
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
    const u = r.request().url();
    if (u.startsWith(API) || u.includes('fonts.g') || u.includes('cdn.example.org')) return r.fallback();
    return r.abort();
  });
  await ctx.addInitScript(`document.addEventListener('DOMContentLoaded', ${OVERLAY});`);
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('tut-seeded')) {
      localStorage.clear();
      sessionStorage.setItem('tut-seeded', '1');
    }
  });

  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(base + (opts.start || ''));
  await page.evaluate(OVERLAY);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
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
    base,
    wait,
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
    async scroll(dy, ms = 900) {
      await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), dy);
      await wait(ms);
    },
    async scrollTo(loc, ms = 900) {
      await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await wait(ms);
    },
    async hideDot() { await page.evaluate(() => window.__tut.hide()); },
    async card(emoji, kicker, title, text, ms = 2800) {
      await waitVoice();
      await page.evaluate(([a, b, c, d]) => window.__tut.card(a, b, c, d), [emoji, kicker, title, text]);
      const spoken = speak([title, text].filter(Boolean).map((x) => String(x).replace(/[.!?]?$/, '.')).join(' '));
      await wait(Math.max(ms, spoken + 300));
    },
    async uncard(ms = 600) { await page.evaluate(() => window.__tut.uncard()); await wait(ms); },
    async go(hash) { await page.evaluate((h) => { window.location.hash = h; }, hash); await wait(900); },
  };

  try {
    await script(helpers);
    const mapFile = join(VOICE, 'videos.json');
    const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, 'utf8')) : {};
    map[name] = [...new Set(usedKeys)];
    writeFileSync(mapFile, `${JSON.stringify(Object.fromEntries(Object.entries(map).sort()), null, 1)}\n`);
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

// פריימים -> mp4 (H.264, נפתח בכל טלפון) + תמונת שער. קול בזמן של כל משפט, מוזיקה ברקע שיורדת כשמדברים
function encode(dir, frames, end, name, posterAt, voice = []) {
  if (!frames.length) throw new Error('no frames recorded');
  const mp4 = join(OUT, `${name}.mp4`);
  const jpg = join(OUT, `${name}.jpg`);
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(3)}`);
  writeFileSync(join(dir, 'list.txt'), `${list.join('\n')}\nfile '${frames.at(-1).file}'\n`);
  const length = end - frames[0].t;
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

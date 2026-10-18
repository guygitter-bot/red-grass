import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Shop } from './worker.js';
import { autoCode, cleanShirt, shortYear } from './model.js';
import { imagesFromHtml, publicUrl, sniff } from './images.js';
import { MAX_AI_PER_DAY } from './shop.js';

const ORIGIN = 'https://isport-shop.pages.dev';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2, 3]);

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k)); },
    async put(k, v) {
      if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      else map.set(k, clone(v));
    },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '' } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix)).sort();
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
  };
}

// דלי R2 מדומה
function fakeBucket() {
  const map = new Map();
  return {
    map,
    async put(k, bytes, opts) { map.set(k, { bytes, type: opts?.httpMetadata?.contentType }); },
    async get(k) { const o = map.get(k); return o ? { body: o.bytes, httpMetadata: { contentType: o.type } } : null; },
    async delete(keys) { for (const k of [keys].flat()) map.delete(k); },
  };
}

// הסוכן המדומה: מחזיר פרטים / דפים
function fakeAI(calls = []) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          const tool = req.tools.find((t) => t.name !== 'web_search').name;
          const input = tool === 'shirt_details'
            ? { kind: 'club', team: 'Liverpool', teamHe: 'ליברפול', type: 'Home', year: '2025/26', color: 'Red', colorHe: 'אדום', country: 'England', countryHe: 'אנגליה', league: 'Premier League', leagueHe: 'הפרמייר ליג', description: 'חולצת בית אדומה עם צווארון V.', tags: ['פרמייר ליג', 'Liverpool'] }
            : { pages: ['https://shop.example.com/liverpool-home', 'http://insecure.example.com/x', 'https://kits.example.org/lfc'] };
          return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: tool, input }], usage: { input_tokens: 50, output_tokens: 20, server_tool_use: { web_search_requests: 2 } } };
        },
      },
    },
  };
}

// אינטרנט מדומה: דפים עם og:image ותמונה אחת
function fakeFetch(log = []) {
  return async (url) => {
    log.push(url);
    if (url === 'https://shop.example.com/liverpool-home') {
      return new Response('<html><head><meta property="og:image" content="/img/lfc-front.jpg?w=800&amp;q=90"></head></html>', { headers: { 'content-type': 'text/html' } });
    }
    if (url === 'https://kits.example.org/lfc') {
      const ld = JSON.stringify({ '@type': 'Product', image: ['https://cdn.example.org/lfc-1.png', 'https://cdn.example.org/lfc-2.png'] });
      return new Response(`<script type="application/ld+json">${ld}</script>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url === 'https://cdn.example.org/lfc-1.png') return new Response(PNG, { headers: { 'content-type': 'image/png' } });
    if (url === 'https://cdn.example.org/fake.png') return new Response('<script>alert(1)</script>', { headers: { 'content-type': 'image/png' } });
    return new Response('nope', { status: 404 });
  };
}

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: `${ORIGIN},https://isport-shop-*.pages.dev`, ADMIN_PASSWORD: 'סוד-גדול-מאוד', AI_CLIENT: fakeAI(), FETCH: fakeFetch(), IMAGES: fakeBucket(), ...extra };
  env.shop = new Shop({ storage: fakeStorage() }, env);
  env.SHOP = { idFromName: (n) => n, get: () => ({ fetch: (req) => env.shop.fetch(req) }) };
  return env;
}

async function call(env, path, body = {}, token, origin = ORIGIN) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json(), headers: res.headers };
}

async function admin(env) {
  const res = await call(env, '/login', { password: 'סוד-גדול-מאוד' });
  assert.equal(res.status, 200);
  return res.data.token;
}

const LIVERPOOL = { team: 'Liverpool', type: 'Home', year: '2025/26', color: 'Red', flyLink: 'https://flylinking.com/p/123', longSleeve: true, published: true };

test('product code: Team-Type-Year-Color', () => {
  assert.equal(shortYear('2025/26'), '26');
  assert.equal(shortYear('2026'), '26');
  assert.equal(shortYear(''), '');
  assert.equal(autoCode({ team: 'Real Madrid', type: 'away', year: '2024-25', color: 'dark blue' }), 'RealMadrid-Away-25-DarkBlue');
  assert.equal(autoCode({ team: 'Atlético Madrid', type: 'GK', year: '2026', color: 'Green' }), 'AtleticoMadrid-GK-26-Green');
  assert.equal(cleanShirt(LIVERPOOL).code, 'Liverpool-Home-26-Red');
  // קוד ידני
  const manual = cleanShirt({ ...LIVERPOOL, codeManual: true, code: 'LFC 26 <b>Home</b>' });
  assert.equal(manual.code, 'LFC26bHomeb');
  // ידני ריק -> חוזר לאוטומטי
  assert.equal(cleanShirt({ ...LIVERPOOL, codeManual: true, code: '' }).codeManual, false);
});

test('shirt cleaning: defaults for old data, links, limits', () => {
  const s = cleanShirt({ team: '  Liverpool ', type: 'Home', year: '26', color: 'Red', images: ['img-abcdefgh1234.webp', '../../etc/passwd', 'img-abcdefgh1234.webp'], tags: ['a', 'A', 'b'] });
  assert.equal(s.kind, 'club');
  assert.equal(s.longSleeve, false);
  assert.equal(s.published, false);
  assert.deepEqual(s.images, ['img-abcdefgh1234.webp']);
  assert.deepEqual(s.tags, ['a', 'b']);
  assert.throws(() => cleanShirt({ ...LIVERPOOL, flyLink: 'javascript:alert(1)' }), /https/);
  assert.throws(() => cleanShirt({ ...LIVERPOOL, flyLink: '' }), /FlyLinking/);
  assert.throws(() => cleanShirt({ type: 'Home' }), /שם/);
  assert.throws(() => cleanShirt({ team: 'מכבי', type: 'בית' }), /באנגלית/);
});

test('only the shop itself can call the server', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/catalog', {}, null, 'https://evil.example')).status, 403);
  assert.equal((await call(env, '/catalog', {}, null, null)).status, 403);
  assert.equal((await call(env, '/catalog', {}, null, 'https://isport-shop-abc.pages.dev')).status, 200);
  assert.equal((await call(env, '/catalog', {}, null, 'https://isport-shop-a.b.pages.dev')).status, 403);
  assert.equal((await call(env, '/nothing')).status, 404);
});

test('admin login: wrong password, lockout, no password configured', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/login', { password: 'x' })).status, 401);
  for (let i = 0; i < 6; i++) await call(env, '/login', { password: 'x' });
  assert.equal((await call(env, '/login', { password: 'סוד-גדול-מאוד' })).status, 429);
  const env2 = fakeEnv({ ADMIN_PASSWORD: '' });
  assert.equal((await call(env2, '/login', { password: '' })).status, 503);
});

test('admin actions need a valid session; logout ends it', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/admin/state')).status, 401);
  assert.equal((await call(env, '/admin/shirt', LIVERPOOL, 'not-a-real-token-but-long-enough')).status, 401);
  const token = await admin(env);
  assert.equal((await call(env, '/admin/state', {}, token)).status, 200);
  await call(env, '/logout', {}, token);
  assert.equal((await call(env, '/admin/state', {}, token)).status, 401);
});

test('catalog shows only published shirts, without internal fields', async () => {
  const env = fakeEnv();
  const token = await admin(env);
  const a = (await call(env, '/admin/shirt', LIVERPOOL, token)).data.shirt;
  await call(env, '/admin/shirt', { team: 'Argentina', kind: 'national', type: 'Home', year: '2026', color: 'Light Blue' }, token);
  // קוד כפול
  assert.equal((await call(env, '/admin/shirt', { ...LIVERPOOL, color: 'red' }, token)).status, 409);

  let cat = (await call(env, '/catalog')).data;
  assert.equal(cat.shirts.length, 1);
  assert.equal(cat.shirts[0].code, 'Liverpool-Home-26-Red');
  assert.equal(cat.shirts[0].published, undefined);
  assert.equal(cat.shirts[0].codeManual, undefined);

  // הסתרה
  await call(env, '/admin/publish', { id: a.id, published: false }, token);
  cat = (await call(env, '/catalog')).data;
  assert.equal(cat.shirts.length, 0);
  // אי אפשר לפרסם בלי קישור
  const arg = (await call(env, '/admin/state', {}, token)).data.shirts.find((s) => s.team === 'Argentina');
  assert.equal((await call(env, '/admin/publish', { id: arg.id, published: true }, token)).status, 400);

  // עריכה שומרת את המזהה ואת תאריך היצירה
  const edited = (await call(env, '/admin/shirt', { ...a, description: 'חדש', published: true }, token)).data.shirt;
  assert.equal(edited.id, a.id);
  assert.equal(edited.createdAt, a.createdAt);
  assert.equal((await call(env, '/admin/shirt', { ...LIVERPOOL, id: 'sh-doesnotexist' }, token)).status, 404);

  await call(env, '/admin/shirt-delete', { id: a.id }, token);
  assert.equal((await call(env, '/admin/state', {}, token)).data.shirts.length, 1);
});

test('settings are cleaned and public', async () => {
  const env = fakeEnv();
  const token = await admin(env);
  await call(env, '/admin/settings', { whatsapp: '+972-50-123-4567', instagram: '@isport', announcement: 'משלוח חינם' }, token);
  const s = (await call(env, '/catalog')).data.settings;
  assert.deepEqual(s, { whatsapp: '972501234567', instagram: 'isport', announcement: 'משלוח חינם' });
  assert.equal((await call(env, '/admin/settings', { instagram: 'a/b' }, token)).status, 400);
});

test('auto-fill: details and image suggestions from web pages', async () => {
  const calls = [];
  const env = fakeEnv({ AI_CLIENT: fakeAI(calls) });
  const token = await admin(env);
  const d = (await call(env, '/admin/enrich', { team: 'ליברפול', type: 'בית', year: '26' }, token)).data.details;
  assert.equal(d.team, 'Liverpool');
  assert.equal(d.kind, 'club');
  assert.equal(d.leagueHe, 'הפרמייר ליג');
  assert.match(calls[0].messages[0].content, /ליברפול/);

  const imgs = (await call(env, '/admin/find-images', { team: 'Liverpool', type: 'Home', year: '2025/26' }, token)).data.images;
  assert.deepEqual(imgs.map((i) => i.url), [
    'https://shop.example.com/img/lfc-front.jpg?w=800&q=90',
    'https://cdn.example.org/lfc-1.png',
    'https://cdn.example.org/lfc-2.png',
  ]);
  assert.equal((await call(env, '/admin/enrich', {}, token)).status, 400);
  const state = (await call(env, '/admin/state', {}, token)).data;
  assert.equal(state.usage.calls, 2);
  assert.equal(state.usage.enrich, 1);
  assert.equal(state.usage.images, 1);
  assert.equal(state.usage.input, 100);
  assert.equal(state.usage.searches, 4);
  assert.equal(state.usageMonths.length, 1);
  assert.equal(state.usageMonths[0].month, new Date().toISOString().slice(0, 7));
});

test('auto-fill has a daily limit', async () => {
  const env = fakeEnv();
  const token = await admin(env);
  await env.shop.storage.put('day', { date: new Date().toISOString().slice(0, 10), ai: MAX_AI_PER_DAY });
  assert.equal((await call(env, '/admin/enrich', { team: 'Liverpool' }, token)).status, 429);
});

test('images: import checks it is a real image, upload, serve and clean up', async () => {
  const env = fakeEnv();
  const token = await admin(env);
  const { key } = (await call(env, '/admin/image-import', { url: 'https://cdn.example.org/lfc-1.png' }, token)).data;
  assert.match(key, /^img-[\w-]+\.png$/);
  assert.equal((await call(env, '/admin/image-import', { url: 'https://cdn.example.org/fake.png' }, token)).status, 415);
  assert.equal((await call(env, '/admin/image-import', { url: 'http://127.0.0.1/x.png' }, token)).status, 400);
  assert.equal((await call(env, '/admin/image-import', { url: 'https://localhost/x.png' }, token)).status, 400);

  const up = await call(env, '/admin/image-upload', { data: btoa(String.fromCharCode(...PNG)) }, token);
  assert.equal(up.status, 200);
  assert.equal((await call(env, '/admin/image-upload', { data: btoa('<svg onload=alert(1)>hello') }, token)).status, 415);

  const res = await worker.fetch(new Request(`https://api.test/img/${key}`), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await worker.fetch(new Request('https://api.test/img/..%2Fsecret'), env)).status, 404);

  // תמונה שהוסרה מהחולצה נמחקת מהדלי
  const s = (await call(env, '/admin/shirt', { ...LIVERPOOL, images: [key, up.data.key] }, token)).data.shirt;
  await call(env, '/admin/shirt', { ...s, images: [up.data.key] }, token);
  assert.equal(env.IMAGES.map.has(key), false);
  assert.equal(env.IMAGES.map.has(up.data.key), true);
});

test('image helpers', () => {
  assert.equal(sniff(PNG), 'png');
  assert.equal(sniff(new TextEncoder().encode('<html>hello world')), null);
  assert.equal(publicUrl('https://10.0.0.1/a'), null);
  assert.equal(publicUrl('https://user:pw@example.com/a'), null);
  assert.equal(publicUrl('https://example.com:8443/a'), null);
  assert.equal(publicUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  const html = '<meta content="https://x.example.com/a.jpg" name="twitter:image"><meta property="og:image" content="https://x.example.com/logo.svg">';
  assert.deepEqual(imagesFromHtml(html, 'https://x.example.com/'), ['https://x.example.com/a.jpg']);
});

test('categories: defaults, old shirts, products by category, managing the list', async () => {
  const env = fakeEnv();
  const token = await admin(env);
  // חולצה ישנה (בלי קטגוריה) = חולצת כדורגל
  await env.shop.storage.put('shirt:sh-old1234567', { id: 'sh-old1234567', team: 'Arsenal', kind: 'club', type: 'Home', year: '2024', color: 'Red', code: 'Arsenal-Home-24-Red', images: [], tags: [], flyLink: 'https://x.example/p', published: true, createdAt: 1 });
  env.shop.d = null;
  let cat = (await call(env, '/catalog')).data;
  assert.deepEqual(cat.categories.map((c) => c.id), ['football', 'basketball', 'shoes', 'bags']);
  assert.equal(cat.shirts[0].category, 'football');

  // נעליים: בלי שרוול ארוך, קוד מותג-דגם-צבע
  const shoe = (await call(env, '/admin/shirt', { category: 'shoes', team: 'Nike', type: 'Air Jordan 1 Mid', color: 'Black White', longSleeve: true, flyLink: 'https://x.example/s', published: true }, token)).data.shirt;
  assert.equal(shoe.code, 'Nike-AirJordan1Mid-BlackWhite');
  assert.equal(shoe.longSleeve, false);
  assert.equal((await call(env, '/admin/shirt', { category: 'nope', team: 'Nike' }, token)).status, 400);
  assert.equal((await call(env, '/admin/shirt', { category: 'shoes' }, token)).data.error, 'חסר שם מותג');

  // קטגוריה חדשה, הסתרה ושינוי סדר
  const list = (await call(env, '/admin/state', {}, token)).data.categories;
  const next = [...list.map((c) => (c.id === 'shoes' ? { ...c, active: false } : c)), { id: 'balls', name: 'כדורים', template: 'plain' }];
  const saved = (await call(env, '/admin/categories', { categories: next }, token)).data.categories;
  assert.equal(saved.at(-1).active, true);
  cat = (await call(env, '/catalog')).data;
  assert.ok(!cat.categories.some((c) => c.id === 'shoes'));
  assert.ok(!cat.shirts.some((s) => s.id === shoe.id));

  // אי אפשר למחוק קטגוריה שיש בה מוצרים, ולא לשבור את הרשימה
  const res = await call(env, '/admin/categories', { categories: next.filter((c) => c.id !== 'shoes') }, token);
  assert.equal(res.status, 400);
  assert.match(res.data.error, /להסתיר/);
  assert.equal((await call(env, '/admin/categories', { categories: [] }, token)).status, 400);
  assert.equal((await call(env, '/admin/categories', { categories: [{ id: 'Bad Id', name: 'x' }] }, token)).status, 400);
  assert.equal((await call(env, '/admin/categories', { categories: next.map((c) => ({ ...c, active: false })) }, token)).status, 400);
});

test('auto-fill tells the agent the category', async () => {
  const calls = [];
  const env = fakeEnv({ AI_CLIENT: fakeAI(calls) });
  const token = await admin(env);
  await call(env, '/admin/enrich', { category: 'shoes', team: 'Nike', type: 'Air Max 90' }, token);
  assert.match(calls[0].messages[0].content, /Category: נעליים \(product\)/);
  assert.match(calls[0].messages[0].content, /Brand: Nike/);
  assert.match(calls[0].messages[0].content, /Model: Air Max 90/);
});

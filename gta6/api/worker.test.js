import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Library } from './worker.js';
import { aiMessage, cleanCodes, cleanResult, material } from './ai.js';
import { readPage, userAgent } from './source.js';
import { MAX_PER_DAY, sameUrl } from './library.js';

// זיכרון מדומה במקום האחסון של Durable Object (get/put/delete/list/alarm כמו ב-Cloudflare)
function fakeStorage() {
  const map = new Map();
  let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '' } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix)).sort();
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
    async getAlarm() { return alarm; },
    async setAlarm(t) { alarm = t; },
  };
}

const CODES = [
  { code: 'R1, R2, L1, X, ←', effect: 'נשק מלא', platform: 'PlayStation' },
  { code: 'R1, R2, L1, X, ←', effect: 'כפול', platform: 'PlayStation' },
  { code: '1-999-367-3767', effect: 'מכונית ספורט', platform: 'zzz' },
];

// סוכן מדומה: קטגוריה לפי מה שכתוב בחומר, וקודים כשכתוב "cheat"
function fakeAI(calls = []) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          const content = JSON.stringify(req.messages);
          const cheats = content.includes('cheat');
          return {
            stop_reason: 'tool_use',
            content: [{
              type: 'tool_use',
              name: 'file_video',
              input: { title: cheats ? 'קודים לנשק ולרכב' : 'טיפ לכסף', summary: 'תקציר', codes: cheats ? CODES : [], category: cheats ? 'קודים וצ׳יטים' : 'כסף ועסקים', emoji: '🔫', tags: ['#Vice City'] },
            }],
          };
        },
      },
    },
  };
}

const page = (title) => new Response(`<html><head><title>${title}</title><meta property="og:description" content="תיאור"></head><body><p>${'טקסט '.repeat(120)}</p></body></html>`, { status: 200, headers: { 'content-type': 'text/html' } });

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: 'https://gta6-videos.pages.dev', AI_CLIENT: fakeAI(), FETCH: async (url) => page(url), ...extra };
  env.lib = new Library({ storage: fakeStorage() }, env);
  env.LIBRARY = { idFromName: (n) => n, get: () => ({ fetch: (req) => env.lib.fetch(req) }) };
  return env;
}

async function call(env, path, body) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://gta6-videos.pages.dev' },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data: await res.json() };
}

test('open without a password, only for the app site', async () => {
  const env = fakeEnv();
  const res = await call(env, '/list', {});
  assert.equal(res.status, 200);
  assert.equal(res.cors, 'https://gta6-videos.pages.dev');
  assert.deepEqual(res.data.items, []);
  assert.equal((await call(env, '/learn-from', {})).status, 404);
});

test('daily limit on additions', async () => {
  const env = fakeEnv();
  await env.lib.storage.put('day', { date: new Date().toISOString().slice(0, 10), count: MAX_PER_DAY });
  const res = await call(env, '/add', { url: 'https://youtube.com/watch?v=abc' });
  assert.equal(res.status, 429);
  assert.match(res.data.error, /מחר/);
  await env.lib.storage.put('day', { date: '2000-01-01', count: MAX_PER_DAY });
  assert.equal((await call(env, '/add', { url: 'https://youtube.com/watch?v=abc' })).status, 200);
});

test('a video link is saved at once, then gets a title and codes in the background', async () => {
  const fetched = [];
  const env = fakeEnv({ FETCH: async (url, init) => { fetched.push([url, init.headers['user-agent']]); return page('GTA 6 cheat codes'); } });
  const added = await call(env, '/add', { url: 'https://www.facebook.com/share/r/1JVJ2AkHeK/?mibextid=x', note: 'לנסות' });
  assert.equal(added.status, 200);
  assert.equal(added.data.item.status, 'pending');
  assert.equal(added.data.item.title, 'facebook.com');
  assert.ok(await env.lib.storage.getAlarm());

  await env.lib.alarm();
  // פייסבוק – קוראים כמו תצוגה מקדימה של קישור
  assert.match(fetched[0][1], /facebookexternalhit/);
  const item = (await call(env, '/list', {})).data.items[0];
  assert.equal(item.status, 'ready');
  assert.equal(item.title, 'קודים לנשק ולרכב');
  assert.equal(item.category, 'קודים וצ׳יטים');
  assert.deepEqual(item.tags, ['Vice City']);
  // קוד כפול מסונן, פלטפורמה לא מוכרת -> "לא ידוע"
  assert.deepEqual(item.codes.map((c) => c.code), ['R1, R2, L1, X, ←', '1-999-367-3767']);
  assert.equal(item.codes[1].platform, 'לא ידוע');
  assert.equal(item.note, 'לנסות');

  // אותו קישור שוב – לא נוסף פעמיים
  const again = await call(env, '/add', { url: 'https://facebook.com/share/r/1JVJ2AkHeK' });
  assert.equal(again.data.duplicate, true);
  assert.equal((await call(env, '/list', {})).data.items.length, 1);
});

test('rejects private links', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/add', { url: 'http://localhost/x' })).status, 400);
  assert.equal((await call(env, '/add', { url: 'not a link' })).status, 400);
});

test('codes edited by hand survive "read again", and a manual category wins', async () => {
  const env = fakeEnv({ FETCH: async () => page('cheat codes') });
  const { item } = (await call(env, '/add', { url: 'https://youtube.com/shorts/x' })).data;
  await env.lib.alarm();
  const edited = await call(env, '/update', { id: item.id, codes: [{ code: ' ↑ ↓ ← → ', effect: 'חיים', platform: 'Xbox' }, { code: '' }], category: 'שלי' });
  assert.deepEqual(edited.data.item.codes, [{ code: '↑ ↓ ← →', effect: 'חיים', platform: 'Xbox' }]);
  await call(env, '/retry', { id: item.id });
  await env.lib.alarm();
  const after = (await call(env, '/list', {})).data;
  assert.equal(after.items[0].codes.length, 1);
  assert.equal(after.items[0].category, 'קודים וצ׳יטים');

  // שינוי שם של קטגוריה
  const renamed = await call(env, '/category', { from: 'קודים וצ׳יטים', to: 'קודים' });
  assert.equal(renamed.data.items[0].category, 'קודים');
  assert.ok(renamed.data.categories['קודים']);
});

test('YouTube: the transcript (where codes are said) goes to the agent', async () => {
  const calls = [];
  const FETCH = async (url) => {
    if (url.includes('/youtubei/v1/player')) {
      return Response.json({
        videoDetails: { title: 'GTA 6 cheats', author: 'Gamer', shortDescription: 'all cheat codes', lengthSeconds: '300' },
        captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=1' }] } },
      });
    }
    if (url.includes('timedtext')) return new Response('<transcript><text start="0">press R1 R2 L1</text></transcript>');
    return page(url);
  };
  const env = fakeEnv({ AI_CLIENT: fakeAI(calls), FETCH });
  await call(env, '/add', { url: 'https://youtu.be/dQw4w9WgXcQ' });
  await env.lib.alarm();
  assert.match(calls[0].messages[0].content, /Transcript \(what is said in the video\):\npress R1 R2 L1/);
  assert.equal(calls[0].tools.length, 1); // יש חומר – בלי web_fetch
  assert.equal((await call(env, '/list', {})).data.items[0].codes.length, 2);
});

test('busy AI is retried later, other errors fail with a Hebrew message', async () => {
  const busy = { beta: { messages: { create: async () => { throw Object.assign(new Error('overloaded'), { status: 529 }); } } } };
  const env = fakeEnv({ AI_CLIENT: busy });
  await call(env, '/add', { url: 'https://tiktok.com/@a/video/1' });
  await env.lib.alarm();
  let item = (await call(env, '/list', {})).data.items[0];
  assert.equal(item.status, 'pending');
  assert.ok(item.retryAt > Date.now());
  assert.match(item.error, /עומס/);

  env.AI_CLIENT = { beta: { messages: { create: async () => { throw Object.assign(new Error('bad'), { status: 401 }); } } } };
  await env.lib.process(item.id);
  item = (await call(env, '/list', {})).data.items[0];
  assert.equal(item.status, 'failed');
  assert.match(item.error, /מפתח/);

  // הדבקה חוזרת של קישור שנכשל – מנסה שוב
  env.AI_CLIENT = fakeAI();
  const again = await call(env, '/add', { url: 'https://tiktok.com/@a/video/1' });
  assert.equal(again.data.retried, true);
  await env.lib.alarm();
  assert.equal((await call(env, '/list', {})).data.items[0].status, 'ready');
});

test('helpers', () => {
  const p = readPage('<title>A &amp; B</title><meta property="og:description" content="תיאור"><script>x()</script><p>שלום</p>');
  assert.equal(p.title, 'A & B');
  assert.equal(p.description, 'תיאור');
  assert.equal(sameUrl('http://www.x.com/a/?utm_source=1#t'), sameUrl('https://x.com/a'));
  assert.equal(cleanResult({ category: 'קודים  וצ׳יטים', emoji: '', title: 't', summary: '', codes: null, tags: [] }, ['קודים וצ׳יטים']).category, 'קודים וצ׳יטים');
  assert.deepEqual(cleanCodes('x'), []);
  assert.match(userAgent('https://m.facebook.com/reel/1'), /facebookexternalhit/);
  assert.doesNotMatch(userAgent('https://example.com'), /facebookexternalhit/);
  // קישור בלי מספיק טקסט – הסוכן מקבל web_fetch
  assert.equal(material({ url: 'https://x.com' }, { title: '', description: '', text: '' }, []).web, true);
  assert.equal(material({ url: 'https://x.com' }, { title: 't', description: '', text: 'א'.repeat(500) }, []).web, false);
  assert.equal(aiMessage(new Error('boom')), 'תקלה זמנית. נסו שוב ("לקרוא שוב").');
  assert.equal(CODES.length, 3);
});

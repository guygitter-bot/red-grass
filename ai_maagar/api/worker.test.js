import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Library } from './worker.js';
import { cleanResult, material } from './ai.js';
import { readPage } from './source.js';
import { MAX_PER_DAY, sameUrl } from './library.js';

// זיכרון מדומה במקום האחסון של Durable Object (get/put/delete/list/alarm כמו ב-Cloudflare)
function fakeStorage() {
  const map = new Map();
  let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k)); },
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

// סוכן מדומה: מחזיר קטגוריה לפי מה שכתוב בחומר
function fakeAI(calls = []) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          const content = JSON.stringify(req.messages);
          const category = content.includes('midjourney') ? 'תמונות, וידאו וקול' : 'כלים ואפליקציות';
          return {
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', name: 'file_item', input: { title: 'כותרת', summary: 'תקציר', points: ['א'], category, emoji: '🎨', type: 'כלי', tags: ['#AI'] } }],
          };
        },
      },
    },
  };
}

const page = (title) => new Response(`<html><head><title>${title}</title><meta name="description" content="תיאור"></head><body><p>${'טקסט '.repeat(120)}</p></body></html>`, { status: 200, headers: { 'content-type': 'text/html' } });

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: 'https://ai-maagar.pages.dev', AI_CLIENT: fakeAI(), FETCH: async (url) => page(url), ...extra };
  env.lib = new Library({ storage: fakeStorage() }, env);
  env.LIBRARY = { idFromName: (n) => n, get: () => ({ fetch: (req) => env.lib.fetch(req) }) };
  return env;
}

async function call(env, path, body, token) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://ai-maagar.pages.dev', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data: await res.json() };
}

// בלי סיסמה – אין אסימון
async function login() {
  return undefined;
}

test('open without a password, only for the app site', async () => {
  const env = fakeEnv();
  const res = await call(env, '/list', {});
  assert.equal(res.status, 200);
  assert.equal(res.cors, 'https://ai-maagar.pages.dev');
  assert.deepEqual(res.data.items, []);
  assert.equal((await call(env, '/login', { password: 'x' })).status, 404);
});

test('daily limit on additions', async () => {
  const env = fakeEnv();
  await env.lib.storage.put('day', { date: new Date().toISOString().slice(0, 10), count: MAX_PER_DAY });
  const res = await call(env, '/add', { kind: 'text', text: 'עוד אחד' });
  assert.equal(res.status, 429);
  assert.match(res.data.error, /מחר/);
  // יום חדש – מתאפס
  await env.lib.storage.put('day', { date: '2000-01-01', count: MAX_PER_DAY });
  assert.equal((await call(env, '/add', { kind: 'text', text: 'עוד אחד' })).status, 200);
});

test('a link is saved at once and mapped in the background', async () => {
  const env = fakeEnv();
  const token = await login(env);
  const added = await call(env, '/add', { kind: 'link', url: 'https://www.midjourney.com/?utm_source=x' }, token);
  assert.equal(added.status, 200);
  assert.equal(added.data.item.status, 'pending');
  assert.equal(added.data.item.title, 'midjourney.com');
  assert.ok(await env.lib.storage.getAlarm());

  await env.lib.alarm();
  const { data } = await call(env, '/list', {}, token);
  const item = data.items[0];
  assert.equal(item.status, 'ready');
  assert.equal(item.category, 'תמונות, וידאו וקול');
  assert.deepEqual(item.tags, ['AI']);
  assert.deepEqual(data.categories['תמונות, וידאו וקול'], { emoji: '🎨' });

  // אותו קישור שוב – לא נוסף פעמיים
  const again = await call(env, '/add', { kind: 'link', url: 'https://midjourney.com/' }, token);
  assert.equal(again.data.duplicate, true);
  assert.equal((await call(env, '/list', {}, token)).data.items.length, 1);
});

test('rejects private links and bad files', async () => {
  const env = fakeEnv();
  const token = await login(env);
  assert.equal((await call(env, '/add', { kind: 'link', url: 'http://localhost/x' }, token)).status, 400);
  assert.equal((await call(env, '/add', { kind: 'file', file: { name: 'a', type: 'text/plain', data: '!!' } }, token)).status, 400);
  assert.equal((await call(env, '/add', { kind: 'nope' }, token)).status, 400);
});

test('files are stored, sent to the agent and can be downloaded', async () => {
  const calls = [];
  const env = fakeEnv({ AI_CLIENT: fakeAI(calls) });
  const token = await login(env);
  const data = Buffer.from('הערות על פרומפטים').toString('base64');
  const { data: added } = await call(env, '/add', { kind: 'file', file: { name: 'notes.md', type: 'text/markdown', data } }, token);
  assert.equal(added.item.file.name, 'notes.md');
  await env.lib.alarm();
  assert.match(JSON.stringify(calls[0].messages), /הערות על פרומפטים/);
  const file = await call(env, '/file', { id: added.item.id }, token);
  assert.equal(file.data.file.data, data);

  const pdf = await call(env, '/add', { kind: 'file', file: { name: 'paper.pdf', type: 'application/pdf', data: 'JVBERi0=' } }, token);
  await env.lib.alarm();
  assert.equal(calls[1].messages[0].content[0].type, 'document');

  await call(env, '/delete', { id: pdf.data.item.id }, token);
  assert.equal([...env.lib.storage.map.keys()].filter((k) => k.includes(pdf.data.item.id)).length, 0);
});

test('a manual category wins, and categories can be renamed', async () => {
  const env = fakeEnv();
  const token = await login(env);
  const { data } = await call(env, '/add', { kind: 'text', text: 'טיפ: לבקש מהמודל לחשוב צעד צעד' }, token);
  await call(env, '/update', { id: data.item.id, category: 'שלי', emoji: '⭐' }, token);
  await env.lib.alarm();
  let list = (await call(env, '/list', {}, token)).data;
  assert.equal(list.items[0].category, 'שלי');
  assert.equal(list.items[0].status, 'ready');

  list = (await call(env, '/category', { from: 'שלי', to: 'טיפים' }, token)).data;
  assert.equal(list.items[0].category, 'טיפים');
  assert.equal(list.categories['טיפים'].emoji, '⭐');
  assert.equal(list.categories['שלי'], undefined);
});

test('busy AI is retried later, other errors fail with a Hebrew message', async () => {
  const busy = { beta: { messages: { create: async () => { throw Object.assign(new Error('overloaded'), { status: 529 }); } } } };
  const env = fakeEnv({ AI_CLIENT: busy });
  const token = await login(env);
  await call(env, '/add', { kind: 'text', text: 'משהו' }, token);
  await env.lib.alarm();
  let item = (await call(env, '/list', {}, token)).data.items[0];
  assert.equal(item.status, 'pending');
  assert.ok(item.retryAt > Date.now());
  assert.match(item.error, /עומס/);

  env.AI_CLIENT = { beta: { messages: { create: async () => { throw Object.assign(new Error('bad'), { status: 401 }); } } } };
  await env.lib.process(item.id);
  item = (await call(env, '/list', {}, token)).data.items[0];
  assert.equal(item.status, 'failed');
  assert.match(item.error, /מפתח/);

  env.AI_CLIENT = fakeAI();
  await call(env, '/retry', { id: item.id }, token);
  await env.lib.alarm();
  assert.equal((await call(env, '/list', {}, token)).data.items[0].status, 'ready');
});

test('helpers', () => {
  const p = readPage('<title>A &amp; B</title><meta property="og:description" content="תיאור"><script>x()</script><p>שלום</p>');
  assert.equal(p.title, 'A & B');
  assert.equal(p.description, 'תיאור');
  assert.equal(p.text, 'שלום');
  assert.equal(sameUrl('http://www.x.com/a/?utm_source=1#t'), sameUrl('https://x.com/a'));
  assert.equal(cleanResult({ category: 'כלים  ואפליקציות', emoji: '', type: 'zzz', title: 't', summary: '', points: [], tags: [] }, ['כלים ואפליקציות']).category, 'כלים ואפליקציות');
  // קישור בלי מספיק טקסט – הסוכן מקבל web_fetch
  assert.equal(material({ kind: 'link', url: 'https://x.com' }, { title: '', description: '', text: '' }, []).web, true);
  assert.equal(material({ kind: 'link', url: 'https://x.com' }, { title: 't', description: '', text: 'א'.repeat(500) }, []).web, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Library } from './worker.js';
import { aiMessage, cleanResult, material } from './ai.js';
import { captionText, readPage, youtubeId } from './source.js';
import { cleanLearning, skillName } from './learn.js';
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

const LEARNED = {
  title: 'יצירת סרטונים עם Veo',
  summary: 'איך כותבים פרומפט לסרטון.',
  coverage: 'full',
  coverage_note: 'קראתי את התמליל המלא',
  lessons: ['לתאר תנועת מצלמה'],
  steps: [{ title: 'לבחור סגנון', detail: 'קולנועי' }],
  prompts: [{ title: 'פרומפט בסיס', purpose: 'סרטון קצר', tool: 'Veo', prompt: 'A cinematic shot of [subject]', from_source: true }],
  skills: [{ name: 'Video Prompt Writer!', title: 'כותב פרומפטים לווידאו', description: 'Writes video prompts. Use for סרטון, וידאו.', instructions: '# מטרה\nלכתוב פרומפט.' }],
};

// סוכן מדומה: מחזיר קטגוריה לפי מה שכתוב בחומר (ובלימוד – את LEARNED)
function fakeAI(calls = []) {
  return {
    beta: {
      messages: {
        // לימוד עובר בסטרימינג – אותה תשובה
        stream(req) {
          return { finalMessage: () => this.create(req) };
        },
        async create(req) {
          calls.push(req);
          if (req.tools.some((t) => t.name === 'submit_learning')) {
            return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_learning', input: LEARNED }] };
          }
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
  const env = { ALLOWED_ORIGINS: 'https://ai-maagar-631.pages.dev', AI_CLIENT: fakeAI(), FETCH: async (url) => page(url), ...extra };
  env.lib = new Library({ storage: fakeStorage() }, env);
  env.LIBRARY = { idFromName: (n) => n, get: () => ({ fetch: (req) => env.lib.fetch(req) }) };
  return env;
}

async function call(env, path, body, token) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://ai-maagar-631.pages.dev', ...(token ? { authorization: `Bearer ${token}` } : {}) },
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
  assert.equal(res.cors, 'https://ai-maagar-631.pages.dev');
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

test('learning from a YouTube video: transcript in, skills and prompts out', async () => {
  const calls = [];
  const fetched = [];
  const FETCH = async (url, init) => {
    fetched.push(url);
    if (url.includes('/youtubei/v1/player')) {
      assert.equal(JSON.parse(init.body).videoId, 'dQw4w9WgXcQ');
      return Response.json({
        videoDetails: { title: 'Veo tutorial', author: 'AI Guy', shortDescription: 'desc', lengthSeconds: '600' },
        captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=1', kind: 'asr' }] } },
      });
    }
    if (url.includes('timedtext')) return new Response('<transcript><text start="0">first write the &amp;#39;scene&amp;#39;</text><text start="2">then the camera</text></transcript>');
    return page(url);
  };
  const env = fakeEnv({ AI_CLIENT: fakeAI(calls), FETCH });
  // אותו קישור במאגר הרגיל ובלימוד – לא נחשב כפול
  await call(env, '/add', { kind: 'link', url: 'https://youtu.be/dQw4w9WgXcQ' });
  const added = await call(env, '/add', { kind: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mode: 'learn' });
  assert.equal(added.data.duplicate, undefined);
  assert.equal(added.data.item.mode, 'learn');
  await env.lib.alarm();
  await env.lib.alarm();

  const learnCall = calls.find((c) => c.tools.some((t) => t.name === 'submit_learning'));
  assert.match(learnCall.messages[0].content, /Transcript:\nfirst write the 'scene' then the camera/);
  assert.match(learnCall.messages[0].content, /Length: ~10 minutes/);

  const { data } = await call(env, '/list', {});
  const item = data.items.find((i) => i.mode === 'learn');
  assert.equal(item.status, 'ready');
  assert.equal(item.category, undefined);
  assert.equal(item.learn.prompts[0].fromSource, true);
  assert.equal(item.learn.skills[0].name, 'video-prompt-writer');
  assert.match(item.learn.skills[0].file, /^---\nname: video-prompt-writer\ndescription: "Writes video prompts\. Use for סרטון, וידאו\."\n---\n\n# מטרה/);
  // פריט לימוד לא פותח קטגוריה במאגר
  assert.deepEqual(await env.lib.categoryNames(), ['כלים ואפליקציות']);
});

test('learning helpers', () => {
  assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ?t=3'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://m.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ'), '');
  assert.equal(captionText('<p t="1">a<s>b</s></p><p>c</p>'), 'ab c');
  assert.equal(skillName('  My Cool Skill (v2) '), 'my-cool-skill-v2');
  assert.equal(skillName('סקיל'), 'my-skill');
  const r = cleanLearning({ ...LEARNED, coverage: 'weird', skills: [LEARNED.skills[0], LEARNED.skills[0]], prompts: [{ ...LEARNED.prompts[0], prompt: '' }] });
  assert.equal(r.learn.coverage, 'partial');
  assert.deepEqual(r.learn.skills.map((s) => s.name), ['video-prompt-writer', 'video-prompt-writer-2']);
  assert.equal(r.learn.prompts.length, 0);
});

test('technical English errors reach the user in Hebrew', () => {
  assert.match(aiMessage(new Error('Streaming is required for operations that may take longer than 10 minutes')), /תקלה זמנית/);
  assert.equal(aiMessage(new Error('החומר ארוך מדי')), 'החומר ארוך מדי');
});

test('"learn from this" on a saved item, and a failed link is retried when pasted again', async () => {
  const env = fakeEnv();
  const link = (await call(env, '/add', { kind: 'link', url: 'https://eilon.co/guide', note: 'חשוב' })).data.item;
  const file = (await call(env, '/add', { kind: 'file', file: { name: 'a.md', type: 'text/markdown', data: Buffer.from('שלום').toString('base64') } })).data.item;

  const learned = await call(env, '/learn-from', { id: link.id });
  assert.equal(learned.status, 200);
  assert.equal(learned.data.item.mode, 'learn');
  assert.equal(learned.data.item.url, 'https://eilon.co/guide');
  assert.equal(learned.data.item.note, 'חשוב');
  // פעם שנייה – אותו פריט לימוד
  assert.equal((await call(env, '/learn-from', { id: link.id })).data.item.id, learned.data.item.id);
  assert.equal((await call(env, '/learn-from', { id: learned.data.item.id })).status, 400);

  const fromFile = (await call(env, '/learn-from', { id: file.id })).data.item;
  assert.equal(fromFile.file.name, 'a.md');
  assert.equal((await call(env, '/file', { id: fromFile.id })).data.file.data, Buffer.from('שלום').toString('base64'));

  // לימוד שנכשל – הדבקה חוזרת מנסה שוב
  await env.lib.save(learned.data.item.id, { status: 'failed', error: 'x' });
  const again = await call(env, '/add', { kind: 'link', url: 'https://eilon.co/guide', mode: 'learn' });
  assert.equal(again.data.retried, true);
  assert.equal(again.data.item.status, 'pending');
});

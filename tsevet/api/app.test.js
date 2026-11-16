// בדיקות לאפליקציה: כניסה, שיחות, קבצים, עריכת וידאו, ושיחות שהגיעו מ-Telegram.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Team, originAllowed } from './worker.js';
import { MODELS } from './agents.js';
import { hookSecret } from './telegram.js';

const ORIGIN = 'https://tsevet-ai.pages.dev';
const API = 'https://api.test';
const GH = 'gh-token-123';

function fakeStorage() {
  const map = new Map();
  let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { map.delete(k); },
    async list({ prefix = '' } = {}) { return new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)])); },
    async getAlarm() { return alarm; },
    async setAlarm(t) { alarm = t; },
  };
}

// R2 מדומה (כולל Range)
function fakeBucket() {
  const map = new Map();
  return {
    map,
    async put(key, body, opts = {}) {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      map.set(key, { bytes, type: opts.httpMetadata?.contentType });
      return { size: bytes.length };
    },
    async get(key, opts) {
      const o = map.get(key);
      if (!o) return null;
      const m = opts?.range?.get?.('range')?.match(/bytes=(\d+)-(\d*)/);
      const offset = m ? Number(m[1]) : 0;
      const end = m && m[2] ? Number(m[2]) : o.bytes.length - 1;
      const part = o.bytes.slice(offset, end + 1);
      return { size: o.bytes.length, body: part, range: m ? { offset, length: part.length } : undefined, arrayBuffer: async () => o.bytes.buffer };
    },
    async delete(key) { map.delete(key); },
  };
}

// Claude מדומה: Haiku מנתב, השאר מחזירים את התשובה הבאה ברשימה
function fakeAI(script, calls) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          if (req.max_tokens === 10) return { content: [{ type: 'text', text: script.route || 'creative' }], usage: { input_tokens: 100, output_tokens: 2 } };
          const next = script.replies.shift();
          if (!next) throw new Error('no more replies');
          if (next.wait) await next.wait;
          return { stop_reason: next.stop || 'end_turn', content: next.content, usage: { input_tokens: 1000, output_tokens: 500 } };
        },
      },
    },
  };
}

function setupEnv(script = { replies: [] }, extra = {}) {
  const aiCalls = [];
  const outside = [];
  const env = {
    TG_CREATIVE_TOKEN: '111:aaa',
    TG_CAMPAIGNS_TOKEN: '222:bbb',
    TEAM_OWNER_CODE: 'secret-code',
    ALLOWED_ORIGINS: `${ORIGIN},https://*.tsevet-ai.pages.dev`,
    GITHUB_TOKEN: GH,
    GITHUB_REPO: 'me/repo',
    FILES: fakeBucket(),
    AI_CLIENT: fakeAI(script, aiCalls),
    async FETCH(url, init) {
      outside.push({ url, body: init?.body ? JSON.parse(init.body) : {}, headers: init?.headers || {} });
      if (url.includes('api.github.com')) return new Response(null, { status: script.github || 204 });
      return new Response(JSON.stringify({ ok: true, result: true }));
    },
    ...extra,
  };
  env.team = new Team({ storage: fakeStorage() }, env);
  env.TEAM = { idFromName: (n) => n, get: () => ({ fetch: (url, init) => env.team.fetch(new Request(url, init)) }) };
  return { env, aiCalls, outside };
}

async function call(env, path, body = {}, token = '', origin = ORIGIN) {
  const res = await worker.fetch(new Request(`${API}${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json() };
}

async function signIn(env) {
  const { data } = await call(env, '/app/setup', { password: 'sisma-123' });
  return data.token;
}

async function upload(env, token, { type, name = 'f', bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), query = '' }) {
  const res = await worker.fetch(new Request(`${API}/app/upload?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}${query}`, {
    method: 'PUT',
    headers: { origin: ORIGIN, authorization: `Bearer ${token}`, 'content-length': String(bytes.length) },
    body: bytes,
    duplex: 'half',
  }), env);
  return { status: res.status, data: await res.json() };
}

const text = (t) => [{ type: 'text', text: t }];
const tool = (name, input) => [{ type: 'tool_use', id: `t_${name}`, name, input }];

test('first entry sets the password; wrong password, other sites and missing token are refused', async () => {
  const { env } = setupEnv();
  assert.deepEqual((await call(env, '/app/status')).data, { ready: false });
  assert.equal((await call(env, '/app/setup', { password: '123' })).status, 400);
  const token = await signIn(env);
  assert.deepEqual((await call(env, '/app/status')).data, { ready: true });
  assert.equal((await call(env, '/app/setup', { password: 'another-one' })).status, 403);
  assert.equal((await call(env, '/app/login', { password: 'nope-nope' })).status, 401);
  const again = await call(env, '/app/login', { password: 'sisma-123' });
  assert.equal(again.status, 200);
  assert.equal((await call(env, '/app/team', {}, again.data.token)).status, 200);
  assert.equal((await call(env, '/app/team', {}, 'bad')).status, 401);
  assert.equal((await call(env, '/app/team', {}, token, 'https://evil.example')).status, 403);
  // החלפת סיסמה מנתקת את המכשירים האחרים
  const changed = await call(env, '/app/password', { password: 'sisma-123', newPassword: 'hadasha-456' }, token);
  assert.equal(changed.status, 200);
  assert.equal((await call(env, '/app/team', {}, again.data.token)).status, 401);
  assert.equal((await call(env, '/app/team', {}, changed.data.token)).status, 200);
});

test('ten wrong passwords lock the login', async () => {
  const { env } = setupEnv();
  await signIn(env);
  for (let i = 0; i < 10; i++) assert.equal((await call(env, '/app/login', { password: 'wrong-pass' })).status, 401);
  assert.equal((await call(env, '/app/login', { password: 'sisma-123' })).status, 429);
});

test('allowed origins', () => {
  const list = 'https://tsevet-ai.pages.dev,https://*.tsevet-ai.pages.dev';
  assert.ok(originAllowed('https://tsevet-ai.pages.dev', list));
  assert.ok(originAllowed('https://abc123.tsevet-ai.pages.dev', list));
  assert.ok(!originAllowed('https://tsevet-ai-9x2.pages.dev', list));
  assert.ok(!originAllowed('https://tsevet-ai.pages.dev.evil.com', list));
  assert.ok(!originAllowed('https://evil.com', list));
});

test('a message in the app: the team picks a bot, it answers and hands off', async () => {
  const { env, aiCalls } = setupEnv({
    route: 'campaigns',
    replies: [
      { content: [...text('הנה תוכנית'), ...tool('handoff', { to: 'creative', request: 'צריך שלושה טקסטים' })] },
      { content: text('שלושה טקסטים: ...') },
    ],
  });
  const token = await signIn(env);
  const { data: conv } = await call(env, '/app/conv/new', {}, token);
  assert.equal((await call(env, '/app/send', { id: conv.id, text: 'קמפיין לסדר' }, token)).status, 200);
  let view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  assert.equal(view.messages.length, 1);
  assert.deepEqual(view.busy, { agent: null });

  await env.team.alarm();
  view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  assert.deepEqual(view.messages.map((m) => m.who), ['owner', 'campaigns', 'creative']);
  assert.deepEqual(view.messages[1].handoff, { to: 'creative', request: 'צריך שלושה טקסטים' });
  assert.equal(view.busy, null);
  assert.equal(view.title, 'קמפיין לסדר');
  // לכל בוט המודל שלו, ובאפליקציה כל הצוות זמין (כולל עורך הווידאו)
  const [, campaigns, creative] = aiCalls;
  assert.equal(campaigns.model, MODELS.opus);
  assert.equal(creative.model, MODELS.sonnet);
  assert.match(campaigns.system[0].text, /עורך וידאו/);
  assert.match(campaigns.system[0].text, /private team app/);
  // עלויות לפי בוט
  const costs = (await call(env, '/app/costs', {}, token)).data;
  assert.ok(costs.now.agents.campaigns > costs.now.agents.creative);
  assert.ok(costs.now.agents.router > 0);
  assert.ok(Math.abs(costs.today - costs.now.usd) < 1e-9);
});

test('a message to one bot skips the routing; the model level can be changed in settings', async () => {
  const { env, aiCalls } = setupEnv({ replies: [{ content: text('בסדר') }] });
  const token = await signIn(env);
  const set = await call(env, '/app/settings', { models: { creative: 'opus', campaigns: 'nonsense' } }, token);
  assert.deepEqual(set.data.models, { creative: 'opus', campaigns: 'opus', editor: 'sonnet' });
  const { data: conv } = await call(env, '/app/conv/new', {}, token);
  await call(env, '/app/send', { id: conv.id, text: 'רעיון', to: 'creative' }, token);
  await env.team.alarm();
  assert.equal(aiCalls.length, 1);
  assert.equal(aiCalls[0].model, MODELS.opus);
});

test('stop: the answer of a turn that was stopped is not kept', async () => {
  let release;
  const wait = new Promise((r) => { release = r; });
  const { env } = setupEnv({ replies: [{ wait, content: text('תשובה שלא צריך') }] });
  const token = await signIn(env);
  const { data: conv } = await call(env, '/app/conv/new', {}, token);
  await call(env, '/app/send', { id: conv.id, text: 'משהו', to: 'creative' }, token);
  const running = env.team.alarm();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual((await call(env, '/app/conv', { id: conv.id }, token)).data.busy, { agent: 'creative' });
  await call(env, '/app/stop', { id: conv.id }, token);
  release();
  await running;
  const view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  assert.deepEqual(view.messages.map((m) => m.who), ['owner']);
  assert.equal(view.busy, null);
});

test('upload: only media, signed links, range, and the bot sees the photo', async () => {
  const { env, aiCalls } = setupEnv({ replies: [{ content: text('תמונה יפה') }] });
  const token = await signIn(env);
  assert.equal((await upload(env, token, { type: 'text/html' })).status, 415);
  assert.equal((await upload(env, token, { type: 'image/svg+xml' })).status, 415);
  assert.equal((await upload(env, 'bad', { type: 'image/jpeg' })).status, 401);
  const up = await upload(env, token, { type: 'image/jpeg', name: 'pic.jpg', query: '&w=800&h=600' });
  assert.equal(up.status, 200);
  assert.equal(up.data.kind, 'image');

  const { data: conv } = await call(env, '/app/conv/new', {}, token);
  await call(env, '/app/send', { id: conv.id, text: '', files: [up.data.id, 'no-such-file'], to: 'creative' }, token);
  await env.team.alarm();
  const view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  const file = view.messages[0].files[0];
  assert.equal(view.messages[0].files.length, 1);
  assert.ok(file.url.startsWith(`${API}/file/${up.data.id}?e=`));
  // הבוט קיבל את התמונה עצמה ואת התיאור שלה
  const content = aiCalls[0].messages[0].content;
  assert.equal(content[0].type, 'image');
  assert.equal(content[0].source.media_type, 'image/jpeg');
  assert.match(content[1].text, new RegExp(`\\[file ${up.data.id}: photo "pic.jpg", 800x600\\]`));

  // הקישור החתום עובד בלי סיסמה; קישור ששונה – לא
  const ok = await worker.fetch(new Request(file.url), env);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'image/jpeg');
  assert.equal((await ok.arrayBuffer()).byteLength, 8);
  const part = await worker.fetch(new Request(file.url, { headers: { range: 'bytes=2-4' } }), env);
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 2-4/8');
  assert.equal((await worker.fetch(new Request(file.url.replace(/s=.{4}/, 's=0000')), env)).status, 403);
  assert.equal((await worker.fetch(new Request(file.url.replace(/e=\d+/, 'e=1')), env)).status, 403);
  assert.match((await worker.fetch(new Request(`${file.url}&dl=1`), env)).headers.get('content-disposition'), /^attachment/);

  // מחיקת השיחה מוחקת גם את הקבצים שלה
  await call(env, '/app/conv/delete', { id: conv.id }, token);
  assert.equal(env.FILES.map.size, 0);
  assert.equal((await call(env, '/app/conv', { id: conv.id }, token)).status, 404);
});

test('video editing: the editor starts a render, the workflow fetches the input and returns the result', async () => {
  const { env, outside } = setupEnv({
    replies: [
      { stop: 'tool_use', content: tool('edit_video', { op: 'color_grade', files: ['VIDEO'], preset: 'warm', strength: 9, extra: '; rm -rf /' }) },
      { content: text('התחלתי לערוך בגוון חם') },
    ],
  });
  const token = await signIn(env);
  const poster = await upload(env, token, { type: 'image/jpeg', name: 'poster.jpg' });
  const video = await upload(env, token, { type: 'video/mp4', name: 'clip.mp4', bytes: new Uint8Array(20).fill(7), query: `&dur=12.4&w=1080&h=1920&poster=${poster.data.id}` });
  assert.equal(video.data.kind, 'video');
  // הבוט משתמש במזהה שמופיע בשיחה
  env.AI_CLIENT = fakeAI({ replies: [
    { stop: 'tool_use', content: tool('edit_video', { op: 'color_grade', files: [video.data.id], preset: 'warm', strength: 9, extra: '; rm -rf /' }) },
    { content: text('התחלתי לערוך בגוון חם') },
  ] }, []);

  const { data: conv } = await call(env, '/app/conv/new', {}, token);
  await call(env, '/app/send', { id: conv.id, text: 'תעשה לזה צבע חם', files: [video.data.id], to: 'editor' }, token);
  await env.team.alarm();

  const dispatch = outside.find((o) => o.url === 'https://api.github.com/repos/me/repo/dispatches');
  assert.equal(dispatch.body.event_type, 'tsevet-render');
  assert.equal(dispatch.headers.authorization, `Bearer ${GH}`);
  const renderId = dispatch.body.client_payload.id;

  let view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  assert.ok(view.messages[0].files[0].poster);
  assert.equal(view.messages[1].who, 'editor');
  assert.equal(view.messages[1].renders[0].status, 'queued');
  assert.equal(view.messages[1].renders[0].label, 'צבעוניות קולנועית');
  assert.equal(view.pending, true);

  // ה-workflow: רק עם הטוקן
  const gh = (path, init = {}) => worker.fetch(new Request(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${GH}`, ...(init.headers || {}) } }), env);
  assert.equal((await worker.fetch(new Request(`${API}/render/job?id=${renderId}`), env)).status, 403);
  const job = await (await gh(`/render/job?id=${renderId}`)).json();
  // רק פרמטרים מוכרים, בטווח
  assert.deepEqual(job, { id: renderId, op: 'color_grade', params: { preset: 'warm', strength: 1.6 }, inputs: [{ n: 0, kind: 'video', name: 'in0.mp4' }], music: null });
  const input = await gh(`/render/input?id=${renderId}&n=0`);
  assert.equal((await input.arrayBuffer()).byteLength, 20);
  assert.equal((await gh(`/render/input?id=${renderId}&n=5`)).status, 404);

  const done = await gh(`/render/result?id=${renderId}`, { method: 'PUT', body: new Uint8Array(30).fill(1), duplex: 'half' });
  assert.equal(done.status, 200);
  view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  const render = view.messages[1].renders[0];
  assert.equal(render.status, 'done');
  assert.equal(render.file.kind, 'video');
  assert.equal(view.pending, false);
  assert.equal((await (await worker.fetch(new Request(render.file.url), env)).arrayBuffer()).byteLength, 30);
  // עבודה שהסתיימה נסגרת: אי אפשר להעלות לה תוצאה שוב
  assert.equal((await gh(`/render/result?id=${renderId}`, { method: 'PUT', body: new Uint8Array(3), duplex: 'half' })).status, 404);
});

test('video editing is refused cleanly when it is not connected, and bad requests never start a render', async () => {
  const { env, outside, aiCalls } = setupEnv({
    replies: [
      { stop: 'tool_use', content: tool('edit_video', { op: 'beats_and_cuts', files: [] }) },
      { content: text('צריך להעלות סרטון ושיר') },
    ],
  });
  const token = await signIn(env);
  const { data: conv } = await call(env, '/app/conv/new', {}, token);
  await call(env, '/app/send', { id: conv.id, text: 'תחתוך לפי הקצב', to: 'editor' }, token);
  await env.team.alarm();
  assert.equal(outside.filter((o) => o.url.includes('github')).length, 0);
  assert.match(aiCalls[1].messages.at(-1).content[0].content, /at least 1 file/);
  const view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  assert.equal(view.messages[1].renders, undefined);

  const off = setupEnv({ replies: [] }, { GITHUB_TOKEN: '' });
  const t2 = await signIn(off.env);
  assert.equal((await call(off.env, '/app/team', {}, t2)).data.video, false);
  assert.equal((await worker.fetch(new Request(`${API}/render/job?id=x`, { headers: { authorization: 'Bearer ' } }), off.env)).status, 403);
});

test('a Telegram topic continues in the app with its history and the shared memory', async () => {
  const { env } = setupEnv({ replies: [{ content: text('תשובה ב-Telegram') }, { content: text('תשובה באפליקציה') }] });
  const owner = { id: 7, is_bot: false, first_name: 'גיא' };
  const tgPost = async (message) => worker.fetch(new Request(`${API}/tg/creative`, {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': await hookSecret('111:aaa') },
    body: JSON.stringify({ update_id: 1, message: { date: 0, ...message } }),
  }), env);
  await tgPost({ message_id: 1, from: owner, chat: { id: 7, type: 'private' }, text: '/start secret-code' });
  await tgPost({ message_id: 2, from: owner, chat: { id: -100, type: 'supergroup' }, text: 'רעיון למודעה', is_topic_message: true, message_thread_id: 5 });
  await env.team.alarm();
  await env.team.storage.put('notes', ['הקהל: הורים']);

  const token = await signIn(env);
  const team = (await call(env, '/app/team', {}, token)).data;
  assert.deepEqual(team.agents.map((a) => a.key), ['creative', 'campaigns', 'editor']);
  const conv = team.convs.find((c) => c.source === 'tg');
  assert.equal(conv.id, 'tg:-100:5');
  let view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  assert.deepEqual(view.messages.map((m) => m.text), ['רעיון למודעה', 'תשובה ב-Telegram']);

  // ממשיכים מהאפליקציה: התשובה נשמרת בשיחה, ולא נשלחת ל-Telegram
  const sentBefore = env.team.storage.map.get('seen').length;
  await call(env, '/app/send', { id: conv.id, text: 'עוד אחד', to: 'creative' }, token);
  await env.team.alarm();
  view = (await call(env, '/app/conv', { id: conv.id }, token)).data;
  assert.equal(view.messages.at(-1).text, 'תשובה באפליקציה');
  assert.equal(env.team.storage.map.get('seen').length, sentBefore);

  assert.deepEqual((await call(env, '/app/memory', {}, token)).data.notes, ['הקהל: הורים']);
  await call(env, '/app/memory/add', { note: 'תקציב: 500 ש"ח' }, token);
  assert.equal((await call(env, '/app/memory/delete', { number: 1, text: 'משהו אחר' }, token)).status, 409);
  const left = await call(env, '/app/memory/delete', { number: 1, text: 'הקהל: הורים' }, token);
  assert.deepEqual(left.data.notes, ['תקציב: 500 ש"ח']);
  await call(env, '/app/conv/rename', { id: conv.id, title: 'מודעות' }, token);
  assert.equal((await call(env, '/app/team', {}, token)).data.convs[0].title, 'מודעות');
});

test('in Telegram the team is only the bots that exist there', async () => {
  const { env, aiCalls } = setupEnv({ route: 'editor', replies: [{ content: text('היי') }] });
  const owner = { id: 7, is_bot: false, first_name: 'גיא' };
  const tgPost = async (message) => worker.fetch(new Request(`${API}/tg/creative`, {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': await hookSecret('111:aaa') },
    body: JSON.stringify({ update_id: 1, message: { date: 0, ...message } }),
  }), env);
  await tgPost({ message_id: 1, from: owner, chat: { id: 7, type: 'private' }, text: '/start secret-code' });
  await tgPost({ message_id: 2, from: owner, chat: { id: -100, type: 'supergroup' }, text: 'תערוך סרטון', is_topic_message: true, message_thread_id: 5 });
  await env.team.alarm();
  assert.doesNotMatch(aiCalls[0].system, /editor/);
  assert.doesNotMatch(aiCalls[1].system[0].text, /עורך וידאו/);
  assert.ok(!aiCalls[1].tools.some((t) => t.name === 'edit_video'));
  assert.equal((await worker.fetch(new Request(`${API}/tg/editor`, { method: 'POST' }), env)).status, 404);
});

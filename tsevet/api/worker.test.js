import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Team } from './worker.js';
import { priceOf, transcript } from './agents.js';
import { hookSecret, split, toHtml } from './telegram.js';

const TOKENS = { creative: '111:aaa', campaigns: '222:bbb' };
const OWNER = { id: 7, is_bot: false, first_name: 'גיא' };
const STRANGER = { id: 99, is_bot: false, first_name: 'זר' };

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { map.delete(k); },
    async getAlarm() { return alarm; },
    async setAlarm(t) { alarm = t; },
  };
}

// Claude מדומה: כל קריאה מחזירה את התשובה הבאה ברשימה
function fakeAI(script, calls = []) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          if (req.model === 'claude-haiku-5-5') return { content: [{ type: 'text', text: script.route || 'creative' }], usage: { input_tokens: 100, output_tokens: 2 } };
          const next = script.replies.shift();
          if (!next) throw new Error('no more replies');
          if (next.error) throw Object.assign(new Error('boom'), { status: next.error });
          return { stop_reason: next.stop || 'end_turn', content: next.content, usage: { input_tokens: 1000, output_tokens: 500 } };
        },
      },
    },
  };
}

function fakeEnv(script = { replies: [] }) {
  const sent = [];
  const aiCalls = [];
  const env = {
    TG_CREATIVE_TOKEN: TOKENS.creative,
    TG_CAMPAIGNS_TOKEN: TOKENS.campaigns,
    TEAM_OWNER_CODE: 'secret-code',
    AI_CLIENT: fakeAI(script, aiCalls),
    async FETCH(url, init) {
      const [, token, method] = url.match(/bot([^/]+)\/(\w+)$/) || [];
      const body = init?.body ? JSON.parse(init.body) : {};
      sent.push({ token, method, body });
      const result = method === 'getMe' ? { id: Number(token.split(':')[0]), username: token.startsWith('111') ? 'creative_bot' : 'campaigns_bot' } : true;
      return new Response(JSON.stringify({ ok: true, result }));
    },
  };
  env.team = new Team({ storage: fakeStorage() }, env);
  env.TEAM = { idFromName: (n) => n, get: () => ({ fetch: (url, init) => env.team.fetch(new Request(url, init)) }) };
  return { env, sent, aiCalls, messages: () => sent.filter((s) => s.method === 'sendMessage') };
}

let msgId = 1;
async function post(env, agent, message, secret) {
  return worker.fetch(new Request(`https://api.test/tg/${agent}`, {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': secret ?? (await hookSecret(TOKENS[agent])) },
    body: JSON.stringify({ update_id: 1, message: { message_id: msgId++, date: 0, ...message } }),
  }), env);
}
const dm = (from, text) => ({ from, chat: { id: from.id, type: 'private' }, text });
const group = (from, text, extra = {}) => ({ from, chat: { id: -100, type: 'supergroup', is_forum: true }, text, is_topic_message: true, message_thread_id: 5, ...extra });

async function claimOwner(env) {
  await post(env, 'creative', dm(OWNER, '/start secret-code'));
}

test('telegram secret is required', async () => {
  const { env } = fakeEnv();
  const res = await post(env, 'creative', dm(OWNER, 'hi'), 'wrong');
  assert.equal(res.status, 401);
  assert.equal((await post(env, 'nobody', dm(OWNER, 'hi'))).status, 404);
});

test('owner is set only with the right code, strangers are refused', async () => {
  const { env, messages } = fakeEnv();
  await post(env, 'creative', dm(STRANGER, '/start wrong'));
  assert.equal(await env.team.storage.get('owner'), undefined);
  assert.match(messages().at(-1).body.text, /בוט פרטי/);

  await claimOwner(env);
  assert.deepEqual(await env.team.storage.get('owner'), { id: 7, name: 'גיא' });
  assert.match(messages().at(-1).body.text, /הצוות שלך/);

  // אחרי שיש בעלים – אי אפשר להחליף אותו גם עם הקוד
  await post(env, 'creative', dm(STRANGER, '/start secret-code'));
  assert.equal((await env.team.storage.get('owner')).id, 7);

  // זר בקבוצה – מתעלמים, בלי תור
  await post(env, 'creative', group(STRANGER, 'תעשו לי קמפיין'));
  assert.equal((await env.team.storage.get('q')) || undefined, undefined);
});

test('group message is handled once, routed, and teammates hand off', async () => {
  const { env, messages, aiCalls } = fakeEnv({
    route: 'creative',
    replies: [
      // קריאייטיב: קורא על האפליקציה, שומר זיכרון, ואז מעביר לקמפיינים
      { stop: 'tool_use', content: [
        { type: 'tool_use', id: 't1', name: 'app_info', input: { app: 'mat_kon' } },
        { type: 'tool_use', id: 't2', name: 'remember', input: { note: 'קהל היעד: הורים עסוקים' } },
      ] },
      { stop: 'tool_use', content: [
        { type: 'text', text: 'הנה 3 **רעיונות**' },
        { type: 'tool_use', id: 't3', name: 'handoff', input: { to: 'campaigns', request: 'תכין קמפיין לרעיון 2' } },
      ] },
      { content: [{ type: 'text', text: 'הכנתי קמפיין: 50 ₪ ליום. לאשר?' }] },
    ],
  });
  await claimOwner(env);
  const before = messages().length;
  const m = group(OWNER, 'צריך קמפיין לחנוכה ל-mat-kon');
  // שני הבוטים מקבלים את אותה הודעה
  await post(env, 'creative', m);
  msgId--;
  await post(env, 'campaigns', m);
  assert.equal((await env.team.storage.get('q')).length, 1);

  await env.team.alarm();
  const out = messages().slice(before);
  assert.equal(out.length, 2);
  assert.equal(out[0].token, TOKENS.creative);
  assert.equal(out[0].body.message_thread_id, 5);
  assert.match(out[0].body.text, /<b>רעיונות<\/b>/);
  assert.match(out[0].body.text, /↪️ 📊 קמפיינים: תכין קמפיין לרעיון 2/);
  assert.equal(out[1].token, TOKENS.campaigns);
  assert.match(out[1].body.text, /50 ₪/);

  // הכלי app_info החזיר את ה-README; הקמפיינים ראו את מה שקריאייטיב כתב
  const toolResults = aiCalls[2].messages[2].content;
  assert.match(toolResults[0].content, /mat-kon/);
  assert.match(JSON.stringify(aiCalls[3].messages[0].content), /תכין קמפיין לרעיון 2/);
  assert.deepEqual(await env.team.storage.get('notes'), ['קהל היעד: הורים עסוקים']);
  assert.deepEqual(await env.team.storage.get('q'), []);
  assert.equal((await env.team.storage.get('h:-100:5')).length, 3);

  // עלויות
  await post(env, 'creative', group(OWNER, '/costs@creative_bot'));
  assert.match(messages().at(-1).body.text, /החודש: \$0\.0\d/);
});

test('reply to a bot goes straight to it, private chat labels the other bot', async () => {
  const { env, messages, aiCalls } = fakeEnv({
    replies: [
      { content: [{ type: 'text', text: 'מילות מפתח' }] },
      { stop: 'tool_use', content: [
        { type: 'text', text: 'כאן קמפיינים' },
        { type: 'tool_use', id: 'h', name: 'handoff', input: { to: 'creative', request: 'כותרות' } },
      ] },
      { content: [{ type: 'text', text: 'כותרות!' }] },
    ],
  });
  await claimOwner(env);
  await post(env, 'creative', group(OWNER, 'ומה עם גוגל?', { reply_to_message: { from: { id: 222, is_bot: true } } }));
  await env.team.alarm();
  assert.ok(!aiCalls.some((c) => c.model === 'claude-haiku-5-5'));
  assert.equal(messages().at(-1).token, TOKENS.campaigns);

  // צ'אט פרטי עם קמפיינים: גם קריאייטיב עונה דרכו, עם השם שלו
  const before = messages().length;
  await post(env, 'campaigns', dm(OWNER, 'תכין משהו'));
  await env.team.alarm();
  const out = messages().slice(before);
  assert.equal(out.length, 2);
  assert.ok(out.every((o) => o.token === TOKENS.campaigns));
  assert.match(out[1].body.text, /^🎨 קריאייטיב:\n/);
});

test('temporary AI error is retried later, then reported in Hebrew', async () => {
  const { env, messages } = fakeEnv({ replies: [{ error: 529 }, { error: 529 }, { error: 529 }] });
  await claimOwner(env);
  await post(env, 'creative', dm(OWNER, 'שלום'));
  await env.team.alarm();
  assert.equal((await env.team.storage.get('q'))[0].attempts, 1);
  await env.team.alarm();
  await env.team.alarm();
  assert.deepEqual(await env.team.storage.get('q'), []);
  assert.match(messages().at(-1).body.text, /עומס/);
});

test('setup registers webhooks with the secret', async () => {
  const { env, sent } = fakeEnv();
  const bad = await worker.fetch(new Request('https://api.test/setup', { method: 'POST' }), env);
  assert.equal(bad.status, 401);
  const res = await worker.fetch(new Request('https://api.test/setup', {
    method: 'POST',
    headers: { 'x-setup': await hookSecret(`setup:${TOKENS.creative}`) },
  }), env);
  assert.deepEqual(await res.json(), { creative: '@creative_bot', campaigns: '@campaigns_bot' });
  const hook = sent.find((s) => s.method === 'setWebhook' && s.token === TOKENS.campaigns);
  assert.equal(hook.body.url, 'https://api.test/tg/campaigns');
  assert.equal(hook.body.secret_token, await hookSecret(TOKENS.campaigns));
  assert.equal((await env.team.storage.get('bots')).creative.username, 'creative_bot');
});

test('helpers', () => {
  assert.equal(toHtml('a <b> & **c**'), 'a &lt;b&gt; &amp; <b>c</b>');
  const parts = split(`${'א'.repeat(3000)}\n\n${'ב'.repeat(3000)}`);
  assert.equal(parts.length, 2);
  assert.match(transcript([{ who: 'owner', text: 'היי' }, { who: 'campaigns', text: 'שלום' }], 'גיא'), /גיא: היי\n\n📊 קמפיינים: שלום/);
  assert.ok(Math.abs(priceOf({ model: 'claude-opus-5-5', input_tokens: 1e6 }) - 5) < 1e-9);
});

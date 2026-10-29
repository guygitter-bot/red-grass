import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Budget, originAllowed } from './worker.js';
import { cleanRecord } from './budget.js';

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) {
      return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k));
    },
    async put(k, v) {
      if (typeof k === 'object') {
        if (Object.keys(k).length > 128) throw new Error('too many keys');
        for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      } else map.set(k, clone(v));
    },
    async delete(k) {
      for (const kk of [k].flat()) map.delete(kk);
    },
    async list({ prefix }) {
      return new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)]));
    },
  };
}

const ORIGIN = 'https://bayit-budget.pages.dev';

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`, time: 1_800_000_000_000 };
  const storage = fakeStorage();
  let obj = null;
  env.BUDGET = {
    idFromName: (n) => n,
    get: () => ({ fetch: (req) => (obj ||= new Budget({ storage }, { NOW: () => env.time, ...extra })).fetch(req) }),
  };
  env.restart = () => {
    obj = null;
  };
  return env;
}

async function call(env, path, body = {}, token = '', origin = ORIGIN) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json() };
}

test('כתובות מותרות', () => {
  assert.ok(originAllowed('https://abc.bayit-budget.pages.dev', 'https://*.bayit-budget.pages.dev'));
  assert.ok(!originAllowed('https://evil.com', 'https://*.bayit-budget.pages.dev'));
});

test('אתר זר לא יכול לפנות לשרת', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/status', {}, '', 'https://evil.com')).status, 403);
});

test('סיסמה בפעם הראשונה, כניסה, ונעילה אחרי ניסיונות שגויים', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/status')).data.ready, false);
  assert.equal((await call(env, '/setup', { password: '123' })).status, 400);
  const { data } = await call(env, '/setup', { password: 'secret123' });
  assert.ok(data.token);
  assert.equal((await call(env, '/status')).data.ready, true);
  // אי אפשר לקבוע שוב
  assert.equal((await call(env, '/setup', { password: 'other123' })).status, 409);
  assert.equal((await call(env, '/sync', {})).status, 401);
  assert.equal((await call(env, '/sync', {}, 'wrong')).status, 401);
  assert.equal((await call(env, '/sync', {}, data.token)).status, 200);
  assert.ok((await call(env, '/login', { password: 'secret123' })).data.token);
  for (let i = 0; i < 10; i++) assert.equal((await call(env, '/login', { password: 'nope' })).status, 401);
  assert.equal((await call(env, '/login', { password: 'secret123' })).status, 429);
  env.time += 16 * 60 * 1000;
  assert.equal((await call(env, '/login', { password: 'secret123' })).status, 200);
});

test('סנכרון בין שני מכשירים: העריכה המאוחרת גוברת, מחיקה עוברת', async () => {
  const env = fakeEnv();
  const a = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const b = (await call(env, '/login', { password: 'secret123' })).data.token;
  const item = { id: 'i1', t: 'item', kind: 'expense', type: 'fixed', name: 'חשמל', amount: 400, start: '2026-10', updatedAt: 100 };
  let r = await call(env, '/sync', { since: 0, changes: [item] }, a);
  assert.equal(r.data.rev, 1);
  r = await call(env, '/sync', { since: 0, changes: [] }, b);
  assert.equal(r.data.changes.length, 1);
  assert.equal(r.data.changes[0].name, 'חשמל');
  // עריכה ישנה יותר לא דורסת
  await call(env, '/sync', { since: 1, changes: [{ ...item, amount: 1, updatedAt: 50 }] }, b);
  await call(env, '/sync', { since: 1, changes: [{ ...item, amount: 450, updatedAt: 200 }] }, b);
  r = await call(env, '/sync', { since: 1, changes: [] }, a);
  assert.equal(r.data.changes.length, 1);
  assert.equal(r.data.changes[0].amount, 450);
  await call(env, '/sync', { since: 2, changes: [{ ...item, deleted: true, updatedAt: 300 }] }, a);
  // אחרי הפעלה מחדש הכול נטען מהאחסון
  env.restart();
  r = await call(env, '/sync', { since: 2, changes: [] }, b);
  assert.equal(r.data.changes[0].deleted, true);
  // אין שינויים חדשים
  r = await call(env, '/sync', { since: r.data.rev, changes: [] }, b);
  assert.equal(r.data.changes.length, 0);
});

test('הרבה רשומות בבת אחת (שחזור מגיבוי)', async () => {
  const env = fakeEnv();
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const changes = Array.from({ length: 500 }, (_, i) => ({ id: `x${i}`, t: 'item', amount: i, updatedAt: 10 }));
  const r = await call(env, '/sync', { since: 0, changes }, t);
  assert.equal(r.data.changes.length, 500);
});

test('החלפת סיסמה מנתקת את שאר המכשירים', async () => {
  const env = fakeEnv();
  const a = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const b = (await call(env, '/login', { password: 'secret123' })).data.token;
  assert.equal((await call(env, '/password', { password: 'bad', newPassword: 'newpass1' }, a)).status, 401);
  const { data } = await call(env, '/password', { password: 'secret123', newPassword: 'newpass1' }, a);
  assert.equal((await call(env, '/sync', {}, b)).status, 401);
  assert.equal((await call(env, '/sync', {}, data.token)).status, 200);
  assert.equal((await call(env, '/login', { password: 'newpass1' })).status, 200);
});

test('רשומות פגומות לא נשמרות', () => {
  assert.equal(cleanRecord(null), null);
  assert.equal(cleanRecord({ id: 'a' }), null);
  assert.equal(cleanRecord({ id: 'a', updatedAt: 1, note: 'x'.repeat(13000) }), null);
  assert.deepEqual(cleanRecord({ id: 'a', updatedAt: 1, rev: 9 }), { id: 'a', updatedAt: 1 });
});

test('מחיקת כל הנתונים: צריך סיסמה, והמחיקה עוברת לשאר המכשירים', async () => {
  const env = fakeEnv();
  const a = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const b = (await call(env, '/login', { password: 'secret123' })).data.token;
  await call(env, '/sync', { since: 0, changes: [{ id: 'i1', t: 'item', name: 'חשמל', amount: 400, updatedAt: 100 }, { id: 'settings', t: 'settings', balance: 5, updatedAt: 100 }] }, a);
  const before = (await call(env, '/sync', { since: 0, changes: [] }, b)).data;
  assert.equal((await call(env, '/reset', { password: 'wrong' }, a)).status, 401);
  assert.equal((await call(env, '/reset', { password: 'secret123' }, '')).status, 401);
  assert.equal((await call(env, '/reset', { password: 'secret123' }, a)).status, 200);
  const after = (await call(env, '/sync', { since: before.rev, changes: [] }, b)).data;
  assert.equal(after.changes.length, 2);
  assert.ok(after.changes.every((r) => r.deleted && !r.name && !r.amount));
});

test('AI: שאלה עם סיכום התקציב, ומגבלה ליום', async () => {
  const seen = [];
  const AI_CLIENT = {
    beta: {
      messages: {
        create: async (req) => {
          seen.push(req);
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: '## תובנות\n- אפשר לחסוך בביטוחים' }] };
        },
      },
    },
  };
  const env = fakeEnv({ AI_CLIENT });
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  assert.equal((await call(env, '/ai', { context: 'x', question: '' }, t)).status, 400);
  const r = await call(env, '/ai', { context: 'הכנסות 20000', question: 'איפה לחסוך?' }, t);
  assert.equal(r.status, 200);
  assert.match(r.data.answer, /ביטוחים/);
  assert.match(seen[0].messages[0].content, /הכנסות 20000/);
  assert.equal(seen[0].model, 'claude-opus-5-5');
  for (let i = 0; i < 39; i++) await call(env, '/ai', { question: 'שוב' }, t);
  assert.equal((await call(env, '/ai', { question: 'שוב' }, t)).status, 429);
  // יום חדש
  env.time += 24 * 60 * 60 * 1000;
  assert.equal((await call(env, '/ai', { question: 'שוב' }, t)).status, 200);
});

test('AI בלי מפתח – הודעה ברורה', async () => {
  const env = fakeEnv();
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  assert.equal((await call(env, '/ai', { question: 'שאלה' }, t)).status, 503);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Diary, originAllowed } from './worker.js';
import { cleanRecord } from './diary.js';
import { buildMessages } from './ai.js';

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
    alarm: null,
    async getAlarm() {
      return this.alarm;
    },
    async setAlarm(t) {
      this.alarm = t;
    },
    async list({ prefix }) {
      return new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)]));
    },
  };
}

const ORIGIN = 'https://yoman-sukar.pages.dev';

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`, time: 1_800_000_000_000 };
  const storage = fakeStorage();
  let obj = null;
  env.DIARY = {
    idFromName: (n) => n,
    get: () => ({ fetch: (req) => (obj ||= new Diary({ storage }, { NOW: () => env.time, ...extra })).fetch(req) }),
  };
  env.storageRef = () => storage;
  env.alarmAt = () => storage.alarm;
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
  assert.ok(originAllowed('https://abc.yoman-sukar.pages.dev', 'https://*.yoman-sukar.pages.dev'));
  assert.ok(!originAllowed('https://evil.com', 'https://*.yoman-sukar.pages.dev'));
});

test('אתר זר לא יכול לפנות לשרת', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/sync', {}, '', 'https://evil.com')).status, 403);
  assert.equal((await call(env, '/sync', {}, '', '')).status, 403);
});

test('בלי סיסמה: כל מי שפותח את האפליקציה רואה את היומן, ואין דרכים ישנות', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/sync', {})).status, 200);
  for (const p of ['/status', '/setup', '/login', '/password', '/reset', '/logout']) assert.equal((await call(env, p, { password: 'x' })).status, 404);
});

test('סנכרון בין שני מכשירים: העריכה המאוחרת גוברת, מחיקה עוברת', async () => {
  const env = fakeEnv();
  const a = '';
  const b = '';
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
  const t = '';
  const changes = Array.from({ length: 500 }, (_, i) => ({ id: `x${i}`, t: 'item', amount: i, updatedAt: 10 }));
  const r = await call(env, '/sync', { since: 0, changes }, t);
  assert.equal(r.data.changes.length, 500);
});

test('רשומות פגומות לא נשמרות', () => {
  assert.equal(cleanRecord(null), null);
  assert.equal(cleanRecord({ id: 'a' }), null);
  assert.equal(cleanRecord({ id: 'a', updatedAt: 1, note: 'x'.repeat(13000) }), null);
  assert.deepEqual(cleanRecord({ id: 'a', updatedAt: 1, rev: 9 }), { id: 'a', updatedAt: 1 });
});

test('AI: שאלה עם סיכום היומן וההודעות הקודמות, ומגבלה ליום', async () => {
  const seen = [];
  const AI_CLIENT = {
    beta: {
      messages: {
        create: async (req) => {
          seen.push(req);
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: '## צהריים\n- ב-3 ארוחות עלה מעל 250' }] };
        },
      },
    },
  };
  const env = fakeEnv({ AI_CLIENT });
  const t = '';
  assert.equal((await call(env, '/ai', { context: 'x', question: '' }, t)).status, 400);
  const history = [{ role: 'assistant', text: 'שלום' }, { role: 'user', text: 'מה קרה אתמול?' }, { role: 'assistant', text: 'עלה ל-250' }];
  const r = await call(env, '/ai', { context: 'צהריים 2 מנות', history, question: 'איפה לחסוך?' }, t);
  assert.equal(r.status, 200);
  assert.match(r.data.answer, /צהריים/);
  // השיחה מתחילה תמיד במשתמש, והנתונים העדכניים בהודעה האחרונה
  assert.deepEqual(seen[0].messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.match(seen[0].messages[2].content, /צהריים 2 מנות/);
  assert.equal(seen[0].model, 'claude-opus-5-5');
  for (let i = 0; i < 59; i++) await call(env, '/ai', { question: 'שוב' }, t);
  assert.equal((await call(env, '/ai', { question: 'שוב' }, t)).status, 429);
  // יום חדש
  env.time += 24 * 60 * 60 * 1000;
  assert.equal((await call(env, '/ai', { question: 'שוב' }, t)).status, 200);
});

test('AI בלי מפתח – הודעה ברורה', async () => {
  const env = fakeEnv();
  const t = '';
  assert.equal((await call(env, '/ai', { question: 'שאלה' }, t)).status, 503);
});

test('בניית השיחה ל-AI: הודעות רצופות מאותו צד מתאחדות', () => {
  const m = buildMessages('נתונים', [{ role: 'user', text: 'א' }, { role: 'user', text: 'ב' }], 'ג');
  assert.equal(m.length, 1);
  assert.match(m[0].content, /א\n\nב/);
  assert.match(m[0].content, /נתונים[\s\S]*ג$/);
});

test('תזכורת שבועית: יום ראשון 9:30 שעון ישראל (קיץ וחורף)', async () => {
  const { nextWeekly } = await import('./diary.js');
  // חמישי 5.11.2026 (חורף, UTC+2) → ראשון 8.11 9:30 = 07:30 UTC
  assert.equal(new Date(nextWeekly(Date.UTC(2026, 10, 5, 12))).toISOString(), '2026-11-08T07:30:00.000Z');
  // ראשון 8.11 בדיוק אחרי 9:30 → השבוע הבא
  assert.equal(new Date(nextWeekly(Date.UTC(2026, 10, 8, 7, 31))).toISOString(), '2026-11-15T07:30:00.000Z');
  // ראשון 8.11 לפני 9:30 → היום
  assert.equal(new Date(nextWeekly(Date.UTC(2026, 10, 8, 6))).toISOString(), '2026-11-08T07:30:00.000Z');
  // קיץ (UTC+3): ראשון 5.7.2026 9:30 = 06:30 UTC
  assert.equal(new Date(nextWeekly(Date.UTC(2026, 6, 1, 12))).toISOString(), '2026-07-05T06:30:00.000Z');
});

test('התראות: הרשמה, ההתראה השבועית נשלחת, ומכשיר שבוטל נמחק', async () => {
  const sent = [];
  const PUSH_FETCH = async (url) => {
    sent.push(url);
    return new Response(null, { status: url.includes('gone') ? 410 : 201 });
  };
  const env = fakeEnv({ PUSH_FETCH });
  const { publicKey } = (await call(env, '/push/key')).data;
  assert.ok(publicKey.length > 40);
  // מפתחות מכשיר אמיתיים (נוצרים כאן) כדי שההצפנה תעבוד
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const p256dh = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
  const auth = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
  assert.equal((await call(env, '/push/subscribe', { sub: { endpoint: 'https://evil.com/x', keys: { p256dh, auth } } })).status, 400);
  assert.equal((await call(env, '/push/subscribe', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/a', keys: { p256dh, auth } } })).status, 200);
  assert.equal((await call(env, '/push/subscribe', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/gone', keys: { p256dh, auth } } })).status, 200);
  assert.equal((await call(env, '/push/test')).data.sent, 1);
  // התזכורת השבועית
  const obj = new Diary({ storage: env.storageRef() }, { NOW: () => env.time, PUSH_FETCH });
  sent.length = 0;
  await obj.alarm();
  assert.deepEqual(sent, ['https://fcm.googleapis.com/fcm/send/a']);
  assert.ok(env.alarmAt() > env.time);
});

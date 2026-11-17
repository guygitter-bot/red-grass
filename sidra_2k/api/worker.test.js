import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Series, originAllowed } from './worker.js';
import { cleanGame, cleanName, over } from './series.js';

// זיכרון מדומה במקום האחסון של Durable Object
function fakeEnv() {
  const map = new Map();
  const storage = {
    async get(k) {
      return structuredClone(map.get(k));
    },
    async put(k, v) {
      map.set(k, structuredClone(v));
    },
  };
  let obj = null;
  return {
    ALLOWED_ORIGINS: 'https://sidra-2k.pages.dev,https://*.sidra-2k.pages.dev',
    SERIES: { idFromName: (n) => n, get: () => ({ fetch: (req) => (obj ||= new Series({ storage }, { NOW: () => 1000 })).fetch(req) }) },
    restart: () => {
      obj = null;
    },
  };
}

const ORIGIN = 'https://sidra-2k.pages.dev';
async function call(env, path, body = {}, origin = ORIGIN, token = env.token) {
  const headers = { origin, 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await worker.fetch(new Request(`https://api${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), env);
  return { status: res.status, data: await res.json() };
}

// סביבה עם מאסטר מחובר (סיסמה נקבעה)
async function masterEnv() {
  const env = fakeEnv();
  const { data } = await call(env, '/setup', { password: '1234' });
  env.token = data.token;
  return env;
}

test('סדרה ריקה בהתחלה', async () => {
  const { data } = await call(fakeEnv(), '/get');
  assert.deepEqual(data.games, []);
  assert.deepEqual(data.players, { LAL: '', SAS: '' });
});

test('רישום משחקים לפי הסדר, ומשחק כפול לא נרשם פעמיים', async () => {
  const env = await masterEnv();
  await call(env, '/game', { n: 0, winner: 'LAL', lal: 102, sas: 98 });
  let { data } = await call(env, '/game', { n: 0, winner: 'SAS' }); // מכשיר שני לחץ על אותו משחק
  assert.equal(data.games.length, 1);
  ({ data } = await call(env, '/game', { n: 1, winner: 'SAS', lal: 'x' }));
  assert.equal(data.games.length, 2);
  assert.equal(data.games[0].lal, 102);
  assert.equal(data.games[1].lal, null);
  env.restart();
  ({ data } = await call(env, '/get'));
  assert.equal(data.games.length, 2, 'נשמר גם אחרי הפעלה מחדש');
});

test('אחרי 4 ניצחונות הסדרה נגמרת', async () => {
  const env = await masterEnv();
  for (let n = 0; n < 4; n++) await call(env, '/game', { n, winner: 'SAS' });
  const { data } = await call(env, '/game', { n: 4, winner: 'LAL' });
  assert.equal(data.games.length, 4);
  assert.ok(over(data.games));
});

test('ביטול המשחק האחרון רק כשהמספר תואם', async () => {
  const env = await masterEnv();
  await call(env, '/game', { n: 0, winner: 'LAL' });
  await call(env, '/game', { n: 1, winner: 'LAL' });
  let { data } = await call(env, '/undo', { n: 1 });
  assert.equal(data.games.length, 2);
  ({ data } = await call(env, '/undo', { n: 2 }));
  assert.equal(data.games.length, 1);
});

test('שמות שחקנים וסדרה חדשה', async () => {
  const env = await masterEnv();
  let r = await call(env, '/players', { LAL: 'אבא', SAS: '' });
  assert.equal(r.status, 400);
  r = await call(env, '/players', { LAL: ' אבא ', SAS: 'הבן' });
  assert.deepEqual(r.data.players, { LAL: 'אבא', SAS: 'הבן' });
  await call(env, '/game', { n: 0, winner: 'LAL' });
  r = await call(env, '/reset');
  assert.equal(r.data.games.length, 0);
  assert.equal(r.data.players.LAL, 'אבא');
});

test('רק המאסטר משנה; כולם רואים', async () => {
  const env = fakeEnv();
  let r = await call(env, '/game', { n: 0, winner: 'LAL' });
  assert.equal(r.status, 403, 'לפני שנקבעה סיסמה אי אפשר לשנות');
  r = await call(env, '/setup', { password: '12' });
  assert.equal(r.status, 400);
  r = await call(env, '/setup', { password: 'abcd' });
  assert.ok(r.data.token);
  assert.equal(r.data.master, true);
  const token = r.data.token;
  assert.equal((await call(env, '/setup', { password: 'other' })).status, 409, 'אי אפשר לקבוע סיסמה פעמיים');
  await call(env, '/game', { n: 0, winner: 'SAS' }, ORIGIN, token);
  // צופה (בלי סוד, או עם סוד מזויף)
  r = await call(env, '/get');
  assert.equal(r.data.games.length, 1);
  assert.equal(r.data.master, false);
  assert.equal(r.data.locked, true);
  assert.equal(JSON.stringify(r.data).includes('salt'), false, 'הסיסמה לא נשלחת');
  for (const path of ['/game', '/undo', '/players', '/reset']) {
    assert.equal((await call(env, path, { n: 1, winner: 'LAL', LAL: 'a', SAS: 'b' }, ORIGIN, 'fake')).status, 403, path);
  }
  // כניסה ממכשיר אחר
  assert.equal((await call(env, '/login', { password: 'nope' })).status, 401);
  r = await call(env, '/login', { password: 'abcd' });
  assert.equal(r.data.master, true);
  env.restart();
  assert.equal((await call(env, '/get', {}, ORIGIN, r.data.token)).data.master, true, 'נשאר מחובר גם אחרי הפעלה מחדש');
  await call(env, '/logout', {}, ORIGIN, r.data.token);
  assert.equal((await call(env, '/get', {}, ORIGIN, r.data.token)).data.master, false);
});

test('נעילה אחרי 10 ניסיונות שגויים', async () => {
  const env = await masterEnv();
  for (let i = 0; i < 10; i++) await call(env, '/login', { password: 'bad' });
  assert.equal((await call(env, '/login', { password: '1234' })).status, 429);
});

test('אתר זר נחסם', async () => {
  const r = await call(fakeEnv(), '/reset', {}, 'https://evil.example');
  assert.equal(r.status, 403);
  assert.ok(originAllowed('https://abc123.sidra-2k.pages.dev', 'https://*.sidra-2k.pages.dev'));
});

test('ניקוי נתונים', () => {
  assert.equal(cleanGame({ winner: 'BOS' }), null);
  assert.equal(cleanGame({ winner: 'LAL', sas: 999 }).sas, null);
  assert.equal(cleanName('x'.repeat(50)).length, 20);
});

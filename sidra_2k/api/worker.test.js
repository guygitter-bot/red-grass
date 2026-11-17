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
async function call(env, path, body = {}, origin = ORIGIN) {
  const res = await worker.fetch(new Request(`https://api${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
  return { status: res.status, data: await res.json() };
}

test('סדרה ריקה בהתחלה', async () => {
  const { data } = await call(fakeEnv(), '/get');
  assert.deepEqual(data.games, []);
  assert.deepEqual(data.players, { LAL: '', SAS: '' });
});

test('רישום משחקים לפי הסדר, ומשחק כפול לא נרשם פעמיים', async () => {
  const env = fakeEnv();
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
  const env = fakeEnv();
  for (let n = 0; n < 4; n++) await call(env, '/game', { n, winner: 'SAS' });
  const { data } = await call(env, '/game', { n: 4, winner: 'LAL' });
  assert.equal(data.games.length, 4);
  assert.ok(over(data.games));
});

test('ביטול המשחק האחרון רק כשהמספר תואם', async () => {
  const env = fakeEnv();
  await call(env, '/game', { n: 0, winner: 'LAL' });
  await call(env, '/game', { n: 1, winner: 'LAL' });
  let { data } = await call(env, '/undo', { n: 1 });
  assert.equal(data.games.length, 2);
  ({ data } = await call(env, '/undo', { n: 2 }));
  assert.equal(data.games.length, 1);
});

test('שמות שחקנים וסדרה חדשה', async () => {
  const env = fakeEnv();
  let r = await call(env, '/players', { LAL: 'אבא', SAS: '' });
  assert.equal(r.status, 400);
  r = await call(env, '/players', { LAL: ' אבא ', SAS: 'הבן' });
  assert.deepEqual(r.data.players, { LAL: 'אבא', SAS: 'הבן' });
  await call(env, '/game', { n: 0, winner: 'LAL' });
  r = await call(env, '/reset');
  assert.equal(r.data.games.length, 0);
  assert.equal(r.data.players.LAL, 'אבא');
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

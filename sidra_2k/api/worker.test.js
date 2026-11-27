import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Series, originAllowed } from './worker.js';
import { PREVIOUS_WINNER, TEAM_CODES, cleanGame, cleanName, over } from './series.js';

// זיכרון מדומה במקום האחסון של Durable Object (אפשר להתחיל עם נתונים קיימים)
function fakeEnv(seed = {}) {
  const map = new Map(Object.entries(seed));
  const storage = {
    map,
    async get(k) {
      return structuredClone(map.get(k));
    },
    async put(k, v) {
      map.set(k, structuredClone(v));
    },
  };
  let obj = null;
  return {
    storage,
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
async function masterEnv(seed) {
  const env = fakeEnv(seed);
  const { data } = await call(env, '/setup', { password: '1234' });
  env.token = data.token;
  return env;
}

test('מעבר מהגרסה הראשונה: הסדרה הישנה להיסטוריה, וסדרה חדשה קינגס נגד לייקרס', async () => {
  const v1 = {
    players: { LAL: 'אבא', SAS: 'בן' },
    games: [
      { winner: 'LAL', lal: 102, sas: 98 },
      { winner: 'SAS', lal: null, sas: null },
      { winner: 'SAS' },
      { winner: 'SAS' },
      { winner: 'SAS' },
    ],
    rev: 5,
  };
  const env = fakeEnv({ series: v1 });
  let r = await call(env, '/setup', { password: '1234' });
  env.token = r.data.token;
  const { data } = await call(env, '/get');
  assert.deepEqual(data.teams, ['SAC', 'LAL']);
  assert.equal(data.era, 'שנות ה-2000');
  assert.equal(data.games.length, 0);
  assert.equal(data.history.length, 1);
  const h = data.history[0];
  assert.deepEqual(h.teams, ['LAL', 'SAS']);
  assert.equal(h.era, '2010');
  assert.equal(h.winner, 'SAS');
  assert.equal(h.winnerName, PREVIOUS_WINNER);
  assert.deepEqual(h.score, { LAL: 1, SAS: 4 });
  assert.equal(data.master, true);
  // לא רץ שוב
  env.restart();
  r = await call(env, '/get');
  assert.equal(r.data.history.length, 1);
  assert.equal(r.data.master, true);
});

test('מעבר כשהסדרה הישנה לא נרשמה עד הסוף – עדיין נרשם המנצח שהמשתמש ציין', async () => {
  const env = fakeEnv({ series: { players: { LAL: 'a', SAS: 'b' }, games: [{ winner: 'LAL' }], rev: 1 } });
  const { data } = await call(env, '/get');
  assert.equal(data.history[0].winnerName, PREVIOUS_WINNER);
  assert.equal(data.history[0].score, null);
});

test('רישום משחקים לפי הסדר, ומשחק כפול לא נרשם פעמיים', async () => {
  const env = await masterEnv();
  await call(env, '/game', { n: 0, winner: 'SAC', pts: { SAC: 102, LAL: 98 } });
  let { data } = await call(env, '/game', { n: 0, winner: 'LAL' }); // מכשיר שני לחץ על אותו משחק
  assert.equal(data.games.length, 1);
  ({ data } = await call(env, '/game', { n: 1, winner: 'LAL', pts: { SAC: 'x' } }));
  assert.equal(data.games.length, 2);
  assert.deepEqual(data.games[0].pts, { SAC: 102, LAL: 98 });
  assert.equal(data.games[1].pts.SAC, null);
  assert.equal((await call(env, '/game', { n: 2, winner: 'SAS' })).data.games.length, 2, 'קבוצה שלא בסדרה');
  env.restart();
  ({ data } = await call(env, '/get'));
  assert.equal(data.games.length, 2, 'נשמר גם אחרי הפעלה מחדש');
});

test('אחרי 4 ניצחונות הסדרה נגמרת', async () => {
  const env = await masterEnv();
  for (let n = 0; n < 4; n++) await call(env, '/game', { n, winner: 'LAL' });
  const { data } = await call(env, '/game', { n: 4, winner: 'SAC' });
  assert.equal(data.games.length, 4);
  assert.ok(over(data));
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

test('שמות שחקנים, יתרון ביתיות רק לפני משחק 1, ואיפוס', async () => {
  const env = await masterEnv();
  let r = await call(env, '/players', { players: { SAC: 'אבא', LAL: '' } });
  assert.equal(r.status, 400);
  r = await call(env, '/players', { players: { SAC: ' אבא ', LAL: 'בן' }, home: 'LAL' });
  assert.deepEqual(r.data.players, { SAC: 'אבא', LAL: 'בן' });
  assert.deepEqual(r.data.teams, ['LAL', 'SAC']);
  await call(env, '/game', { n: 0, winner: 'LAL' });
  r = await call(env, '/players', { players: { SAC: 'אבא', LAL: 'בן' }, home: 'SAC' });
  assert.deepEqual(r.data.teams, ['LAL', 'SAC'], 'אחרי משחק 1 לא משנים');
  r = await call(env, '/reset');
  assert.equal(r.data.games.length, 0);
  assert.equal(r.data.players.LAL, 'בן');
});

test('סדרה חדשה: סדרה שהוכרעה עוברת להיסטוריה', async () => {
  const env = await masterEnv();
  await call(env, '/players', { players: { SAC: 'אבא', LAL: 'בן' } });
  assert.equal((await call(env, '/new', { teams: ['LAL', 'LAL'] })).status, 400);
  assert.equal((await call(env, '/new', { teams: ['LAL', 'BOS'] })).status, 400);
  for (let n = 0; n < 4; n++) await call(env, '/game', { n, winner: 'SAC' });
  const { data } = await call(env, '/new', { teams: ['SAS', 'LAL'], era: '2014', players: { SAS: 'בן', LAL: 'אבא' } });
  assert.deepEqual(data.teams, ['SAS', 'LAL']);
  assert.equal(data.era, '2014');
  assert.equal(data.games.length, 0);
  assert.equal(data.history.length, 2);
  assert.equal(data.history[1].winnerName, 'אבא');
  assert.deepEqual(data.history[1].score, { SAC: 4, LAL: 0 });
  // סדרה שלא הוכרעה – לא נכנסת להיסטוריה
  const r = await call(env, '/new', { teams: ['SAC', 'LAL'], era: 'x' });
  assert.equal(r.data.history.length, 2);
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
  await call(env, '/game', { n: 0, winner: 'SAC' }, ORIGIN, token);
  // צופה (בלי סוד, או עם סוד מזויף)
  r = await call(env, '/get');
  assert.equal(r.data.games.length, 1);
  assert.equal(r.data.master, false);
  assert.equal(r.data.locked, true);
  assert.equal(JSON.stringify(r.data).includes('salt'), false, 'הסיסמה לא נשלחת');
  for (const path of ['/game', '/undo', '/players', '/new', '/reset']) {
    assert.equal((await call(env, path, { n: 1, winner: 'LAL', teams: ['SAS', 'LAL'], players: { SAC: 'a', LAL: 'b' } }, ORIGIN, 'fake')).status, 403, path);
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
  assert.equal(cleanGame({ winner: 'BOS' }, ['SAC', 'LAL']), null);
  assert.equal(cleanGame({ winner: 'LAL', pts: { SAC: 999 } }, ['SAC', 'LAL']).pts.SAC, null);
  assert.equal(cleanGame({ winner: 'LAL', lal: 90, sas: 80 }, ['LAL', 'SAS']).pts.SAS, 80, 'הצורה הישנה');
  assert.equal(cleanName('x'.repeat(50)).length, 20);
});

test('רשימת הקבוצות זהה בשרת ובאפליקציה', async () => {
  const { TEAM } = await import('../web/src/lib/series.js');
  assert.deepEqual(Object.keys(TEAM).sort(), [...TEAM_CODES].sort());
});

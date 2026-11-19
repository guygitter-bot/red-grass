import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Tracker, originAllowed, LOCK_AFTER, MAX_KIDS } from './worker.js';
import { summarize, cleanRound } from './stats.js';

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
  };
}

function fakeEnv() {
  const env = { ALLOWED_ORIGINS: 'https://cheshbon-dalet.pages.dev,https://cheshbon-admin-*.pages.dev', time: 1_000_000_000 };
  const tracker = new Tracker({ storage: fakeStorage() }, { NOW: () => env.time });
  env.TRACKER = { idFromName: (n) => n, get: () => ({ fetch: (req) => tracker.fetch(req) }) };
  return env;
}

async function call(env, path, body, origin = 'https://cheshbon-dalet.pages.dev') {
  const res = await worker.fetch(new Request(`https://cheshbon-api.test${path}`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json(), cors: res.headers.get('access-control-allow-origin') };
}

const kid = { id: 'abcdefgh1234', name: 'נועם' };

test('סיבוב נשמר ומופיע בניהול רק עם סיסמה', async () => {
  const env = fakeEnv();
  const r = await call(env, '/round', { kid, round: { mode: 'ops', correct: 7, total: 10, wrong: ['7 × 8', '47 : 5'], at: env.time } });
  assert.equal(r.status, 200);
  assert.equal(r.cors, 'https://cheshbon-dalet.pages.dev');
  await call(env, '/round', { kid, round: { mode: 'ops', correct: 9, total: 10, wrong: ['7 × 8'], at: env.time + 1 } });

  assert.equal((await call(env, '/admin/overview', {})).status, 401);
  assert.equal((await call(env, '/admin/status', {})).data.hasPassword, false);
  assert.equal((await call(env, '/admin/setup', { password: '123' })).status, 400);
  const { data } = await call(env, '/admin/setup', { password: 'secret12' });
  assert.ok(data.token);
  assert.equal((await call(env, '/admin/setup', { password: 'other123' })).status, 409);

  const o = await call(env, '/admin/overview', { token: data.token });
  assert.equal(o.status, 200);
  const k = o.data.kids[0];
  assert.equal(k.name, 'נועם');
  assert.equal(k.summary.ops.attempts, 2);
  assert.equal(k.summary.ops.passed, true);
  assert.equal(k.summary.ops.attemptsToPass, 2);
  assert.deepEqual(k.summary.ops.missed[0], { q: '7 × 8', times: 2 });
  assert.equal(k.summary.area.attempts, 0);
});

test('כניסה עם סיסמה, ונעילה אחרי הרבה ניסיונות שגויים', async () => {
  const env = fakeEnv();
  await call(env, '/admin/setup', { password: 'secret12' });
  assert.equal((await call(env, '/admin/login', { password: 'nope' })).status, 401);
  const ok = await call(env, '/admin/login', { password: 'secret12' });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token);
  for (let i = 0; i < LOCK_AFTER; i++) await call(env, '/admin/login', { password: 'bad' });
  assert.equal((await call(env, '/admin/login', { password: 'secret12' })).status, 429);
  env.time += 16 * 60 * 1000;
  assert.equal((await call(env, '/admin/login', { password: 'secret12' })).status, 200);
});

test('מחיקת ילד', async () => {
  const env = fakeEnv();
  await call(env, '/round', { kid, round: { mode: 'ops', correct: 1, total: 2 } });
  const { data } = await call(env, '/admin/setup', { password: 'secret12' });
  assert.equal((await call(env, '/admin/delete', { token: data.token, id: kid.id })).status, 200);
  assert.equal((await call(env, '/admin/overview', { token: data.token })).data.kids.length, 0);
});

test('נתונים לא תקינים לא נשמרים', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/round', { kid: { id: 'x' }, round: {} })).status, 400);
  const r = await call(env, '/round', { kid, rounds: [{ mode: 'hack', correct: 1, total: 2 }, { mode: 'ops', correct: 5, total: 2 }] });
  assert.equal(r.data.saved, 0);
  for (let i = 0; i < MAX_KIDS - 1; i++) await call(env, '/round', { kid: { id: `kidkid${String(i).padStart(4, '0')}` } });
  assert.equal((await call(env, '/round', { kid: { id: 'overflow1234' } })).status, 429);
});

test('אתרים מורשים בלבד', () => {
  assert.ok(originAllowed('https://cheshbon-admin-x1.pages.dev', 'https://cheshbon-admin-*.pages.dev'));
  assert.ok(!originAllowed('https://evil.com', 'https://cheshbon-admin-*.pages.dev'));
});

test('סיכום: עד שעבר 80%', () => {
  const s = summarize([
    { mode: 'ops', percent: 50, at: 1 }, { mode: 'ops', percent: 70, at: 2 },
    { mode: 'ops', percent: 85, at: 3 }, { mode: 'ops', percent: 60, at: 4 },
  ]);
  assert.equal(s.ops.attemptsToPass, 3);
  assert.equal(s.ops.best, 85);
  assert.equal(s.ops.average, 66);
  assert.equal(s.ops.last, 60);
  assert.equal(cleanRound({ mode: 'ops', correct: 8, total: 10 }, 5).percent, 80);
  assert.equal(cleanRound({ mode: 'exam', correct: 16, total: 20 }, 5).mode, 'exam');
  assert.equal(cleanRound({ mode: 'hack', correct: 1, total: 2 }, 5), null);
});

test('מבחן מסכם: תוצאות לפי נושא נשמרות ומסוננות', () => {
  const r = cleanRound({ mode: 'exam', correct: 15, total: 20, sections: { area: [0, 2], ops: [2, 2], bad: [1, 1], chart: [3, 2], angles: 'x' } }, 5);
  assert.deepEqual(r.sections, { area: [0, 2], ops: [2, 2] });
  const s = summarize([r, { ...r, at: 6 }]);
  assert.deepEqual(s.exam.sections.area, { correct: 0, total: 4 });
  assert.equal(cleanRound({ mode: 'ops', correct: 1, total: 2, sections: { area: [0, 1] } }, 5).sections, undefined);
});

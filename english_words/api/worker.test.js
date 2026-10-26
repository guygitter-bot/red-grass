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
  const env = { ALLOWED_ORIGINS: 'https://milim-beanglit.pages.dev,https://milim-admin-*.pages.dev', time: 1_000_000_000 };
  const tracker = new Tracker({ storage: fakeStorage() }, { NOW: () => env.time });
  env.TRACKER = { idFromName: (n) => n, get: () => ({ fetch: (req) => tracker.fetch(req) }) };
  return env;
}

async function call(env, path, body, origin = 'https://milim-beanglit.pages.dev') {
  const res = await worker.fetch(new Request(`https://milim-api.test${path}`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json(), cors: res.headers.get('access-control-allow-origin') };
}

const kid = { id: 'abcdefgh1234', name: 'נועם' };

test('סיבוב נשמר ומופיע בניהול רק עם סיסמה', async () => {
  const env = fakeEnv();
  const r = await call(env, '/round', { kid, round: { mode: 'words', correct: 27, total: 35, wrong: ['cat', 'dog'], at: env.time } });
  assert.equal(r.status, 200);
  assert.equal(r.cors, 'https://milim-beanglit.pages.dev');
  await call(env, '/round', { kid, round: { mode: 'words', correct: 30, total: 35, wrong: ['cat'], at: env.time + 1 } });

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
  assert.equal(k.summary.words.attempts, 2);
  assert.equal(k.summary.words.passed, true);
  assert.equal(k.summary.words.attemptsToPass, 2);
  assert.deepEqual(k.summary.words.missed[0], { en: 'cat', times: 2 });
  assert.equal(k.summary.sentences.attempts, 0);
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
  await call(env, '/round', { kid, round: { mode: 'words', correct: 1, total: 2 } });
  const { data } = await call(env, '/admin/setup', { password: 'secret12' });
  assert.equal((await call(env, '/admin/delete', { token: data.token, id: kid.id })).status, 200);
  assert.equal((await call(env, '/admin/overview', { token: data.token })).data.kids.length, 0);
});

test('נתונים לא תקינים לא נשמרים', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/round', { kid: { id: 'x' }, round: {} })).status, 400);
  const r = await call(env, '/round', { kid, rounds: [{ mode: 'hack', correct: 1, total: 2 }, { mode: 'words', correct: 5, total: 2 }] });
  assert.equal(r.data.saved, 0);
  for (let i = 0; i < MAX_KIDS - 1; i++) await call(env, '/round', { kid: { id: `kidkid${String(i).padStart(4, '0')}` } });
  assert.equal((await call(env, '/round', { kid: { id: 'overflow1234' } })).status, 429);
});

test('אתרים מורשים בלבד', () => {
  assert.ok(originAllowed('https://milim-admin-x1.pages.dev', 'https://milim-admin-*.pages.dev'));
  assert.ok(!originAllowed('https://evil.com', 'https://milim-admin-*.pages.dev'));
});

test('סיכום: עד שעבר 80%', () => {
  const s = summarize([
    { mode: 'words', percent: 50, at: 1 }, { mode: 'words', percent: 70, at: 2 },
    { mode: 'words', percent: 85, at: 3 }, { mode: 'words', percent: 60, at: 4 },
  ]);
  assert.equal(s.words.attemptsToPass, 3);
  assert.equal(s.words.best, 85);
  assert.equal(s.words.average, 66);
  assert.equal(s.words.last, 60);
  assert.equal(cleanRound({ mode: 'words', correct: 28, total: 35 }, 5).percent, 80);
  assert.equal(cleanRound({ mode: 'exam', correct: 30, total: 32 }, 5).mode, 'exam');
  assert.equal(cleanRound({ mode: 'hack', correct: 1, total: 2 }, 5), null);
});

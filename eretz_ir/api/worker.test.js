import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Room, CODE_RE, originAllowed } from './worker.js';
import { normalize, startsWithLetter, scoreRound, pickLetter, LETTERS } from './game.js';
import { GRACE_MS, COUNTDOWN_MS, MAX_PLAYERS } from './room.js';

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async deleteAll() { map.clear(); },
    async getAlarm() { return alarm; },
    async setAlarm(t) { alarm = t; },
  };
}

// סביבה מדומה: שעון שאפשר להזיז, ואות קבועה (הראשונה שעוד לא הייתה)
function fakeEnv() {
  const env = { ALLOWED_ORIGINS: 'https://eretz-ir.pages.dev,https://eretz-ir-*.pages.dev', time: 1_000_000, rooms: new Map() };
  const roomEnv = { NOW: () => env.time, RANDOM: () => 0 };
  env.ROOMS = {
    idFromName: (n) => n,
    get: (id) => {
      if (!env.rooms.has(id)) env.rooms.set(id, new Room({ storage: fakeStorage() }, roomEnv));
      const room = env.rooms.get(id);
      return { fetch: (req) => room.fetch(req) };
    },
  };
  return env;
}

async function call(env, path, body, origin = 'https://eretz-ir.pages.dev') {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data: await res.json() };
}

const player = (n, extra = {}) => ({ id: `player-${n}-aaaa`, token: `token-${n}-0123456789abcdef`, name: `שחקן ${n}`, photo: '', ...extra });
const auth = (code, n) => ({ code, playerId: player(n).id, token: player(n).token });

async function gameWith(env, count) {
  const created = await call(env, '/create', { player: player(1) });
  const code = created.data.code;
  for (let n = 2; n <= count; n++) await call(env, '/join', { code, player: player(n) });
  return code;
}

test('normalize and the letter check', () => {
  assert.equal(normalize('  תֵּל-אָבִיב '), 'תל אביב');
  assert.equal(normalize('תל אביב'), normalize('תל־אביב'));
  assert.ok(startsWithLetter('ישראל', 'י'));
  assert.ok(!startsWithLetter('ירדן', 'א'));
  assert.ok(!startsWithLetter('', 'א'));
  assert.ok(startsWithLetter("ג'ירפה", 'ג'));
});

test('scoring: 10 for a unique answer, 5 each for a shared one, 0 for wrong/empty', () => {
  const round = {
    letter: 'ב',
    answers: {
      a: { country: 'ברזיל', city: 'באר שבע', animal: 'ברווז' },
      b: { country: 'ברזיל', city: 'חיפה', animal: 'בָּרווז ' },
      c: { country: 'בלגיה', city: '' },
    },
    votes: {},
  };
  const { rows, totals } = scoreRound(round, ['a', 'b', 'c']);
  assert.equal(rows.country.a.points, 5);
  assert.equal(rows.country.b.points, 5);
  assert.equal(rows.country.c.points, 10);
  assert.equal(rows.city.a.points, 10);
  assert.equal(rows.city.b.reason, 'letter');
  assert.equal(rows.city.c.reason, 'empty');
  assert.equal(rows.animal.a.points, 5); // ניקוד ורווח לא משנים
  assert.deepEqual(totals, { a: 20, b: 10, c: 10 });
});

test('an answer is struck out when more than half of the others vote against it', () => {
  const round = { letter: 'ב', answers: { a: { animal: 'בננה' }, b: {}, c: {} }, votes: { 'animal|a': ['b'] } };
  assert.equal(scoreRound(round, ['a', 'b', 'c']).rows.animal.a.points, 10); // 1 מתוך 2 – לא מספיק
  round.votes['animal|a'] = ['b', 'c'];
  assert.equal(scoreRound(round, ['a', 'b', 'c']).rows.animal.a.reason, 'voted');
  // שני שחקנים: הקול של השני מספיק. ההצבעה של השחקן על עצמו לא נספרת
  const two = { letter: 'ב', answers: { a: { animal: 'בננה' } }, votes: { 'animal|a': ['a'] } };
  assert.equal(scoreRound(two, ['a', 'b']).rows.animal.a.points, 10);
  two.votes['animal|a'] = ['b'];
  assert.equal(scoreRound(two, ['a', 'b']).rows.animal.a.points, 0);
});

test('letters do not repeat until all were used', () => {
  assert.equal(pickLetter(['א'], () => 0), 'ב');
  assert.ok(LETTERS.includes(pickLetter(LETTERS, () => 0.5)));
});

test('cors only for the app site (including a suffixed Pages name)', async () => {
  assert.ok(originAllowed('https://eretz-ir-4ab.pages.dev', 'https://eretz-ir-*.pages.dev'));
  assert.ok(!originAllowed('https://evil.dev', 'https://eretz-ir-*.pages.dev'));
  assert.ok(!originAllowed('https://eretz-ir-x.pages.dev.evil.dev', 'https://eretz-ir-*.pages.dev'));
  const env = fakeEnv();
  assert.equal((await call(env, '/create', { player: player(1) })).cors, 'https://eretz-ir.pages.dev');
  assert.equal((await call(env, '/create', { player: player(1) }, 'https://evil.dev')).cors, null);
});

test('create, join, and a full round', async () => {
  const env = fakeEnv();
  const created = await call(env, '/create', { player: player(1, { photo: 'data:image/jpeg;base64,AAAA' }) });
  assert.equal(created.status, 200);
  const code = created.data.code;
  assert.match(code, CODE_RE);
  assert.equal(created.data.hostId, player(1).id);
  assert.equal(created.data.players[0].photo, 'data:image/jpeg;base64,AAAA');
  assert.ok(!JSON.stringify(created.data).includes(player(1).token));

  const joined = await call(env, '/join', { code: code.toLowerCase(), player: player(2) });
  assert.equal(joined.status, 200);
  assert.equal(joined.data.players.length, 2);

  // אין שינוי – תשובה קצרה
  const same = await call(env, '/state', { ...auth(code, 1), v: joined.data.v });
  assert.equal(same.data.same, true);

  const started = await call(env, '/start', { ...auth(code, 1), seconds: 60 });
  assert.equal(started.data.phase, 'playing');
  assert.equal(started.data.round.letter, 'א');
  assert.equal(started.data.round.endsAt - started.data.round.startsAt, 60_000);
  assert.equal(started.data.round.startsAt, env.time + COUNTDOWN_MS);
  // לחיצה כפולה על "התחל" לא מתחילה סיבוב נוסף
  assert.equal((await call(env, '/start', auth(code, 2))).data.round.n, 1);

  env.time += 20_000;
  await call(env, '/answers', { ...auth(code, 1), round: 1, answers: { country: 'אנגליה', city: 'אשדוד', junk: 'x' } });
  // בזמן המשחק אף אחד לא רואה תשובות של אחרים
  const mid = await call(env, '/state', auth(code, 2));
  assert.equal(mid.data.results, null);
  assert.deepEqual(mid.data.round.mine, {});
  const mine = await call(env, '/state', auth(code, 1));
  assert.deepEqual(mine.data.round.mine, { country: 'אנגליה', city: 'אשדוד' });

  await call(env, '/answers', { ...auth(code, 1), round: 1, answers: { country: 'אנגליה', city: 'אשדוד' }, done: true });
  assert.equal((await call(env, '/state', auth(code, 1))).data.phase, 'playing');
  // השני סיים – הסיבוב נגמר מיד
  await call(env, '/answers', { ...auth(code, 2), round: 1, answers: { country: 'אנגליה', animal: 'אריה' }, done: true });
  const res = await call(env, '/state', auth(code, 2));
  assert.equal(res.data.phase, 'results');
  assert.equal(res.data.results.rows.country[player(1).id].points, 5);
  assert.equal(res.data.results.rows.city[player(1).id].points, 10);
  assert.equal(res.data.results.rows.animal[player(2).id].points, 10);
  assert.equal(res.data.players.find((p) => p.id === player(1).id).total, 15);

  // פסילה: שחקן 2 פוסל את "אשדוד" (2 שחקנים – קול אחד מספיק), ואחר כך מתחרט
  const voted = await call(env, '/vote', { ...auth(code, 2), round: 1, category: 'city', target: player(1).id, bad: true });
  assert.equal(voted.data.players.find((p) => p.id === player(1).id).total, 5);
  assert.equal((await call(env, '/vote', { ...auth(code, 1), round: 1, category: 'city', target: player(1).id, bad: true })).status, 400);
  const undone = await call(env, '/vote', { ...auth(code, 2), round: 1, category: 'city', target: player(1).id, bad: false });
  assert.equal(undone.data.players.find((p) => p.id === player(1).id).total, 15);

  // סיבוב שני: הניקוד נשמר, אות אחרת
  const next = await call(env, '/start', auth(code, 2));
  assert.equal(next.data.round.n, 2);
  assert.equal(next.data.round.letter, 'ב');
  assert.equal(next.data.seconds, 60);
  assert.equal(next.data.players.find((p) => p.id === player(1).id).total, 15);
  assert.deepEqual(next.data.history, [{ n: 1, letter: 'א' }]);
});

test('the round ends when the time is up, late answers are refused', async () => {
  const env = fakeEnv();
  const code = await gameWith(env, 2);
  await call(env, '/start', auth(code, 1));
  env.time += COUNTDOWN_MS + 120_000 + 1000;
  // עדיין בזמן החסד – התשובה נקלטת
  assert.equal((await call(env, '/answers', { ...auth(code, 1), round: 1, answers: { country: 'אוסטריה' }, done: true })).status, 200);
  env.time += GRACE_MS;
  assert.equal((await call(env, '/answers', { ...auth(code, 2), round: 1, answers: { country: 'אוסטריה' } })).data.late, true);
  const res = await call(env, '/state', auth(code, 2));
  assert.equal(res.data.phase, 'results');
  assert.equal(res.data.results.rows.country[player(1).id].points, 10);
});

test('tokens, full games, leaving and unknown codes', async () => {
  const env = fakeEnv();
  const code = await gameWith(env, MAX_PLAYERS);
  assert.equal((await call(env, '/join', { code, player: player(99) })).status, 409);
  // מישהו אחר עם אותו מזהה ובלי הסוד
  assert.equal((await call(env, '/join', { code, player: player(2, { token: 'x'.repeat(20) }) })).status, 403);
  assert.equal((await call(env, '/state', { ...auth(code, 2), token: 'x'.repeat(20) })).status, 403);
  // עדכון שם
  const renamed = await call(env, '/join', { code, player: player(2, { name: 'דנה' }) });
  assert.ok(renamed.data.players.some((p) => p.name === 'דנה'));
  // המארח יוצא – מישהו אחר מקבל את התפקיד
  await call(env, '/leave', auth(code, 1));
  const after = await call(env, '/state', auth(code, 2));
  assert.equal(after.data.hostId, player(2).id);
  assert.equal(after.data.players.length, MAX_PLAYERS - 1);
  assert.equal((await call(env, '/state', auth(code, 1))).data.gone, true);

  assert.equal((await call(env, '/state', { ...auth('ZZZZZ', 1) })).status, 404);
  assert.equal((await call(env, '/state', { ...auth('bad!', 1) })).status, 404);
  assert.equal((await call(env, '/create', { player: { ...player(1), photo: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await call(env, '/create', { player: { ...player(1), name: '   ' } })).status, 400);
});

test('an old game is deleted', async () => {
  const env = fakeEnv();
  const code = await gameWith(env, 1);
  const room = env.rooms.get(code);
  await room.alarm();
  assert.equal((await call(env, '/state', auth(code, 1))).status, 200);
  env.time += 4 * 24 * 60 * 60 * 1000;
  await room.alarm();
  assert.equal((await call(env, '/state', auth(code, 1))).status, 404);
});

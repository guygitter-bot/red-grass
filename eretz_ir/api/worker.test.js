import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Room, CODE_RE, originAllowed } from './worker.js';
import { normalize, startsWithLetter, scoreRound, pickLetter, LETTERS } from './game.js';
import { GRACE_MS, COUNTDOWN_MS, MAX_PLAYERS, SPELL_MS } from './room.js';
import { spellJobs } from './spell.js';

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
function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: 'https://eretz-ir.pages.dev,https://eretz-ir-*.pages.dev', time: 1_000_000, rooms: new Map() };
  const roomEnv = { NOW: () => env.time, RANDOM: () => 0, ...extra };
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

// סוכן מדומה לתיקון כתיב: מתקן לפי מילון קטן, ומנסה גם "לתקן" לאות אחרת (שאסור)
function fakeSpeller(calls = [], fail = false) {
  const dict = { ארייה: 'אריה', אמרכה: 'אמריקה', אבטיך: 'אבטיח', אנגליה: 'בריטניה' };
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          if (fail) throw Object.assign(new Error('overloaded'), { status: 529 });
          const lines = req.messages[0].content.split('\n').filter((l) => /^\d+\./.test(l));
          const fixes = lines.map((l) => {
            const [, i, text] = l.match(/^(\d+)\. \[[^\]]+\] (.*)$/);
            return { i: Number(i), fixed: dict[text] || text, ok: !['היי', 'אאאא'].includes(text) };
          });
          return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'fix_answers', input: { fixes } }] };
        },
      },
    },
  };
}

test('spelling is fixed at the end of the round, and fixed answers count as the same answer', async () => {
  const calls = [];
  const env = fakeEnv({ AI_CLIENT: fakeSpeller(calls) });
  const code = await gameWith(env, 3);
  await call(env, '/start', auth(code, 1));
  env.time += COUNTDOWN_MS + 5000;
  await call(env, '/answers', { ...auth(code, 1), round: 1, answers: { animal: 'ארייה', country: 'אמרכה', plant: 'אבטיך' }, done: true });
  await call(env, '/answers', { ...auth(code, 2), round: 1, answers: { animal: 'אריה', country: 'אנגליה', plant: 'בננה' }, done: true });
  await call(env, '/answers', { ...auth(code, 3), round: 1, answers: { animal: 'ארייה' }, done: true });

  const waiting = await call(env, '/state', auth(code, 1));
  assert.equal(waiting.data.phase, 'results');
  assert.equal(waiting.data.round.spell, 'pending');
  // "ארייה" פעמיים נשלח פעם אחת; "בננה" לא מתחיל ב-א – לא נשלח
  assert.equal(spellJobs((await env.rooms.get(code).storage.get('room')).round).length, 5);

  await env.rooms.get(code).alarm();
  assert.equal(calls.length, 1);
  const res = await call(env, '/state', auth(code, 1));
  assert.equal(res.data.round.spell, 'done');
  const animal = res.data.results.rows.animal;
  assert.equal(animal[player(1).id].text, 'אריה');
  assert.equal(animal[player(1).id].typed, 'ארייה');
  assert.equal(animal[player(2).id].typed, undefined);
  // שלושתם כתבו "אריה" (אחרי התיקון) – 5 לכל אחד
  assert.deepEqual([1, 2, 3].map((n) => animal[player(n).id].points), [5, 5, 5]);
  assert.equal(res.data.results.rows.country[player(1).id].text, 'אמריקה');
  // תיקון שמחליף את האות הראשונה – לא מתקבל
  assert.equal(res.data.results.rows.country[player(2).id].text, 'אנגליה');
  assert.equal(res.data.results.rows.plant[player(1).id].text, 'אבטיח');
});

test('when the speller fails or is stuck, results show without fixes', async () => {
  const env = fakeEnv({ AI_CLIENT: fakeSpeller([], true) });
  const code = await gameWith(env, 1);
  await call(env, '/start', auth(code, 1));
  await call(env, '/answers', { ...auth(code, 1), round: 1, answers: { animal: 'ארייה' }, done: true });
  await env.rooms.get(code).alarm();
  const failed = await call(env, '/state', auth(code, 1));
  assert.equal(failed.data.round.spell, 'failed');
  assert.equal(failed.data.results.rows.animal[player(1).id].text, 'ארייה');
  assert.equal(failed.data.results.rows.animal[player(1).id].points, 10);

  // נתקע (ה-alarm לא רץ) – אחרי חצי דקה מציגים בלי
  const env2 = fakeEnv({ AI_CLIENT: fakeSpeller() });
  const code2 = await gameWith(env2, 1);
  await call(env2, '/start', auth(code2, 1));
  await call(env2, '/answers', { ...auth(code2, 1), round: 1, answers: { animal: 'ארייה' }, done: true });
  assert.equal((await call(env2, '/state', auth(code2, 1))).data.round.spell, 'pending');
  env2.time += SPELL_MS + 1;
  assert.equal((await call(env2, '/state', auth(code2, 1))).data.round.spell, 'failed');
});

test('a lone letter scores nothing', () => {
  const round = { letter: 'ב', answers: { a: { animal: 'ב' }, b: { animal: 'ב׳' }, c: { animal: 'בז' } }, votes: {} };
  const { rows } = scoreRound(round, ['a', 'b', 'c']);
  assert.equal(rows.animal.a.reason, 'short');
  assert.equal(rows.animal.b.reason, 'short');
  assert.equal(rows.animal.c.points, 10);
});

test('answers that do not fit the category score nothing, unless most players approve them', async () => {
  const calls = [];
  const env = fakeEnv({ AI_CLIENT: fakeSpeller(calls), RANDOM: () => 4.5 / 22 }); // האות ה
  const code = await gameWith(env, 3);
  const started = await call(env, '/start', auth(code, 1));
  assert.equal(started.data.round.letter, 'ה');
  env.time += COUNTDOWN_MS + 5000;
  await call(env, '/answers', { ...auth(code, 1), round: 1, answers: { job: 'היי', animal: 'ה' }, done: true });
  await call(env, '/answers', { ...auth(code, 2), round: 1, answers: { job: 'הנדסאי' }, done: true });
  await call(env, '/answers', { ...auth(code, 3), round: 1, answers: {}, done: true });
  await env.rooms.get(code).alarm();
  // אות לבד לא נשלחת לבדיקה
  assert.ok(!calls[0].messages[0].content.includes('] ה\n') && !calls[0].messages[0].content.endsWith('] ה'));
  let res = await call(env, '/state', auth(code, 1));
  const job = res.data.results.rows.job;
  assert.equal(job[player(1).id].reason, 'wrong');
  assert.equal(job[player(1).id].points, 0);
  assert.equal(job[player(2).id].points, 10);
  assert.equal(res.data.results.rows.animal[player(1).id].reason, 'short');

  // אישור: צריך יותר ממחצית האחרים (2 מתוך 2)
  const approve = (n, yes) => call(env, '/vote', { ...auth(code, n), round: 1, category: 'job', target: player(1).id, kind: 'approve', approve: yes });
  res = await approve(2, true);
  assert.equal(res.data.results.rows.job[player(1).id].reason, 'wrong');
  res = await approve(3, true);
  assert.equal(res.data.results.rows.job[player(1).id].points, 10);
  res = await approve(3, false);
  assert.equal(res.data.results.rows.job[player(1).id].points, 0);
});

test('first to finish with every field filled gets a bonus (if at least half are right)', async () => {
  const env = fakeEnv();
  const code = await gameWith(env, 3);
  await call(env, '/start', auth(code, 1));
  env.time += COUNTDOWN_MS + 5000;
  const full = { country: 'אוסטריה', city: 'אשדוד', animal: 'אריה', plant: 'אורן', object: 'ארון', boy: 'אבי', girl: 'אורית', job: 'אופה', food: 'אורז' };
  // שחקן 2 סיים ראשון אבל עם שדות ריקים – אין בונוס
  await call(env, '/answers', { ...auth(code, 2), round: 1, answers: { country: 'אוסטריה' }, done: true });
  await call(env, '/answers', { ...auth(code, 1), round: 1, answers: full, done: true });
  await call(env, '/answers', { ...auth(code, 3), round: 1, answers: { ...full, food: 'אבטיח' }, done: true });
  const res = await call(env, '/state', auth(code, 1));
  assert.equal(res.data.round.first, player(1).id);
  assert.deepEqual(res.data.results.bonus, { id: player(1).id, points: 10 });
  // שחקן 1: 8 תשובות משותפות (5) + מאכל ייחודי (10) + בונוס
  assert.equal(res.data.results.totals[player(1).id], 8 * 5 + 10 + 10);

  // מלא אבל רוב התשובות לא באות הנכונה – בלי בונוס
  const round = { letter: 'א', first: 'a', answers: { a: { ...full, country: 'בלגיה', city: 'בת ים', animal: 'ברווז', plant: 'במבוק', object: 'בית' } }, votes: {} };
  assert.equal(scoreRound(round, ['a']).bonus, null);
});

test('letters from recent games on this device are skipped when possible', () => {
  assert.equal(pickLetter([], () => 0, ['א', 'ב']), 'ג');
  assert.equal(pickLetter(['ג'], () => 0, ['א', 'ב']), 'ד');
  // כולן היו – בכל זאת יש אות
  assert.ok(LETTERS.includes(pickLetter([], () => 0, LETTERS)));
});

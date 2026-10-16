import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Room, Library, audioUrl, originAllowed } from './worker.js';
import { COUNTDOWN_MS, GRACE_MS, QUESTION_MS, REVEAL_MS } from './room.js';
import { JOKER_EVERY, compact, makeOptions, pickSongs, scoreGame, teamScores } from './game.js';
import { pickBest } from './library.js';
import { SONGS } from './songs.js';

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

// סביבה מדומה: שעון שאפשר להזיז, וכל שיר "נמצא" (חוץ ממה שב-missing)
function fakeEnv({ missing = () => false } = {}) {
  const env = { ALLOWED_ORIGINS: 'https://ma-hashir.pages.dev', time: 1_000_000, rooms: new Map() };
  const roomEnv = {
    NOW: () => env.time,
    RANDOM: () => 0.3,
    FIND_SONGS: async (songs) => Object.fromEntries(songs.filter((s) => !missing(s)).map((s) => [s.id, { src: `it:https://a.mzstatic.com/${s.id}.m4a`, art: '' }])),
  };
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

async function call(env, path, body) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://ma-hashir.pages.dev' },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data: await res.json() };
}

const player = (n) => ({ id: `player-${n}-aaaa`, token: `token-${n}-0123456789abcdef`, name: `שחקן ${n}`, photo: '' });
const auth = (code, n) => ({ code, playerId: player(n).id, token: player(n).token });

async function newGame(env, players = 2) {
  const { data } = await call(env, '/create', { player: player(1) });
  for (let n = 2; n <= players; n++) await call(env, '/join', { code: data.code, player: player(n) });
  return data.code;
}

// התשובה הנכונה (מהשרת עצמו – לשחקנים היא לא נשלחת לפני הסוף)
const correctOf = (env, code) => env.rooms.get(code).storage.get('room').then((r) => r.game.correct[r.game.q]);

test('משחק שלם: שאלה, תשובה, ניקוד, ומעבר לשאלה הבאה', async () => {
  const env = fakeEnv();
  const code = await newGame(env);
  const start = await call(env, '/start', auth(code, 1));
  assert.equal(start.data.phase, 'question');
  assert.equal(start.data.game.count, 10);
  assert.equal(start.data.game.options.length, 4);
  assert.equal(start.data.game.reveal, null, 'התשובה הנכונה לא נשלחת לפני הזמן');
  assert.equal(start.cors, 'https://ma-hashir.pages.dev');

  env.time += COUNTDOWN_MS;
  const right = await correctOf(env, code);
  await call(env, '/extend', { ...auth(code, 2), q: 0 });
  await call(env, '/answer', { ...auth(code, 1), q: 0, choice: right });
  const r2 = await call(env, '/answer', { ...auth(code, 2), q: 0, choice: right });
  // כולם ענו – רואים את התשובה
  assert.equal(r2.data.phase, 'reveal');
  assert.equal(r2.data.game.reveal.correct, right);
  const totals = Object.fromEntries(r2.data.players.map((p) => [p.id, p.total]));
  assert.equal(totals[player(1).id], 10);
  assert.equal(totals[player(2).id], 5, 'עם הארכה – 5 נקודות');

  // תשובה כפולה לא משנה
  await call(env, '/answer', { ...auth(code, 1), q: 0, choice: (right + 1) % 4 });
  env.time += REVEAL_MS;
  const next = await call(env, '/state', auth(code, 1));
  assert.equal(next.data.phase, 'question');
  assert.equal(next.data.game.q, 1);
  assert.equal(next.data.players.find((p) => p.id === player(1).id).total, 10);
});

test('הזמן נגמר בלי תשובה – 0, ואחרי השאלה האחרונה המשחק נגמר', async () => {
  const env = fakeEnv();
  const code = await newGame(env, 1);
  await call(env, '/start', auth(code, 1));
  for (let q = 0; q < 10; q++) {
    env.time += COUNTDOWN_MS + QUESTION_MS + GRACE_MS + 1;
    const s = await call(env, '/state', auth(code, 1));
    assert.equal(s.data.phase, 'reveal');
    env.time += REVEAL_MS;
    await call(env, '/state', auth(code, 1));
  }
  const end = await call(env, '/state', auth(code, 1));
  assert.equal(end.data.phase, 'over');
  assert.equal(end.data.players[0].total, 0);
  const late = await call(env, '/answer', { ...auth(code, 1), q: 9, choice: 0 });
  assert.equal(late.status, 409);
  // משחק נוסף – שירים אחרים
  const again = await call(env, '/start', auth(code, 1));
  assert.equal(again.data.phase, 'question');
  assert.equal(again.data.game.n, 2);
});

test('50:50 רק אחרי שצוברים נקודות, ומוחק שתי תשובות לא נכונות', async () => {
  const env = fakeEnv();
  const code = await newGame(env, 1);
  await call(env, '/start', auth(code, 1));
  env.time += COUNTDOWN_MS;
  const no = await call(env, '/fifty', { ...auth(code, 1), q: 0 });
  assert.equal(no.status, 409);
  // שלוש תשובות נכונות = 30 נקודות = 50:50 אחד
  for (let q = 0; q < JOKER_EVERY / 10; q++) {
    await call(env, '/answer', { ...auth(code, 1), q, choice: await correctOf(env, code) });
    env.time += REVEAL_MS;
    await call(env, '/state', auth(code, 1));
    env.time += COUNTDOWN_MS;
  }
  const s = await call(env, '/state', auth(code, 1));
  assert.equal(s.data.players[0].jokers, 1);
  const cut = await call(env, '/fifty', { ...auth(code, 1), q: 3 });
  const right = await correctOf(env, code);
  assert.equal(cut.data.game.mine.cut.length, 2);
  assert.ok(!cut.data.game.mine.cut.includes(right));
  assert.equal(cut.data.players[0].jokers, 0);
  // אי אפשר לבחור תשובה שנמחקה
  const bad = await call(env, '/answer', { ...auth(code, 1), q: 3, choice: cut.data.game.mine.cut[0] });
  assert.equal(bad.status, 400);
});

test('קבוצות: מצטרפים לקבוצה הקטנה, ממוצע לקבוצה, ובלי שחקן בכל קבוצה לא מתחילים', async () => {
  const env = fakeEnv();
  const code = await newGame(env, 3);
  await call(env, '/settings', { ...auth(code, 1), settings: { mode: 'teams', count: 20, lang: 'intl', era: '80' } });
  const s = await call(env, '/state', auth(code, 1));
  assert.deepEqual(s.data.settings, { mode: 'teams', count: 20, lang: 'intl', era: '80' });
  assert.deepEqual(s.data.players.map((p) => p.team), [0, 1, 0]);
  const notHost = await call(env, '/settings', { ...auth(code, 2), settings: { count: 10 } });
  assert.equal(notHost.status, 403);

  await call(env, '/team', { ...auth(code, 2), team: 0 });
  const blocked = await call(env, '/start', auth(code, 1));
  assert.equal(blocked.status, 409);
  await call(env, '/team', { ...auth(code, 2), team: 1 });
  const started = await call(env, '/start', auth(code, 1));
  assert.equal(started.data.game.count, 20);
  assert.equal(started.data.teams.length, 2);
  assert.deepEqual(teamScores([{ id: 'a', team: 0 }, { id: 'b', team: 0 }, { id: 'c', team: 1 }], { a: 10, b: 0, c: 10 }).map((t) => t.total), [5, 10]);
});

test('שירים שלא נמצאו להשמעה לא נכנסים; אם אין מספיק – חוזרים לחדר ההמתנה עם הודעה', async () => {
  const env = fakeEnv({ missing: () => true });
  const code = await newGame(env, 1);
  const res = await call(env, '/start', auth(code, 1));
  assert.equal(res.data.phase, 'lobby');
  assert.match(res.data.error, /לא הצלחתי/);

  const some = fakeEnv({ missing: (s) => s.id.charCodeAt(2) % 2 === 0 });
  const code2 = await newGame(some, 1);
  const ok = await call(some, '/start', auth(code2, 1));
  assert.equal(ok.data.phase, 'question');
  assert.ok(ok.data.game.count >= 5);
});

test('בחירת שירים: לפי שפה ועשור, בלי לחזור על שירים, ומשלימים מעשורים קרובים', () => {
  const random = () => 0.5;
  const il60 = pickSongs({ era: '60', lang: 'il', count: 20 }, [], random);
  assert.equal(il60.length, 28);
  assert.ok(il60.every((s) => s.lang === 'il'));
  assert.equal(il60[0].decade, '60');
  assert.ok(il60.some((s) => s.decade === '70'), 'מעט שירים משנות ה-60 – משלימים מה-70');
  const used = il60.map((s) => s.id);
  const again = pickSongs({ era: 'all', lang: 'intl', count: 10 }, used, random);
  assert.ok(again.every((s) => s.lang === 'intl'));
  const both = pickSongs({ era: '90', lang: 'both', count: 10 }, [], random);
  assert.ok(both.every((s) => s.decade === '90'));
  // תשובות לא נכונות: באותה שפה, בלי כפילויות
  for (const song of SONGS.slice(0, 80)) {
    const { options, correct } = makeOptions(song, Math.random);
    assert.equal(options.length, 4);
    assert.equal(options[correct], song.id);
    assert.equal(new Set(options).size, 4);
    const songs = options.map((id) => SONGS.find((s) => s.id === id));
    assert.ok(songs.every((s) => s.lang === song.lang));
  }
});

test('ניקוד: 10 / 5 עם הארכה, ו-50:50 נספר', () => {
  const game = { ids: ['a', 'b', 'c', 'd'], correct: [0, 1, 2, 3], picks: { p: [{ c: 0 }, { c: 1, ext: true }, { c: 0 }, { c: 3, cut: [0, 1] }] } };
  assert.deepEqual(scoreGame(game, ['p']).p, { total: 25, right: 3, jokers: 0 });
  assert.deepEqual(scoreGame(game, ['p'], 1).p, { total: 10, right: 1, jokers: 0 });
});

test('התאמת תוצאת חיפוש לשיר', () => {
  const song = { title: '(I Can\'t Get No) Satisfaction', artist: 'The Rolling Stones', lang: 'intl' };
  const best = pickBest([
    { title: 'Satisfaction (Karaoke Version)', artist: 'Karaoke Hits', preview: 'x1' },
    { title: 'Satisfaction', artist: 'Benny Benassi', preview: 'x2' },
    { title: '(I Can\'t Get No) Satisfaction (Mono)', artist: 'The Rolling Stones', preview: 'x3' },
  ], song);
  assert.equal(best.preview, 'x3');
  // זמר ישראלי שמופיע באנגלית – מספיק שם שיר מדויק
  assert.equal(pickBest([{ title: 'עוף גוזל', artist: 'Arik Einstein', preview: 'y' }], { title: 'עוף גוזל', artist: 'אריק איינשטיין' }).preview, 'y');
  assert.equal(pickBest([{ title: 'עוף', artist: 'מישהו אחר', preview: 'z' }], { title: 'עוף גוזל', artist: 'אריק איינשטיין' }), null);
  assert.equal(pickBest([{ title: 'שיר השלום', artist: 'להקת הנחל', preview: 'w' }], { title: 'שיר השלום', artist: 'להקת הנח"ל' }).preview, 'w');
  assert.equal(compact('א-ב-ני-בי'), compact('אבניבי'));
});

test('הספרייה זוכרת מה נמצא, ומנסה Deezer כש-iTunes לא מצא', async () => {
  const calls = [];
  const env = {
    NOW: () => 5000,
    FETCH: async (url) => {
      calls.push(url);
      if (url.includes('itunes')) return Response.json({ results: [{ trackName: 'Other', artistName: 'X', previewUrl: 'p' }] });
      return Response.json({ data: [{ id: 42, title: 'Toy', artist: { name: 'Netta' }, preview: 'https://cdns-preview-1.dzcdn.net/x.mp3', album: { cover_medium: 'art' } }] });
    },
  };
  const lib = new Library({ storage: fakeStorage() }, env);
  const song = { id: 's1', title: 'Toy', artist: 'Netta', lang: 'il' };
  assert.deepEqual(await lib.resolve([song]), { s1: { src: 'dz:42', art: 'art' } });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('country=IL'));
  await lib.resolve([song]);
  assert.equal(calls.length, 2, 'בפעם השנייה – מהזיכרון');
});

test('קטעי שירים רק מ-iTunes ו-Deezer', async () => {
  assert.equal(await audioUrl('it:https://audio-ssl.itunes.apple.com/a.m4a'), 'https://audio-ssl.itunes.apple.com/a.m4a');
  assert.equal(await audioUrl('it:https://evil.com/a.m4a'), null);
  assert.equal(await audioUrl('xx'), null);
  const fetcher = async () => Response.json({ preview: 'https://cdnt-preview.dzcdn.net/a.mp3' });
  assert.equal(await audioUrl('dz:42', fetcher), 'https://cdnt-preview.dzcdn.net/a.mp3');
  const env = { ALLOWED_ORIGINS: '', FETCH: async () => new Response('AUDIO', { headers: { 'content-type': 'audio/mp4' } }) };
  const res = await worker.fetch(new Request('https://api.test/audio?s=' + encodeURIComponent('it:https://a.mzstatic.com/x.m4a')), env);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'AUDIO');
  const bad = await worker.fetch(new Request('https://api.test/audio?s=it:https://evil.com/x'), env);
  assert.equal(bad.status, 404);
});

test('כתובות מותרות', () => {
  assert.ok(originAllowed('https://ma-hashir-abc.pages.dev', 'https://ma-hashir-*.pages.dev'));
  assert.ok(!originAllowed('https://evil.dev', 'https://ma-hashir-*.pages.dev'));
});

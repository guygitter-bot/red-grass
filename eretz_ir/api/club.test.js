import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Club, CLUB_RE } from './worker.js';
import { b64url } from './push.js';
import { INVITE_GAP_MS, MAX_MEMBERS } from './club.js';

function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async deleteAll() { map.clear(); },
    async setAlarm() {},
  };
}

// סביבה מדומה: קהילות בזיכרון, ושירות ההתראות רושם מה נשלח
function fakeEnv() {
  const env = { ALLOWED_ORIGINS: 'https://eretz-ir.pages.dev', APP_URL: 'https://eretz-ir.pages.dev/', time: 1_000_000, clubs: new Map(), pushed: [], gone: new Set() };
  const clubEnv = {
    NOW: () => env.time,
    PUSH_FETCH: async (url, init) => {
      env.pushed.push({ url, init });
      return new Response('', { status: env.gone.has(url) ? 410 : 201 });
    },
  };
  env.CLUBS = clubEnv.CLUBS = {
    idFromName: (n) => n,
    get: (id) => {
      if (!env.clubs.has(id)) env.clubs.set(id, new Club({ storage: fakeStorage() }, clubEnv));
      const c = env.clubs.get(id);
      return { fetch: (req) => c.fetch(req) };
    },
  };
  return env;
}

async function call(env, path, body) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://eretz-ir.pages.dev' },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json() };
}

const player = (n) => ({ id: `player-${n}-aaaa`, token: `token-${n}-0123456789abcdef`, name: `שחקן ${n}` });
const auth = (club, n) => ({ club, playerId: player(n).id, token: player(n).token });

// מנוי התראות אמיתי מבחינת המפתחות (כדי שההצפנה תעבוד)
async function subscription(n) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const p256dh = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`, keys: { p256dh, auth: b64url(crypto.getRandomValues(new Uint8Array(16))) } };
}

test('create a community, join it, and call everyone to a game', async () => {
  const env = fakeEnv();
  const created = await call(env, '/club/create', { name: ' המשפחה ', player: player(1) });
  assert.equal(created.status, 200);
  const club = created.data.code;
  assert.match(club, CLUB_RE);
  assert.equal(created.data.name, 'המשפחה');
  assert.ok(!JSON.stringify(created.data).includes(player(1).token));

  await call(env, '/club/join', { club: club.toLowerCase(), player: player(2) });
  await call(env, '/club/join', { club, player: player(3) });
  const key = await call(env, '/push/key', {});
  assert.equal(key.data.publicKey.length, 87);
  // אותו מפתח בכל פעם
  assert.equal((await call(env, '/push/key', {})).data.publicKey, key.data.publicKey);

  const sub2 = await subscription(2);
  const subscribed = await call(env, '/club/subscribe', { ...auth(club, 2), subscription: sub2 });
  assert.equal(subscribed.data.members.find((m) => m.id === player(2).id).notify, true);
  await call(env, '/club/subscribe', { ...auth(club, 1), subscription: await subscription(1) });
  assert.equal((await call(env, '/club/subscribe', { ...auth(club, 3), subscription: { endpoint: 'https://evil.example/x', keys: sub2.keys } })).status, 400);

  // שחקן 1 קורא לכולם – רק שחקן 2 (הפעיל התראות, ולא מי שקרא) מקבל
  const invited = await call(env, '/club/invite', { ...auth(club, 1), game: 'abcde' });
  assert.equal(invited.status, 200);
  assert.equal(invited.data.sent, 1);
  assert.equal(env.pushed.length, 1);
  assert.equal(env.pushed[0].url, sub2.endpoint);
  assert.equal(env.pushed[0].init.headers['content-encoding'], 'aes128gcm');
  assert.match(env.pushed[0].init.headers.authorization, /^vapid t=.+, k=/);
  // כולם רואים בקהילה שמחכים להם
  const seen = await call(env, '/club/get', auth(club, 3));
  assert.deepEqual({ name: seen.data.invite.name, game: seen.data.invite.game }, { name: 'שחקן 1', game: 'ABCDE' });

  // שוב לאותו משחק – לא שולחים פעמיים; למשחק אחר מיד – לא
  assert.equal((await call(env, '/club/invite', { ...auth(club, 3), game: 'ABCDE' })).data.again, true);
  assert.equal((await call(env, '/club/invite', { ...auth(club, 3), game: 'FGHJK' })).status, 429);
  assert.equal(env.pushed.length, 1);

  // אחרי דקה – מותר. מכשיר שביטל (410) יורד מהרשימה
  env.time += INVITE_GAP_MS + 1;
  env.gone.add(sub2.endpoint);
  const again = await call(env, '/club/invite', { ...auth(club, 3), game: 'FGHJK' });
  assert.equal(again.data.sent, 1); // שחקן 1
  assert.equal(again.data.members.find((m) => m.id === player(2).id).notify, false);
});

test('community checks: tokens, bad codes, leaving, full', async () => {
  const env = fakeEnv();
  const club = (await call(env, '/club/create', { name: 'כיתה ג', player: player(1) })).data.code;
  assert.equal((await call(env, '/club/create', { name: '  ', player: player(1) })).status, 400);
  // שינוי שם
  assert.equal((await call(env, '/club/rename', { ...auth(club, 1), name: ' כיתה ד ' })).data.name, 'כיתה ד');
  assert.equal((await call(env, '/club/rename', { ...auth(club, 1), name: '' })).status, 400);
  assert.equal((await call(env, '/club/get', { ...auth(club, 1), token: 'x'.repeat(20) })).status, 403);
  assert.equal((await call(env, '/club/get', auth('ZZZZZZ', 1))).status, 404);
  assert.equal((await call(env, '/club/get', auth('~vapid', 1))).status, 404);
  assert.equal((await call(env, '/club/invite', { ...auth(club, 1), game: 'bad' })).status, 400);
  for (let n = 2; n <= MAX_MEMBERS; n++) await call(env, '/club/join', { club, player: player(n) });
  assert.equal((await call(env, '/club/join', { club, player: player(99) })).status, 409);
  await call(env, '/club/leave', auth(club, 2));
  assert.equal((await call(env, '/club/get', auth(club, 2))).data.gone, true);
  assert.equal((await call(env, '/club/join', { club, player: player(99) })).status, 200);
});

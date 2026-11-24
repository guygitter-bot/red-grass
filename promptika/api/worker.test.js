// בדיקות השרת – רק נתונים מומצאים
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Studio } from './worker.js';
import { login, MAX_TRIES, TRIES_WINDOW_MS } from './lib/auth.js';
import { safeClient, safeSettings, DEFAULT_SETTINGS } from './lib/model.js';

const ORIGIN = 'https://promptika.pages.dev';

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '' } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix)).sort();
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
  };
}

function setup() {
  const storage = fakeStorage();
  const studio = new Studio({ storage }, {});
  const env = {
    ALLOWED_ORIGINS: ORIGIN,
    STUDIO: { idFromName: () => 'main', get: () => ({ fetch: (req) => studio.fetch(req) }) },
  };
  const call = async (method, path, body, token, origin = ORIGIN) => {
    const res = await worker.fetch(new Request(`https://api.test${path}`, {
      method,
      headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }), env);
    return { status: res.status, data: await res.json() };
  };
  return { storage, call };
}

test('first login sets the password, then it is checked', async () => {
  const { call, storage } = setup();
  assert.equal((await call('GET', '/status')).data.ready, false);
  assert.equal((await call('POST', '/login', { password: '123' })).status, 400);
  const first = await call('POST', '/login', { password: 'test-pass-1' });
  assert.equal(first.status, 200);
  assert.ok(first.data.token);
  assert.equal((await call('GET', '/status')).data.ready, true);
  // הסיסמה לא נשמרת כמו שהיא
  assert.ok(!JSON.stringify(storage.map.get('auth')).includes('test-pass-1'));
  assert.equal((await call('POST', '/login', { password: 'wrong-pass' })).status, 401);
  assert.equal((await call('POST', '/login', { password: 'test-pass-1' })).status, 200);
});

test('every route except login needs a session', async () => {
  const { call } = setup();
  await call('POST', '/login', { password: 'test-pass-1' });
  for (const [m, p] of [['GET', '/settings'], ['PUT', '/settings'], ['GET', '/clients'], ['POST', '/clients'], ['GET', '/clients/abc'], ['DELETE', '/clients/abc'], ['POST', '/clients/abc/propose']]) {
    assert.equal((await call(m, p, m === 'GET' || m === 'DELETE' ? undefined : {})).status, 401, `${m} ${p}`);
    assert.equal((await call(m, p, m === 'GET' || m === 'DELETE' ? undefined : {}, 'not-a-token')).status, 401, `${m} ${p}`);
  }
});

test('logout ends the session', async () => {
  const { call } = setup();
  const { token } = (await call('POST', '/login', { password: 'test-pass-1' })).data;
  assert.equal((await call('GET', '/settings', undefined, token)).status, 200);
  assert.equal((await call('POST', '/logout', {}, token)).status, 200);
  assert.equal((await call('GET', '/settings', undefined, token)).status, 401);
});

test('login rate limit: 5 wrong tries per 10 minutes', async () => {
  const storage = fakeStorage();
  await login(storage, 'test-pass-1', 0);
  for (let i = 0; i < MAX_TRIES; i++) await assert.rejects(login(storage, 'nope-nope', 1000 + i), { status: 401 });
  // גם הסיסמה הנכונה נחסמת עד שהחלון עובר
  await assert.rejects(login(storage, 'test-pass-1', 2000), { status: 429 });
  assert.ok(await login(storage, 'test-pass-1', 1000 + TRIES_WINDOW_MS + 1));
});

test('other sites are blocked', async () => {
  const { call } = setup();
  assert.equal((await call('GET', '/status', undefined, undefined, 'https://evil.example')).status, 403);
});

test('settings: defaults, partial update, clamping', async () => {
  const { call } = setup();
  const { token } = (await call('POST', '/login', { password: 'test-pass-1' })).data;
  assert.deepEqual((await call('GET', '/settings', undefined, token)).data.settings, DEFAULT_SETTINGS);
  const put = await call('PUT', '/settings', { settings: { hourlyRate: 250, depositPercent: 140 } }, token);
  assert.equal(put.data.settings.hourlyRate, 250);
  assert.equal(put.data.settings.depositPercent, 100);
  assert.equal(put.data.settings.revisionRounds, 2);
  const again = await call('PUT', '/settings', { vatIncluded: true }, token);
  assert.equal(again.data.settings.hourlyRate, 250);
  assert.equal(again.data.settings.vatIncluded, true);
});

test('clients: create, list, read, update, delete, propose stub', async () => {
  const { call } = setup();
  const { token } = (await call('POST', '/login', { password: 'test-pass-1' })).data;
  assert.equal((await call('POST', '/clients', {}, token)).status, 400);
  const made = await call('POST', '/clients', { name: 'לקוח לדוגמה', business: 'עסק בדוי' }, token);
  assert.equal(made.status, 201);
  const { id } = made.data.client;
  assert.deepEqual(made.data.client.intake, {});
  assert.deepEqual(made.data.client.proposals, []);

  const list = await call('GET', '/clients', undefined, token);
  assert.equal(list.data.clients.length, 1);
  assert.equal(list.data.clients[0].name, 'לקוח לדוגמה');

  const upd = await call('PUT', `/clients/${id}`, { client: { business: 'עסק אחר', id: 'hack', intake: { tools: 'אקסל' } } }, token);
  assert.equal(upd.data.client.id, id);
  assert.equal(upd.data.client.business, 'עסק אחר');
  assert.equal(upd.data.client.name, 'לקוח לדוגמה');
  assert.equal(upd.data.client.intake.tools, 'אקסל');

  assert.equal((await call('POST', `/clients/${id}/propose`, {}, token)).status, 501);
  assert.equal((await call('DELETE', `/clients/${id}`, undefined, token)).status, 200);
  assert.equal((await call('GET', `/clients/${id}`, undefined, token)).status, 404);
});

test('old data keeps working: safeClient / safeSettings fill defaults', () => {
  const c = safeClient({ id: 'x1', name: 'ישן' });
  assert.deepEqual(c.intake, {});
  assert.deepEqual(c.proposals, []);
  const p = safeClient({ proposals: [{ tools: [{ name: 'בוט', buildHours: '12', price: 9999 }] }] }).proposals[0];
  assert.equal(p.version, 1);
  // אין שדה של כסף בכלי – רק שעות
  assert.deepEqual(Object.keys(p.tools[0]).sort(), ['buildHours', 'monthlyHours', 'name', 'problem', 'spec']);
  assert.equal(p.tools[0].buildHours, 12);
  assert.deepEqual(safeSettings(undefined), DEFAULT_SETTINGS);
});

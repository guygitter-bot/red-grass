import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Vault } from './worker.js';
import { PAGE } from './vault.js';

// זיכרון מדומה במקום האחסון של Durable Object (get/put/delete/list כמו ב-Cloudflare)
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k)); },
    async put(k, v) {
      if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      else map.set(k, clone(v));
    },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '', start = '', limit = Infinity } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix) && kk >= start).sort().slice(0, limit);
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
  };
}

function fakeEnv(extra = {}) {
  const env = { SEDER_PASSWORD: 'סיסמה-סודית', ALLOWED_ORIGINS: 'https://seder-tasks.pages.dev', ...extra };
  let vault;
  env.VAULT = { idFromName: (n) => n, get: () => ({ fetch: (req) => (vault ||= new Vault({ storage: fakeStorage() }, env)).fetch(req) }) };
  return env;
}

async function call(env, path, body, token) {
  const res = await worker.fetch(new Request(`https://seder-api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://seder-tasks.pages.dev', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data: await res.json() };
}

async function login(env) {
  return (await call(env, '/login', { password: 'סיסמה-סודית' })).data.token;
}

const task = (id, updatedAt, title = id) => ({ kind: 'task', id, updatedAt, data: { id, title, updatedAt } });

test('login needs the right password, and sync needs the token', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/login', { password: 'לא' })).status, 401);
  const token = await login(env);
  assert.ok(token.length > 20);
  assert.equal((await call(env, '/sync', { since: 0, changes: [] })).status, 401);
  assert.equal((await call(env, '/sync', { since: 0, changes: [] }, 'wrong')).status, 401);
  const ok = await call(env, '/sync', { since: 0, changes: [] }, token);
  assert.equal(ok.status, 200);
  assert.equal(ok.cors, 'https://seder-tasks.pages.dev');
});

test('server without a password is closed', async () => {
  for (const pw of [undefined, '', 'none']) {
    const env = fakeEnv({ SEDER_PASSWORD: pw });
    assert.equal((await call(env, '/login', { password: '' })).status, 503);
    assert.equal((await call(env, '/login', { password: 'none' })).status, 503);
  }
});

test('locks login after repeated wrong passwords', async () => {
  const env = fakeEnv();
  for (let i = 0; i < 10; i += 1) assert.equal((await call(env, '/login', { password: `x${i}` })).status, 401);
  assert.equal((await call(env, '/login', { password: 'סיסמה-סודית' })).status, 429);
});

test('phone and computer end up with the same data', async () => {
  const env = fakeEnv();
  const token = await login(env);
  // הטלפון מעלה שתי משימות
  const phone = await call(env, '/sync', { since: 0, changes: [task('a', 100), task('b', 100)] }, token);
  assert.equal(phone.data.cursor, 2);
  // המחשב (חדש) מקבל את שתיהן
  const pc = await call(env, '/sync', { since: 0, changes: [] }, token);
  assert.deepEqual(pc.data.records.map((r) => r.id), ['a', 'b']);
  // המחשב עורך את a, הטלפון מוחק את b
  await call(env, '/sync', { since: pc.data.cursor, changes: [task('a', 200, 'נערך במחשב')] }, token);
  await call(env, '/sync', { since: 2, changes: [{ kind: 'task', id: 'b', updatedAt: 300, deleted: true }] }, token);
  // עריכה ישנה יותר מגיעה באיחור – לא דורסת
  await call(env, '/sync', { since: 0, changes: [task('a', 150, 'ישן')] }, token);
  const after = await call(env, '/sync', { since: 2, changes: [] }, token);
  assert.deepEqual(after.data.records.map((r) => [r.id, r.deleted, r.data?.title]), [['a', false, 'נערך במחשב'], ['b', true, undefined]]);
  assert.equal(after.data.cursor, 4);
  const nothing = await call(env, '/sync', { since: 4, changes: [] }, token);
  assert.deepEqual(nothing.data.records, []);
});

test('ignores malformed changes', async () => {
  const env = fakeEnv();
  const token = await login(env);
  const bad = [
    { kind: 'user', id: 'x', updatedAt: 1, data: { id: 'x' } },
    { kind: 'task', id: '../x', updatedAt: 1, data: { id: '../x' } },
    { kind: 'task', id: 'x', updatedAt: 'now', data: { id: 'x' } },
    { kind: 'task', id: 'x', updatedAt: 1, data: { id: 'other' } },
    { kind: 'task', id: 'x', updatedAt: 1, data: { id: 'x', notes: 'x'.repeat(70000) } },
    null,
  ];
  const res = await call(env, '/sync', { since: 0, changes: bad }, token);
  assert.equal(res.data.accepted, 0);
  assert.deepEqual(res.data.records, []);
});

test('pages through many changes', async () => {
  const env = fakeEnv();
  const token = await login(env);
  const many = Array.from({ length: PAGE + 5 }, (_, i) => task(`t${i}`, 1));
  const first = await call(env, '/sync', { since: 0, changes: many }, token);
  assert.equal(first.data.records.length, PAGE);
  assert.equal(first.data.more, true);
  const second = await call(env, '/sync', { since: first.data.cursor, changes: [] }, token);
  assert.equal(second.data.records.length, 5);
  assert.equal(second.data.more, false);
});

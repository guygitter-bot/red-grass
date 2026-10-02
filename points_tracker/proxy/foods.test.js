import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { SharedFoods, cleanFood } from './foods.js';

// זיכרון מדומה במקום האחסון של Cloudflare
function fakeEnv() {
  const map = new Map();
  const storage = {
    async get(k) { return map.get(k); },
    async put(k, v) { map.set(k, v); },
    async delete(k) { return map.delete(k); },
    async list({ prefix, limit } = {}) {
      const entries = [...map].filter(([k]) => k.startsWith(prefix || '')).slice(0, limit ?? Infinity);
      return new Map(entries);
    },
  };
  const obj = new SharedFoods({ storage });
  return {
    ANTHROPIC_API_KEY: 'k', ACCESS_CODE: 'code123', ADMIN_CODE: 'admin999', ALLOWED_ORIGINS: 'https://app.example',
    FOODS: { idFromName: (n) => n, get: () => ({ fetch: (req) => obj.fetch(req) }) },
  };
}

const call = (env, method, { body, query = '', headers = {} } = {}) =>
  worker.fetch(
    new Request(`https://proxy.example/foods${query}`, {
      method,
      headers: { origin: 'https://app.example', 'x-access-code': 'code123', ...headers },
      body: body && JSON.stringify(body),
    }),
    env,
  );

test('anyone with the access code adds; the first one wins; everyone sees it', async () => {
  const env = fakeEnv();
  let res = await call(env, 'POST', { body: { name: 'עוגת גבינה של אמא (פרוסה)', points: 6, source: 'user' } });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://app.example');
  res = await call(env, 'POST', { body: { name: 'עוגת גבינה של אמא (פרוסה)', points: 9 } });
  assert.equal((await res.json()).added, false);
  const { foods } = await (await call(env, 'GET')).json();
  assert.equal(foods.length, 1);
  assert.equal(foods[0].points, 6);
  assert.equal(foods[0].shared, true);
});

test('needs the access code and valid data', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, 'GET', { headers: { 'x-access-code': 'nope' } })).status, 401);
  assert.equal((await call(env, 'POST', { body: { name: '', points: 3 } })).status, 400);
  assert.equal((await call(env, 'POST', { body: { name: 'x', points: 'lots' } })).status, 400);
  assert.equal((await call(env, 'POST', { body: { name: 'x', points: 9999 } })).status, 400);
});

test('only the admin code can fix or delete for everyone', async () => {
  const env = fakeEnv();
  await call(env, 'POST', { body: { name: 'במבה', points: 5 } });
  // a client cannot pretend to be admin with the internal header
  assert.equal((await call(env, 'DELETE', { query: '?name=במבה', headers: { 'x-is-admin': '1' } })).status, 403);
  assert.equal((await call(env, 'PUT', { body: { name: 'במבה', points: 4 } })).status, 403);
  const admin = { 'x-admin-code': 'admin999' };
  assert.equal((await call(env, 'PUT', { body: { name: 'במבה אסם', points: 4 }, query: '?oldName=במבה', headers: admin })).status, 200);
  let { foods } = await (await call(env, 'GET')).json();
  assert.deepEqual(foods.map((f) => [f.name, f.points]), [['במבה אסם', 4]]);
  assert.equal((await call(env, 'DELETE', { query: '?name=במבה אסם', headers: admin })).status, 200);
  ({ foods } = await (await call(env, 'GET')).json());
  assert.equal(foods.length, 0);
});

test('cleanFood keeps only known fields', () => {
  const food = cleanFood({ name: ' פיתה ', points: 6.04, evil: '<script>', sources: ['javascript:x', 'https://a.b'], per100: { kcal: 1 } });
  assert.deepEqual(food, { name: 'פיתה', points: 6, source: 'user', sources: ['https://a.b'] });
});

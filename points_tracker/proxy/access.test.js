import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { fakeEnv } from './fake-env.js';

const req = (env, method, path, { body, headers = {} } = {}) =>
  worker.fetch(
    new Request(`https://proxy.example${path}`, {
      method,
      headers: { origin: 'https://app.example', ...headers },
      body: body && JSON.stringify(body),
    }),
    env,
  );
const owner = { 'x-access-code': 'code123' };

test('an invite link works once and gives the device its own key', async () => {
  const env = fakeEnv();
  const { token } = await (await req(env, 'POST', '/invites', { body: { name: 'מירב' }, headers: owner })).json();
  assert.ok(token.length >= 30);

  const first = await req(env, 'POST', '/redeem', { body: { token } });
  assert.equal(first.status, 201);
  const { deviceKey, name } = await first.json();
  assert.equal(name, 'מירב');
  assert.notEqual(deviceKey, 'code123');

  // used again (e.g. forwarded) -> refused
  assert.equal((await req(env, 'POST', '/redeem', { body: { token } })).status, 410);

  // the device key opens the shared foods (and so the AI proxy)
  assert.equal((await req(env, 'GET', '/foods', { headers: { 'x-device-key': deviceKey } })).status, 200);
  assert.equal((await req(env, 'GET', '/foods', { headers: { 'x-device-key': 'guess' } })).status, 401);
});

test('only the owner can invite or manage devices; a device can be disconnected', async () => {
  const env = fakeEnv();
  const { token } = await (await req(env, 'POST', '/invites', { body: {}, headers: owner })).json();
  const { deviceKey } = await (await req(env, 'POST', '/redeem', { body: { token } })).json();
  const device = { 'x-device-key': deviceKey };

  assert.equal((await req(env, 'POST', '/invites', { body: {}, headers: device })).status, 403);
  assert.equal((await req(env, 'GET', '/devices', { headers: device })).status, 403);
  assert.equal((await req(env, 'POST', '/invites', { body: {} })).status, 401);

  const { devices } = await (await req(env, 'GET', '/devices', { headers: owner })).json();
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, 'מכשיר');
  assert.equal((await req(env, 'DELETE', `/devices?id=${devices[0].id}`, { headers: owner })).status, 200);
  assert.equal((await req(env, 'GET', '/foods', { headers: device })).status, 401);
});

test('expired or made-up invites are refused', async () => {
  const env = fakeEnv();
  assert.equal((await req(env, 'POST', '/redeem', { body: { token: 'x'.repeat(32) } })).status, 410);
  assert.equal((await req(env, 'POST', '/redeem', { body: { token: 'short' } })).status, 400);
  const { token } = await (await req(env, 'POST', '/invites', { body: {}, headers: owner })).json();
  const realNow = Date.now;
  Date.now = () => realNow() + 8 * 24 * 60 * 60 * 1000;
  try {
    assert.equal((await req(env, 'POST', '/redeem', { body: { token } })).status, 410);
  } finally {
    Date.now = realNow;
  }
});

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const env = { ANTHROPIC_API_KEY: 'sk-ant-secret', ACCESS_CODE: 'code123', ALLOWED_ORIGINS: 'https://app.example' };
let upstreamCalls;

beforeEach(() => {
  upstreamCalls = [];
  globalThis.fetch = async (url, init) => {
    upstreamCalls.push({ url, init });
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
});

const post = (body, headers = {}) =>
  new Request('https://proxy.example/v1/messages?beta=true', {
    method: 'POST',
    headers: { origin: 'https://app.example', 'x-access-code': 'code123', 'x-api-key': 'placeholder', ...headers },
    body: JSON.stringify(body),
  });

const ok = { model: 'claude-opus-5-5', max_tokens: 16000, messages: [] };

test('forwards with the real key, not the one from the browser', async () => {
  const res = await worker.fetch(post(ok, { 'anthropic-beta': 'server-side-fallback-2026-07-01' }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://app.example');
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].url, 'https://api.anthropic.com/v1/messages?beta=true');
  assert.equal(upstreamCalls[0].init.headers.get('x-api-key'), 'sk-ant-secret');
  assert.equal(upstreamCalls[0].init.headers.get('anthropic-beta'), 'server-side-fallback-2026-07-01');
});

test('rejects a wrong or missing access code', async () => {
  assert.equal((await worker.fetch(post(ok, { 'x-access-code': 'nope' }), env)).status, 401);
  const noCode = new Request('https://proxy.example/v1/messages', { method: 'POST', body: '{}' });
  assert.equal((await worker.fetch(noCode, env)).status, 401);
  assert.equal(upstreamCalls.length, 0);
});

test('only allows the app models, token limit and paths', async () => {
  assert.equal((await worker.fetch(post({ ...ok, model: 'claude-fable-5-1' }), env)).status, 400);
  assert.equal((await worker.fetch(post({ ...ok, max_tokens: 64000 }), env)).status, 400);
  const other = new Request('https://proxy.example/v1/messages/batches', {
    method: 'POST', headers: { 'x-access-code': 'code123' }, body: '{}',
  });
  assert.equal((await worker.fetch(other, env)).status, 404);
  assert.equal(upstreamCalls.length, 0);
});

test('allows the key check (GET model) and CORS preflight', async () => {
  const get = new Request('https://proxy.example/v1/models/claude-opus-5-5', { headers: { 'x-access-code': 'code123' } });
  assert.equal((await worker.fetch(get, env)).status, 200);
  const pre = new Request('https://proxy.example/v1/messages', { method: 'OPTIONS', headers: { origin: 'https://app.example' } });
  const res = await worker.fetch(pre, env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://app.example');
});

test('refuses to run without configuration', async () => {
  assert.equal((await worker.fetch(post(ok), { ACCESS_CODE: 'code123' })).status, 500);
});

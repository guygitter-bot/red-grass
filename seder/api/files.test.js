import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Vault } from './worker.js';
import { CHUNK_CHARS, ORPHAN_AFTER_MS, base64Bytes, cleanFile, cleanupFiles, getFile, putFile } from './files.js';

// זיכרון מדומה במקום האחסון של Durable Object (כמו ב-worker.test.js)
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

const b64 = (s) => Buffer.from(s).toString('base64');

async function call(env, path, body, token) {
  const res = await worker.fetch(new Request(`https://seder-api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://seder-tasks.pages.dev', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json() };
}

function fakeEnv() {
  const env = { SEDER_PASSWORD: 'סיסמה-סודית', ALLOWED_ORIGINS: 'https://seder-tasks.pages.dev' };
  const storage = fakeStorage();
  let vault;
  env.VAULT = { idFromName: (n) => n, get: () => ({ fetch: (req) => (vault ||= new Vault({ storage }, env)).fetch(req) }) };
  return { env, storage };
}

test('base64 size and file validation', () => {
  assert.equal(base64Bytes(b64('abc')), 3);
  assert.equal(base64Bytes(b64('abcd')), 4);
  assert.equal(base64Bytes(b64('abcde')), 5);
  assert.ok(cleanFile({ id: 'short', data: b64('x') }).error);
  assert.ok(cleanFile({ id: 'abcdefgh12', data: 'לא base64' }).error);
  assert.ok(cleanFile({ id: 'abcdefgh12', data: '' }).error);
  const { file } = cleanFile({ id: 'abcdefgh12', name: 'קבלה\n.pdf', type: 'text/html; x', data: b64('שלום') });
  assert.equal(file.name, 'קבלה.pdf');
  assert.equal(file.type, 'application/octet-stream');
  assert.equal(file.size, Buffer.from('שלום').length);
});

test('big files are split into chunks and come back whole', async () => {
  const storage = fakeStorage();
  const data = b64('x'.repeat(CHUNK_CHARS)); // יותר מחתיכה אחת
  await putFile(storage, cleanFile({ id: 'file123456', name: 'a.txt', type: 'text/plain', data }).file);
  assert.ok([...storage.map.keys()].filter((k) => k.startsWith('fc:file123456:')).length >= 2);
  const back = await getFile(storage, 'file123456');
  assert.equal(back.data, data);
  assert.equal(back.type, 'text/plain');
  assert.equal(await getFile(storage, 'missing999'), null);
});

test('files no task points to are removed after a day', async () => {
  const storage = fakeStorage();
  const now = Date.now();
  const put = (id, at) => putFile(storage, cleanFile({ id, data: b64(id) }).file, at);
  await put('kept000001', now - 2 * ORPHAN_AFTER_MS);
  await put('orphan0001', now - 2 * ORPHAN_AFTER_MS);
  await put('fresh00001', now);
  await put('ofdeleted1', now - 2 * ORPHAN_AFTER_MS);
  await storage.put('r:task:a', { kind: 'task', id: 'a', data: { id: 'a', attachments: [{ id: 'kept000001' }] } });
  await storage.put('r:task:b', { kind: 'task', id: 'b', deleted: true });
  assert.equal(await cleanupFiles(storage, now), 2);
  assert.ok(await getFile(storage, 'kept000001'));
  assert.ok(await getFile(storage, 'fresh00001'));
  assert.equal(await getFile(storage, 'orphan0001'), null);
  assert.equal([...storage.map.keys()].some((k) => k.includes('orphan0001')), false);
});

test('upload and download through the server, only with the password', async () => {
  const { env } = fakeEnv();
  const token = (await call(env, '/login', { password: 'סיסמה-סודית' })).data.token;
  const body = { id: 'photo12345', name: 'תמונה.jpg', type: 'image/jpeg', data: b64('תמונה') };
  assert.equal((await call(env, '/files/put', body)).status, 401);
  const up = await call(env, '/files/put', body, token);
  assert.equal(up.status, 200);
  assert.deepEqual(up.data.file, { id: 'photo12345', name: 'תמונה.jpg', type: 'image/jpeg', size: Buffer.from('תמונה').length });
  const down = await call(env, '/files/get', { id: 'photo12345' }, token);
  assert.equal(down.data.file.data, body.data);
  assert.equal((await call(env, '/files/get', { id: 'nothing123' }, token)).status, 404);
  assert.equal((await call(env, '/files/put', { ...body, data: '###' }, token)).status, 400);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Directory } from '../src/directory.js';

function makeDir() {
  const map = new Map();
  return new Directory({
    storage: {
      async get(k) { return map.get(k); },
      async put(k, v) { map.set(k, v); },
      async delete(k) { map.delete(k); },
    },
  });
}
const post = (dir, path, body) =>
  dir.fetch(new Request('https://do.local' + path, { method: 'POST', body: JSON.stringify(body) })).then((r) => r.json());

test('רישום ופתרון של קוד → מזהה משפחה', async () => {
  const dir = makeDir();
  await post(dir, '/register', { code: '123456', familyId: 'famABC' });
  const r = await post(dir, '/resolve', { code: '123456' });
  assert.equal(r.familyId, 'famABC');
});

test('קוד לשימוש חד-פעמי – פתרון שני נכשל', async () => {
  const dir = makeDir();
  await post(dir, '/register', { code: '222333', familyId: 'fam2' });
  assert.equal((await post(dir, '/resolve', { code: '222333' })).familyId, 'fam2');
  assert.equal((await post(dir, '/resolve', { code: '222333' })).error, 'bad_code');
});

test('קוד לא קיים נכשל', async () => {
  const dir = makeDir();
  assert.equal((await post(dir, '/resolve', { code: '000000' })).error, 'bad_code');
});

test('קוד לא תקין ברישום נדחה', async () => {
  const dir = makeDir();
  assert.equal((await post(dir, '/register', { code: 'abc', familyId: 'x' })).error, 'bad');
});

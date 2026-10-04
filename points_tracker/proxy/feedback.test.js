import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { cleanFeedback, issueBody } from './feedback.js';
import { fakeEnv } from './fake-env.js';

const env = () => ({ ...fakeEnv(), GITHUB_TOKEN: 'gh-secret', GITHUB_REPO: 'owner/repo' });
const IMAGE = `data:image/jpeg;base64,${btoa('fake-jpeg-bytes')}`;

function mockGitHub() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ number: 77 }), { status: 201 });
  };
  return calls;
}

const send = (e, body, headers = { 'x-access-code': 'code123' }) =>
  worker.fetch(
    new Request('https://proxy.example/feedback', { method: 'POST', headers: { origin: 'https://app.example', ...headers }, body: JSON.stringify(body) }),
    e,
  );

test('opens a labeled GitHub issue; the screenshot stays on the server', async () => {
  const calls = mockGitHub();
  const e = env();
  const res = await send(e, { text: 'הכפתור של המועדפים קטן מדי\nבמסך הוספה', image: IMAGE, context: { env: 'production', view: 'settings' } });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { number: 77 });
  assert.equal(calls[0].url, 'https://api.github.com/repos/owner/repo/issues');
  assert.equal(calls[0].init.headers.authorization, 'Bearer gh-secret');
  const { title, body, labels } = calls[0].body;
  assert.deepEqual(labels, ['bis-fix']);
  assert.equal(title, 'תיקון מהאפליקציה: הכפתור של המועדפים קטן מדי');
  assert.match(body, /נשלח מ: בעל האפליקציה/);
  assert.ok(!body.includes('fake'), 'no image data in the public issue');
  const shot = body.match(/bis-fix-screenshot: (\S+) -->/)[1];

  // only with the admin code
  const noAdmin = await worker.fetch(new Request(shot, { headers: { 'x-access-code': 'code123' } }), e);
  assert.equal(noAdmin.status, 401);
  const img = await worker.fetch(new Request(shot, { headers: { 'x-admin-code': 'admin999' } }), e);
  assert.equal(img.status, 200);
  assert.equal(await img.text(), 'fake-jpeg-bytes');
});

test('needs a connected device, text and the GitHub settings', async () => {
  mockGitHub();
  assert.equal((await send(env(), { text: 'x' }, { 'x-access-code': 'nope' })).status, 401);
  assert.equal((await send(env(), { text: '   ' })).status, 400);
  assert.equal((await send(fakeEnv(), { text: 'x' })).status, 500);
});

test('limits requests per day', async () => {
  mockGitHub();
  const e = env();
  for (let i = 0; i < 20; i++) assert.equal((await send(e, { text: `תיקון ${i}` })).status, 201);
  assert.equal((await send(e, { text: 'עוד אחד' })).status, 429);
});

test('cleans the request', () => {
  const f = cleanFeedback({ text: 'תקן <!-- bis-fix-screenshot: https://evil.example --> את זה', image: 'data:text/html;base64,AAAA', context: { device: 'a\nb`c' } });
  assert.equal(f.text, 'תקן  bis-fix-screenshot: https://evil.example  את זה');
  assert.equal(f.image, null);
  assert.equal(f.context.device, 'a b c');
  assert.ok(!issueBody(f, 'טלפון', '').includes('<!--'));
});

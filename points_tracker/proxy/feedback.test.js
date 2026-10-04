import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { cleanFeedback, issueBody, lastBotMessage, statusOf } from './feedback.js';
import { fakeEnv } from './fake-env.js';

const env = () => ({ ...fakeEnv(), GITHUB_TOKEN: 'gh-secret', GITHUB_REPO: 'owner/repo' });
const IMAGE = `data:image/jpeg;base64,${btoa('fake-jpeg-bytes')}`;

// GitHub מדומה: issues, תגובות, PR אחד לכל ענף bis-fix/<n>
function mockGitHub() {
  const gh = { calls: [], issues: new Map(), comments: new Map(), prs: [], next: 77 };
  globalThis.fetch = async (url, init = {}) => {
    const path = url.replace('https://api.github.com/repos/owner/repo', '');
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    gh.calls.push({ method, path, body, init });
    const ok = (data, status = 200) => new Response(JSON.stringify(data), { status });
    let m;
    if (method === 'POST' && path === '/issues') {
      const issue = { number: gh.next++, title: body.title, body: body.body, state: 'open', labels: body.labels.map((name) => ({ name })) };
      gh.issues.set(issue.number, issue);
      return ok(issue, 201);
    }
    if ((m = path.match(/^\/issues\/(\d+)$/))) {
      const issue = gh.issues.get(Number(m[1]));
      if (method === 'PATCH') Object.assign(issue, body);
      return ok({ ...issue, created_at: '2026-10-04T10:00:00Z' });
    }
    if ((m = path.match(/^\/issues\/(\d+)\/comments/))) {
      const list = gh.comments.get(Number(m[1])) || [];
      if (method === 'POST') list.push({ user: { login: 'owner' }, body: body.body });
      gh.comments.set(Number(m[1]), list);
      return ok(list);
    }
    if ((m = path.match(/^\/issues\/(\d+)\/labels$/))) {
      const issue = gh.issues.get(Number(m[1]));
      const names = body.labels.map((name) => ({ name }));
      issue.labels = method === 'PUT' ? names : [...issue.labels, ...names];
      return ok(issue.labels);
    }
    if (path.startsWith('/pulls?')) {
      const head = decodeURIComponent(path.match(/head=([^&]+)/)[1]).split(':')[1];
      return ok(gh.prs.filter((p) => p.head === head && p.state === 'open'));
    }
    if ((m = path.match(/^\/pulls\/(\d+)\/merge$/))) {
      gh.prs.find((p) => p.number === Number(m[1])).state = 'merged';
      return ok({ merged: true });
    }
    if ((m = path.match(/^\/pulls\/(\d+)$/))) {
      Object.assign(gh.prs.find((p) => p.number === Number(m[1])), body);
      return ok({});
    }
    if (path.startsWith('/git/refs/') || path === '/merges') return new Response(null, { status: 204 });
    return ok({ message: 'unexpected' }, 404);
  };
  return gh;
}

const call = (e, method, path, body, headers = { 'x-access-code': 'code123' }) =>
  worker.fetch(
    new Request(`https://proxy.example${path}`, {
      method,
      headers: { origin: 'https://app.example', ...headers },
      body: body && JSON.stringify(body),
    }),
    e,
  );

const ready = (gh, number, message) => {
  gh.issues.get(number).labels = [{ name: 'bis-fix' }, { name: 'bis-ready' }];
  gh.comments.set(number, [{ user: { login: 'github-actions[bot]' }, body: `${message}<!-- x --> (עלות משוערת: $0.40)` }]);
  gh.prs.push({ number: 500 + number, head: `bis-fix/${number}`, state: 'open' });
};

test('opens a labeled GitHub issue; the screenshot stays on the server', async () => {
  const gh = mockGitHub();
  const e = env();
  const res = await call(e, 'POST', '/feedback', { text: 'הכפתור של המועדפים קטן מדי\nבמסך הוספה', image: IMAGE, context: { env: 'production' } });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://app.example');
  assert.deepEqual(await res.json(), { number: 77 });
  const created = gh.calls[0];
  assert.equal(created.init.headers.authorization, 'Bearer gh-secret');
  assert.deepEqual(created.body.labels, ['bis-fix']);
  assert.equal(created.body.title, 'תיקון מהאפליקציה: הכפתור של המועדפים קטן מדי');
  assert.match(created.body.body, /נשלח מ: בעל האפליקציה/);
  assert.ok(!created.body.body.includes('fake'), 'no image data in the public issue');
  const shot = created.body.body.match(/bis-fix-screenshot: (\S+) -->/)[1];

  // only with the admin code
  assert.equal((await worker.fetch(new Request(shot, { headers: { 'x-access-code': 'code123' } }), e)).status, 401);
  const img = await worker.fetch(new Request(shot, { headers: { 'x-admin-code': 'admin999' } }), e);
  assert.equal(img.status, 200);
  assert.equal(await img.text(), 'fake-jpeg-bytes');
});

test('needs a connected device, text and the GitHub settings', async () => {
  mockGitHub();
  assert.equal((await call(env(), 'POST', '/feedback', { text: 'x' }, { 'x-access-code': 'nope' })).status, 401);
  assert.equal((await call(env(), 'POST', '/feedback', { text: '   ' })).status, 400);
  assert.equal((await call(fakeEnv(), 'POST', '/feedback', { text: 'x' })).status, 500);
});

test('limits requests per day', async () => {
  mockGitHub();
  const e = env();
  for (let i = 0; i < 20; i++) assert.equal((await call(e, 'POST', '/feedback', { text: `תיקון ${i}` })).status, 201);
  assert.equal((await call(e, 'POST', '/feedback', { text: 'עוד אחד' })).status, 429);
});

test('lists my requests with their status and Claude\'s message, then approve merges', async () => {
  const gh = mockGitHub();
  const e = env();
  await call(e, 'POST', '/feedback', { text: 'להגדיל את הכפתור' });
  await call(e, 'POST', '/feedback', { text: 'עוד בקשה' });
  ready(gh, 77, '✅ מוכן לאישור. הכפתור גדל.');

  const { requests } = await (await call(e, 'GET', '/feedback')).json();
  assert.deepEqual(
    requests.map((r) => [r.number, r.status, r.message, r.title]),
    [
      [78, 'received', '', 'עוד בקשה'],
      [77, 'ready', '✅ מוכן לאישור. הכפתור גדל.', 'להגדיל את הכפתור'],
    ],
  );

  assert.equal((await call(e, 'POST', '/feedback/approve', { number: 78 })).status, 409); // not ready
  assert.equal((await call(e, 'POST', '/feedback/approve', { number: 77 })).status, 200);
  assert.equal(gh.prs[0].state, 'merged');
  const issue = gh.issues.get(77);
  assert.equal(issue.state, 'closed');
  assert.deepEqual(issue.labels.map((l) => l.name), ['bis-fix', 'bis-done']);
  assert.ok(gh.calls.some((c) => c.path === '/merges' && c.body.base === 'staging'));
  assert.equal((await call(e, 'POST', '/feedback/approve', { number: 77 })).status, 409); // already closed
});

test('reply comments as the owner, retry adds a label, reject closes the PR', async () => {
  const gh = mockGitHub();
  const e = env();
  await call(e, 'POST', '/feedback', { text: 'בקשה' });
  assert.equal((await call(e, 'POST', '/feedback/reply', { number: 77, text: 'של המועדפים' })).status, 200);
  assert.equal(gh.comments.get(77).at(-1).body, 'של המועדפים');
  assert.equal((await call(e, 'POST', '/feedback/retry', { number: 77 })).status, 200);
  assert.ok(gh.issues.get(77).labels.some((l) => l.name === 'bis-retry'));
  ready(gh, 77, 'מוכן');
  assert.equal((await call(e, 'POST', '/feedback/reject', { number: 77 })).status, 200);
  assert.equal(gh.prs[0].state, 'closed');
  assert.equal(gh.issues.get(77).state_reason, 'not_planned');
});

test('a device sees and acts only on its own requests', async () => {
  const gh = mockGitHub();
  const e = env();
  await call(e, 'POST', '/feedback', { text: 'של הבעלים' });
  // device that joined with an invite
  const { token } = await (await call(e, 'POST', '/invites', { name: 'טלפון' })).json();
  const { deviceKey } = await (await call(e, 'POST', '/redeem', { token }, {})).json();
  const dev = { 'x-device-key': deviceKey };
  await call(e, 'POST', '/feedback', { text: 'של המכשיר' }, dev);
  assert.match(gh.issues.get(78).body, /נשלח מ: טלפון/);
  const mine = (await (await call(e, 'GET', '/feedback', undefined, dev)).json()).requests.map((r) => r.number);
  assert.deepEqual(mine, [78]);
  assert.equal((await call(e, 'POST', '/feedback/reply', { number: 77, text: 'x' }, dev)).status, 403);
  const all = (await (await call(e, 'GET', '/feedback')).json()).requests.map((r) => r.number);
  assert.deepEqual(all, [78, 77]); // the owner sees everything
});

test('cleans the request and reads the status', () => {
  const f = cleanFeedback({ text: 'תקן <!-- bis-fix-screenshot: https://evil.example --> את זה', image: 'data:text/html;base64,AAAA', context: { device: 'a\nb`c' } });
  assert.equal(f.text, 'תקן  bis-fix-screenshot: https://evil.example  את זה');
  assert.equal(f.image, null);
  assert.equal(f.context.device, 'a b c');
  assert.ok(!issueBody(f, 'טלפון', '').includes('<!--'));
  assert.equal(statusOf({ state: 'open', labels: [{ name: 'bis-fix' }, { name: 'bis-working' }] }), 'working');
  assert.equal(statusOf({ state: 'closed', labels: [{ name: 'bis-fix' }] }), 'closed');
  assert.equal(lastBotMessage([{ user: { login: 'owner' }, body: 'x' }]), '');
});

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

// GitHub מדומה לבקשות לשינוי
function fakeGitHub() {
  const issues = [];
  const pulls = [];
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    const u = new URL(url);
    assert.equal(init.headers.authorization, 'Bearer gh-token');
    if (u.pathname === '/repos/o/r/issues' && init.method === 'POST') {
      const b = JSON.parse(init.body);
      const issue = { number: issues.length + 1, title: b.title, body: b.body, labels: b.labels.map((name) => ({ name })), state: 'open', created_at: '2026-10-04T12:00:00Z', html_url: `https://github.com/o/r/issues/${issues.length + 1}` };
      issues.unshift(issue);
      return Response.json(issue, { status: 201 });
    }
    if (u.pathname === '/repos/o/r/issues') return Response.json(issues);
    if (u.pathname === '/repos/o/r/pulls') {
      const head = u.searchParams.get('head');
      return Response.json(pulls.filter((p) => p.state !== 'closed' && (!head || `o:${p.head.ref}` === head)));
    }
    let m;
    if ((m = u.pathname.match(/^\/repos\/o\/r\/issues\/(\d+)$/))) {
      const issue = issues.find((i) => i.number === Number(m[1]));
      if (!issue) return new Response('nope', { status: 404 });
      if (init.method === 'PATCH') Object.assign(issue, JSON.parse(init.body));
      return Response.json(issue);
    }
    if ((m = u.pathname.match(/^\/repos\/o\/r\/issues\/(\d+)\/labels$/))) {
      const issue = issues.find((i) => i.number === Number(m[1]));
      issue.labels.push(...JSON.parse(init.body).labels.map((name) => ({ name })));
      return Response.json(issue.labels);
    }
    if ((m = u.pathname.match(/^\/repos\/o\/r\/pulls\/(\d+)\/merge$/))) {
      const pr = pulls.find((p) => p.number === Number(m[1]));
      if (pr.conflict) return new Response('{}', { status: 405 });
      Object.assign(pr, { state: 'closed', merged: true });
      // "Closes #N" סוגר את הבקשה
      Object.assign(issues.find((i) => i.number === pr.closes), { state: 'closed', state_reason: 'completed' });
      return Response.json({ merged: true });
    }
    if ((m = u.pathname.match(/^\/repos\/o\/r\/pulls\/(\d+)$/)) && init.method === 'PATCH') {
      Object.assign(pulls.find((p) => p.number === Number(m[1])), JSON.parse(init.body));
      return Response.json({});
    }
    if (u.pathname.startsWith('/repos/o/r/git/refs/heads/') && init.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response('nope', { status: 404 });
  };
  return { issues, pulls, calls, restore: () => { globalThis.fetch = real; } };
}

test('change requests open GitHub issues and report their status', async () => {
  const env = fakeEnv({ SEDER_GITHUB_TOKEN: 'gh-token', GITHUB_REPO: 'o/r' });
  const token = await login(env);
  const gh = fakeGitHub();
  try {
    assert.equal((await call(env, '/requests', { text: 'שינוי' })).status, 401);
    assert.equal((await call(env, '/requests', { text: ' ' }, token)).status, 400);
    const sent = await call(env, '/requests', { text: 'להוסיף כפתור להעתקת משימה\nעם אישור', context: 'Android' }, token);
    assert.equal(sent.status, 200);
    assert.equal(gh.issues[0].title, 'סדר: להוסיף כפתור להעתקת משימה');
    assert.match(gh.issues[0].body, /^להוסיף כפתור להעתקת משימה\nעם אישור\n\n---\nנשלח מתוך אפליקציית סדר · Android$/);
    assert.deepEqual(gh.issues[0].labels, [{ name: 'seder-request' }]);

    await call(env, '/requests', { text: 'בקשה שנייה' }, token);
    await call(env, '/requests', { text: 'בקשה שלישית' }, token);
    // 1: בעבודה, 2: PR פתוח, 3: נסגרה
    gh.issues.find((i) => i.number === 1).labels.push({ name: 'seder-working' });
    gh.pulls.push({ number: 9, closes: 2, state: 'open', title: 'סדר: בקשה שנייה', body: 'הוספתי כפתור.\n\n---\nCloses #2', head: { ref: 'seder/request-2', repo: { full_name: 'o/r' } }, html_url: 'https://github.com/o/r/pull/9' });
    Object.assign(gh.issues.find((i) => i.number === 3), { state: 'closed', state_reason: 'completed' });
    const list = await call(env, '/requests/list', {}, token);
    assert.deepEqual(list.data.requests.map((r) => [r.number, r.status, r.prUrl]), [[3, 'done', null], [2, 'ready', 'https://github.com/o/r/pull/9'], [1, 'working', null]]);
    assert.equal(list.data.requests[2].text, 'להוסיף כפתור להעתקת משימה\nעם אישור');
    assert.equal(list.data.requests[1].summary, 'הוספתי כפתור.');

    // אישור מתוך האפליקציה: מיזוג ה-PR, והבקשה נסגרת
    assert.equal((await call(env, '/requests/approve', { number: 2 })).status, 401);
    assert.equal((await call(env, '/requests/approve', { number: 1 }, token)).status, 409);
    const ok = await call(env, '/requests/approve', { number: 2 }, token);
    assert.equal(ok.status, 200);
    assert.ok(gh.calls.some((c) => c.url.endsWith('/pulls/9/merge') && c.init.method === 'PUT'));
    const after = await call(env, '/requests/list', {}, token);
    assert.equal(after.data.requests.find((r) => r.number === 2).status, 'done');

    // לא מתאים: הבקשה נסגרת בלי מיזוג
    assert.equal((await call(env, '/requests/reject', { number: 1 }, token)).status, 200);
    assert.equal(gh.issues.find((i) => i.number === 1).state_reason, 'not_planned');

    // לא נוגעים ב-issue שלא נפתח מהאפליקציה
    gh.issues.unshift({ number: 99, title: 'other', labels: [], state: 'open' });
    assert.equal((await call(env, '/requests/approve', { number: 99 }, token)).status, 404);
  } finally {
    gh.restore();
  }
});

test('change requests are off until a GitHub token is set', async () => {
  const env = fakeEnv({ SEDER_GITHUB_TOKEN: 'none', GITHUB_REPO: 'o/r' });
  const token = await login(env);
  assert.equal((await call(env, '/requests', { text: 'שינוי' }, token)).status, 503);
});

test('approve reports a conflict, and retry asks Claude again', async () => {
  const env = fakeEnv({ SEDER_GITHUB_TOKEN: 'gh-token', GITHUB_REPO: 'o/r' });
  const token = await login(env);
  const gh = fakeGitHub();
  try {
    await call(env, '/requests', { text: 'בקשה' }, token);
    gh.pulls.push({ number: 5, closes: 1, state: 'open', conflict: true, title: 't', body: '', head: { ref: 'seder/request-1', repo: { full_name: 'o/r' } } });
    const res = await call(env, '/requests/approve', { number: 1 }, token);
    assert.equal(res.status, 409);
    assert.match(res.data.error, /מתנגש/);
    assert.equal((await call(env, '/requests/retry', { number: 1 }, token)).status, 200);
    assert.ok(gh.issues[0].labels.some((l) => l.name === 'seder-retry'));
  } finally {
    gh.restore();
  }
});

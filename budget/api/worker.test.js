import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Budget, originAllowed } from './worker.js';
import { cleanRecord } from './budget.js';

// זיכרון מדומה במקום האחסון של Durable Object
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) {
      return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k));
    },
    async put(k, v) {
      if (typeof k === 'object') {
        if (Object.keys(k).length > 128) throw new Error('too many keys');
        for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      } else map.set(k, clone(v));
    },
    async delete(k) {
      for (const kk of [k].flat()) map.delete(kk);
    },
    async list({ prefix }) {
      return new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)]));
    },
  };
}

const ORIGIN = 'https://bayit-budget.pages.dev';

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`, time: 1_800_000_000_000 };
  const storage = fakeStorage();
  let obj = null;
  env.BUDGET = {
    idFromName: (n) => n,
    get: () => ({ fetch: (req) => (obj ||= new Budget({ storage }, { NOW: () => env.time, ...extra })).fetch(req) }),
  };
  env.restart = () => {
    obj = null;
  };
  return env;
}

async function call(env, path, body = {}, token = '', origin = ORIGIN) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json() };
}

test('כתובות מותרות', () => {
  assert.ok(originAllowed('https://abc.bayit-budget.pages.dev', 'https://*.bayit-budget.pages.dev'));
  assert.ok(!originAllowed('https://evil.com', 'https://*.bayit-budget.pages.dev'));
});

test('אתר זר לא יכול לפנות לשרת', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/status', {}, '', 'https://evil.com')).status, 403);
});

test('סיסמה בפעם הראשונה, כניסה, ונעילה אחרי ניסיונות שגויים', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/status')).data.ready, false);
  assert.equal((await call(env, '/setup', { password: '123' })).status, 400);
  const { data } = await call(env, '/setup', { password: 'secret123' });
  assert.ok(data.token);
  assert.equal((await call(env, '/status')).data.ready, true);
  // אי אפשר לקבוע שוב
  assert.equal((await call(env, '/setup', { password: 'other123' })).status, 409);
  assert.equal((await call(env, '/sync', {})).status, 401);
  assert.equal((await call(env, '/sync', {}, 'wrong')).status, 401);
  assert.equal((await call(env, '/sync', {}, data.token)).status, 200);
  assert.ok((await call(env, '/login', { password: 'secret123' })).data.token);
  for (let i = 0; i < 10; i++) assert.equal((await call(env, '/login', { password: 'nope' })).status, 401);
  assert.equal((await call(env, '/login', { password: 'secret123' })).status, 429);
  env.time += 16 * 60 * 1000;
  assert.equal((await call(env, '/login', { password: 'secret123' })).status, 200);
});

test('סנכרון בין שני מכשירים: העריכה המאוחרת גוברת, מחיקה עוברת', async () => {
  const env = fakeEnv();
  const a = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const b = (await call(env, '/login', { password: 'secret123' })).data.token;
  const item = { id: 'i1', t: 'item', kind: 'expense', type: 'fixed', name: 'חשמל', amount: 400, start: '2026-10', updatedAt: 100 };
  let r = await call(env, '/sync', { since: 0, changes: [item] }, a);
  assert.equal(r.data.rev, 1);
  r = await call(env, '/sync', { since: 0, changes: [] }, b);
  assert.equal(r.data.changes.length, 1);
  assert.equal(r.data.changes[0].name, 'חשמל');
  // עריכה ישנה יותר לא דורסת
  await call(env, '/sync', { since: 1, changes: [{ ...item, amount: 1, updatedAt: 50 }] }, b);
  await call(env, '/sync', { since: 1, changes: [{ ...item, amount: 450, updatedAt: 200 }] }, b);
  r = await call(env, '/sync', { since: 1, changes: [] }, a);
  assert.equal(r.data.changes.length, 1);
  assert.equal(r.data.changes[0].amount, 450);
  await call(env, '/sync', { since: 2, changes: [{ ...item, deleted: true, updatedAt: 300 }] }, a);
  // אחרי הפעלה מחדש הכול נטען מהאחסון
  env.restart();
  r = await call(env, '/sync', { since: 2, changes: [] }, b);
  assert.equal(r.data.changes[0].deleted, true);
  // אין שינויים חדשים
  r = await call(env, '/sync', { since: r.data.rev, changes: [] }, b);
  assert.equal(r.data.changes.length, 0);
});

test('הרבה רשומות בבת אחת (שחזור מגיבוי)', async () => {
  const env = fakeEnv();
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const changes = Array.from({ length: 500 }, (_, i) => ({ id: `x${i}`, t: 'item', amount: i, updatedAt: 10 }));
  const r = await call(env, '/sync', { since: 0, changes }, t);
  assert.equal(r.data.changes.length, 500);
});

test('החלפת סיסמה מנתקת את שאר המכשירים', async () => {
  const env = fakeEnv();
  const a = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const b = (await call(env, '/login', { password: 'secret123' })).data.token;
  assert.equal((await call(env, '/password', { password: 'bad', newPassword: 'newpass1' }, a)).status, 401);
  const { data } = await call(env, '/password', { password: 'secret123', newPassword: 'newpass1' }, a);
  assert.equal((await call(env, '/sync', {}, b)).status, 401);
  assert.equal((await call(env, '/sync', {}, data.token)).status, 200);
  assert.equal((await call(env, '/login', { password: 'newpass1' })).status, 200);
});

test('רשומות פגומות לא נשמרות', () => {
  assert.equal(cleanRecord(null), null);
  assert.equal(cleanRecord({ id: 'a' }), null);
  assert.equal(cleanRecord({ id: 'a', updatedAt: 1, note: 'x'.repeat(13000) }), null);
  assert.deepEqual(cleanRecord({ id: 'a', updatedAt: 1, rev: 9 }), { id: 'a', updatedAt: 1 });
});

test('מחיקת כל הנתונים: צריך סיסמה, והמחיקה עוברת לשאר המכשירים', async () => {
  const env = fakeEnv();
  const a = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const b = (await call(env, '/login', { password: 'secret123' })).data.token;
  await call(env, '/sync', { since: 0, changes: [{ id: 'i1', t: 'item', name: 'חשמל', amount: 400, updatedAt: 100 }, { id: 'settings', t: 'settings', balance: 5, updatedAt: 100 }] }, a);
  const before = (await call(env, '/sync', { since: 0, changes: [] }, b)).data;
  assert.equal((await call(env, '/reset', { password: 'wrong' }, a)).status, 401);
  assert.equal((await call(env, '/reset', { password: 'secret123' }, '')).status, 401);
  assert.equal((await call(env, '/reset', { password: 'secret123' }, a)).status, 200);
  const after = (await call(env, '/sync', { since: before.rev, changes: [] }, b)).data;
  assert.equal(after.changes.length, 2);
  assert.ok(after.changes.every((r) => r.deleted && !r.name && !r.amount));
});

test('AI: שאלה עם סיכום התקציב, ומגבלה ליום', async () => {
  const seen = [];
  const AI_CLIENT = {
    beta: {
      messages: {
        create: async (req) => {
          seen.push(req);
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: '## תובנות\n- אפשר לחסוך בביטוחים' }] };
        },
      },
    },
  };
  const env = fakeEnv({ AI_CLIENT });
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  assert.equal((await call(env, '/ai', { context: 'x', question: '' }, t)).status, 400);
  const r = await call(env, '/ai', { context: 'הכנסות 20000', question: 'איפה לחסוך?' }, t);
  assert.equal(r.status, 200);
  assert.match(r.data.answer, /ביטוחים/);
  assert.match(seen[0].messages[0].content, /הכנסות 20000/);
  assert.equal(seen[0].model, 'claude-opus-5-5');
  for (let i = 0; i < 39; i++) await call(env, '/ai', { question: 'שוב' }, t);
  assert.equal((await call(env, '/ai', { question: 'שוב' }, t)).status, 429);
  // יום חדש
  env.time += 24 * 60 * 60 * 1000;
  assert.equal((await call(env, '/ai', { question: 'שוב' }, t)).status, 200);
});

test('AI בלי מפתח – הודעה ברורה', async () => {
  const env = fakeEnv();
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  assert.equal((await call(env, '/ai', { question: 'שאלה' }, t)).status, 503);
});

// GitHub מדומה: issues, תגובות, תוויות ו-PR
function fakeGithub() {
  const gh = { issues: new Map(), comments: new Map(), prs: [], merged: [], calls: [] };
  gh.fetch = async (url, { method = 'GET', body, headers } = {}) => {
    const path = url.replace('https://api.github.com/repos/o/r', '');
    gh.calls.push(`${method} ${path}`);
    assert.equal(headers.authorization, 'Bearer gh-token');
    const data = body ? JSON.parse(body) : null;
    const ok = (v, status = 200) => new Response(JSON.stringify(v), { status });
    let m;
    if (method === 'POST' && path === '/issues') {
      const number = gh.issues.size + 1;
      gh.issues.set(number, { number, title: data.title, body: data.body, state: 'open', labels: data.labels.map((name) => ({ name })), created_at: 'now' });
      return ok({ number }, 201);
    }
    if ((m = path.match(/^\/issues\/(\d+)$/))) {
      const issue = gh.issues.get(+m[1]);
      if (method === 'PATCH') Object.assign(issue, data);
      return ok(issue);
    }
    if ((m = path.match(/^\/issues\/(\d+)\/comments/))) {
      const list = gh.comments.get(+m[1]) || [];
      if (method === 'POST') list.push({ user: { login: 'o' }, body: data.body });
      gh.comments.set(+m[1], list);
      return ok(list);
    }
    if ((m = path.match(/^\/issues\/(\d+)\/labels$/))) {
      const issue = gh.issues.get(+m[1]);
      issue.labels = method === 'PUT' ? data.labels.map((name) => ({ name })) : [...issue.labels, ...data.labels.map((name) => ({ name }))];
      return ok(issue.labels);
    }
    if (path.startsWith('/pulls?')) return ok(gh.prs.filter((p) => path.includes(encodeURIComponent(`o:${p.branch}`))));
    if ((m = path.match(/^\/pulls\/(\d+)\/merge$/))) {
      gh.merged.push(+m[1]);
      return ok({ merged: true });
    }
    if (path.startsWith('/git/refs/')) return new Response(null, { status: 204 });
    return ok({}, 404);
  };
  return gh;
}

test('בקשת שינוי מהאפליקציה: נשלחת ל-GitHub, צילום המסך נשאר בשרת, ומאשרים מהאפליקציה', async () => {
  const gh = fakeGithub();
  const env = fakeEnv({ FETCH: gh.fetch, GITHUB_TOKEN: 'gh-token', GITHUB_REPO: 'o/r' });
  Object.assign(env, { GITHUB_TOKEN: 'gh-token' });
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  assert.equal((await call(env, '/fix/send', { text: 'שינוי' }, '')).status, 401);
  assert.equal((await call(env, '/fix/send', { text: '  ' }, t)).status, 400);
  const img = `data:image/jpeg;base64,${btoa('JPEGDATA')}`;
  const sent = await call(env, '/fix/send', { text: 'להגדיל את הגרף\nבמסך גרפים', image: img, view: 'charts' }, t);
  assert.equal(sent.status, 200);
  const issue = gh.issues.get(sent.data.number);
  assert.deepEqual(issue.labels.map((l) => l.name), ['budget-fix']);
  assert.match(issue.title, /להגדיל את הגרף/);
  // ב-issue (ציבורי) רק קישור, לא התמונה
  assert.ok(!issue.body.includes('JPEGDATA') && !issue.body.includes(btoa('JPEGDATA')));
  const shotUrl = issue.body.match(/budget-fix-screenshot: (\S+) -->/)[1];
  assert.match(shotUrl, /^https:\/\/api\.test\/fix\/image\?id=/);

  // את התמונה מקבלים רק עם הטוקן של GitHub
  const get = (auth) => worker.fetch(new Request(shotUrl, { headers: auth ? { authorization: `Bearer ${auth}` } : {} }), env);
  assert.equal((await get('')).status, 403);
  assert.equal((await get('wrong')).status, 403);
  const shot = await get('gh-token');
  assert.equal(shot.status, 200);
  assert.equal(new TextDecoder().decode(await shot.arrayBuffer()), 'JPEGDATA');

  // Claude הכין שינוי
  issue.labels = [{ name: 'budget-fix' }, { name: 'budget-ready' }];
  gh.comments.set(issue.number, [{ user: { login: 'github-actions[bot]' }, body: '✅ הגרף גדול יותר <!-- x --> (עלות משוערת: $0.40)' }]);
  gh.prs.push({ number: 77, branch: `budget-fix/${issue.number}` });
  const list = await call(env, '/fix/list', {}, t);
  assert.deepEqual(list.data.requests.map((r) => [r.status, r.message, r.title]), [['ready', '✅ הגרף גדול יותר', 'להגדיל את הגרף']]);

  // בקשה שלא נשלחה מכאן – אסור
  assert.equal((await call(env, '/fix/approve', { number: 999 }, t)).status, 403);
  assert.equal((await call(env, '/fix/approve', { number: issue.number }, t)).status, 200);
  assert.deepEqual(gh.merged, [77]);
  assert.equal(issue.state, 'closed');
  assert.ok(issue.labels.some((l) => l.name === 'budget-done'));
  assert.equal((await call(env, '/fix/reply', { number: issue.number, text: 'עוד' }, t)).status, 409);
});

test('בקשת שינוי: תשובה ל-Claude, ניסיון חוזר, דחייה ומגבלה ליום', async () => {
  const gh = fakeGithub();
  const env = fakeEnv({ FETCH: gh.fetch, GITHUB_TOKEN: 'gh-token', GITHUB_REPO: 'o/r' });
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  const n = (await call(env, '/fix/send', { text: 'משהו' }, t)).data.number;
  assert.equal((await call(env, '/fix/reply', { number: n, text: 'בגרף העליון' }, t)).status, 200);
  assert.equal(gh.comments.get(n)[0].body, 'בגרף העליון');
  gh.issues.get(n).labels = [{ name: 'budget-fix' }, { name: 'budget-working' }];
  assert.equal((await call(env, '/fix/retry', { number: n }, t)).status, 409);
  gh.issues.get(n).labels = [{ name: 'budget-fix' }, { name: 'budget-failed' }];
  assert.equal((await call(env, '/fix/retry', { number: n }, t)).status, 200);
  assert.ok(gh.issues.get(n).labels.some((l) => l.name === 'budget-retry'));
  assert.equal((await call(env, '/fix/reject', { number: n }, t)).status, 200);
  assert.equal(gh.issues.get(n).state, 'closed');
  for (let i = 0; i < 9; i++) await call(env, '/fix/send', { text: 'עוד' }, t);
  assert.equal((await call(env, '/fix/send', { text: 'עוד' }, t)).status, 429);
});

test('בלי טוקן של GitHub – הכפתור כבוי', async () => {
  const env = fakeEnv();
  const t = (await call(env, '/setup', { password: 'secret123' })).data.token;
  assert.deepEqual((await call(env, '/fix/list', {}, t)).data, { enabled: false, requests: [] });
  assert.equal((await call(env, '/fix/send', { text: 'x' }, t)).status, 503);
  assert.equal((await worker.fetch(new Request('https://api.test/fix/image?id=x', { headers: { authorization: 'Bearer ' } }), env)).status, 403);
});

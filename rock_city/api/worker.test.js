import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { School, originAllowed } from './worker.js';

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
      if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      else map.set(k, clone(v));
    },
    async delete(k) {
      for (const kk of [k].flat()) map.delete(kk);
    },
  };
}

function fakeEnv() {
  const env = { ALLOWED_ORIGINS: 'https://rock-city-school.pages.dev', time: 1_800_000_000_000 };
  const storage = fakeStorage();
  let school = null;
  env.SCHOOL = {
    idFromName: (n) => n,
    get: () => ({ fetch: (req) => (school ||= new School({ storage }, { NOW: () => env.time })).fetch(req) }),
  };
  // "הפעלה מחדש" של האובייקט – נטען שוב מהאחסון
  env.restart = () => {
    school = null;
  };
  env.storage = storage;
  return env;
}

async function call(env, path, body = {}, token = '', origin = 'https://rock-city-school.pages.dev') {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json() };
}

// בית ספר עם מנהל, שני מורים (אחד עם עריכה), תלמיד ושיעור לכל מורה
async function school() {
  const env = fakeEnv();
  const { data } = await call(env, '/setup', { username: 'Gil', password: 'secret123' });
  const admin = data.token;
  const save = (kind, item, t = admin) => call(env, '/save', { kind, item }, t);
  await save('teacher', { id: 'teacher-a', first: 'אבי', subjects: ['גיטרה'] });
  await save('teacher', { id: 'teacher-b', first: 'בתיה', subjects: ['פסנתר'] });
  await save('student', { id: 'student-1', first: 'דני', last: 'כהן', phone: '050' });
  await save('lesson', { id: 'lesson-a', teacherId: 'teacher-a', studentIds: ['student-1'], subject: 'גיטרה', roomId: 'room-1', kind: 'weekly', day: 1, start: '16:00', minutes: 45 });
  await save('lesson', { id: 'lesson-b', teacherId: 'teacher-b', studentIds: ['student-1'], subject: 'פסנתר', roomId: 'room-2', kind: 'weekly', day: 2, start: '17:00', minutes: 45 });
  const a = (await call(env, '/invite', { teacherId: 'teacher-a', level: 'edit' }, admin)).data.key;
  const b = (await call(env, '/invite', { teacherId: 'teacher-b', level: 'view' }, admin)).data.key;
  return { env, admin, a, b, save };
}

test('origins', () => {
  assert.ok(originAllowed('https://x.rock-city-school.pages.dev', 'https://*.rock-city-school.pages.dev'));
  assert.ok(!originAllowed('https://evil.com', 'https://*.rock-city-school.pages.dev'));
});

test('first setup creates the admin, only once', async () => {
  const env = fakeEnv();
  assert.deepEqual((await call(env, '/status')).data, { ready: false });
  assert.equal((await call(env, '/setup', { username: 'Gil', password: '123' })).status, 400);
  const ok = await call(env, '/setup', { username: 'Gil', password: 'secret123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token);
  assert.equal((await call(env, '/setup', { username: 'Eve', password: 'secret123' })).status, 409);
  assert.deepEqual((await call(env, '/status')).data, { ready: true });
});

test('requests from other sites are refused', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/status', {}, '', 'https://evil.com')).status, 403);
});

test('login, wrong password, lockout', async () => {
  const env = fakeEnv();
  await call(env, '/setup', { username: 'Gil', password: 'secret123' });
  assert.equal((await call(env, '/login', { username: 'gil', password: 'secret123' })).status, 200);
  assert.equal((await call(env, '/login', { username: 'Gil', password: 'nope' })).status, 401);
  for (let i = 0; i < 8; i++) await call(env, '/login', { username: 'Gil', password: 'nope' });
  assert.equal((await call(env, '/login', { username: 'Gil', password: 'secret123' })).status, 429);
  env.time += 16 * 60 * 1000;
  assert.equal((await call(env, '/login', { username: 'Gil', password: 'secret123' })).status, 200);
});

test('no token, no data', async () => {
  const { env } = await school();
  assert.equal((await call(env, '/state', {})).status, 401);
  assert.equal((await call(env, '/state', {}, 'x'.repeat(30))).status, 401);
});

test('state survives a restart and is filtered by permission', async () => {
  const { env, admin, b, save } = await school();
  await save('payment', { id: 'pay-1', studentId: 'student-1', amount: 400, date: '2026-10-01', until: '2026-11-01', method: 'ביט' });
  env.restart();
  const all = (await call(env, '/state', {}, admin)).data;
  assert.equal(all.me.level, 'admin');
  assert.equal(all.lessons.length, 2);
  assert.equal(all.payments.length, 1);
  assert.equal(all.teachers.find((t) => t.id === 'teacher-a').hasLink, true);
  assert.ok(!('keyHash' in all.teachers[0]));
  const same = (await call(env, '/state', { v: all.v }, admin)).data;
  assert.deepEqual(same, { same: true, v: all.v });

  const viewer = (await call(env, '/state', {}, b)).data;
  assert.equal(viewer.me.id, 'teacher-b');
  assert.equal(viewer.me.level, 'view');
  assert.equal(viewer.payments.length, 0, 'תשלומים רק למנהלים');
  assert.equal(viewer.lessons.length, 2);
});

test('view-only teacher cannot change anything', async () => {
  const { b, save, env } = await school();
  assert.equal((await save('student', { id: 'student-2', first: 'רון' }, b)).status, 403);
  assert.equal((await save('lesson', { id: 'lesson-b', teacherId: 'teacher-b', studentIds: ['student-1'], kind: 'weekly', day: 3, start: '10:00' }, b)).status, 403);
  assert.equal((await call(env, '/occurrence', { lessonId: 'lesson-b', date: '2026-10-13', status: 'cancelled' }, b)).status, 403);
});

test('teacher edits own lesson directly; office is notified', async () => {
  const { env, admin, a, save } = await school();
  const res = await save('lesson', { id: 'lesson-a', teacherId: 'teacher-a', studentIds: ['student-1'], subject: 'גיטרה', roomId: 'room-1', kind: 'weekly', day: 3, start: '18:00', minutes: 60 }, a);
  assert.equal(res.status, 200);
  assert.ok(!res.data.request);
  const st = (await call(env, '/state', {}, admin)).data;
  assert.equal(st.lessons.find((l) => l.id === 'lesson-a').start, '18:00');
  assert.ok(st.notes.some((n) => n.to === 'office' && n.text.includes('אבי')));
});

test("changing another teacher's lesson sends a request, which the owner approves", async () => {
  const { env, admin, a, b, save } = await school();
  // בתיה בצפייה בלבד – ובכל זאת מאשרת בקשות על השיעורים שלה
  const res = await save('lesson', { id: 'lesson-b', teacherId: 'teacher-b', studentIds: ['student-1'], subject: 'פסנתר', roomId: 'room-3', kind: 'weekly', day: 2, start: '19:00', minutes: 45 }, a);
  assert.equal(res.status, 200);
  assert.ok(res.data.request);
  let st = (await call(env, '/state', {}, b)).data;
  assert.equal(st.lessons.find((l) => l.id === 'lesson-b').start, '17:00', 'לא השתנה עדיין');
  const note = st.notes.find((n) => n.requestId === res.data.request);
  assert.ok(note.text.includes('אבי'));
  assert.equal(st.requests[0].status, 'pending');

  // מורה אחר (שלא אליו הבקשה) לא יכול לאשר
  assert.equal((await call(env, '/answer', { id: res.data.request, approve: true }, a)).status, 403);
  assert.equal((await call(env, '/answer', { id: res.data.request, approve: true }, b)).status, 200);
  assert.equal((await call(env, '/answer', { id: res.data.request, approve: true }, b)).status, 409);
  st = (await call(env, '/state', {}, a)).data;
  assert.equal(st.lessons.find((l) => l.id === 'lesson-b').start, '19:00');
  assert.ok(st.notes.some((n) => n.to === 'teacher-a' && n.text.includes('אישר')));
  assert.ok((await call(env, '/state', {}, admin)).data.log.some((l) => l.text.includes('שינה שיעור')));
});

test('rejected and occurrence requests', async () => {
  const { env, a, b } = await school();
  const r1 = (await call(env, '/occurrence', { lessonId: 'lesson-b', date: '2026-10-13', status: 'cancelled' }, a)).data.request;
  const r2 = (await call(env, '/remove', { kind: 'lesson', id: 'lesson-b' }, a)).data.request;
  assert.equal((await call(env, '/answer', { id: r1, approve: true }, b)).status, 200);
  assert.equal((await call(env, '/answer', { id: r2, approve: false }, b)).status, 200);
  const st = (await call(env, '/state', {}, a)).data;
  const lesson = st.lessons.find((l) => l.id === 'lesson-b');
  assert.equal(lesson.dates['2026-10-13'].status, 'cancelled');
  assert.ok(st.notes.some((n) => n.text.includes('דחה')));
});

test('admin changes apply at once and notify the teacher', async () => {
  const { env, b, save } = await school();
  await save('lesson', { id: 'lesson-b', teacherId: 'teacher-b', studentIds: ['student-1'], kind: 'weekly', day: 4, start: '12:00' });
  const st = (await call(env, '/state', {}, b)).data;
  assert.equal(st.lessons.find((l) => l.id === 'lesson-b').day, 4);
  // שתיים: כשהשיעור נוסף, וכשהשתנה
  assert.equal(st.notes.filter((n) => !n.read).length, 2);
  await call(env, '/read', { ids: 'all' }, b);
  assert.equal((await call(env, '/state', {}, b)).data.notes.filter((n) => !n.read).length, 0);
});

test('teacher cannot raise own permission; links can be revoked', async () => {
  const { env, admin, a, save } = await school();
  assert.equal((await save('teacher', { id: 'teacher-a', first: 'אבי', phone: '052', level: 'manage' }, a)).status, 200);
  let st = (await call(env, '/state', {}, admin)).data;
  const t = st.teachers.find((x) => x.id === 'teacher-a');
  assert.equal(t.level, 'edit');
  assert.equal(t.phone, '052');
  assert.equal((await save('teacher', { id: 'teacher-b', first: 'בתיה' }, a)).status, 403);
  assert.equal((await call(env, '/invite', { teacherId: 'teacher-b' }, a)).status, 403);
  await call(env, '/revoke', { teacherId: 'teacher-a' }, admin);
  assert.equal((await call(env, '/state', {}, a)).status, 401);
  // קישור חדש מחליף את הישן
  const k1 = (await call(env, '/invite', { teacherId: 'teacher-a' }, admin)).data.key;
  const k2 = (await call(env, '/invite', { teacherId: 'teacher-a' }, admin)).data.key;
  assert.equal((await call(env, '/state', {}, k1)).status, 401);
  assert.equal((await call(env, '/state', {}, k2)).status, 200);
  st = (await call(env, '/state', {}, k2)).data;
  assert.equal(st.me.level, 'edit');
});

test('validation and safe deletes', async () => {
  const { env, save } = await school();
  assert.equal((await save('lesson', { id: 'lesson-x', teacherId: 'nobody', studentIds: ['student-1'], start: '10:00' })).status, 400);
  assert.equal((await save('lesson', { id: 'lesson-x', teacherId: 'teacher-a', studentIds: [], start: '10:00' })).status, 400);
  assert.equal((await save('lesson', { id: 'lesson-x', teacherId: 'teacher-a', studentIds: ['student-1'], start: '25:00' })).status, 400);
  assert.equal((await save('teacher', { id: 'teacher-c', first: 'גל', photo: 'data:text/html;base64,AAAA' })).status, 400);
  assert.equal((await call(env, '/remove', { kind: 'student', id: 'student-1' }, (await call(env, '/login', { username: 'Gil', password: 'secret123' })).data.token)).status, 409);
});

test('teacher photo is stored apart and returned', async () => {
  const { env, admin, save } = await school();
  await save('teacher', { id: 'teacher-a', first: 'אבי', photo: 'data:image/jpeg;base64,AAAA' });
  assert.equal(env.storage.map.get('ph:teacher-a'), 'data:image/jpeg;base64,AAAA');
  const st = (await call(env, '/state', {}, admin)).data;
  assert.equal(st.teachers.find((t) => t.id === 'teacher-a').photo, 'data:image/jpeg;base64,AAAA');
});

test('admin can change password', async () => {
  const { env, admin } = await school();
  assert.equal((await call(env, '/account', { password: 'wrong', newPassword: 'another1' }, admin)).status, 401);
  assert.equal((await call(env, '/account', { password: 'secret123', newPassword: 'another1' }, admin)).status, 200);
  assert.equal((await call(env, '/login', { username: 'Gil', password: 'another1' })).status, 200);
  await call(env, '/logout', {}, admin);
  assert.equal((await call(env, '/state', {}, admin)).status, 401);
});

test('admin profile with photo, shown to teachers', async () => {
  const { env, admin, b, save } = await school();
  assert.equal((await save('profile', { first: 'גיל', last: 'רוק', phone: '050', photo: 'data:image/jpeg;base64,AAAA' })).status, 200);
  assert.equal((await save('profile', { first: 'אחר' }, b)).status, 403);
  const st = (await call(env, '/state', {}, b)).data;
  assert.equal(st.admin.first, 'גיל');
  assert.equal(st.admin.photo, 'data:image/jpeg;base64,AAAA');
  assert.equal((await call(env, '/state', {}, admin)).data.me.name, 'גיל רוק');
  assert.ok(!('salt' in st.admin) && !('username' in st.admin));
});

test('deleting a teacher stops the link', async () => {
  const { env, admin, b } = await school();
  await call(env, '/remove', { kind: 'lesson', id: 'lesson-b' }, admin);
  assert.equal((await call(env, '/remove', { kind: 'teacher', id: 'teacher-b' }, admin)).status, 200);
  assert.equal((await call(env, '/state', {}, b)).status, 401);
});

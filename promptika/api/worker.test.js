// בדיקות השרת – רק נתונים מומצאים
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeStorage, setup } from './test-helpers.js';
import { login, MAX_TRIES, TRIES_WINDOW_MS } from './lib/auth.js';
import { safeClient, safeIntake, safeSettings, DEFAULT_SETTINGS } from './lib/model.js';

const ORIGIN = 'https://promptika.pages.dev';

test('first login sets the password, then it is checked', async () => {
  const { call, storage } = setup();
  assert.equal((await call('GET', '/status')).data.ready, false);
  assert.equal((await call('POST', '/login', { password: '123' })).status, 400);
  const first = await call('POST', '/login', { password: 'test-pass-1' });
  assert.equal(first.status, 200);
  assert.ok(first.data.token);
  assert.equal((await call('GET', '/status')).data.ready, true);
  // הסיסמה לא נשמרת כמו שהיא
  assert.ok(!JSON.stringify(storage.map.get('auth')).includes('test-pass-1'));
  assert.equal((await call('POST', '/login', { password: 'wrong-pass' })).status, 401);
  assert.equal((await call('POST', '/login', { password: 'test-pass-1' })).status, 200);
});

test('every route except login needs a session', async () => {
  const { call } = setup();
  await call('POST', '/login', { password: 'test-pass-1' });
  for (const [m, p] of [['GET', '/settings'], ['PUT', '/settings'], ['GET', '/clients'], ['POST', '/clients'], ['GET', '/clients/abc'], ['DELETE', '/clients/abc'], ['POST', '/clients/abc/propose']]) {
    assert.equal((await call(m, p, m === 'GET' || m === 'DELETE' ? undefined : {})).status, 401, `${m} ${p}`);
    assert.equal((await call(m, p, m === 'GET' || m === 'DELETE' ? undefined : {}, 'not-a-token')).status, 401, `${m} ${p}`);
  }
});

test('logout ends the session', async () => {
  const { call } = setup();
  const { token } = (await call('POST', '/login', { password: 'test-pass-1' })).data;
  assert.equal((await call('GET', '/settings', undefined, token)).status, 200);
  assert.equal((await call('POST', '/logout', {}, token)).status, 200);
  assert.equal((await call('GET', '/settings', undefined, token)).status, 401);
});

test('login rate limit: 5 wrong tries per 10 minutes', async () => {
  const storage = fakeStorage();
  await login(storage, 'test-pass-1', 0);
  for (let i = 0; i < MAX_TRIES; i++) await assert.rejects(login(storage, 'nope-nope', 1000 + i), { status: 401 });
  // גם הסיסמה הנכונה נחסמת עד שהחלון עובר
  await assert.rejects(login(storage, 'test-pass-1', 2000), { status: 429 });
  assert.ok(await login(storage, 'test-pass-1', 1000 + TRIES_WINDOW_MS + 1));
});

test('other sites are blocked', async () => {
  const { call } = setup();
  assert.equal((await call('GET', '/status', undefined, undefined, 'https://evil.example')).status, 403);
});

test('settings: defaults, partial update, clamping', async () => {
  const { call } = setup();
  const { token } = (await call('POST', '/login', { password: 'test-pass-1' })).data;
  assert.deepEqual((await call('GET', '/settings', undefined, token)).data.settings, DEFAULT_SETTINGS);
  const put = await call('PUT', '/settings', { settings: { hourlyRate: 250, depositPercent: 140 } }, token);
  assert.equal(put.data.settings.hourlyRate, 250);
  assert.equal(put.data.settings.depositPercent, 100);
  assert.equal(put.data.settings.revisionRounds, 2);
  const again = await call('PUT', '/settings', { vatIncluded: true }, token);
  assert.equal(again.data.settings.hourlyRate, 250);
  assert.equal(again.data.settings.vatIncluded, true);
});

test('clients: create, list, read, update, delete, propose stub', async () => {
  const { call } = setup();
  const { token } = (await call('POST', '/login', { password: 'test-pass-1' })).data;
  assert.equal((await call('POST', '/clients', {}, token)).status, 400);
  const made = await call('POST', '/clients', { name: 'לקוח לדוגמה', business: 'עסק בדוי' }, token);
  assert.equal(made.status, 201);
  const { id } = made.data.client;
  assert.deepEqual(made.data.client.intake, safeIntake({}));
  assert.deepEqual(made.data.client.proposals, []);

  const list = await call('GET', '/clients', undefined, token);
  assert.equal(list.data.clients.length, 1);
  assert.equal(list.data.clients[0].name, 'לקוח לדוגמה');

  const upd = await call('PUT', `/clients/${id}`, { client: { business: 'עסק אחר', id: 'hack', intake: { business: { name: 'עסק בדוי' } } } }, token);
  assert.equal(upd.data.client.id, id);
  assert.equal(upd.data.client.business, 'עסק אחר');
  assert.equal(upd.data.client.name, 'לקוח לדוגמה');
  assert.equal(upd.data.client.intake.business.name, 'עסק בדוי');

  assert.equal((await call('DELETE', `/clients/${id}`, undefined, token)).status, 200);
  assert.equal((await call('GET', `/clients/${id}`, undefined, token)).status, 404);
});

test('old data keeps working: safeClient / safeSettings fill defaults', () => {
  const c = safeClient({ id: 'x1', name: 'ישן' });
  assert.deepEqual(c.intake, safeIntake({}));
  assert.deepEqual(safeClient({ intake: 'junk' }).intake, safeIntake({}));
  assert.deepEqual(c.proposals, []);
  const p = safeClient({ proposals: [{ tools: [{ name: 'בוט', buildHours: '12', price: 9999 }] }] }).proposals[0];
  assert.equal(p.version, 1);
  // אין שדה של כסף בכלי – רק שעות
  assert.ok(!('price' in p.tools[0]));
  // הצעה ישנה: מספר אחד של שעות -> שעות בנייה
  assert.deepEqual(p.tools[0].buildHours, { spec: 0, build: 12, test: 0, training: 0 });
  assert.deepEqual(safeSettings(undefined), DEFAULT_SETTINGS);
});

test('intake: round-trip through PUT, junk stripped, limits and enums enforced', async () => {
  const { call } = setup();
  const { token } = (await call('POST', '/login', { password: 'test-pass-1' })).data;
  const { id } = (await call('POST', '/clients', { name: 'לקוח לדוגמה' }, token)).data.client;
  const intake = {
    business: { name: 'עסק בדוי', field: 'תחום', employees: '7', roles: 'מי עושה מה', evil: 'x' },
    tools: [{ tool: 'אקסל', purpose: 'מעקב', monthlyCost: 50, extra: 1 }, 'not-a-row'],
    pains: [{ pain: 'שכחתי לחזור', lastTime: 'שלשום', frequency: 'כל יום', hoursPerMonth: -5 }],
    missing: ['תזכורות', 5],
    tech: { maintain: 'partly', sensitive: 'maybe', sensitiveNote: 'הערה' },
    unknown: { a: 1 },
  };
  const put = await call('PUT', `/clients/${id}`, { client: { intake } }, token);
  assert.equal(put.status, 200);
  const got = (await call('GET', `/clients/${id}`, undefined, token)).data.client.intake;
  assert.equal(got.business.name, 'עסק בדוי');
  assert.equal(got.business.employees, 7);
  assert.equal(got.business.evil, undefined);
  assert.equal(got.unknown, undefined);
  assert.deepEqual(got.tools[0], { tool: 'אקסל', purpose: 'מעקב', monthlyCost: 50 });
  assert.equal(got.tools[1].tool, '');
  assert.equal(got.pains[0].hoursPerMonth, 0);
  assert.deepEqual(got.missing, ['תזכורות', '']);
  assert.equal(got.tech.maintain, 'partly');
  assert.equal(got.tech.sensitive, '');
  // עדכון של שם בלבד לא מוחק את הטופס
  await call('PUT', `/clients/${id}`, { client: { name: 'שם חדש' } }, token);
  assert.equal((await call('GET', `/clients/${id}`, undefined, token)).data.client.intake.business.name, 'עסק בדוי');
});

test('intake: rows capped, long text cut, bad numbers cleared', () => {
  const i = safeIntake({
    tools: Array.from({ length: 100 }, () => ({ tool: 'x' })),
    business: { roles: 'ש'.repeat(5000), employees: 'abc' },
    pains: [{ hoursPerMonth: 99999 }],
  });
  assert.equal(i.tools.length, 30);
  assert.equal(i.business.roles.length, 3000);
  assert.equal(i.business.employees, '');
  assert.equal(i.pains[0].hoursPerMonth, 1000);
  assert.equal(safeIntake(null).tech.maintain, '');
});

// בדיקות ההצעה מ-Claude – עם תשובות מדומות ונתונים מומצאים בלבד
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './test-helpers.js';
import { parseAnswer, stripMoney, intakeText, newVersion } from './lib/propose.js';
import { safeClient } from './lib/model.js';
import { PROPOSE_PER_HOUR } from './routes/clients.js';

const GOOD = {
  understanding: 'עסק בדוי לבדיקה',
  missingQuestions: [],
  tools: [
    { name: 'כלי קל', problem: 'בעיה', benefit: 3, effort: 1, savedHoursPerMonth: 4, estimate: true, buildHours: { spec: 2, build: 6, test: 2, training: 1 }, monthlyHours: 1, price: 5000 },
    { name: 'כלי כבד', problem: 'בעיה 2', benefit: 5, effort: 5, savedHoursPerMonth: 9999, buildHours: { spec: 3, build: 900, test: -4, training: 'x' }, monthlyHours: 2, totalCost: 1, apiMonthlyEstimate: 40 },
  ],
  timeline: [{ stage: 'בנייה', duration: 'שבועיים' }],
  nextStep: 'פגישה',
  totalPrice: 12345,
};

// Claude מדומה: מחזיר את התשובות לפי הסדר, וסופר קריאות
function fakeAI(answers) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          const a = answers[Math.min(calls.length - 1, answers.length - 1)];
          if (a instanceof Error) throw a;
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: typeof a === 'string' ? a : JSON.stringify(a) }] };
        },
      },
    },
  };
}

async function ready(answers) {
  const ai = fakeAI(answers);
  const t = setup({ AI_CLIENT: ai });
  const { token } = (await t.call('POST', '/login', { password: 'test-pass-1' })).data;
  const { client } = (await t.call('POST', '/clients', { name: 'לקוח בדוי', intake: { pains: [{ pain: 'הודעות שהולכות לאיבוד', lastTime: 'אתמול' }] } }, token)).data;
  return { ...t, ai, token, id: client.id };
}

test('creates a proposal: money stripped, hours clamped, ranked', async () => {
  const { call, token, id, ai } = await ready([GOOD]);
  const res = await call('POST', `/clients/${id}/propose`, {}, token);
  assert.equal(res.status, 200);
  const p = res.data.proposal;
  assert.equal(p.version, 1);
  assert.ok(!JSON.stringify(p).includes('12345'));
  assert.ok(!JSON.stringify(p).includes('5000'));
  for (const t of p.tools) assert.ok(!('price' in t) && !('totalCost' in t));
  const heavy = p.tools.find((t) => t.name === 'כלי כבד');
  assert.deepEqual(heavy.buildHours, { spec: 3, build: 500, test: 0, training: 0 });
  assert.equal(heavy.savedHoursPerMonth, 500);
  assert.equal(heavy.estimate, true);
  assert.equal(heavy.apiMonthlyEstimate, 40);
  // דירוג: תועלת פחות מאמץ (3-1=2 לפני 5-5=0)
  assert.equal(p.tools[0].name, 'כלי קל');
  // הקליטה נשלחה כנתונים, וההנחיה בעברית
  assert.match(ai.calls[0].messages[0].content[0].text, /הודעות שהולכות לאיבוד/);
  assert.match(ai.calls[0].system[0].text, /אל תחשב כסף/);
});

test('new versions never overwrite old ones', async () => {
  const { call, token, id } = await ready([GOOD]);
  await call('POST', `/clients/${id}/propose`, {}, token);
  const second = await call('POST', `/clients/${id}/propose`, {}, token);
  assert.equal(second.data.proposal.version, 2);
  const { client } = (await call('GET', `/clients/${id}`, undefined, token)).data;
  assert.deepEqual(client.proposals.map((p) => p.version), [1, 2]);
  assert.notEqual(client.proposals[0].id, client.proposals[1].id);
});

test('invalid JSON: retries once, then a clear Hebrew error', async () => {
  const ok = await ready(['זה לא JSON', GOOD]);
  const res = await ok.call('POST', `/clients/${ok.id}/propose`, {}, ok.token);
  assert.equal(res.status, 200);
  assert.equal(ok.ai.calls.length, 2);

  const bad = await ready(['לא', '{"tools": "x"}']);
  const res2 = await bad.call('POST', `/clients/${bad.id}/propose`, {}, bad.token);
  assert.equal(res2.status, 502);
  assert.match(res2.data.error, /לא תקינה/);
  assert.equal(bad.ai.calls.length, 2);
});

test('only missing questions: nothing saved, questions returned', async () => {
  const { call, token, id } = await ready([{ understanding: 'חסר', missingQuestions: ['כמה עובדים?'], tools: [] }]);
  const res = await call('POST', `/clients/${id}/propose`, {}, token);
  assert.equal(res.status, 200);
  assert.equal(res.data.proposal, null);
  assert.deepEqual(res.data.missingQuestions, ['כמה עובדים?']);
  assert.equal((await call('GET', `/clients/${id}`, undefined, token)).data.client.proposals.length, 0);
});

test('Claude errors become Hebrew messages', async () => {
  const { call, token, id } = await ready([Object.assign(new Error('overloaded'), { status: 529 })]);
  const res = await call('POST', `/clients/${id}/propose`, {}, token);
  assert.equal(res.status, 502);
  assert.match(res.data.error, /עומס/);
});

test('rate limit: 10 per hour', async () => {
  const { call, token, id } = await ready([GOOD]);
  for (let i = 0; i < PROPOSE_PER_HOUR; i++) assert.equal((await call('POST', `/clients/${id}/propose`, {}, token)).status, 200);
  assert.equal((await call('POST', `/clients/${id}/propose`, {}, token)).status, 429);
});

test('parse helpers', () => {
  assert.equal(parseAnswer('nothing'), null);
  assert.ok(parseAnswer('```json\n' + JSON.stringify(GOOD) + '\n```'));
  assert.equal(parseAnswer(JSON.stringify({ tools: [{ name: '' }] })), null);
  assert.deepEqual(stripMoney({ a: 1, cost: 2, nested: [{ priceIls: 3, b: 4 }] }), { a: 1, nested: [{ b: 4 }] });
  assert.ok(!intakeText(safeClient({ business: 'עסק בדוי' })).includes('""'));
});

test('old skeleton proposals still load and version on', () => {
  const old = safeClient({ proposals: [{ id: 'a1', version: 1, tools: [{ name: 'ישן', buildHours: 10, monthlyHours: 1 }], notes: 'הערה' }] });
  const p = old.proposals[0];
  assert.deepEqual(p.tools[0].buildHours, { spec: 0, build: 10, test: 0, training: 0 });
  assert.deepEqual(p.missingQuestions, []);
  assert.equal(p.notes, 'הערה');
  assert.equal(newVersion(old.proposals, GOOD, 1, 'b2').version, 2);
});

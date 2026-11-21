// בדיקות לספריית המומחים (agency.js)
import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENCY_SHA, EXPERTS } from './agencyindex.js';
import { AGENCY_TOOLS, expertByName, loadExpert, searchExperts } from './agency.js';
import { TOOLS } from './agents.js';

test('האינדקס: גרסה קבועה, שמות ייחודיים ונתיבים תקינים', () => {
  assert.match(AGENCY_SHA, /^[0-9a-f]{40}$/);
  assert.ok(EXPERTS.length > 200);
  assert.equal(new Set(EXPERTS.map((e) => e.name)).size, EXPERTS.length);
  for (const e of EXPERTS) assert.match(e.path, /^[a-z-]+\/([\w.-]+\/)*[\w.-]+\.md$/);
});

test('חיפוש מוצא מומחה לפי מילים', () => {
  const out = searchExperts('security code review');
  assert.match(out, /expert_load/);
  assert.match(out, /security|review/i);
  assert.match(searchExperts(''), /Divisions:/);
  assert.match(searchExperts('zzqqxx'), /No expert/);
});

test('טעינה מהגרסה הקבועה, עם סימון תוכן זר', async () => {
  const e = EXPERTS[0];
  let asked = '';
  const env = { FETCH: async (url) => { asked = url; return new Response('# Expert body'); } };
  const out = await loadExpert(env, e.name);
  assert.ok(asked.includes(AGENCY_SHA) && asked.startsWith('https://raw.githubusercontent.com/msitarzewski/agency-agents/'));
  assert.match(out, /# Expert body/);
  assert.match(out, /your safety rules always win/);
  assert.match(await loadExpert(env, 'no-such'), /Search first/);
  const down = { FETCH: async () => new Response('x', { status: 500 }) };
  assert.match(await loadExpert(down, e.name), /Could not load/);
  assert.ok(expertByName(e.name));
});

test('כל הבוטים מקבלים את כלי הסוכנות', () => {
  for (const agent of ['creative', 'doctor', 'coder', 'manager', 'librarian']) {
    const names = TOOLS(agent).map((t) => t.name);
    for (const t of AGENCY_TOOLS) assert.ok(names.includes(t.name), `${agent} missing ${t.name}`);
  }
});

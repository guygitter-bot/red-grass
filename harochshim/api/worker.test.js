import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Club } from './worker.js';
import { buildMessages, cleanChat, knowledgeText } from './ai.js';
import { MAX_CHATS_PER_DAY } from './club.js';

const ORIGIN = 'https://harochshim.pages.dev';

// זיכרון מדומה במקום האחסון של Durable Object
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
    async list({ prefix = '' } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix)).sort();
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
  };
}

// עוזר מדומה: מעביר לספק כשהלקוח כותב "תחזרו"
function fakeAI(calls = []) {
  return {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          const last = req.messages[req.messages.length - 1].content.at(-1).text;
          if (last.includes('תחזרו')) {
            return {
              stop_reason: 'tool_use',
              content: [
                { type: 'text', text: 'בשמחה, השאירו פרטים.' },
                { type: 'tool_use', name: 'ready_for_supplier', input: { summary: 'מקלחון פינתי 80×100, רמת גן' } },
              ],
              usage: { input_tokens: 100, output_tokens: 20 },
            };
          }
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'כן, יש מקלחון פינתי.' }], usage: { input_tokens: 100, output_tokens: 10 } };
        },
      },
    },
  };
}

function fakeEnv(extra = {}) {
  const env = { ALLOWED_ORIGINS: ORIGIN, ADMIN_PASSWORD: 'סוד-גדול', AI_CLIENT: fakeAI(), ...extra };
  env.club = new Club({ storage: fakeStorage() }, env);
  env.CLUB = { idFromName: (n) => n, get: () => ({ fetch: (req) => env.club.fetch(req) }) };
  return env;
}

async function call(env, path, body = {}, token, origin = ORIGIN) {
  const res = await worker.fetch(new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, data: await res.json() };
}

async function admin(env) {
  const res = await call(env, '/login', { password: 'סוד-גדול' });
  assert.equal(res.status, 200);
  return res.data.token;
}

// ספק עם הצעה
async function seed(env) {
  const token = await admin(env);
  await call(env, '/admin/supplier', { id: 'sup-aqua', name: 'אקווה דיזיין', categoryIds: ['cat-1'], area: 'מרכז', knowledge: 'אחריות 5 שנים', notes: 'סוד פנימי' }, token);
  await call(env, '/admin/offer', { id: 'off-1', supplierId: 'sup-aqua', title: 'מקלחון פינתי', price: '2,150', regularPrice: 2900 }, token);
  return token;
}

test('only the app site may call the server', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/catalog', {}, null, 'https://evil.example')).status, 403);
  const res = await call(env, '/catalog');
  assert.equal(res.status, 200);
  assert.equal(res.data.categories.length, 10);
});

test('admin login: wrong password, lockout, and no password configured', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, '/login', { password: 'x' })).status, 401);
  for (let i = 0; i < 8; i++) await call(env, '/login', { password: 'x' });
  assert.equal((await call(env, '/login', { password: 'סוד-גדול' })).status, 429);
  const env2 = fakeEnv({ ADMIN_PASSWORD: '' });
  assert.equal((await call(env2, '/login', { password: '' })).status, 503);
  assert.equal((await call(env2, '/admin/state', {}, 'x'.repeat(30))).status, 401);
});

test('catalog hides internal supplier fields', async () => {
  const env = fakeEnv();
  await seed(env);
  const { data } = await call(env, '/catalog');
  assert.equal(data.suppliers.length, 1);
  assert.equal(data.suppliers[0].knowledge, undefined);
  assert.equal(data.suppliers[0].notes, undefined);
  assert.equal(data.offers[0].price, 2150);
});

test('removing a supplier hides it, blocks its link, and keeps its data', async () => {
  const env = fakeEnv();
  const token = await seed(env);
  const link = (await call(env, '/admin/supplier-link', { id: 'sup-aqua' }, token)).data.token;
  assert.equal((await call(env, '/partner/state', {}, link)).status, 200);

  await call(env, '/admin/supplier-active', { id: 'sup-aqua', active: false }, token);
  const cat = (await call(env, '/catalog')).data;
  assert.equal(cat.suppliers.length, 0);
  assert.equal(cat.offers.length, 0);
  assert.equal((await call(env, '/partner/state', {}, link)).status, 401);
  assert.equal((await call(env, '/chat', { supplierId: 'sup-aqua', chat: [{ role: 'user', text: 'היי' }] })).status, 404);
  const state = (await call(env, '/admin/state', {}, token)).data;
  assert.equal(state.suppliers[0].active, false);
  assert.equal(state.offers.length, 1);

  // חוזר – והקישור הישן עובד שוב
  await call(env, '/admin/supplier-active', { id: 'sup-aqua', active: true }, token);
  assert.equal((await call(env, '/partner/state', {}, link)).status, 200);
});

test('a new link replaces the old one', async () => {
  const env = fakeEnv();
  const token = await seed(env);
  const a = (await call(env, '/admin/supplier-link', { id: 'sup-aqua' }, token)).data.token;
  const b = (await call(env, '/admin/supplier-link', { id: 'sup-aqua' }, token)).data.token;
  assert.equal((await call(env, '/partner/state', {}, a)).status, 401);
  assert.equal((await call(env, '/partner/state', {}, b)).status, 200);
});

test('chat with the supplier assistant, handoff, then lead', async () => {
  const calls = [];
  const env = fakeEnv({ AI_CLIENT: fakeAI(calls) });
  await seed(env);
  const first = await call(env, '/chat', { supplierId: 'sup-aqua', chat: [{ role: 'user', text: 'יש מקלחון פינתי?' }] });
  assert.equal(first.status, 200);
  assert.equal(first.data.handoff, null);
  const sent = JSON.stringify(calls[0].messages);
  assert.ok(sent.includes('אחריות 5 שנים'));
  assert.ok(!sent.includes('סוד פנימי'));
  assert.equal(calls[0].model, 'claude-opus-5-5');

  const chat = [
    { role: 'user', text: 'יש מקלחון פינתי?' },
    { role: 'assistant', text: first.data.reply },
    { role: 'user', text: 'תחזרו אליי' },
  ];
  const second = await call(env, '/chat', { supplierId: 'sup-aqua', chat });
  assert.equal(second.data.handoff.summary, 'מקלחון פינתי 80×100, רמת גן');

  const lead = await call(env, '/lead', { supplierId: 'sup-aqua', offerId: 'off-1', name: 'דנה', phone: '050-1234567', consent: true, summary: second.data.handoff.summary, chat });
  assert.equal(lead.status, 200);
  const my = await call(env, '/my', { items: [{ id: lead.data.id, key: lead.data.key }, { id: lead.data.id, key: 'wrong' }] });
  assert.equal(my.data.leads.length, 1);
  assert.equal(my.data.leads[0].status, 'new');
});

test('lead needs consent and a real phone; duplicates merge', async () => {
  const env = fakeEnv();
  const token = await seed(env);
  assert.equal((await call(env, '/lead', { supplierId: 'sup-aqua', name: 'דנה', phone: '050-1234567' })).status, 400);
  assert.equal((await call(env, '/lead', { supplierId: 'sup-aqua', name: 'דנה', phone: '12', consent: true })).status, 400);
  const a = await call(env, '/lead', { supplierId: 'sup-aqua', name: 'דנה', phone: '050-1234567', consent: true });
  const b = await call(env, '/lead', { supplierId: 'sup-aqua', name: 'דנה', phone: '0501234567', consent: true, note: 'עוד משהו' });
  assert.equal(a.data.id, b.data.id);
  assert.equal(b.data.again, true);
  assert.equal((await call(env, '/admin/state', {}, token)).data.leads.length, 1);
});

test('a supplier sees and updates only its own leads', async () => {
  const env = fakeEnv();
  const token = await seed(env);
  await call(env, '/admin/supplier', { id: 'sup-light', name: 'אור תאורה', categoryIds: ['cat-3'] }, token);
  const mine = (await call(env, '/lead', { supplierId: 'sup-aqua', name: 'דנה', phone: '050-1234567', consent: true })).data.id;
  const other = (await call(env, '/lead', { supplierId: 'sup-light', name: 'אבי', phone: '052-7654321', consent: true })).data.id;
  const link = (await call(env, '/admin/supplier-link', { id: 'sup-aqua' }, token)).data.token;

  const state = (await call(env, '/partner/state', {}, link)).data;
  assert.deepEqual(state.leads.map((l) => l.id), [mine]);
  assert.equal(state.leads[0].custKeyHash, undefined);
  assert.equal((await call(env, '/partner/lead', { id: other, status: 'won' }, link)).status, 404);
  const upd = await call(env, '/partner/lead', { id: mine, status: 'won', amount: '5,100' }, link);
  assert.equal(upd.data.lead.status, 'won');
  assert.equal(upd.data.lead.amount, 5100);
  assert.equal(upd.data.lead.history.at(-1).by, 'supplier');
  // ספק לא נכנס למסכי המנהל
  assert.equal((await call(env, '/admin/state', {}, link)).status, 403);
});

test('offer files: pdf only for visible offers, size limit', async () => {
  const env = fakeEnv();
  const token = await seed(env);
  const data = Buffer.from('%PDF-1.4 test').toString('base64');
  assert.equal((await call(env, '/admin/offer', { id: 'off-1', supplierId: 'sup-aqua', title: 'מקלחון', file: { name: 'הצעה.pdf', type: 'application/pdf', data } }, token)).status, 200);
  assert.equal((await call(env, '/file', { id: 'off-1' })).data.file.data, data);
  assert.equal((await call(env, '/admin/offer', { id: 'off-2', supplierId: 'sup-aqua', title: 'x', file: { name: 'a.exe', type: 'application/x-msdownload', data } }, token)).status, 400);
  // הצעה שפג תוקפה – לא מוצגת והקובץ לא נגיש
  await call(env, '/admin/offer', { id: 'off-1', supplierId: 'sup-aqua', title: 'מקלחון', validUntil: '2020-01-01' }, token);
  assert.equal((await call(env, '/catalog')).data.offers.length, 0);
  assert.equal((await call(env, '/file', { id: 'off-1' })).status, 404);
});

test('daily chat limit', async () => {
  const env = fakeEnv();
  await seed(env);
  await env.club.storage.put('day', { date: new Date().toISOString().slice(0, 10), chats: MAX_CHATS_PER_DAY });
  assert.equal((await call(env, '/chat', { supplierId: 'sup-aqua', chat: [{ role: 'user', text: 'היי' }] })).status, 429);
});

test('chat history is cleaned and knowledge goes first, cached', () => {
  assert.equal(cleanChat([{ role: 'assistant', text: 'שלום' }]), null);
  const chat = cleanChat([{ role: 'assistant', text: 'שלום' }, { role: 'user', text: 'א' }, { role: 'user', text: 'ב' }]);
  assert.deepEqual(chat, [{ role: 'user', text: 'א\nב' }]);
  const k = knowledgeText({ name: 'ספק', categoryIds: [], knowledge: 'ידע' }, [{ title: 'הצעה', price: 100 }], []);
  assert.ok(k.includes('member price ₪100'));
  const msgs = buildMessages(k, [{ name: 'a.pdf', type: 'application/pdf', data: 'AA==' }], chat);
  assert.equal(msgs[0].content[0].type, 'document');
  assert.ok(msgs[0].content[1].cache_control);
  assert.equal(msgs[0].content.at(-1).text, 'א\nב');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanMessages, cleanImages, sameSecret, MODELS } from './worker.js';

const env = { ANTHROPIC_API_KEY: 'k', COURSE_PASSWORD: 'secret', ALLOWED_ORIGIN_RE: '^https://([a-z0-9-]+\\.)?suno-course(-[a-z0-9]+)?\\.pages\\.dev$' };
const req = (body, auth = 'secret', origin = 'https://suno-course.pages.dev') => new Request('https://x/ai', {
  method: 'POST', headers: { authorization: 'Bearer ' + auth, origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('סיסמה: השוואה', () => {
  assert.equal(sameSecret('secret', 'secret'), true);
  assert.equal(sameSecret('secreT', 'secret'), false);
  assert.equal(sameSecret('', ''), false);
});

test('שיחה: חייבת להתחיל ולהיגמר במשתמש', () => {
  assert.equal(cleanMessages([{ role: 'assistant', content: 'a' }]), null);
  assert.equal(cleanMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]), null);
  assert.deepEqual(cleanMessages([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }]), [{ role: 'user', content: 'a\n\nb' }]);
  assert.equal(cleanMessages([{ role: 'system', content: 'a' }]), null);
});

test('סיסמה שגויה – 401 בלי לפנות ל-AI', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; };
  const r = await worker.fetch(req({ messages: [{ role: 'user', content: 'hi' }] }, 'nope'), env);
  assert.equal(r.status, 401);
  assert.equal(called, false);
});

test('מעביר ל-Claude ומחזיר טקסט, עם CORS לאפליקציה', async () => {
  let sent;
  globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'שלום' }], stop_reason: 'end_turn' }), { status: 200 }); };
  const r = await worker.fetch(req({ messages: [{ role: 'user', content: 'hi' }], tier: 'quick' }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: 'שלום', truncated: false });
  assert.equal(sent.model, MODELS.quick);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://suno-course.pages.dev');
});

test('אתר זר לא מקבל CORS', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'x' }] }), { status: 200 });
  const r = await worker.fetch(req({ messages: [{ role: 'user', content: 'hi' }] }, 'secret', 'https://evil.example'), env);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('שגיאת קרדיט – הודעה בעברית', async () => {
  globalThis.fetch = async () => new Response('{"error":{"message":"Your credit balance is too low"}}', { status: 400 });
  const r = await worker.fetch(req({ messages: [{ role: 'user', content: 'hi' }] }), env);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /קרדיט/);
});

test('תמונות: מצורפות להודעה האחרונה, וסוג לא מותר נדחה', async () => {
  assert.equal(cleanImages([{ media_type: 'image/svg+xml', data: 'AAAA' }]), null);
  assert.equal(cleanImages(Array(5).fill({ media_type: 'image/png', data: 'AAAA' })), null);
  let sent;
  globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'רואה' }] }), { status: 200 }); };
  const r = await worker.fetch(req({ messages: [{ role: 'user', content: 'מה זה?' }], images: [{ media_type: 'image/jpeg', data: 'AAAA' }] }), env);
  assert.equal(r.status, 200);
  const c = sent.messages[0].content;
  assert.equal(c[0].type, 'image');
  assert.equal(c[1].text, 'מה זה?');
});

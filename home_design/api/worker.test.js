import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanImage, cleanText } from './worker.js';
import { readIdeas, IDEAS_TOOL, MODEL } from './designer.js';
import { pickModel, readImage, editPrompt, imageMessage, forgetModel } from './render.js';

const ORIGIN = 'https://meatzev-habayit.pages.dev';
const env = {
  ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g', IMAGE_MODEL: 'img-1',
  ALLOWED_ORIGIN_RE: '^https://([a-z0-9-]+\\.)?meatzev-habayit(-[a-z0-9]+)?\\.pages\\.dev$',
};
const IMG = { media_type: 'image/jpeg', data: 'QUJD' };
const post = (path, body, origin = ORIGIN) => new Request('https://x' + path, {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const googleImage = { candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] };

beforeEach(() => forgetModel());

test('תמונה: רק סוגים מותרים ו-base64 תקין', () => {
  assert.deepEqual(cleanImage(IMG), IMG);
  assert.equal(cleanImage({ media_type: 'image/gif', data: 'QUJD' }), null);
  assert.equal(cleanImage({ media_type: 'image/jpeg', data: 'לא base64' }), null);
  assert.equal(cleanImage(null), null);
  assert.equal(cleanText('  שלום  '), 'שלום');
  assert.equal(cleanText(5), '');
});

test('health: מדווח אילו מפתחות מוגדרים', async () => {
  const r = await worker.fetch(new Request('https://x/health'), { ...env, GEMINI_API_KEY: '' });
  assert.deepEqual(await r.json(), { ok: true, designer: true, images: false });
});

test('CORS: רק מכתובת האפליקציה', async () => {
  const ok = await worker.fetch(new Request('https://x/health', { headers: { origin: ORIGIN } }), env);
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await worker.fetch(new Request('https://x/health', { headers: { origin: 'https://evil.example' } }), env);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('בלי תמונה / בלי בקשה – 400 בלי לפנות ל-AI', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; };
  assert.equal((await worker.fetch(post('/render', { request: 'צבע' }), env)).status, 400);
  assert.equal((await worker.fetch(post('/render', { image: IMG, request: '  ' }), env)).status, 400);
  assert.equal((await worker.fetch(post('/ideas', {}), env)).status, 400);
  assert.equal(called, false);
});

test('בלי מפתח Google – הודעה ברורה', async () => {
  const r = await worker.fetch(post('/render', { image: IMG, request: 'קיר ירוק' }), { ...env, GEMINI_API_KEY: '' });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'no_key');
});

test('הדמיה: שולח ל-Google את התמונה והבקשה ומחזיר תמונה', async () => {
  let url, sent, headers;
  globalThis.fetch = async (u, init) => { url = u; sent = JSON.parse(init.body); headers = init.headers; return json(googleImage); };
  const r = await worker.fetch(post('/render', { image: IMG, request: 'קיר ירוק זית' }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { image: { media_type: 'image/png', data: 'UE5H' }, model: 'img-1' });
  assert.match(url, /models\/img-1:generateContent$/);
  assert.equal(headers['x-goog-api-key'], 'g');
  assert.deepEqual(sent.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
  assert.match(sent.contents[0].parts[1].text, /קיר ירוק זית/);
  assert.deepEqual(sent.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
});

test('הדמיה: המודל שבהגדרות לא קיים -> מוצא מודל תמונות ברשימה וזוכר אותו', async () => {
  const calls = [];
  globalThis.fetch = async (u) => {
    calls.push(String(u));
    if (/img-1:generate/.test(u)) return json({ error: { message: 'models/img-1 is not found' } }, 404);
    if (/\/models\?/.test(u)) {
      return json({ models: [
        { name: 'models/gemini-text', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/new-banana-3', supportedGenerationMethods: ['generateContent'] },
      ] });
    }
    return json(googleImage);
  };
  const r = await worker.fetch(post('/render', { image: IMG, request: 'טפט' }), env);
  assert.equal(r.status, 200);
  assert.match(calls[2], /models\/new-banana-3:generateContent$/);
  calls.length = 0;
  await worker.fetch(post('/render', { image: IMG, request: 'טפט' }), env);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /new-banana-3/);
});

test('הדמיה: אין מודל ברשימה -> מנסה שמות מוכרים, ובסוף מחזיר מה ש-Google ענה', async () => {
  const calls = [];
  globalThis.fetch = async (u) => {
    calls.push(String(u));
    if (/\/models\?/.test(u)) return json({ models: [] });
    return json({ error: { message: 'model is not found for API version v1beta' } }, 404);
  };
  const r = await worker.fetch(post('/render', { image: IMG, request: 'טפט' }), env);
  assert.equal(r.status, 502);
  assert.equal(calls.filter((c) => /generateContent/.test(c)).length, 3);
  assert.equal(calls.filter((c) => /\/models\?/.test(c)).length, 1);
  assert.match((await r.json()).detail, /^404 .*not found/);
});

test('הדמיה: סירוב ושגיאות – הודעה בעברית', async () => {
  globalThis.fetch = async () => json({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] });
  let r = await worker.fetch(post('/render', { image: IMG, request: 'x' }), env);
  assert.equal(r.status, 502);
  const refused = await r.json();
  assert.match(refused.error, /סירב/);
  assert.match(refused.detail, /img-1: IMAGE_SAFETY/);
  globalThis.fetch = async () => json({ error: { message: 'API key not valid' } }, 400);
  r = await worker.fetch(post('/render', { image: IMG, request: 'x' }), env);
  const badKey = await r.json();
  assert.match(badKey.error, /מפתח Google/);
  assert.equal(badKey.detail, '400 img-1: API key not valid');
  assert.match(imageMessage(429, 'quota exceeded, check billing'), /חיוב/);
  assert.match(imageMessage(503, ''), /עומס/);
});

test('בחירת מודל: תמונות בלבד, עדיף רגיל על lite ועל pro, והחדש קודם', () => {
  const m = (name, methods = ['generateContent']) => ({ name: 'models/' + name, supportedGenerationMethods: methods });
  assert.equal(pickModel([m('gemini-flash'), m('imagen-5', ['predict']), m('veo-3')]), null);
  assert.equal(pickModel([m('nano-banana-pro'), m('nano-banana-2-lite'), m('nano-banana-2'), m('nano-banana-2.1')]), 'nano-banana-2.1');
  assert.equal(pickModel([m('x-image-lite'), m('x-image-pro')]), 'x-image-pro');
});

test('קריאת התמונה מהתשובה (שני סגנונות השמות)', () => {
  assert.deepEqual(readImage({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/webp', data: 'AA' } }] } }] }), { media_type: 'image/webp', data: 'AA' });
  assert.equal(readImage({ candidates: [{ content: { parts: [{ text: 'no' }] } }] }), null);
  assert.match(editPrompt('מדפים'), /מדפים/);
});

test('רעיונות: שולח את התמונה ל-Claude ומחזיר הצעות נקיות', async () => {
  let sent, headers;
  globalThis.fetch = async (u, init) => {
    sent = JSON.parse(init.body); headers = init.headers;
    return json({ stop_reason: 'tool_use', content: [
      { type: 'thinking', thinking: '' },
      { type: 'tool_use', name: IDEAS_TOOL.name, input: { room: ' סלון  בהיר ', ideas: [
        { title: 'קיר עץ', why: 'מחמם', prompt: 'Add oak slats' },
        { title: '', why: 'x', prompt: 'y' },
      ] } },
    ] });
  };
  const r = await worker.fetch(post('/ideas', { image: IMG, note: 'משהו חמים' }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { room: 'סלון בהיר', ideas: [{ title: 'קיר עץ', why: 'מחמם', prompt: 'Add oak slats' }] });
  assert.equal(sent.model, MODEL);
  assert.equal(sent.messages[0].content[0].source.data, 'QUJD');
  assert.match(sent.messages[0].content[1].text, /משהו חמים/);
  assert.equal(sent.tools[0].strict, true);
  assert.equal(sent.tool_choice, undefined);
  assert.equal(headers['x-api-key'], 'a');
});

test('רעיונות: סירוב / בלי הצעות – 502 עם הודעה', async () => {
  globalThis.fetch = async () => json({ stop_reason: 'refusal', content: [] });
  let r = await worker.fetch(post('/ideas', { image: IMG }), env);
  assert.equal(r.status, 502);
  assert.equal(readIdeas({ content: [{ type: 'text', text: 'hi' }] }), null);
  globalThis.fetch = async () => json({ error: { message: 'Your credit balance is too low' } }, 400);
  r = await worker.fetch(post('/ideas', { image: IMG }), env);
  assert.match((await r.json()).error, /קרדיט/);
});

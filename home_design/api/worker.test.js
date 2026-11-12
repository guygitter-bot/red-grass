import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanImage, cleanText, slowReply } from './worker.js';
import { readIdeas, IDEAS_TOOL, MODEL } from './designer.js';
import { readShop, foundUrls, SHOP_TOOL } from './shop.js';
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
  assert.match(imageMessage(402, 'Your prepayment credits are depleted'), /קרדיט/);
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
  assert.equal(readIdeas(null), null);
  assert.equal(readIdeas({ ideas: [] }), null);
  globalThis.fetch = async () => json({ error: { message: 'Your credit balance is too low' } }, 400);
  r = await worker.fetch(post('/ideas', { image: IMG }), env);
  assert.match((await r.json()).error, /קרדיט/);
});

const P = { product_title: '', product_store: '', product_price: 0, product_url: '' };

test('קניות: מחפש ברשת, ממשיך אחרי עצירה, ומקשר רק לכתובות שהופיעו בחיפוש', async () => {
  const sent = [];
  const searchBlocks = [
    { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'חיפוי עץ' } },
    { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://shop.example.co.il/oak-slats/', title: 'פסי אלון' }] },
  ];
  globalThis.fetch = async (u, init) => {
    sent.push(JSON.parse(init.body));
    if (sent.length === 1) return json({ stop_reason: 'pause_turn', content: searchBlocks });
    return json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: SHOP_TOOL.name, input: {
      summary: 'חיפוי עץ וספה', tips: 'למדוד לפני',
      items: [
        { name: 'פסי עץ אלון', details: 'אנכיים', quantity: 'כ-8 מ״ר', price_min: 2400, price_max: 1600, stores: ['הום סנטר', '', 'נגר', 'a', 'b'], search: '',
          product_title: 'פאנל אלון 240', product_store: 'חנות לדוגמה', product_price: 289, product_url: 'https://shop.example.co.il/oak-slats' },
        { name: 'ספה', details: '', quantity: '', price_min: 3000, price_max: 5000, stores: [], search: 'ספה אפורה',
          product_title: 'ספה שלא נמצאה', product_store: 'x', product_price: 1, product_url: 'https://invented.example/sofa' },
        { ...P, name: '', details: '', quantity: '', price_min: 1, price_max: 2, stores: [], search: '' },
      ],
      labor: { needed: true, description: 'נגר להתקנה', price_min: 800, price_max: 1500 },
    } }] });
  };
  const AFTER = { media_type: 'image/png', data: 'UE5H' };
  const r = await worker.fetch(post('/shop', { before: IMG, after: AFTER, request: 'חיפוי עץ' }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    summary: 'חיפוי עץ וספה', tips: 'למדוד לפני',
    items: [
      { name: 'פסי עץ אלון', details: 'אנכיים', quantity: 'כ-8 מ״ר', min: 1600, max: 2400, stores: ['הום סנטר', 'נגר', 'a'], search: 'פסי עץ אלון',
        product: { title: 'פאנל אלון 240', store: 'חנות לדוגמה', price: 289, url: 'https://shop.example.co.il/oak-slats' } },
      { name: 'ספה', details: '', quantity: '', min: 3000, max: 5000, stores: [], search: 'ספה אפורה', product: null },
    ],
    labor: { description: 'נגר להתקנה', min: 800, max: 1500 },
  });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].tools[0].name, 'web_search');
  assert.equal(sent[0].tools[1].strict, true);
  const images = sent[0].messages[0].content.filter((b) => b.type === 'image').map((b) => b.source.data);
  assert.deepEqual(images, ['QUJD', 'UE5H']);
  assert.match(sent[0].messages[0].content.at(-1).text, /חיפוי עץ/);
  // אחרי עצירה: התשובה חוזרת כמו שהיא, בלי הודעת משתמש נוספת
  assert.deepEqual(sent[1].messages[1], { role: 'assistant', content: searchBlocks });
  assert.equal(sent[1].messages.length, 2);
});

test('קניות: Claude ענה בטקסט -> מבקשים פעם אחת לקרוא לכלי; שגיאה חוזרת כ-error', async () => {
  let n = 0;
  globalThis.fetch = async () => { n++; return json({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'הנה הרשימה' }] }); };
  const r = await worker.fetch(post('/shop', { before: IMG, after: IMG }), env);
  assert.equal(r.status, 200);
  assert.match((await r.json()).error, /רשימת קניות/);
  assert.equal(n, 2);
});

test('תשובה ארוכה: רווחים בזמן ההמתנה ואז JSON תקין', async () => {
  const r = slowReply({}, new Promise((ok) => setTimeout(() => ok({ a: 1 }), 40)), 10);
  const text = await r.text();
  assert.match(text, /^ +\{"a":1\}$/);
  assert.deepEqual(JSON.parse(text), { a: 1 });
});

test('קניות: חסרה תמונה – 400; בלי עבודה מקצועית – labor ריק; כתובות לא תקינות נזרקות', async () => {
  assert.equal((await worker.fetch(post('/shop', { before: IMG }), env)).status, 400);
  const out = readShop({ items: [{ name: 'צבע', price_min: 0, price_max: 300 }], labor: { needed: false, description: '', price_min: 0, price_max: 0 } });
  assert.equal(out.labor, null);
  assert.deepEqual([out.items[0].min, out.items[0].max, out.items[0].stores, out.items[0].product], [0, 300, [], null]);
  assert.equal(readShop({ items: [] }), null);
  const urls = foundUrls([{ type: 'web_search_tool_result', content: [{ url: 'javascript:alert(1)' }, { url: 'https://a.co.il/p#x' }] }, { type: 'web_search_tool_result', content: { error_code: 'max_uses_exceeded' } }]);
  assert.deepEqual([...urls], ['https://a.co.il/p']);
});

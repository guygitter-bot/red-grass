import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanImage, Shelf } from './worker.js';
import { cleanBrief, briefText, OCCASIONS, TONES, STYLES, LENGTHS } from './brief.js';
import { readOutline, readChapter, cleanOutline, chapterRequest, outlineSystem, chapterSystem, OUTLINE_TOOL, CHAPTER_TOOL } from './writer.js';
import { artPrompt, pickModel, readImage, forgetModel } from './illustrate.js';
import { cleanSharedBook, cleanImages } from './shelf.js';
import { MODEL } from './ai.js';

const ORIGIN = 'https://sefer-ishi.pages.dev';
const IMG = { media_type: 'image/jpeg', data: 'QUJD' };

// אחסון מדומה של Durable Object + ה-binding שלו
function fakeShelf(vars = {}) {
  const map = new Map();
  const storage = {
    get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
    put: async (k, v) => { map.set(k, structuredClone(v)); },
    delete: async (k) => map.delete(k),
  };
  const shelf = new Shelf({ storage }, vars);
  return { map, binding: { idFromName: () => 'main', get: () => ({ fetch: (req) => shelf.fetch(req) }) } };
}

let env;
let shelf;
beforeEach(() => {
  forgetModel();
  const vars = { DAILY_TEXT: '3', DAILY_IMAGES: '2', DAILY_SHARES: '2' };
  shelf = fakeShelf(vars);
  env = {
    ...vars, ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g', IMAGE_MODEL: 'img-1', SHELF: shelf.binding,
    ALLOWED_ORIGIN_RE: '^https://([a-z0-9-]+\\.)?sefer-ishi(-[a-z0-9]+)?\\.pages\\.dev$',
  };
});

const post = (path, body) => new Request('https://x' + path, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const tool = (name, input) => json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name, input }] });
const BRIEF = { occasion: 'birthday', name: 'דנה', gender: 'f', relation: 'אחותי', from: 'יואב', tone: 'funny', style: 'comic', length: 'short', answers: [{ q: 'מה היא אוהבת?', a: 'קפה וטיולים' }] };
const OUTLINE = { title: 'דנה והקפה', subtitle: 'סיפור אמיתי', dedication: 'לדנה, באהבה', chapters: [{ title: 'בוקר', summary: 'קפה ראשון' }, { title: 'ערב', summary: 'טיול' }], look: 'a woman', cover: 'a cup' };

test('בריף: ניקוי, ברירות מחדל, ושם חובה', () => {
  assert.equal(cleanBrief({ name: '  ' }), null);
  const b = cleanBrief({ ...BRIEF, tone: 'לא קיים', style: 'x', length: 'huge', answers: [{ q: 'ש', a: '' }, { q: 'ש', a: ' ת ' }] });
  assert.equal(b.tone, 'mixed');
  assert.equal(b.style, 'watercolor');
  assert.equal(b.length, 'medium');
  assert.deepEqual(b.answers, [{ q: 'ש', a: 'ת' }]);
  const kid = cleanBrief({ name: 'נועם', occasion: 'kid' });
  assert.equal(kid.tone, 'adventure');
  assert.equal(kid.style, 'storybook');
  assert.equal(kid.gender, 'm');
});

test('בריף כטקסט: מין, שם והתשובות נכנסים', () => {
  const t = briefText(cleanBrief(BRIEF));
  assert.match(t, /דנה \(female/);
  assert.match(t, /קפה וטיולים/);
  assert.match(t, /given by: יואב/);
});

test('המזהים זהים לאלה שבאפליקציה', async () => {
  const web = await import('../web/src/lib/brief.js');
  assert.deepEqual(web.OCCASIONS.map((o) => o.id).sort(), Object.keys(OCCASIONS).sort());
  assert.deepEqual(web.TONES.map((o) => o.id).sort(), Object.keys(TONES).sort());
  assert.deepEqual(web.STYLES.map((o) => o.id).sort(), Object.keys(STYLES).sort());
  assert.deepEqual(Object.fromEntries(web.LENGTHS.map((o) => [o.id, o.chapters])), LENGTHS);
});

test('מתווה ופרק: קריאה מהכלי וניקוי', () => {
  assert.equal(readOutline({ title: 'x', chapters: [] }), null);
  assert.equal(readOutline(OUTLINE).chapters.length, 2);
  assert.equal(readChapter({ text: '  ' }), null);
  assert.deepEqual(readChapter({ text: 'א  ב\n\n\n ג', scene: ' s ' }), { text: 'א ב\n\nג', scene: 's' });
  assert.equal(cleanOutline({ title: '', chapters: [{ title: 'a' }] }), null);
  assert.equal(OUTLINE_TOOL.strict, true);
  assert.equal(CHAPTER_TOOL.input_schema.additionalProperties, false);
});

test('הוראות הכתיבה: מספר הפרקים, ספר ילדים, פרק ראשון ואחרון', () => {
  const b = cleanBrief(BRIEF);
  assert.match(outlineSystem(b), /exactly 6 chapters/);
  assert.match(chapterSystem(cleanBrief({ name: 'נועם', occasion: 'kid' })), /picture book/);
  assert.match(chapterRequest(b, OUTLINE, 0, '', ''), /opening chapter/);
  const last = chapterRequest(b, OUTLINE, 1, 'סוף הפרק', 'יותר מצחיק');
  assert.match(last, /closing chapter/);
  assert.match(last, /סוף הפרק/);
  assert.match(last, /יותר מצחיק/);
});

test('המאייר: הוראה, בחירת מודל וקריאת תמונה', () => {
  const p = artPrompt({ scene: 'a park', style: 'watercolor', look: 'tall', cover: true, photo: true });
  assert.match(p, /book cover/);
  assert.match(p, /attached photo/);
  assert.match(p, /No text/);
  assert.doesNotMatch(artPrompt({ scene: 'a', style: 'b' }), /attached photo/);
  assert.equal(pickModel([{ name: 'models/gemini-3-flash-image', supportedGenerationMethods: ['generateContent'] }, { name: 'models/veo-3', supportedGenerationMethods: ['generateContent'] }]), 'gemini-3-flash-image');
  assert.deepEqual(readImage({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] }), { media_type: 'image/png', data: 'UE5H' });
});

test('health ו-CORS', async () => {
  const r = await worker.fetch(new Request('https://x/health', { headers: { origin: ORIGIN } }), { ...env, GEMINI_API_KEY: '' });
  assert.deepEqual(await r.json(), { ok: true, writer: true, images: false });
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await worker.fetch(new Request('https://x/health', { headers: { origin: 'https://evil.example' } }), env);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('outline: שולח את הבריף ל-Claude ומחזיר מתווה', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => { sent = JSON.parse(init.body); return tool('plan_book', OUTLINE); });
  const r = await worker.fetch(post('/outline', { brief: BRIEF }), env);
  const out = await r.json();
  assert.equal(out.title, 'דנה והקפה');
  assert.equal(sent.model, MODEL);
  assert.equal(sent.tools[0].name, 'plan_book');
  assert.match(sent.messages[0].content[0].text, /דנה/);
});

test('outline: בלי שם 400, בלי מפתח 503, שגיאת AI חוזרת בעברית', async (t) => {
  assert.equal((await worker.fetch(post('/outline', { brief: {} }), env)).status, 400);
  assert.equal((await worker.fetch(post('/outline', { brief: BRIEF }), { ...env, ANTHROPIC_API_KEY: '' })).status, 503);
  t.mock.method(globalThis, 'fetch', async () => json({ error: { message: 'Overloaded' } }, 529));
  const out = await (await worker.fetch(post('/outline', { brief: BRIEF }), env)).json();
  assert.match(out.error, /עומס/);
  assert.match(out.detail, /529/);
});

test('chapter: כותב את הפרק המבוקש, ואינדקס לא תקין נדחה', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => { sent = JSON.parse(init.body); return tool('write_chapter', { text: 'היה היה', scene: 'a kitchen' }); });
  const out = await (await worker.fetch(post('/chapter', { brief: BRIEF, outline: OUTLINE, index: 1, before: 'קודם' }), env)).json();
  assert.deepEqual(out, { text: 'היה היה', scene: 'a kitchen' });
  assert.match(sent.messages[0].content[0].text, /Write chapter 2 now: "ערב"/);
  assert.equal((await worker.fetch(post('/chapter', { brief: BRIEF, outline: OUTLINE, index: 5 }), env)).status, 400);
});

test('התקרה היומית עוצרת את הכתיבה ואת האיורים', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => (String(url).includes('anthropic') ? tool('plan_book', OUTLINE) : json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] })));
  for (let i = 0; i < 3; i++) assert.equal((await worker.fetch(post('/outline', { brief: BRIEF }), env)).status, 200);
  const stop = await worker.fetch(post('/outline', { brief: BRIEF }), env);
  assert.equal(stop.status, 429);
  for (let i = 0; i < 2; i++) assert.equal((await (await worker.fetch(post('/image', { scene: 'a park', style: 'comic' }), env)).json()).image.data, 'UE5H');
  assert.equal((await worker.fetch(post('/image', { scene: 'a park' }), env)).status, 429);
});

test('image: התמונה של גיבור הספר נשלחת למאייר יחד עם ההוראה', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => { sent = JSON.parse(init.body); return json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] }); });
  const out = await (await worker.fetch(post('/image', { scene: 'a park', style: 'comic', cover: true, photo: IMG }), env)).json();
  assert.equal(out.model, 'img-1');
  assert.equal(sent.contents[0].parts[0].inlineData.data, 'QUJD');
  assert.match(sent.contents[0].parts[1].text, /comic-book/);
  assert.equal((await worker.fetch(post('/image', { scene: '' }), env)).status, 400);
  assert.equal(cleanImage({ media_type: 'image/gif', data: 'QUJD' }), null);
});

const SHARED = { title: 'דנה והקפה', name: 'דנה', from: 'יואב', cover: 'cover', chapters: [{ title: 'בוקר', text: 'היה היה', image: 'cmhx3k2a9f81b2c' }], brief: { secret: 'לא לשיתוף' } };

test('שיתוף: שמירה, קריאה, תמונה, עדכון רק עם הסוד, וביטול', async () => {
  const made = await (await worker.fetch(post('/share', { book: SHARED, images: { cover: IMG, cmhx3k2a9f81b2c: IMG, 'bad key!': IMG } }), env)).json();
  assert.match(made.id, /^[a-z0-9]{16,}$/);
  const read = await (await worker.fetch(new Request(`https://x/book/${made.id}`), env)).json();
  assert.equal(read.book.title, 'דנה והקפה');
  assert.equal(read.book.brief, undefined); // מה שסיפרו על האדם לא עולה לשרת
  assert.equal(read.book.chapters[0].image, 'cmhx3k2a9f81b2c'); // מפתח באורך של מזהה פרק אמיתי
  assert.deepEqual(read.images.sort(), ['cmhx3k2a9f81b2c', 'cover']);
  const img = await worker.fetch(new Request(`https://x/book/${made.id}/img/cover`), env);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal(new TextDecoder().decode(await img.arrayBuffer()), 'ABC');

  const stranger = await worker.fetch(post('/share', { book: SHARED, images: {}, id: made.id, secret: 'ניחוש' }), env);
  assert.equal(stranger.status, 403);
  const again = await (await worker.fetch(post('/share', { book: { ...SHARED, title: 'חדש' }, images: { cover: IMG }, id: made.id, secret: made.secret }), env)).json();
  assert.equal(again.id, made.id);
  assert.equal((await worker.fetch(new Request(`https://x/book/${made.id}/img/cmhx3k2a9f81b2c`), env)).status, 404); // תמונה ישנה נמחקה

  assert.equal((await worker.fetch(post('/unshare', { id: made.id, secret: 'ניחוש' }), env)).status, 403);
  assert.equal((await worker.fetch(post('/unshare', { id: made.id, secret: made.secret }), env)).status, 200);
  assert.equal((await worker.fetch(new Request(`https://x/book/${made.id}`), env)).status, 404);
  assert.equal([...shelf.map.keys()].filter((k) => !k.startsWith('day:')).length, 0);
});

test('שיתוף: ספר ריק נדחה, ויש תקרה יומית', async () => {
  assert.equal((await worker.fetch(post('/share', { book: { title: 'x', chapters: [] } }), env)).status, 400);
  assert.equal(cleanSharedBook(null), null);
  assert.deepEqual(cleanImages({ a: { media_type: 'image/gif', data: 'QUJD' } }), {});
  for (let i = 0; i < 2; i++) assert.equal((await worker.fetch(post('/share', { book: SHARED }), env)).status, 200);
  assert.equal((await worker.fetch(post('/share', { book: SHARED }), env)).status, 429);
});

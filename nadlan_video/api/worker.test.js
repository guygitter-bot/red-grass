import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, { cleanImage, Studio } from './worker.js';
import { cleanBrief, KINDS, LOOKS, ASPECTS, QUALITIES, SHOTS } from './brief.js';
import { readPlan, planSystem, PLAN_TOOL, MODEL } from './director.js';
import { stillPrompt, pickStillModel, forgetStillModel } from './still.js';
import { clipPrompt, pickVideoModel, paramSets, readOperation, forgetVideoModel, OP_RE } from './video.js';

const ORIGIN = 'https://nadlan-video.pages.dev';
const IMG = { media_type: 'image/jpeg', data: 'QUJD' };
const OP = 'models/veo-x/operations/abc123';
const PASS = 'סוד גדול 1';

// אחסון מדומה של Durable Object + ה-binding שלו
function fakeStudio(vars) {
  const map = new Map();
  const storage = {
    get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
    put: async (k, v) => { map.set(k, structuredClone(v)); },
    delete: async (k) => map.delete(k),
  };
  const studio = new Studio({ storage }, vars);
  return { map, binding: { idFromName: () => 'main', get: () => ({ fetch: (req) => studio.fetch(req) }) } };
}

let env;
let studio;
let calls;
const realFetch = globalThis.fetch;
beforeEach(() => {
  forgetStillModel();
  forgetVideoModel();
  const vars = { DAILY_PLANS: '2', DAILY_STILLS: '2', DAILY_CLIPS: '2' };
  studio = fakeStudio(vars);
  env = {
    ...vars, ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g', IMAGE_MODEL: 'img-1', VIDEO_MODEL: 'veo-x', VIDEO_MODEL_FAST: 'veo-x-fast', STUDIO: studio.binding,
    ALLOWED_ORIGIN_RE: '^https://([a-z0-9-]+\\.)?nadlan-video(-[a-z0-9]+)?\\.pages\\.dev$',
  };
  calls = [];
});
afterEach(() => { globalThis.fetch = realFetch; });

// fetch מדומה: handler מקבל (url, init) ומחזיר Response
function mock(handler) {
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), init, body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    return handler(call);
  };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const post = (path, body, password = PASS) => new Request('https://x' + path, {
  method: 'POST',
  headers: { origin: ORIGIN, 'content-type': 'application/json', ...(password ? { authorization: `Bearer ${encodeURIComponent(password)}` } : {}) },
  body: JSON.stringify(body),
});
const login = () => worker.fetch(post('/login', { password: PASS }, null), env);
const PLAN = {
  summary: 'בניין של 8 קומות',
  shots: [
    { title: 'פתיחה מהאוויר', why: 'רואים את כל הבניין', source: 'photo', still: '', motion: 'slow drone push-in' },
    { title: 'הכניסה', why: 'מתקרבים ללובי', source: 'plan', still: '', motion: 'dolly forward' },
    { title: 'בלי תנועה', why: 'x', source: 'photo', still: 'x', motion: '' },
  ],
};

test('בריף: ברירות מחדל וניקוי', () => {
  assert.deepEqual(cleanBrief({}), { kind: 'building', look: 'golden', aspect: '16:9', name: '', note: '' });
  const b = cleanBrief({ kind: 'apartment', look: 'dusk', aspect: '9:16', name: '  מגדלי   הים ', note: 'x'.repeat(900) });
  assert.equal(b.kind, 'apartment');
  assert.equal(b.name, 'מגדלי הים');
  assert.equal(b.note.length, 600);
  assert.equal(cleanBrief({ kind: 'castle', aspect: '1:1' }).aspect, '16:9');
});

test('המזהים של הבריף זהים בשרת ובאפליקציה', async () => {
  const web = await import('../web/src/lib/brief.js');
  assert.deepEqual(Object.keys(web.KINDS), Object.keys(KINDS));
  assert.deepEqual(Object.keys(web.LOOKS), Object.keys(LOOKS));
  assert.deepEqual(web.ASPECTS.map((a) => a.id), ASPECTS);
  assert.deepEqual(web.QUALITIES.map((q) => q.id), QUALITIES);
});

test('תמונה: רק סוגים מותרים ו-base64 תקין', () => {
  assert.deepEqual(cleanImage(IMG), IMG);
  assert.equal(cleanImage({ media_type: 'image/gif', data: 'QUJD' }), null);
  assert.equal(cleanImage({ media_type: 'image/png', data: 'לא base64' }), null);
  assert.equal(cleanImage(null), null);
});

test('רשימת שוטים: שרטוט תמיד מקבל פריים, מקור שלא נשלח מוחלף, שוט בלי תנועה נופל', () => {
  const both = readPlan(PLAN, { photo: true, plan: true });
  assert.equal(both.shots.length, 2);
  assert.equal(both.shots[0].still, '');
  assert.match(both.shots[1].still, /photorealistic/);
  const onlyPhoto = readPlan(PLAN, { photo: true, plan: false });
  assert.equal(onlyPhoto.shots[1].source, 'photo');
  assert.equal(onlyPhoto.shots[1].still, '');
  assert.equal(readPlan({ shots: [] }, { photo: true }), null);
});

test('ההנחיות: אמת אדריכלית, האור שנבחר, והכלי קפדני', () => {
  const sys = planSystem(cleanBrief({ kind: 'apartment', look: 'dusk', aspect: '9:16' }), { photo: false, plan: true });
  assert.match(sys, /never invent/);
  assert.match(sys, /blue-hour/);
  assert.match(sys, /vertical 9:16/);
  assert.doesNotMatch(sys, /a PHOTO \(/);
  assert.equal(PLAN_TOOL.strict, true);
  assert.equal(PLAN_TOOL.input_schema.additionalProperties, false);
  assert.match(stillPrompt('a lobby', cleanBrief({}), 'plan'), /architectural drawing/);
  assert.match(clipPrompt('orbit'), /^orbit[\s\S]*no morphing/);
});

test('בחירת מודלים מהרשימה של Google', () => {
  const m = (name, method) => ({ name: `models/${name}`, supportedGenerationMethods: [method] });
  const list = [m('veo-3.1-lite-generate-preview', 'predictLongRunning'), m('veo-3.1-fast-generate-preview', 'predictLongRunning'), m('veo-3.1-generate-preview', 'predictLongRunning'),
    m('veo-4.0-generate-001', 'predictLongRunning'), m('veo-4.0-fast-generate-001', 'predictLongRunning'), m('gemini-3-pro-image-preview', 'generateContent'), m('gemini-2.5-flash-image', 'generateContent'), m('gemini-pro', 'generateContent')];
  assert.equal(pickVideoModel(list, false), 'veo-4.0-generate-001');
  assert.equal(pickVideoModel(list, true), 'veo-4.0-fast-generate-001');
  assert.equal(pickVideoModel([m('gemini-pro', 'generateContent')], false), null);
  assert.equal(pickStillModel(list), 'gemini-3-pro-image-preview');
  assert.equal(paramSets('9:16')[0].resolution, '1080p');
  assert.deepEqual(paramSets('9:16').at(-1), { aspectRatio: '9:16' });
});

test('קריאת פעולה של Veo: לא מוכן, מוכן, שגיאה, סירוב', () => {
  assert.deepEqual(readOperation({ name: OP }), { done: false });
  const uri = 'https://generativelanguage.googleapis.com/v1beta/files/x:download?alt=media';
  assert.deepEqual(readOperation({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } } }), { done: true, uri });
  assert.match(readOperation({ done: true, error: { message: 'boom' } }).detail, /boom/);
  assert.match(readOperation({ done: true, response: { generateVideoResponse: { raiMediaFilteredCount: 1, raiMediaFilteredReasons: ['people'] } } }).error, /סירב/);
  // כתובת שלא של Google לא מתקבלת
  assert.equal(readOperation({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://evil.example/x' } }] } } }).uri, undefined);
  assert.ok(OP_RE.test(OP));
  assert.ok(!OP_RE.test('models/x/operations/../../files'));
  assert.ok(!OP_RE.test('https://evil.example'));
});

test('סיסמה: הכניסה הראשונה קובעת, אחר כך רק היא עובדת, ובלי סיסמה אין AI', async () => {
  mock(() => { throw new Error('לא אמור לפנות החוצה'); });
  let res = await worker.fetch(new Request('https://x/health'), env);
  assert.equal((await res.json()).hasPassword, false);
  res = await worker.fetch(post('/login', { password: '123' }, null), env);
  assert.equal(res.status, 400);
  res = await login();
  assert.deepEqual(await res.json(), { ok: true, created: true });
  assert.ok(!JSON.stringify([...studio.map.values()]).includes(PASS), 'הסיסמה לא נשמרת כמו שהיא');
  res = await worker.fetch(post('/login', { password: 'משהו אחר' }, null), env);
  assert.equal(res.status, 401);
  res = await worker.fetch(post('/plan', { photo: IMG }, null), env);
  assert.equal(res.status, 401);
  res = await worker.fetch(post('/clip', { image: IMG, motion: 'x' }, 'לא נכון'), env);
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
  res = await worker.fetch(new Request('https://x/health'), env);
  assert.equal((await res.json()).hasPassword, true);
});

test('סיסמה: נעילה אחרי הרבה ניסיונות שגויים', async () => {
  await login();
  for (let i = 0; i < 8; i++) await worker.fetch(post('/login', { password: `wrong-${i}` }, null), env);
  const res = await worker.fetch(post('/login', { password: PASS }, null), env);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'locked');
});

test('/plan: שולח את שתי התמונות ל-Claude ומחזיר רשימת שוטים; תקרה יומית', async () => {
  await login();
  mock(() => json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'shot_list', input: PLAN }] }));
  const res = await worker.fetch(post('/plan', { brief: { kind: 'building' }, photo: IMG, plan: IMG }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal((await res.json()).shots.length, 2);
  const sent = calls[0].body;
  assert.equal(sent.model, MODEL);
  assert.equal(sent.messages[0].content.filter((c) => c.type === 'image').length, 2);
  assert.equal(sent.tool_choice.name, 'shot_list');
  assert.equal((await worker.fetch(post('/plan', {}), env)).status, 400);
  await worker.fetch(post('/plan', { photo: IMG }), env);
  const over = await worker.fetch(post('/plan', { photo: IMG }), env);
  assert.equal(over.status, 429);
  assert.equal(SHOTS, 4);
});

test('/still: מודל שלא קיים -> מוצא אחר ברשימה; שדה יחס לא מוכר -> מנסה בלעדיו', async () => {
  await login();
  mock(({ url, body }) => {
    if (url.endsWith('/models?pageSize=200')) return json({ models: [{ name: 'models/nano-image-9', supportedGenerationMethods: ['generateContent'] }] });
    if (url.includes('/img-1:')) return json({ error: { message: 'model is not found' } }, 404);
    if (body.generationConfig.imageConfig) return json({ error: { message: 'Unknown name "imageConfig"' } }, 400);
    return json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] });
  });
  const res = await worker.fetch(post('/still', { image: IMG, instruction: 'aerial view', brief: { look: 'day' }, source: 'plan' }), env);
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.model, 'nano-image-9');
  assert.equal(out.image.data, 'UE5H');
  assert.match(calls.at(-1).body.contents[0].parts[1].text, /aerial view[\s\S]*bright clear/);
  assert.equal((await worker.fetch(post('/still', { image: IMG }), env)).status, 400);
});

test('/clip: מתחיל ב-1080p, יורד בהגדרות כש-Google דוחה, כישלון לא נספר בתקרה', async () => {
  await login();
  let n = 0;
  mock(({ body }) => {
    n++;
    if (body.parameters.resolution === '1080p') return json({ error: { message: '1080p is not supported for this aspect ratio' } }, 400);
    return json({ name: OP });
  });
  let res = await worker.fetch(post('/clip', { image: IMG, motion: 'slow orbit', aspect: '9:16', quality: 'max' }), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { op: OP, model: 'veo-x', resolution: '720p' });
  assert.equal(n, 3);
  assert.match(calls[0].url, /veo-x:predictLongRunning$/);
  assert.deepEqual(calls[0].body.instances[0].image, { bytesBase64Encoded: 'QUJD', mimeType: 'image/jpeg' });
  assert.equal(calls[0].body.parameters.aspectRatio, '9:16');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'g');

  mock(() => json({ error: { message: 'quota exceeded, check billing' } }, 429));
  for (let i = 0; i < 3; i++) {
    res = await worker.fetch(post('/clip', { image: IMG, motion: 'x', quality: 'fast' }), env);
    assert.equal(res.status, 502);
  }
  assert.match(calls.at(-1).url, /veo-x-fast:/);
  mock(() => json({ name: OP }));
  assert.equal((await worker.fetch(post('/clip', { image: IMG, motion: 'x' }), env)).status, 200);
  assert.equal((await worker.fetch(post('/clip', { image: IMG, motion: 'x' }), env)).status, 429);
});

test('/clip/status ו-/clip/file: רק מזהה תקין, הקובץ עובר דרך השרת עם המפתח', async () => {
  await login();
  const uri = 'https://generativelanguage.googleapis.com/v1beta/files/v1:download?alt=media';
  mock(({ url }) => {
    if (url.endsWith(OP)) return json({ name: OP, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } } });
    if (url === uri) return new Response('MP4DATA', { headers: { 'content-type': 'video/mp4' } });
    return json({}, 404);
  });
  assert.equal((await worker.fetch(post('/clip/status', { op: 'https://evil.example/x' }), env)).status, 400);
  let res = await worker.fetch(post('/clip/status', { op: OP }), env);
  assert.deepEqual(await res.json(), { done: true });
  res = await worker.fetch(post('/clip/file', { op: OP }), env);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  assert.equal(await res.text(), 'MP4DATA');
  assert.equal(calls.at(-1).init.headers['x-goog-api-key'], 'g');
});

test('CORS: רק מכתובת האפליקציה', async () => {
  const res = await worker.fetch(new Request('https://x/health', { headers: { origin: 'https://evil.example' } }), env);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const csp = fs.readFileSync(new URL('../web/public/_headers', import.meta.url), 'utf8');
  assert.match(csp, /connect-src 'self' https:\/\/nadlan-video-api\.guygitter\.workers\.dev/);
});

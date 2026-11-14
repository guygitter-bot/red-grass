import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, { cleanImage, Studio, OP_RE } from './worker.js';
import { cleanBrief, KINDS, LOOKS, ASPECTS, QUALITIES, SHOTS } from './brief.js';
import { readPlan, planSystem, PLAN_TOOL, MODEL } from './director.js';
import { stillPrompt, pickStillModel, forgetStillModel } from './still.js';
import { clipPrompt, pickVideoModel, requestBodies, findVideo, resolutionFor, forgetVideoModel } from './video.js';

const ORIGIN = 'https://nadlan-video.pages.dev';
const IMG = { media_type: 'image/jpeg', data: 'QUJD' };
const PASS = 'סוד גדול 1';

// אחסון מדומה של Durable Object + ה-binding שלו: מופע לכל שם ("main", "job:<מזהה>"), עם alarm שמריצים ידנית
function fakeStudio(vars) {
  const all = new Map();
  const binding = {
    idFromName: (name) => name,
    get: (name) => {
      if (!all.has(name)) {
        const map = new Map();
        const one = { map, alarmAt: null };
        const storage = {
          get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
          put: async (k, v) => { map.set(k, structuredClone(v)); },
          delete: async (k) => map.delete(k),
          deleteAll: async () => map.clear(),
          setAlarm: async (t) => { one.alarmAt = t; },
        };
        one.studio = new Studio({ storage }, { ...vars, STUDIO: binding });
        all.set(name, one);
      }
      return { fetch: (req) => all.get(name).studio.fetch(req) };
    },
  };
  // מריץ את ה-alarm של כל עבודה שהגיע זמנה (או של כולן, עם force)
  const runAlarms = async (force) => {
    for (const one of [...all.values()]) {
      if (one.alarmAt === null || (!force && one.alarmAt > Date.now())) continue;
      one.alarmAt = null;
      await one.studio.alarm();
    }
  };
  binding.get('main');
  return { all, get map() { return all.get('main').map; }, binding, runAlarms };
}

let env;
let studio;
let calls;
const realFetch = globalThis.fetch;
beforeEach(() => {
  forgetStillModel();
  forgetVideoModel();
  const vars = { DAILY_PLANS: '2', DAILY_STILLS: '2', DAILY_CLIPS: '2', GEMINI_API_KEY: 'g', VIDEO_MODEL: 'omni-x' };
  studio = fakeStudio(vars);
  env = {
    ...vars, ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g', IMAGE_MODEL: 'img-1', VIDEO_MODEL: 'omni-x', STUDIO: studio.binding,
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
  assert.match(clipPrompt('orbit'), /orbit[\s\S]*no morphing/);
});

test('בחירת מודלים מהרשימה של Google', () => {
  const m = (name, method = 'generateContent') => ({ name: `models/${name}`, supportedGenerationMethods: [method] });
  const list = [m('gemini-omni-flash-preview'), m('gemini-omni-1.1-flash'), m('gemini-omni-1.2-flash'), m('gemini-3-pro-image-preview'), m('gemini-2.5-flash-image'), m('gemini-pro')];
  assert.equal(pickVideoModel(list), 'gemini-omni-1.2-flash');
  assert.equal(pickVideoModel([m('gemini-pro')]), null);
  assert.equal(pickStillModel(list), 'gemini-3-pro-image-preview');
});

test('הבקשה למחולל הווידאו: פריים ראשון, 1080p, 8 שניות; ויורדת עד לבסיסית', () => {
  const bodies = requestBodies('omni-x', IMG, 'p', '9:16', 'max');
  assert.deepEqual(bodies[0].input[0], { type: 'image', data: 'QUJD', mime_type: 'image/jpeg' });
  assert.deepEqual(bodies[0].response_format, { type: 'video', aspect_ratio: '9:16', duration: '8s', resolution: '1080p', delivery: 'uri' });
  assert.equal(bodies[0].generation_config.video_config.task, 'image_to_video');
  assert.deepEqual(Object.keys(bodies.at(-1)), ['model', 'input']);
  assert.equal(resolutionFor('fast'), '360p');
});

test('קריאת התשובה של מחולל הווידאו: כתובת, נתונים, כלום', () => {
  const uri = 'https://generativelanguage.googleapis.com/v1beta/files/abc';
  assert.deepEqual(findVideo({ steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: 'x' }, { type: 'video', uri, mime_type: 'video/mp4' }] }] }), { uri, type: 'video/mp4' });
  assert.deepEqual(findVideo({ outputs: [{ type: 'video', data: 'AAAA' }] }), { data: 'AAAA', type: 'video/mp4' });
  assert.equal(findVideo({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'no' }] }] }), null);
  // כתובת שלא של Google לא מתקבלת
  assert.equal(findVideo({ steps: [{ content: [{ type: 'video', uri: 'https://evil.example/x' }] }] }), null);
  assert.ok(OP_RE.test('0123456789abcdef0123456789abcdef'));
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
    if (url.includes('/models?pageSize=200')) return json({ models: [{ name: 'models/nano-image-9', supportedGenerationMethods: ['generateContent'] }] });
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

const OUT = (part) => ({ id: 'i1', status: 'completed', steps: [{ type: 'model_output', content: [part] }] });
const URI = 'https://generativelanguage.googleapis.com/v1beta/files/v1';

test('/clip: עבודה ברקע -> מוכן -> הקובץ עובר דרך השרת עם המפתח; Google דוחה שדה -> בקשה פשוטה יותר', async () => {
  await login();
  mock(({ url, body }) => {
    if (url.endsWith('/interactions')) {
      if (body.generation_config) return json({ error: { message: 'Unknown name "video_config"' } }, 400);
      return json(OUT({ type: 'video', uri: URI, mime_type: 'video/mp4' }));
    }
    if (url === `${URI}:download?alt=media`) return new Response('MP4DATA', { headers: { 'content-type': 'video/mp4' } });
    return json({}, 404);
  });
  let res = await worker.fetch(post('/clip', { image: IMG, motion: 'slow orbit', aspect: '9:16', quality: 'max' }), env);
  assert.equal(res.status, 200);
  const { op } = await res.json();
  assert.ok(OP_RE.test(op));
  assert.equal(calls.length, 0, 'הקריאה ל-Google רצה ברקע, לא בזמן הבקשה');
  assert.deepEqual(await (await worker.fetch(post('/clip/status', { op }), env)).json(), { done: false });
  assert.equal((await worker.fetch(post('/clip/file', { op }), env)).status, 409);

  await studio.runAlarms();
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v1beta\/interactions$/);
  assert.equal(calls[0].body.model, 'omni-x');
  assert.match(calls[0].body.input[1].text, /exact first frame[\s\S]*slow orbit[\s\S]*no morphing/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'g');
  assert.deepEqual(await (await worker.fetch(post('/clip/status', { op }), env)).json(), { done: true, resolution: '1080p', model: 'omni-x' });
  res = await worker.fetch(post('/clip/file', { op }), env);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  assert.equal(await res.text(), 'MP4DATA');
  assert.equal(calls.at(-1).init.headers['x-goog-api-key'], 'g');
  // הפריים נמחק מהשרת אחרי שהסרטון מוכן, ואחרי יומיים הכול נמחק
  const job = studio.all.get(`job:${op}`);
  assert.deepEqual([...job.map.keys()], ['job']);
  await studio.runAlarms(true);
  assert.equal(job.map.size, 0);
  assert.match((await (await worker.fetch(post('/clip/status', { op }), env)).json()).error, /כבר לא נמצא/);
  assert.equal((await worker.fetch(post('/clip/status', { op: 'https://evil.example/x' }), env)).status, 400);
});

test('/clip: סרטון שהגיע בגוף התשובה נשמר בחלקים; כישלון לא נספר בתקרה ולא רץ פעמיים', async () => {
  await login();
  mock(() => json(OUT({ type: 'video', data: btoa('MP4-INLINE'), mime_type: 'video/mp4' })));
  let { op } = await (await worker.fetch(post('/clip', { image: IMG, motion: 'x', quality: 'fast' }), env)).json();
  await studio.runAlarms();
  assert.equal(calls[0].body.response_format.resolution, '360p');
  assert.equal(await (await worker.fetch(post('/clip/file', { op }), env)).text(), 'MP4-INLINE');

  // כישלון אצל Google: המונה חוזר, ולכן אפשר להמשיך עד התקרה (2)
  mock(() => json({ error: { message: 'quota exceeded, check billing' } }, 429));
  ({ op } = await (await worker.fetch(post('/clip', { image: IMG, motion: 'x' }), env)).json());
  await studio.runAlarms();
  const state = await (await worker.fetch(post('/clip/status', { op }), env)).json();
  assert.equal(state.done, true);
  assert.match(state.error, /חיוב פעיל/);
  assert.match(state.detail, /429 omni-x/);

  // עבודה שנקטעה באמצע לא יוצרת סרטון שני
  mock(() => { throw new Error('לא אמור לפנות שוב'); });
  ({ op } = await (await worker.fetch(post('/clip', { image: IMG, motion: 'x' }), env)).json());
  const job = studio.all.get(`job:${op}`);
  job.map.set('job', { ...job.map.get('job'), status: 'working' });
  await studio.runAlarms();
  assert.match((await (await worker.fetch(post('/clip/status', { op }), env)).json()).error, /נקטעה/);
  assert.equal((await worker.fetch(post('/clip', { image: IMG, motion: 'x' }), env)).status, 200);
  assert.equal((await worker.fetch(post('/clip', { image: IMG, motion: 'x' }), env)).status, 429);
});

test('CORS: רק מכתובת האפליקציה', async () => {
  const res = await worker.fetch(new Request('https://x/health', { headers: { origin: 'https://evil.example' } }), env);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const csp = fs.readFileSync(new URL('../web/public/_headers', import.meta.url), 'utf8');
  assert.match(csp, /connect-src 'self' https:\/\/nadlan-video-api\.guygitter\.workers\.dev/);
});

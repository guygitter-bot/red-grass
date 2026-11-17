// יצירת סרטון חדש במחולל הווידאו של Google (Gemini Omni, דרך ה-Interactions API) – כמו באפליקציית סרטוני הנדל"ן.
// סרטון עולה כסף (בחשבון Google), ולכן שום דבר לא נוצר בלי אישור של הבעלים בכפתור:
//   1. בוט קורא ל-make_video -> נשמרת הצעה (g:<id>, status: proposed) ומוצג כרטיס עם "ליצור סרטון" / "לא עכשיו"
//   2. הבעלים מאשר (/app/gen/approve) -> העבודה עוברת למופע נפרד של ה-Durable Object ("gen:<id>"), כדי שהקריאה
//      הארוכה ל-Google (דקה ויותר) לא תעכב את התשובות של הבוטים
//   3. הסרטון נשמר ב-R2 כקובץ רגיל, והכרטיס הופך לסרטון. הבוטים רואים אותו כקובץ (אפשר לבקש מהעורך לערוך אותו)
//
//   g:<id>        -> { id, key, prompt, summary, image, aspect, quality, status, error, file, at, startedAt }
//   clips:<תאריך> -> כמה סרטונים נוצרו היום (תקרה: DAILY_CLIPS)
//   genJob        -> (במופע "gen:<id>" בלבד) העבודה שרצה
import { fail } from './auth.js';
import { addFile, fileView, israelDate, newId } from './app.js';

export const SECONDS = 8;
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FILE_RE = /^https:\/\/generativelanguage\.googleapis\.com\//;
const KNOWN = ['gemini-omni-1.2-flash', 'gemini-omni-1.1-flash'];
const ASPECTS = ['9:16', '16:9', '1:1'];
const CALL_MS = 8 * 60 * 1000;
const STALE_MS = 15 * 60 * 1000;
const MAX_PROMPT = 2500;

export const genReady = (env) => Boolean(env.GEMINI_API_KEY && env.FILES);
export const dailyLimit = (env) => Number(env.DAILY_CLIPS) || 10;
// draft = טיוטה (מהירה וזולה בערך פי 2), final = לסרטון הסופי
const resolutionFor = (quality) => (quality === 'draft' ? '360p' : '1080p');

// ---------- ההצעה (הכלי make_video) ----------
export async function proposeClip(t, job, input, started) {
  const { storage, env } = t;
  if (!genReady(env)) return 'The video generator is not connected yet. Tell the owner; prepare the prompt as text instead.';
  const prompt = String(input.prompt || '').replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT);
  const summary = String(input.summary || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (prompt.length < 30) return 'prompt is too short: describe the subject, the action, the camera move, the look and the sound.';
  if (!summary) return 'summary (one Hebrew sentence for the owner) is required.';
  let image = null;
  if (input.image) {
    const f = await storage.get(`f:${String(input.image)}`);
    if (f?.kind !== 'image') return 'image must be the id of an uploaded photo ([file <id>: photo ...]).';
    image = f.id;
  }
  const rec = {
    id: newId(16), key: t.jobKey(job), prompt, summary, image,
    aspect: ASPECTS.includes(input.aspect) ? input.aspect : '9:16',
    quality: input.quality === 'draft' ? 'draft' : 'final',
    status: 'proposed', at: Date.now(),
  };
  await storage.put(`g:${rec.id}`, rec);
  started.push(rec.id);
  return 'The proposal is shown to the owner with a "create" button. Nothing is generated (and nothing is charged) until they approve. Say briefly what the clip will show and that it waits for their approval; do not propose the same clip again.';
}

// מה שהאפליקציה מציגה בכרטיס
export async function genView(t, id, origin) {
  const g = await t.storage.get(`g:${id}`);
  if (!g) return null;
  const out = { id: g.id, status: g.status, summary: g.summary, prompt: g.prompt, aspect: g.aspect, quality: g.quality, seconds: SECONDS, hasImage: Boolean(g.image), at: g.at };
  if (g.status === 'working' && Date.now() - (g.startedAt || g.at) > STALE_MS) return { ...out, status: 'failed', error: 'יצירת הסרטון לקחה יותר מדי זמן. אפשר לבקש שוב.' };
  if (g.status === 'failed') out.error = g.error || 'הסרטון לא נוצר. אפשר לבקש שוב.';
  if (g.status === 'done' && g.file) out.file = await fileView(t.storage, origin, await t.storage.get(`f:${g.file}`));
  return out;
}

// ---------- אישור / ביטול (מהאפליקציה) ----------
export async function approve(t, id) {
  const { storage, env } = t;
  const g = await storage.get(`g:${String(id || '')}`);
  if (!g) throw fail(404, 'ההצעה לא נמצאה');
  if (g.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  if (!genReady(env)) throw fail(503, 'מחולל הווידאו עוד לא מחובר');
  const dayKey = `clips:${israelDate()}`;
  const today = (await storage.get(dayKey)) || 0;
  if (today >= dailyLimit(env)) throw fail(429, `הגעת לתקרה של ${dailyLimit(env)} סרטונים ליום. אפשר להמשיך מחר.`);
  await storage.put(dayKey, today + 1);
  await storage.put(`g:${g.id}`, { ...g, status: 'working', startedAt: Date.now() });
  let image = null;
  if (g.image) {
    const f = await storage.get(`f:${g.image}`);
    if (f) image = { key: `files/${f.id}`, type: f.type };
  }
  // העבודה עצמה רצה במופע נפרד, ברקע
  const worker = env.TEAM.get(env.TEAM.idFromName(`gen:${g.id}`));
  await worker.fetch('https://team/internal/gen-start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: g.id, prompt: g.prompt, aspect: g.aspect, quality: g.quality, image }),
  });
  return { ok: true };
}

export async function cancel(storage, id) {
  const g = await storage.get(`g:${String(id || '')}`);
  if (!g) throw fail(404, 'ההצעה לא נמצאה');
  if (g.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  await storage.put(`g:${g.id}`, { ...g, status: 'cancelled' });
  return { ok: true };
}

// ---------- סיום (המופע של העבודה מדווח למופע הראשי) ----------
export async function genDone(t, id, file) {
  const { storage } = t;
  const g = await storage.get(`g:${String(id || '')}`);
  if (!g || g.status !== 'working') throw fail(404, 'no such job');
  const rec = await addFile(storage, { id: file.id, kind: 'video', name: 'generated.mp4', type: 'video/mp4', size: file.size, dur: SECONDS, conv: 'gen' });
  await storage.put(`g:${g.id}`, { ...g, status: 'done', file: rec.id, doneAt: Date.now() });
  // ההודעה שהציעה את הסרטון מקבלת את הקובץ, כדי שהבוטים יראו אותו בשיחה (ויוכלו לערוך אותו)
  const history = (await storage.get(g.key)) || [];
  const entry = history.find((h) => (h.gens || []).includes(g.id));
  if (entry) {
    entry.made = [...(entry.made || []), { id: rec.id, kind: 'video', name: rec.name, dur: SECONDS }];
    await storage.put(g.key, history);
  }
  // כמה סרטונים נוצרו החודש (למסך העלויות)
  const month = `cost:${israelDate().slice(0, 7)}`;
  const c = (await storage.get(month)) || { usd: 0, days: {} };
  await storage.put(month, { ...c, clips: (c.clips || 0) + 1 });
  return { ok: true };
}

export async function genFail(storage, id, error) {
  const g = await storage.get(`g:${String(id || '')}`);
  if (!g || g.status !== 'working') throw fail(404, 'no such job');
  await storage.put(`g:${g.id}`, { ...g, status: 'failed', error: String(error || '').slice(0, 300) });
  return { ok: true };
}

// ---------- הפנייה ל-Google (מותאם מ-nadlan_video/api/video.js) ----------
function googleMessage(status, text) {
  const s = String(text || '').toLowerCase();
  if (status === 400 && /api key|api_key/.test(s)) return 'מפתח Google לא תקין. צריך לעדכן את GEMINI_API_KEY בסודות של GitHub.';
  if (status === 402 || /credits are depleted|prepay/.test(s)) return 'נגמר הקרדיט בחשבון Google. צריך לטעון קרדיט ב-AI Studio ואז לנסות שוב.';
  if (status === 401 || status === 403) return 'מפתח Google לא תקין או שאין לו הרשאה ליצירת סרטונים.';
  if (status === 429 && /billing|free.?tier|quota/.test(s)) return 'יצירת סרטונים דורשת חשבון Google עם חיוב פעיל, או שנגמרה המכסה.';
  if (status === 429 || status >= 500) return 'יש עומס אצל Google כרגע. נסו שוב בעוד דקה.';
  if (/safety|policy|blocked|prohibited/.test(s)) return 'מחולל הווידאו סירב לבקשה הזאת. נסו לנסח אחרת (בלי אנשים מוכרים, מותגים או טקסט).';
  return 'לא הצלחנו ליצור את הסרטון. נסו שוב.';
}

const modelMissing = (status, raw) => status === 404 || (status === 400 && /model .*(not found|not supported)|is not found|unknown model|modalit/i.test(raw));

// הבקשות, מהמלאה לבסיסית: אם Google דוחה שדה (400) – מנסים עם פחות
export function requestBodies(model, image, prompt, aspect, quality) {
  const input = [...(image ? [{ type: 'image', data: image.data, mime_type: image.type }] : []), { type: 'text', text: prompt }];
  const format = { type: 'video', aspect_ratio: aspect, duration: `${SECONDS}s`, resolution: resolutionFor(quality), delivery: 'uri' };
  return [
    ...(image ? [{ model, input, response_format: format, generation_config: { video_config: { task: 'image_to_video' } } }] : []),
    { model, input, response_format: format },
    { model, input, response_format: { type: 'video', aspect_ratio: aspect, delivery: 'uri' } },
    { model, input, response_format: { type: 'video', aspect_ratio: aspect } },
  ];
}

// התשובה של Google -> החלק עם הסרטון ({ uri } או { data }); המבנה משתנה בין גרסאות, ולכן מחפשים בכל העץ
export function findVideo(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (!Array.isArray(node) && node.type === 'video' && (typeof node.uri === 'string' || typeof node.data === 'string')) {
    if (node.uri && FILE_RE.test(node.uri)) return { uri: node.uri };
    return node.data ? { data: node.data } : null;
  }
  for (const v of (Array.isArray(node) ? node : Object.values(node)).slice().reverse()) {
    const hit = findVideo(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

export function clipPrompt(prompt, hasImage) {
  return `${hasImage ? 'Use the attached image as the exact first frame of the video and animate it.\n\n' : ''}${prompt}\n\n` +
    'One continuous shot. Photorealistic unless a style is named above, natural motion. No on-screen text, captions, subtitles, logos or watermarks.';
}

// יוצר סרטון ומחכה לו. מחזיר Response עם הקובץ (גוף זורם), או זורק Error עם הודעה בעברית
async function generate(env, job, image) {
  const doFetch = env.FETCH || fetch;
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY };
  const prompt = clipPrompt(job.prompt, Boolean(image));
  let res;
  let raw = '';
  models: for (const model of [...new Set([env.VIDEO_MODEL, ...KNOWN].filter(Boolean))]) {
    for (const body of requestBodies(model, image, prompt, job.aspect, job.quality)) {
      res = await doFetch(`${BASE}/interactions`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(CALL_MS) });
      raw = await res.text();
      if (res.ok) break models;
      if (modelMissing(res.status, raw)) break;
      // 400 שאינו על המפתח או על התוכן: כנראה שדה שהמודל לא מכיר – מנסים בקשה פשוטה יותר
      if (!(res.status === 400 && !/api key|api_key|safety|policy|blocked/i.test(raw))) break models;
    }
    if (!modelMissing(res.status, raw)) break;
  }
  if (!res.ok) {
    console.error('video generator', res.status, raw.slice(0, 300));
    throw new Error(googleMessage(res.status, raw));
  }
  let data = null;
  try { data = JSON.parse(raw); } catch { /* נבדק מיד */ }
  const video = findVideo(data?.steps) || findVideo(data?.outputs) || findVideo(data);
  if (!video) throw new Error(googleMessage(200, raw));
  if (video.data) return new Response(Uint8Array.from(atob(video.data), (c) => c.charCodeAt(0)));
  const ready = /alt=media|:download/.test(video.uri);
  for (const url of ready ? [video.uri] : [`${video.uri}:download?alt=media`, `${video.uri}${video.uri.includes('?') ? '&' : '?'}alt=media`, video.uri]) {
    const file = await doFetch(url, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, redirect: 'follow' }).catch(() => null);
    if (file?.ok && file.body && !/json|text\//i.test(file.headers.get('content-type') || '')) return file;
    await file?.body?.cancel().catch(() => {});
  }
  throw new Error('הסרטון נוצר, אבל לא הצלחנו להוריד אותו מ-Google. נסו שוב.');
}

// ---------- המופע של העבודה ("gen:<id>") ----------
export async function genStart(storage, body) {
  await storage.put('genJob', { ...body, status: 'queued', at: Date.now() });
  await storage.setAlarm(Date.now());
  return { ok: true };
}

// נקרא מה-alarm. true = הייתה כאן עבודה של סרטון
export async function runGenJob(t) {
  const { storage, env } = t;
  const job = await storage.get('genJob');
  if (!job) return false;
  const main = env.TEAM.get(env.TEAM.idFromName('main'));
  const report = (path, body) => main.fetch(`https://team/internal/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch((e) => console.error(path, e));
  // ה-alarm רץ שוב באמצע עבודה (השרת התחיל מחדש): לא יוצרים פעמיים – זה עולה כסף
  if (job.status === 'working') {
    await storage.delete('genJob');
    await report('gen-fail', { id: job.id, error: 'יצירת הסרטון נקטעה. אפשר לבקש שוב.' });
    return true;
  }
  await storage.put('genJob', { ...job, status: 'working' });
  let fileId = '';
  try {
    let image = null;
    if (job.image) {
      const obj = await env.FILES.get(job.image.key);
      if (obj) {
        const bytes = new Uint8Array(await obj.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        image = { data: btoa(bin), type: job.image.type };
      }
    }
    const res = await generate(env, job, image);
    fileId = newId(16);
    const obj = await env.FILES.put(`files/${fileId}`, res.body, { httpMetadata: { contentType: 'video/mp4' } });
    if (!obj.size) throw new Error('הסרטון שהתקבל ריק. נסו שוב.');
    await storage.delete('genJob');
    await report('gen-done', { id: job.id, file: { id: fileId, size: obj.size } });
  } catch (e) {
    console.error('gen job', e);
    if (fileId) await env.FILES.delete(`files/${fileId}`).catch(() => {});
    await storage.delete('genJob');
    const known = /[֐-׿]/.test(e?.message || '');
    await report('gen-fail', { id: job.id, error: known ? e.message : 'אין חיבור למחולל הווידאו כרגע, או שהוא לא ענה בזמן. נסו שוב.' });
  }
  return true;
}

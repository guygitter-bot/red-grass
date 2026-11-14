// מחולל הווידאו (Google Gemini Omni דרך ה-Interactions API): פריים פתיחה + תנועת מצלמה -> סרטון של 8 שניות.
// הקריאה ל-Google נשארת פתוחה עד שהסרטון מוכן (דקה ויותר), ולכן היא רצה ברקע ב-Durable Object (ראו studio.js: "עבודה"),
// והאפליקציה רק שואלת אם הסרטון מוכן. כאן: בניית הבקשה, קריאת התשובה, והורדת הקובץ.
import { BASE, fail, googleMessage, googleDetail, modelMissing, listModels } from './google.js';
import { STYLES } from './brief.js';

export const SECONDS = 8;
const FILE_RE = /^https:\/\/generativelanguage\.googleapis\.com\//;

let found = null;
export const forgetVideoModel = () => { found = null; };

// מה אסור שיקרה בסרטון נדל"ן. בסגנון רגוע גם תנועה מהירה אסורה
export const NEGATIVE = 'warping or morphing architecture, bending walls, melting windows, a changing number of floors, new buildings appearing, text, captions, subtitles, logos, watermarks, people walking into frame, camera shake, cuts, flicker, cartoon look';

// ההוראה למחולל: תנועת המצלמה של הבמאי + הקצב של הסגנון + כללי האיכות
export function clipPrompt(motion, styleId) {
  const style = STYLES[styleId] || STYLES.classic;
  return `Use the attached image as the exact first frame of the video and animate it.

${motion}

Cinematic high-end real-estate promotional film. ${style.pace} A single unbroken take for the whole shot, and the \
camera really moves: the last frame is clearly a different view from the first. The architecture is rigid and stays \
exactly as in the first frame: straight vertical lines, no morphing, no new objects. Photorealistic, natural colour \
grade, soft highlight roll-off, 24fps film motion. Audio: subtle natural ambience only, no music, no speech.

Avoid: ${NEGATIVE}${style.calm ? ', fast camera motion' : ''}.`;
}

// מתוך רשימת המודלים של Google: מודל הווידאו (Omni), הגרסה החדשה ביותר, ועדיף לא "preview"
export function pickVideoModel(models) {
  const names = (models || [])
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((n) => /omni/i.test(n));
  if (!names.length) return null;
  const score = (n) => (/preview|exp/i.test(n) ? 1 : 0) + (/lite/i.test(n) ? 2 : 0);
  return names.sort((a, b) => score(a) - score(b) || b.localeCompare(a, 'en', { numeric: true }))[0];
}

// max = לסרטון הסופי, fast = טיוטה (מהירה וזולה בערך פי 2)
export const resolutionFor = (quality) => (quality === 'fast' ? '360p' : '1080p');

// הבקשות, מהמלאה לבסיסית: אם Google דוחה שדה (400) – מנסים עם פחות, כדי שתמיד ייצא סרטון
export function requestBodies(model, image, prompt, aspect, quality) {
  const input = [{ type: 'image', data: image.data, mime_type: image.media_type }, { type: 'text', text: prompt }];
  const format = { type: 'video', aspect_ratio: aspect, duration: `${SECONDS}s`, resolution: resolutionFor(quality), delivery: 'uri' };
  const task = { video_config: { task: 'image_to_video' } }; // התמונה היא הפריים הראשון, לא רק השראה
  return [
    { model, input, response_format: format, generation_config: task },
    { model, input, response_format: format },
    { model, input, response_format: { type: 'video', aspect_ratio: aspect, delivery: 'uri' } },
    { model, input, response_format: { type: 'video', aspect_ratio: aspect } },
    { model, input },
  ];
}

// התשובה של Google -> החלק עם הסרטון ({ uri } או { data }) – מחפשים בכל העץ, כי מבנה התשובה משתנה בין גרסאות
export function findVideo(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (!Array.isArray(node) && node.type === 'video' && (typeof node.uri === 'string' || typeof node.data === 'string')) {
    const type = node.mime_type || node.mimeType || 'video/mp4';
    if (node.uri && FILE_RE.test(node.uri)) return { uri: node.uri, type };
    if (node.data) return { data: node.data, type };
    return null;
  }
  // מהסוף להתחלה: הסרטון האחרון הוא התוצאה
  for (const v of (Array.isArray(node) ? node : Object.values(node)).slice().reverse()) {
    const hit = findVideo(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

// מה המודל כתב במקום סרטון (לאבחון)
function saidInstead(data) {
  const texts = [];
  const walk = (n, d) => {
    if (!n || typeof n !== 'object' || d > 8) return;
    if (!Array.isArray(n) && n.type === 'text' && typeof n.text === 'string') texts.push(n.text);
    for (const v of Array.isArray(n) ? n : Object.values(n)) walk(v, d + 1);
  };
  walk(data?.steps || data?.outputs || data, 0);
  return `${data?.status || ''} ${texts.join(' ')}`.replace(/\s+/g, ' ').trim().slice(0, 300);
}

const call = (env, body, signal) => fetch(`${BASE}/interactions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
  body: JSON.stringify(body),
  signal,
});

const KNOWN = ['gemini-omni-1.2-flash', 'gemini-omni-1.1-flash'];

// יוצר סרטון ומחכה לו (דקה ויותר). מחזיר { uri | data, type, model, resolution } או זורק Error בעברית
export async function generateClip(env, image, motion, aspect, quality, signal, style) {
  const prompt = clipPrompt(motion, style);
  const queue = [...new Set([found, env.VIDEO_MODEL, ...KNOWN].filter(Boolean))];
  const tried = new Set();
  let listed = false;
  let res, raw, model, body;
  try {
    models: while (queue.length) {
      model = queue.shift();
      if (tried.has(model)) continue;
      tried.add(model);
      for (body of requestBodies(model, image, prompt, aspect, quality)) {
        res = await call(env, body, signal);
        raw = await res.text();
        if (res.ok) break models;
        if (modelMissing(res.status, raw)) break;
        // 400 שאינו על המפתח או על התוכן: כנראה שדה שהמודל הזה לא מכיר – מנסים בקשה פשוטה יותר
        if (!(res.status === 400 && !/api key|api_key|safety|policy|blocked/i.test(raw))) break models;
      }
      if (!modelMissing(res.status, raw)) break;
      if (!listed) {
        listed = true;
        const other = pickVideoModel(await listModels(env));
        if (other) queue.unshift(other);
      }
    }
  } catch {
    throw fail('אין חיבור למחולל הווידאו כרגע, או שהוא לא ענה בזמן. נסו שוב.');
  }
  if (!res.ok) throw fail(googleMessage(res.status, raw, 'הסרטון'), googleDetail(res.status, model, raw));
  let data;
  try { data = JSON.parse(raw); } catch { throw fail('מחולל הווידאו לא החזיר סרטון. נסו שוב.', `${model}: bad JSON`); }
  const video = findVideo(data?.steps) || findVideo(data?.outputs) || findVideo(data);
  if (!video) {
    const said = saidInstead(data);
    if (/safety|policy|blocked|prohibited|cannot|can't/i.test(said)) throw fail('מחולל הווידאו סירב לפריים הזה. נסו ליצור את הפריים מחדש (בלי אנשים, שלטים או טקסט).', `${model}: ${said}`);
    throw fail('מחולל הווידאו לא החזיר סרטון. נסו שוב.', `${model}: ${said || 'no video'}`);
  }
  found = model;
  return { ...video, model, resolution: body.response_format?.resolution || '720p' };
}

// מוריד סרטון שנשמר אצל Google (delivery: uri). מחזיר Response עם הקובץ, או זורק Error בעברית
export async function fetchClipFile(env, uri) {
  if (!FILE_RE.test(uri)) throw fail('לא הצלחנו להוריד את הסרטון. נסו שוב.', 'bad uri');
  const headers = { 'x-goog-api-key': env.GEMINI_API_KEY };
  // כתובת של קובץ (files/<id>) מורידים עם ":download?alt=media"; כתובת הורדה מוכנה – כמו שהיא
  const ready = /alt=media|:download/.test(uri);
  const tries = ready ? [uri] : [`${uri}:download?alt=media`, `${uri}${uri.includes('?') ? '&' : '?'}alt=media`, uri];
  let last = '';
  for (const url of tries) {
    let res;
    try {
      res = await fetch(url, { headers, redirect: 'follow' });
    } catch {
      last = 'network';
      continue;
    }
    const type = res.headers.get('content-type') || '';
    if (res.ok && res.body && !/json|text\//i.test(type)) return res;
    last = `${res.status} ${type}`;
    await res.body?.cancel().catch(() => {});
    if (res.status === 404 && ready) break;
  }
  throw fail('הסרטון כבר לא נמצא אצל Google (נשמר שם רק יומיים). צריך ליצור אותו מחדש.', `download ${last}`);
}

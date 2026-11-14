// מחולל הווידאו (Google Veo דרך Gemini API): פריים פתיחה + תנועת מצלמה -> סרטון של 8 שניות.
// יצירת סרטון לוקחת כמה דקות, ולכן זה בשלושה צעדים: startClip (מחזיר מזהה פעולה), clipStatus (האם מוכן), clipFile (הקובץ).
import { BASE, fail, googleMessage, googleDetail, modelMissing, listModels } from './google.js';

// מזהה פעולה של Google: models/<מודל>/operations/<מזהה>. רק מבנה כזה נשלח הלאה (לא כתובת שהלקוח המציא)
export const OP_RE = /^models\/[A-Za-z0-9._-]{1,80}\/operations\/[A-Za-z0-9._-]{1,120}$/;
const FILE_RE = /^https:\/\/generativelanguage\.googleapis\.com\//;

const found = { max: null, fast: null };
export const forgetVideoModel = () => { found.max = null; found.fast = null; };

// מה אסור שיקרה בסרטון נדל"ן
export const NEGATIVE = 'warping or morphing architecture, bending walls, melting windows, changing number of floors, new buildings appearing, text, captions, subtitles, logos, watermark, people walking into frame, fast camera motion, camera shake, cuts, flicker, cartoon, low quality';

// ההוראה ל-Veo: תנועת המצלמה של הבמאי + כללי האיכות
export function clipPrompt(motion) {
  return `${motion}

Cinematic high-end real-estate promotional film. One continuous, slow, perfectly stabilised camera move for the whole \
shot. The architecture is rigid and stays exactly as in the first frame: straight vertical lines, no morphing, no new \
objects. Photorealistic, natural colour grade, soft highlight roll-off, 24fps film motion. Audio: subtle natural ambience \
only, no music, no speech.`;
}

// מתוך רשימת המודלים של Google: מודל Veo. fast = הגרסה המהירה; אחרת הגרסה המלאה, והחדשה ביותר
export function pickVideoModel(models, fast) {
  const names = (models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('predictLongRunning'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((n) => /^veo/i.test(n));
  if (!names.length) return null;
  const kind = (n) => (/lite/i.test(n) ? 2 : /fast/i.test(n) ? 1 : 0);
  const want = fast ? 1 : 0;
  const score = (n) => Math.abs(kind(n) - want) + (/preview|exp/i.test(n) ? 0.25 : 0);
  return names.sort((a, b) => score(a) - score(b) || b.localeCompare(a, 'en', { numeric: true }))[0];
}

// ההגדרות, מהמלאות לבסיסיות: אם Google דוחה שדה (400) – מנסים עם פחות, כדי שתמיד ייצא סרטון
export function paramSets(aspect) {
  return [
    { aspectRatio: aspect, resolution: '1080p', durationSeconds: 8, personGeneration: 'allow_adult', negativePrompt: NEGATIVE, sampleCount: 1 },
    { aspectRatio: aspect, resolution: '1080p', personGeneration: 'allow_adult', negativePrompt: NEGATIVE },
    { aspectRatio: aspect, resolution: '720p', personGeneration: 'allow_adult', negativePrompt: NEGATIVE },
    { aspectRatio: aspect, negativePrompt: NEGATIVE },
    { aspectRatio: aspect },
  ];
}

function start(env, model, image, prompt, parameters) {
  return fetch(`${BASE}/models/${encodeURIComponent(model)}:predictLongRunning`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ instances: [{ prompt, image: { bytesBase64Encoded: image.data, mimeType: image.media_type } }], parameters }),
  });
}

const KNOWN = { max: ['veo-3.1-generate-preview', 'veo-3.1-generate-001'], fast: ['veo-3.1-fast-generate-preview', 'veo-3.1-fast-generate-001'] };

// מתחיל יצירת סרטון. מחזיר { op, model, resolution } או זורק Error בעברית
export async function startClip(env, image, motion, aspect, quality) {
  const fast = quality === 'fast';
  const slot = fast ? 'fast' : 'max';
  const prompt = clipPrompt(motion);
  const queue = [...new Set([found[slot], fast ? env.VIDEO_MODEL_FAST : env.VIDEO_MODEL, ...KNOWN[slot]].filter(Boolean))];
  const tried = new Set();
  let listed = false;
  let res, raw, model, params;
  try {
    models: while (queue.length) {
      model = queue.shift();
      if (tried.has(model)) continue;
      tried.add(model);
      for (params of paramSets(aspect)) {
        res = await start(env, model, image, prompt, params);
        raw = await res.text();
        if (res.ok) break models;
        if (modelMissing(res.status, raw)) break;
        // 400 שאינו על המפתח: כנראה שדה שהמודל הזה לא מכיר – מנסים הגדרות פשוטות יותר
        if (!(res.status === 400 && !/api key|api_key|safety|policy/i.test(raw))) break models;
      }
      if (!modelMissing(res.status, raw)) break;
      if (!listed) {
        listed = true;
        const other = pickVideoModel(await listModels(env), fast);
        if (other) queue.unshift(other);
      }
    }
  } catch {
    throw fail('אין חיבור למחולל הווידאו כרגע. נסו שוב.');
  }
  if (!res.ok) throw fail(googleMessage(res.status, raw, 'הסרטון'), googleDetail(res.status, model, raw));
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (!OP_RE.test(data?.name || '')) throw fail('מחולל הווידאו לא התחיל לעבוד. נסו שוב.', `${model}: no operation`);
  found[slot] = model;
  return { op: data.name, model, resolution: params.resolution || '720p' };
}

// התשובה של Google על פעולה -> { done, uri?, error?, detail? }
export function readOperation(data) {
  if (!data?.done) return { done: false };
  if (data.error) return { done: true, error: 'מחולל הווידאו לא הצליח ליצור את הסרטון. נסו שוב.', detail: String(data.error.message || '').slice(0, 300) };
  const out = data.response?.generateVideoResponse || data.response || {};
  const uri = (out.generatedSamples || out.generatedVideos || [])[0]?.video?.uri || '';
  if (FILE_RE.test(uri)) return { done: true, uri };
  const reasons = (out.raiMediaFilteredReasons || []).join(' ').slice(0, 300);
  if (reasons || out.raiMediaFilteredCount) return { done: true, error: 'מחולל הווידאו סירב לפריים הזה. נסו ליצור את הפריים מחדש (בלי אנשים, שלטים או טקסט).', detail: reasons };
  return { done: true, error: 'מחולל הווידאו לא החזיר סרטון. נסו שוב.', detail: 'no video in response' };
}

async function operation(env, op) {
  let res;
  try {
    res = await fetch(`${BASE}/${op}`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
  } catch {
    throw fail('אין חיבור למחולל הווידאו כרגע. נסו שוב.');
  }
  const raw = await res.text();
  if (res.status === 404) return { done: true, error: 'הסרטון כבר לא נמצא אצל Google (נשמר שם רק יומיים). צריך ליצור אותו מחדש.' };
  if (!res.ok) throw fail(googleMessage(res.status, raw, 'הסרטון'), googleDetail(res.status, 'operation', raw));
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  return readOperation(data);
}

// האם הסרטון מוכן: { done, error?, detail? } (בלי הכתובת – הקובץ עובר רק דרך clipFile)
export async function clipStatus(env, op) {
  const { uri, ...state } = await operation(env, op);
  return state;
}

// הקובץ עצמו (mp4) כזרם, או זורק Error בעברית
export async function clipFile(env, op) {
  const state = await operation(env, op);
  if (!state.done) throw fail('הסרטון עוד לא מוכן.');
  if (!state.uri) throw fail(state.error, state.detail);
  let res;
  try {
    res = await fetch(state.uri, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, redirect: 'follow' });
  } catch {
    throw fail('לא הצלחנו להוריד את הסרטון. נסו שוב.');
  }
  if (!res.ok || !res.body) throw fail('לא הצלחנו להוריד את הסרטון. נסו שוב.', `download ${res.status}`);
  return { body: res.body, type: res.headers.get('content-type') || 'video/mp4', length: res.headers.get('content-length') || '' };
}

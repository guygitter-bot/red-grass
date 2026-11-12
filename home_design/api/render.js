// מחולל התמונות (Google Gemini API): מקבל את צילום החדר ואת השינוי המבוקש ומחזיר את אותו חדר אחרי השינוי.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// המודל שנמצא ברשימה של Google, אחרי שהשם שבהגדרות לא נמצא (נשמר עד שהשרת מתחיל מחדש)
let found = null;
export const forgetModel = () => { found = null; };

// ההוראה למחולל: השינוי של המשתמש + מה אסור לשנות
export function editPrompt(request) {
  return `You are a professional interior designer editing a photo of a real room in the client's home.

Apply this change to the photo (the request may be in Hebrew):
"""
${request}
"""

Rules:
- Change only what the request asks for. Everything else stays exactly as in the photo: camera angle, perspective, room \
shape and size, windows, doors, ceiling, floor, furniture and objects.
- The result must look like a real photograph of the same room after the work was done: correct scale, realistic \
materials, lighting and shadows that match the existing light.
- Keep the same framing and aspect ratio. No text, labels, watermarks or split-screen comparisons.`;
}

// מתוך רשימת המודלים של Google: מודל שמייצר תמונות (לא וידאו), עדיף לא "lite" ולא "pro" (היקר)
export function pickModel(models) {
  const names = (models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((n) => /banana|image/i.test(n) && !/imagen|veo|embed|vision/i.test(n));
  if (!names.length) return null;
  const score = (n) => (/lite/i.test(n) ? 2 : 0) + (/pro/i.test(n) ? 1 : 0) + (/preview|exp/i.test(n) ? 0.5 : 0);
  // בציון שווה – השם ה"גדול" יותר (גרסה חדשה יותר) קודם
  return names.sort((a, b) => score(a) - score(b) || b.localeCompare(a, 'en', { numeric: true }))[0];
}

// שגיאות מ-Google בעברית
export function imageMessage(status, text) {
  const t = String(text || '').toLowerCase();
  if (status === 400 && /api key|api_key/.test(t)) return 'מפתח Google לא תקין. צריך לעדכן את GEMINI_API_KEY בסודות של GitHub.';
  if (status === 402 || /credits are depleted|prepay/.test(t)) return 'נגמר הקרדיט בחשבון Google. צריך לטעון קרדיט ב-AI Studio (ai.studio/projects ← Billing) ואז לנסות שוב.';
  if (status === 401 || status === 403) return 'מפתח Google לא תקין או שאין לו הרשאה ליצירת תמונות.';
  if (status === 429 && /billing|free.?tier|quota/.test(t)) return 'יצירת תמונות דורשת חשבון Google עם חיוב פעיל, או שנגמרה המכסה (aistudio.google.com ← Billing).';
  if (status === 429 || status >= 500) return 'יש עומס אצל מחולל התמונות. נסו שוב בעוד דקה.';
  return 'לא הצלחנו ליצור את ההדמיה. נסו שוב.';
}

// התשובה של Google -> { media_type, data } או null
export function readImage(data) {
  for (const c of data?.candidates || []) {
    for (const p of c?.content?.parts || []) {
      const im = p.inlineData || p.inline_data;
      if (im?.data) return { media_type: im.mimeType || im.mime_type || 'image/png', data: im.data };
    }
  }
  return null;
}

async function listModels(env) {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return pickModel(data?.models);
}

function generate(env, model, image, request) {
  return fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ inlineData: { mimeType: image.media_type, data: image.data } }, { text: editPrompt(request) }],
      }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
}

// שמות שהיו נכונים בעבר – מנסים אותם אם גם השם שבהגדרות וגם הרשימה של Google לא עזרו
const KNOWN = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

// ההודעה של Google עצמה (באנגלית), קצרה – מוצגת למשתמש באותיות קטנות כדי שאפשר יהיה לאבחן תקלה
function googleDetail(status, model, raw) {
  let msg = '';
  try { msg = JSON.parse(raw)?.error?.message || ''; } catch { msg = ''; }
  return `${status} ${model}: ${String(msg || raw || '').replace(/\s+/g, ' ').slice(0, 300)}`;
}

function fail(message, detail) {
  const e = new Error(message);
  e.detail = detail || '';
  return e;
}

// image: { media_type, data } (base64). request: מה לשנות (עברית או אנגלית)
// מחזיר { media_type, data, model } או זורק Error עם הודעה בעברית (ו-detail: מה Google ענה)
export async function renderImage(env, image, request) {
  const queue = [...new Set([found, env.IMAGE_MODEL, ...KNOWN].filter(Boolean))];
  const tried = new Set();
  let listed = false;
  let res, raw, model;
  try {
    while (queue.length) {
      model = queue.shift();
      if (tried.has(model)) continue;
      tried.add(model);
      res = await generate(env, model, image, request);
      raw = await res.text();
      if (res.ok) break;
      // רק כשהבעיה היא המודל עצמו (לא קיים / לא מייצר תמונות) ממשיכים למודל הבא
      if (!(res.status === 404 || (res.status === 400 && /model|not found|not supported|modalit/i.test(raw)))) break;
      if (!listed) {
        listed = true;
        const other = await listModels(env);
        if (other) queue.unshift(other);
      }
    }
  } catch {
    throw fail('אין חיבור למחולל התמונות כרגע. נסו שוב.');
  }
  if (!res.ok) throw fail(imageMessage(res.status, raw), googleDetail(res.status, model, raw));
  found = model;
  let data;
  try { data = JSON.parse(raw); } catch { throw fail('לא הצלחנו ליצור את ההדמיה. נסו שוב.', `${model}: bad JSON`); }
  const out = readImage(data);
  if (out) return { ...out, model };
  const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
  const said = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(' ').replace(/\s+/g, ' ').slice(0, 200);
  const detail = `${model}: ${reason || 'no image'}${said ? ` - ${said}` : ''}`;
  if (/SAFETY|PROHIBITED|BLOCK/i.test(reason)) throw fail('מחולל התמונות סירב לתמונה או לבקשה הזאת. נסו לנסח אחרת, או לצלם בלי אנשים.', detail);
  throw fail('מחולל התמונות לא החזיר תמונה. נסו שוב, או נסחו את הבקשה אחרת.', detail);
}

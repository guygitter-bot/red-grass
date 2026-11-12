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

// image: { media_type, data } (base64). request: מה לשנות (עברית או אנגלית)
// מחזיר { media_type, data } או זורק Error עם הודעה בעברית
export async function renderImage(env, image, request) {
  let model = found || env.IMAGE_MODEL;
  let res;
  try {
    res = await generate(env, model, image, request);
    // השם שבהגדרות כבר לא קיים אצל Google -> מחפשים מודל תמונות ברשימה ומנסים שוב
    if (res.status === 404 || (res.status === 400 && /not found|not supported/i.test(await res.clone().text()))) {
      const other = await listModels(env);
      if (other && other !== model) {
        model = other;
        res = await generate(env, model, image, request);
        if (res.ok) found = model;
      }
    }
  } catch {
    throw new Error('אין חיבור למחולל התמונות כרגע. נסו שוב.');
  }
  const raw = await res.text();
  if (!res.ok) throw new Error(imageMessage(res.status, raw));
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('לא הצלחנו ליצור את ההדמיה. נסו שוב.'); }
  const out = readImage(data);
  if (out) return out;
  const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
  if (/SAFETY|PROHIBITED|BLOCK/i.test(reason)) throw new Error('מחולל התמונות סירב לתמונה או לבקשה הזאת. נסו לנסח אחרת, או לצלם בלי אנשים.');
  throw new Error('מחולל התמונות לא החזיר תמונה. נסו שוב, או נסחו את הבקשה אחרת.');
}

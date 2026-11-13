// המאייר (Google Gemini API): מקבל תיאור סצנה (ואולי תמונה של גיבור הספר) ומחזיר איור.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// המודל שנמצא ברשימה של Google, אחרי שהשם שבהגדרות לא נמצא (נשמר עד שהשרת מתחיל מחדש)
let found = null;
export const forgetModel = () => { found = null; };

// ההוראה למאייר: הסצנה + סגנון האיור + איך הדמויות נראות. photo = האם צורפה תמונה של גיבור הספר
// romance = רומן למבוגרים: מרומז בלבד, דמויות מצוירות ובדויות
export function artPrompt({ scene, style, look, cover, photo, romance }) {
  return `You are the illustrator of a personal gift book. Draw one illustration.

Scene: ${scene}

Style: ${style}. The same style on every page of the book.
${look ? `The characters and world of the book: ${look}\n` : ''}${photo
    ? 'The attached photo shows the real person the book is about. Draw the main character so they are clearly recognizable as this person (face, hair, build), in the illustration style - not a pasted photo.\n'
    : ''}
Rules:
- ${cover ? 'This is the book cover: a single strong image, vertical (portrait 3:4) composition, with calm empty space in the upper third for the title.' : 'An inside illustration: horizontal (landscape 4:3) composition.'}
- No text, letters, numbers, captions, logos, watermarks or frames anywhere in the image.
- ${romance
    ? 'A romance novel for adults, suggestive only: the mood comes from closeness, a gaze, hands, silhouettes, light and place. Everyone is an adult and fully clothed. No nudity, no underwear or swimwear focus, no sexual acts or poses. The people are invented, drawn characters - not a likeness of any real person.'
    : 'Warm, kind and suitable for all ages.'}`;
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
  if (status === 429 || status >= 500) return 'יש עומס אצל המאייר. נסו שוב בעוד דקה.';
  return 'לא הצלחנו ליצור את האיור. נסו שוב.';
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

function generate(env, model, prompt, photo) {
  return fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [...(photo ? [{ inlineData: { mimeType: photo.media_type, data: photo.data } }] : []), { text: prompt }],
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

// prompt: ההוראה המלאה (artPrompt). photo: { media_type, data } של גיבור הספר, או null
// מחזיר { media_type, data, model } או זורק Error עם הודעה בעברית (ו-detail: מה Google ענה)
export async function drawImage(env, prompt, photo) {
  const queue = [...new Set([found, env.IMAGE_MODEL, ...KNOWN].filter(Boolean))];
  const tried = new Set();
  let listed = false;
  let res, raw, model;
  try {
    while (queue.length) {
      model = queue.shift();
      if (tried.has(model)) continue;
      tried.add(model);
      res = await generate(env, model, prompt, photo);
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
    throw fail('אין חיבור למאייר כרגע. נסו שוב.');
  }
  if (!res.ok) throw fail(imageMessage(res.status, raw), googleDetail(res.status, model, raw));
  found = model;
  let data;
  try { data = JSON.parse(raw); } catch { throw fail('לא הצלחנו ליצור את האיור. נסו שוב.', `${model}: bad JSON`); }
  const out = readImage(data);
  if (out) return { ...out, model };
  const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
  const said = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(' ').replace(/\s+/g, ' ').slice(0, 200);
  const detail = `${model}: ${reason || 'no image'}${said ? ` - ${said}` : ''}`;
  if (/SAFETY|PROHIBITED|BLOCK/i.test(reason)) throw fail('המאייר סירב לאיור הזה. נסו שוב, או בלי התמונה המצורפת.', detail);
  throw fail('המאייר לא החזיר איור. נסו שוב.', detail);
}

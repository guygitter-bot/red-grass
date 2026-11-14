// מחולל הפריימים (Google Gemini API, מודל תמונות): מקבל צילום או שרטוט + הוראה, ומחזיר את פריים הפתיחה של השוט –
// תמונה פוטוריאליסטית שממנה מחולל הווידאו מתחיל את התנועה. שרטוט הופך כאן להדמיה אדריכלית.
import { BASE, fail, googleMessage, googleDetail, modelMissing, listModels } from './google.js';
import { LOOKS } from './brief.js';

// המודל שנמצא ברשימה של Google, אחרי שהשם שבהגדרות לא נמצא (נשמר עד שהשרת מתחיל מחדש)
let found = null;
export const forgetStillModel = () => { found = null; };

// ההוראה למחולל: מה הבמאי ביקש + כללי האמת האדריכלית
export function stillPrompt(instruction, brief, source) {
  const from = source === 'plan'
    ? 'The attached image is an architectural drawing (floor plan, elevation or sketch). Read it as the binding design.'
    : 'The attached image is a photograph or render of the real property. It is the binding reference for the design.';
  return `You are a senior architectural visualisation artist producing one frame for a luxury real-estate promo film.

${from}

Produce this frame:
"""
${instruction}
"""

Rules:
- Stay faithful to the design in the attached image: same number of floors, same facade composition, window and balcony \
layout, same room layout and proportions. Do not add or remove floors, wings, windows or rooms.
- The result must look like a real photograph taken with a full-frame cinema camera: correct scale and perspective, \
straight verticals, realistic materials, reflections and shadows.
- Light and mood: ${LOOKS[brief.look]}.
- Frame: ${brief.aspect === '9:16' ? 'vertical 9:16' : 'horizontal 16:9'}, composed with a little breathing room around the subject for camera movement.
- No text, labels, dimensions, logos, watermarks, borders or split screens. No people in the foreground.`;
}

// מתוך רשימת המודלים של Google: מודל שמייצר תמונות (לא וידאו). כאן האיכות חשובה – "pro" קודם, "lite" אחרון
export function pickStillModel(models) {
  const names = (models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((n) => /banana|image/i.test(n) && !/imagen|veo|omni|embed|vision/i.test(n));
  if (!names.length) return null;
  const score = (n) => (/lite/i.test(n) ? 2 : 0) + (/pro/i.test(n) ? -1 : 0) + (/preview|exp/i.test(n) ? 0.5 : 0);
  return names.sort((a, b) => score(a) - score(b) || b.localeCompare(a, 'en', { numeric: true }))[0];
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

// withAspect: מבקשים את יחס התמונה גם בהגדרות (לא כל מודל מכיר את השדה – אז מנסים שוב בלעדיו)
function generate(env, model, image, text, aspect, withAspect) {
  return fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: image.media_type, data: image.data } }, { text }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(withAspect ? { imageConfig: { aspectRatio: aspect } } : {}) },
    }),
  });
}

// שמות שהיו נכונים בעבר – מנסים אותם אם גם השם שבהגדרות וגם הרשימה של Google לא עזרו
const KNOWN = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

// image: { media_type, data }. מחזיר { media_type, data, model } או זורק Error בעברית (ו-detail: מה Google ענה)
export async function makeStill(env, image, instruction, brief, source) {
  const text = stillPrompt(instruction, brief, source);
  const queue = [...new Set([found, env.IMAGE_MODEL, ...KNOWN].filter(Boolean))];
  const tried = new Set();
  let listed = false;
  let res, raw, model;
  try {
    while (queue.length) {
      model = queue.shift();
      if (tried.has(model)) continue;
      tried.add(model);
      res = await generate(env, model, image, text, brief.aspect, true);
      raw = await res.text();
      if (res.status === 400 && /imageConfig|aspectRatio|unknown name|invalid json/i.test(raw)) {
        res = await generate(env, model, image, text, brief.aspect, false);
        raw = await res.text();
      }
      if (res.ok) break;
      if (!modelMissing(res.status, raw)) break;
      if (!listed) {
        listed = true;
        const other = pickStillModel(await listModels(env));
        if (other) queue.unshift(other);
      }
    }
  } catch {
    throw fail('אין חיבור למחולל הפריימים כרגע. נסו שוב.');
  }
  if (!res.ok) throw fail(googleMessage(res.status, raw, 'הפריים'), googleDetail(res.status, model, raw));
  found = model;
  let data;
  try { data = JSON.parse(raw); } catch { throw fail('לא הצלחנו ליצור את הפריים. נסו שוב.', `${model}: bad JSON`); }
  const out = readImage(data);
  if (out) return { ...out, model };
  const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
  const detail = `${model}: ${reason || 'no image'}`;
  if (/SAFETY|PROHIBITED|BLOCK/i.test(reason)) throw fail('מחולל הפריימים סירב לתמונה הזאת. נסו תמונה בלי אנשים או שלטים.', detail);
  throw fail('מחולל הפריימים לא החזיר תמונה. נסו שוב.', detail);
}

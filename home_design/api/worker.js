// השרת של "מעצב הבית" (Cloudflare Worker, בלי שמירת נתונים – התמונות נשמרות רק במכשיר):
//   GET  /health -> { ok, designer, images } (אילו מפתחות מוגדרים)
//   POST /ideas  { image: {media_type, data}, note? }     -> { room, ideas: [{title, why, prompt}] }   (Claude)
//   POST /shop   { before, after: {media_type, data}, request? } -> { summary, items, labor, tips }       (Claude + חיפוש ברשת;
//                 לוקח עד כמה דקות, ולכן התשובה תמיד 200 ושגיאה חוזרת כ-{ error })
//   POST /render { image: {media_type, data}, request }   -> { image: {media_type, data}, model }      (Google)
// בשגיאה: { error (עברית), detail? (מה ש-Google ענה, לאבחון) }
// בלי סיסמה (אפליקציה אישית, לבקשת המשתמש). הדפדפן מורשה רק מכתובת האפליקציה (ALLOWED_ORIGIN_RE).
import { suggestIdeas } from './designer.js';
import { renderImage } from './render.js';
import { shoppingList } from './shop.js';

const MAX_BODY = 15 * 1024 * 1024; // עד שתי תמונות (לפני + אחרי)
const MAX_IMAGE_B64 = 7 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_TEXT = 2000;

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (origin && env.ALLOWED_ORIGIN_RE && new RegExp(env.ALLOWED_ORIGIN_RE).test(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// תמונה: סוג מותר ו-base64 בגודל סביר. null = לא תקין
export function cleanImage(im) {
  if (!im || !IMAGE_TYPES.includes(im.media_type) || typeof im.data !== 'string') return null;
  if (!im.data || im.data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/]+=*$/.test(im.data)) return null;
  return { media_type: im.media_type, data: im.data };
}

// תשובה לפעולה ארוכה (חיפוש ברשת יכול לקחת כמה דקות): שולחים רווח כל כמה שניות כדי שהחיבור לא ייסגר,
// ובסוף את ה-JSON (רווחים לפני JSON תקינים). הסטטוס כבר נשלח, ולכן שגיאה חוזרת כ-{ error } עם 200.
export function slowReply(cors, work, everyMs = 8000) {
  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const beat = setInterval(() => { writer.write(enc.encode(' ')).catch(() => {}); }, everyMs);
  work
    .then((data) => data, (e) => ({ error: e?.message || 'משהו השתבש. נסו שוב.', detail: e?.detail || '' }))
    .then((data) => { clearInterval(beat); return writer.write(enc.encode(JSON.stringify(data))); })
    .then(() => writer.close())
    .catch(() => { clearInterval(beat); });
  return new Response(readable, { status: 200, headers: { ...cors, 'content-type': 'application/json' } });
}

export const cleanText = (s) => (typeof s === 'string' ? s.trim().slice(0, MAX_TEXT) : '');

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') {
      return reply(200, { ok: true, designer: Boolean(env.ANTHROPIC_API_KEY), images: Boolean(env.GEMINI_API_KEY) });
    }
    if (request.method !== 'POST' || !['/ideas', '/render', '/shop'].includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { error: 'התמונה גדולה מדי' });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: 'בקשה לא תקינה' }); }
    const noKey = () => reply(503, { error: 'המעצב עוד לא מחובר (חסר מפתח Claude בשרת).', code: 'no_key' });

    try {
      if (pathname === '/shop') {
        const before = cleanImage(body?.before);
        const after = cleanImage(body?.after);
        if (!before || !after) return reply(400, { error: 'חסרה תמונה תקינה' });
        if (!env.ANTHROPIC_API_KEY) return noKey();
        return slowReply(cors, shoppingList(env, before, after, cleanText(body.request)));
      }
      const image = cleanImage(body?.image);
      if (!image) return reply(400, { error: 'חסרה תמונה תקינה' });
      if (pathname === '/ideas') {
        if (!env.ANTHROPIC_API_KEY) return noKey();
        return reply(200, await suggestIdeas(env, image, cleanText(body.note)));
      }
      const req = cleanText(body.request);
      if (!req) return reply(400, { error: 'צריך לכתוב מה לשנות' });
      if (!env.GEMINI_API_KEY) return reply(503, { error: 'מחולל התמונות עוד לא מחובר (חסר מפתח Google בשרת).', code: 'no_key' });
      const { model, ...out } = await renderImage(env, image, req);
      return reply(200, { image: out, model });
    } catch (e) {
      return reply(502, { error: e?.message || 'משהו השתבש. נסו שוב.', detail: e?.detail || '' });
    }
  },
};

// השרת של "ספר אישי" (Cloudflare Worker):
//   GET  /health -> { ok, writer, images } (אילו מפתחות מוגדרים)
//   POST /outline { brief }                               -> { title, subtitle, dedication, chapters, look, cover }   (Claude)
//   POST /chapter { brief, outline, index, before?, note? } -> { text, scene }                                         (Claude)
//   POST /image   { scene, style, look?, cover?, photo?, occasion? } -> { image: {media_type, data} }                 (Google)
//                 occasion 'romance' (רומן למבוגרים): איור מרומז בלבד, והתמונה המצורפת לא נשלחת למאייר
//   POST /share   { book, images, id?, secret? }           -> { id, secret }  שיתוף ספר בקישור (או עדכון קישור קיים)
//   POST /unshare { id, secret }                           ביטול הקישור
//   GET  /book/<id>             -> { book, images: [מפתחות] }   הספר לקריאה (מי שקיבל את הקישור)
//   GET  /book/<id>/img/<key>   -> התמונה עצמה
// שלוש פעולות ה-AI לוקחות עד דקה, ולכן התשובה תמיד 200 ושגיאה חוזרת כ-{ error (עברית), detail? }.
// בלי סיסמה; הדפדפן מורשה רק מכתובת האפליקציה (ALLOWED_ORIGIN_RE), ויש תקרה יומית לקריאות AI (ראו shelf.js).
// הספרים עצמם נשמרים במכשיר של מי שיצר אותם; בשרת נשמר רק ספר ששותף בקישור.
import { cleanBrief, isRomance, STYLES } from './brief.js';
import { planBook, writeChapter, cleanOutline } from './writer.js';
import { drawImage, artPrompt } from './illustrate.js';
import { Shelf } from './shelf.js';

export { Shelf };

const MAX_BODY = 16 * 1024 * 1024; // שיתוף: ספר שלם עם האיורים
const MAX_AI_BODY = 3 * 1024 * 1024;
const MAX_PHOTO_B64 = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const POSTS = ['/outline', '/chapter', '/image', '/share', '/unshare'];

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
  if (!im.data || im.data.length > MAX_PHOTO_B64 || !/^[A-Za-z0-9+/]+=*$/.test(im.data)) return null;
  return { media_type: im.media_type, data: im.data };
}

export const cleanText = (s, max = 1500) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

// תשובה לפעולה ארוכה: שולחים רווח כל כמה שניות כדי שהחיבור לא ייסגר, ובסוף את ה-JSON (רווחים לפני JSON תקינים).
// הסטטוס כבר נשלח, ולכן שגיאה חוזרת כ-{ error } עם 200.
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

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') {
      return reply(200, { ok: true, writer: Boolean(env.ANTHROPIC_API_KEY), images: Boolean(env.GEMINI_API_KEY) });
    }
    if (!env.SHELF) return reply(503, { error: 'השרת לא מוגדר' });
    const shelf = env.SHELF.get(env.SHELF.idFromName('main'));
    const ask = async (path, body) => {
      const res = await shelf.fetch(new Request(`https://shelf${path}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }));
      return { status: res.status, data: await res.json().catch(() => ({})) };
    };
    // התקרה היומית: false = עברנו אותה
    const allowed = async (kind) => (await ask('/spend', { kind })).data.ok === true;

    try {
      // קריאת ספר ששותף
      const m = /^\/book\/([a-z0-9]+)(?:\/img\/([a-z0-9]+))?$/.exec(pathname);
      if (request.method === 'GET' && m) {
        if (!m[2]) {
          const { status, data } = await ask(`/book/${m[1]}`);
          return reply(status, data);
        }
        const { status, data } = await ask(`/img/${m[1]}/${m[2]}`);
        if (status !== 200) return reply(404, { error: 'לא נמצא' });
        const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
        return new Response(bytes, { status: 200, headers: { ...cors, 'content-type': data.media_type, 'cache-control': 'public, max-age=3600' } });
      }
      if (request.method !== 'POST' || !POSTS.includes(pathname)) return reply(404, { error: 'לא נמצא' });

      const raw = await request.text();
      const sharing = pathname === '/share';
      if (raw.length > (sharing ? MAX_BODY : MAX_AI_BODY)) return reply(413, { error: sharing ? 'הספר גדול מדי לשיתוף' : 'התמונה גדולה מדי' });
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, { error: 'בקשה לא תקינה' }); }

      if (sharing || pathname === '/unshare') {
        const { status, data } = await ask(pathname, body);
        return reply(status, data);
      }

      if (pathname === '/image') {
        const scene = cleanText(body?.scene);
        if (!scene) return reply(400, { error: 'חסר תיאור לאיור' });
        if (!env.GEMINI_API_KEY) return reply(503, { error: 'המאייר עוד לא מחובר (חסר מפתח Google בשרת).', code: 'no_key' });
        if (!(await allowed('images'))) return reply(429, { error: 'נוצרו היום הרבה איורים. נסו שוב מחר.', code: 'limit' });
        const romance = body.occasion === 'romance';
        // ברומן למבוגרים לא מציירים לפי תמונה של אדם אמיתי
        const photo = romance ? null : cleanImage(body.photo);
        const style = STYLES[body.style] || STYLES.watercolor;
        const prompt = artPrompt({ scene, style, look: cleanText(body.look, 800), cover: Boolean(body.cover), photo: Boolean(photo), romance });
        return slowReply(cors, drawImage(env, prompt, photo).then(({ model, ...image }) => ({ image, model })));
      }

      const brief = cleanBrief(body?.brief);
      if (!brief) return reply(400, { error: 'צריך לכתוב על מי הספר' });
      if (isRomance(brief) && !brief.adult) return reply(403, { error: 'הקטגוריה הזאת מיועדת לבני 18 ומעלה', code: 'adult' });
      if (!env.ANTHROPIC_API_KEY) return reply(503, { error: 'הסופר עוד לא מחובר (חסר מפתח Claude בשרת).', code: 'no_key' });

      if (pathname === '/outline') {
        if (!(await allowed('text'))) return reply(429, { error: 'נכתבו היום הרבה ספרים. נסו שוב מחר.', code: 'limit' });
        return slowReply(cors, planBook(env, brief));
      }
      // /chapter
      const outline = cleanOutline(body.outline);
      const index = Number(body.index);
      if (!outline || !Number.isInteger(index) || index < 0 || index >= outline.chapters.length) return reply(400, { error: 'בקשה לא תקינה' });
      if (!(await allowed('text'))) return reply(429, { error: 'נכתבו היום הרבה ספרים. נסו שוב מחר.', code: 'limit' });
      return slowReply(cors, writeChapter(env, brief, outline, index, cleanText(body.before, 900), cleanText(body.note, 600)));
    } catch (e) {
      return reply(502, { error: e?.message || 'משהו השתבש. נסו שוב.', detail: e?.detail || '' });
    }
  },
};

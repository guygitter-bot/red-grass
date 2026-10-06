// השרת של "מאגר AI" (Cloudflare Worker): שומר קישורים וקבצים, וממפה כל אחד לקטגוריה לפי הנושא.
//   POST /login {password}                 -> {token}   (פעם אחת בכל מכשיר)
//   POST /list                             -> {items, categories}   (Authorization: Bearer <token>)
//   POST /add {kind: 'link', url, note}    -> {item, duplicate?}  המיפוי רץ ברקע (ראו library.js)
//        {kind: 'text', text, note} | {kind: 'file', file: {name, type, data}, note}  (data = base64, עד 10MB)
//   POST /update {id, title?, note?, category?, emoji?} | /delete {id} | /retry {id} (מיפוי מחדש)
//   POST /file {id}                        -> {file: {name, type, size, data}}
//   POST /category {from, to?, emoji?}     -> שינוי שם / איחוד / סמל של קטגוריה
// הסיסמה (AI_MAAGAR_PASSWORD) היא סוד של השרת. בלי סיסמה מוגדרת השרת סגור לגמרי.
import { Library, safeEqual, sessionToken } from './library.js';

export { Library };

const MAX_BODY_BYTES = 256 * 1024;
// קובץ מגיע כ-base64 (גדול בשליש מהקובץ עצמו)
const MAX_FILE_BODY_BYTES = 14 * 1024 * 1024;
const ROUTES = ['/login', '/list', '/add', '/update', '/delete', '/retry', '/file', '/category'];

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (!env.AI_MAAGAR_PASSWORD || env.AI_MAAGAR_PASSWORD === 'none' || !env.LIBRARY) return reply(503, { error: 'השרת לא מוגדר (חסרה סיסמה)' });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const text = await request.text();
    if (text.length > (pathname === '/add' ? MAX_FILE_BODY_BYTES : MAX_BODY_BYTES)) return reply(413, { error: 'גדול מדי' });

    if (pathname !== '/login') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!safeEqual(auth, await sessionToken(env.AI_MAAGAR_PASSWORD))) return reply(401, { error: 'צריך להתחבר מחדש' });
    }

    const stub = env.LIBRARY.get(env.LIBRARY.idFromName('main'));
    const res = await stub.fetch(new Request(`https://library${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: text }));
    return reply(res.status, await res.json());
  },
};

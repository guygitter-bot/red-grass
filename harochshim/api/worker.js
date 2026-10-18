// השרת של "הרוכשים" (Cloudflare Worker): קטלוג הספקים וההצעות, העוזר החכם של כל ספק, לידים וניהול.
//   ללקוחות (בלי כניסה):
//     POST /catalog                       -> { categories, suppliers, offers }
//     POST /file {id}                     -> { file }  קובץ הצעת מחיר
//     POST /chat {supplierId, chat}       -> { reply, handoff: { summary } | null }
//     POST /lead {supplierId, offerId?, name, phone, city?, note?, consent, summary?, chat?} -> { id, key }
//     POST /my {items: [{id, key}]}       -> { leads }  מצב הפניות של הלקוח
//   מנהל (סיסמה -> /login -> authorization: Bearer <token>):
//     /admin/state, /admin/category, /admin/supplier, /admin/supplier-active, /admin/supplier-link,
//     /admin/offer, /admin/offer-remove, /admin/lead, /admin/file, /logout
//   ספק (הקישור האישי שלו = Bearer <token>): /partner/state, /partner/lead, /partner/file
import { Club } from './club.js';

export { Club };

const MAX_BODY_BYTES = 200 * 1024;
// הצעה עם קובץ מצורף (base64)
const MAX_FILE_BODY_BYTES = 2.2 * 1024 * 1024;
const ROUTES = [
  '/catalog', '/file', '/chat', '/lead', '/my', '/login', '/logout',
  '/admin/state', '/admin/category', '/admin/supplier', '/admin/supplier-active', '/admin/supplier-link',
  '/admin/offer', '/admin/offer-remove', '/admin/lead', '/admin/file',
  '/partner/state', '/partner/lead', '/partner/file',
];

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
    if (!env.CLUB) return reply(503, { error: 'השרת לא מוגדר' });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });
    // רק מהאפליקציה עצמה
    if (!cors['access-control-allow-origin']) return reply(403, { error: 'אסור' });

    const text = await request.text();
    if (text.length > (pathname === '/admin/offer' ? MAX_FILE_BODY_BYTES : MAX_BODY_BYTES)) return reply(413, { error: 'גדול מדי' });
    const stub = env.CLUB.get(env.CLUB.idFromName('main'));
    const res = await stub.fetch(new Request(`https://club${pathname}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization') || '' },
      body: text,
    }));
    return reply(res.status, await res.json());
  },
};

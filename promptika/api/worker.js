// השרת של "פרומפטיקה" (Cloudflare Worker): רק מסדר את הכתובות ומעביר ל-Studio.
//   בלי כניסה:  GET /status -> { ready }   ·   POST /login { password } -> { token }  (בפעם הראשונה – קובע סיסמה)
//   עם כניסה (authorization: Bearer <token>):
//     POST /logout
//     GET / PUT /settings
//     GET / POST /clients
//     GET / PUT / DELETE /clients/:id
//     POST /clients/:id/propose  -> 501 (ה-AI יגיע בהמשך)
import { Studio } from './studio.js';

export { Studio };

const MAX_BODY_BYTES = 200 * 1024;
const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': `${METHODS.join(', ')}, OPTIONS`,
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
    if (!env.STUDIO) return reply(503, { error: 'השרת לא מוגדר' });
    if (!METHODS.includes(request.method)) return reply(405, { error: 'לא נתמך' });
    // רק מהאפליקציה עצמה
    if (!cors['access-control-allow-origin']) return reply(403, { error: 'אסור' });

    const text = ['GET', 'DELETE'].includes(request.method) ? '' : await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });
    const stub = env.STUDIO.get(env.STUDIO.idFromName('main'));
    const res = await stub.fetch(new Request(`https://studio${pathname}`, {
      method: request.method,
      headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization') || '' },
      ...(text ? { body: text } : {}),
    }));
    return reply(res.status, await res.json());
  },
};

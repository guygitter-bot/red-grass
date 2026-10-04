// השרת של סדר (Cloudflare Worker): שומר את המשימות כדי שיהיו זהות בטלפון ובמחשב.
//   POST /login {password}            -> {token}   (פעם אחת בכל מכשיר)
//   POST /sync  {since, changes}      -> {cursor, more, records}   (Authorization: Bearer <token>)
// הסיסמה (SEDER_PASSWORD) היא סוד של השרת. בלי סיסמה מוגדרת השרת סגור לגמרי.
import { Vault, safeEqual, sessionToken } from './vault.js';

export { Vault };

const MAX_BODY_BYTES = 4 * 1024 * 1024;

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
    if (!env.SEDER_PASSWORD || env.SEDER_PASSWORD === 'none' || !env.VAULT) return reply(503, { error: 'השרת לא מוגדר (חסרה סיסמה)' });
    if (request.method !== 'POST' || !['/login', '/sync'].includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });

    if (pathname === '/sync') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!safeEqual(auth, await sessionToken(env.SEDER_PASSWORD))) return reply(401, { error: 'צריך להתחבר מחדש' });
    }

    const stub = env.VAULT.get(env.VAULT.idFromName('main'));
    const res = await stub.fetch(new Request(`https://vault${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: text }));
    return reply(res.status, await res.json());
  },
};

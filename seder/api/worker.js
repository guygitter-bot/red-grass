// השרת של סדר (Cloudflare Worker): שומר את המשימות כדי שיהיו זהות בטלפון ובמחשב.
//   POST /login {password}            -> {token}   (פעם אחת בכל מכשיר)
//   POST /sync  {since, changes}      -> {cursor, more, records}   (Authorization: Bearer <token>)
//   POST /requests {text}             -> בקשה לשינוי באפליקציה: נפתחת כ-issue ב-GitHub (ו-Claude מטפל בה)
//   POST /requests/list               -> הבקשות והמצב של כל אחת
//   POST /requests/approve {number}   -> אישור השינוי: מיזוג ה-PR (בלי להיכנס ל-GitHub)
//   POST /requests/reject  {number}   -> לא מתאים: סגירת הבקשה
//   POST /requests/retry   {number}   -> לנסות שוב בקשה שנכשלה
// הסיסמה (SEDER_PASSWORD) היא סוד של השרת. בלי סיסמה מוגדרת השרת סגור לגמרי.
import { Vault, safeEqual, sessionToken } from './vault.js';
import { approveRequest, createRequest, listRequests, rejectRequest, retryRequest } from './requests.js';

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
    const ROUTES = ['/login', '/sync', '/requests', '/requests/list', '/requests/approve', '/requests/reject', '/requests/retry'];
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });

    if (pathname !== '/login') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!safeEqual(auth, await sessionToken(env.SEDER_PASSWORD))) return reply(401, { error: 'צריך להתחבר מחדש' });
    }

    if (pathname.startsWith('/requests')) {
      if (!env.SEDER_GITHUB_TOKEN || env.SEDER_GITHUB_TOKEN === 'none' || !env.GITHUB_REPO) return reply(503, { error: 'בקשות לשינוי עוד לא הוגדרו (חסר SEDER_GITHUB_TOKEN)' });
      try {
        if (pathname === '/requests/list') return reply(200, { requests: await listRequests(env) });
        const body = JSON.parse(text || '{}');
        if (pathname === '/requests/approve') return reply(200, await approveRequest(env, body.number));
        if (pathname === '/requests/reject') return reply(200, await rejectRequest(env, body.number));
        if (pathname === '/requests/retry') return reply(200, await retryRequest(env, body.number));
        return reply(200, { request: await createRequest(env, body.text, body.context) });
      } catch (e) {
        return reply(e.status || 502, { error: e.message || 'GitHub לא זמין' });
      }
    }

    const stub = env.VAULT.get(env.VAULT.idFromName('main'));
    const res = await stub.fetch(new Request(`https://vault${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: text }));
    return reply(res.status, await res.json());
  },
};

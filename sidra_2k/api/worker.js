// השרת של "הסדרה" (Cloudflare Worker). כל הנתונים ב-Durable Object אחד (Series, ראו series.js).
//   POST /get                         -> הסדרה {players, games, rev, locked, master} – פתוח לכולם (צפייה)
//   POST /setup {password}             -> {token, ...} פעם ראשונה: קביעת סיסמת המאסטר
//   POST /login {password}             -> {token, ...} כניסת מאסטר
// מכאן רק המאסטר (authorization: Bearer <token>):
//   POST /logout
//   POST /game {n, winner, lal?, sas?} -> רישום משחק מספר n+1 (רק אם הוא באמת הבא)
//   POST /undo {n}                     -> ביטול המשחק האחרון (רק אם יש n משחקים)
//   POST /players {LAL, SAS}           -> מי משחק עם איזו קבוצה
//   POST /reset                        -> סדרה חדשה (השמות נשארים)
// מקבלים בקשות רק מהאתר של האפליקציה.
import { Series } from './series.js';

export { Series };

const MAX_BODY_BYTES = 4096;
const ROUTES = ['/get', '/setup', '/login', '/logout', '/game', '/undo', '/players', '/reset'];

// כתובת מותרת? (* בהגדרה = כל רצף אותיות)
export function originAllowed(origin, list) {
  return (list || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .some((pattern) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`).test(origin));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const headers = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (originAllowed(origin, env.ALLOWED_ORIGINS)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (!env.SERIES) return reply(503, { error: 'השרת לא מוגדר' });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });
    // רק מהאפליקציה עצמה
    if (!cors['access-control-allow-origin']) return reply(403, { error: 'אסור' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });
    const stub = env.SERIES.get(env.SERIES.idFromName('main'));
    const res = await stub.fetch(new Request(`https://series${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization') || '' }, body: text || '{}' }));
    return reply(res.status, await res.json());
  },
};

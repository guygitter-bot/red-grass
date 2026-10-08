// השרת של "ארץ עיר" (Cloudflare Worker). כל משחק הוא Durable Object משלו, לפי קוד בן 5 תווים.
//   POST /create {player}                              -> מצב המשחק החדש (כולל code)
//   POST /join {code, player}                          -> הצטרפות (או עדכון שם/תמונה)
//   POST /state {code, playerId, token, v}             -> מצב המשחק, או {same: true} אם לא השתנה מאז v
//   POST /settings {code, playerId, token, seconds}    -> זמן לסיבוב
//   POST /start {code, playerId, token, seconds?}      -> סיבוב חדש עם אות חדשה
//   POST /answers {code, playerId, token, round, answers, done?}
//   POST /vote {code, playerId, token, round, category, target, bad}  -> סימון תשובה של מישהו כלא נכונה
//   POST /leave {code, playerId, token}
// player = {id, token, name, photo}. בלי סיסמה: מי שיש לו את הקוד יכול להצטרף.
import { Room } from './room.js';

export { Room };

const MAX_BODY_BYTES = 64 * 1024;
const ROUTES = ['/create', '/join', '/state', '/settings', '/start', '/answers', '/vote', '/leave'];
// בלי אותיות ומספרים שמתבלבלים (O/0, I/1/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJKMNP-Z2-9]{5}$/;

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

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
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (originAllowed(origin, env.ALLOWED_ORIGINS)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (!env.ROOMS) return reply(503, { error: 'השרת לא מוגדר' });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { error: 'בקשה לא תקינה' });
    }
    if (!body || typeof body !== 'object') return reply(400, { error: 'בקשה לא תקינה' });

    const send = async (code, payload) => {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const res = await stub.fetch(new Request(`https://room${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
      return { status: res.status, data: await res.json() };
    };

    if (pathname === '/create') {
      // קוד חדש; אם במקרה תפוס – מנסים אחר
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const res = await send(code, { ...body, code });
        if (res.status !== 409) return reply(res.status, res.data);
      }
      return reply(503, { error: 'נסו שוב' });
    }

    const code = String(body.code || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return reply(404, { error: 'קוד משחק לא תקין' });
    const res = await send(code, { ...body, code });
    return reply(res.status, res.data);
  },
};

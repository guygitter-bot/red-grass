// השרת של "ארץ עיר" (Cloudflare Worker). כל משחק הוא Durable Object משלו, לפי קוד בן 5 תווים.
//   POST /create {player}                              -> מצב המשחק החדש (כולל code)
//   POST /join {code, player}                          -> הצטרפות (או עדכון שם/תמונה)
//   POST /state {code, playerId, token, v}             -> מצב המשחק, או {same: true} אם לא השתנה מאז v
//   POST /settings {code, playerId, token, seconds}    -> זמן לסיבוב
//   POST /start {code, playerId, token, seconds?}      -> "מתחילים": כולם מאשרים מוכנות (עד חצי דקה), ואז סיבוב חדש
//   POST /ready {code, playerId, token}                -> "אני מוכן/ה"
//   POST /answers {code, playerId, token, round, answers, done?}
//   POST /vote {code, playerId, token, round, category, target, bad}  -> סימון תשובה של מישהו כלא נכונה
//   POST /leave {code, playerId, token}
// player = {id, token, name, photo}. בלי סיסמה: מי שיש לו את הקוד יכול להצטרף.
//
// קהילות חברים (club.js), קוד בן 6 תווים:
//   POST /club/create {name, player} | /club/join {club, player}
//   POST /club/get | /club/leave {club, playerId, token} | /club/rename {club, playerId, token, name}
//   POST /club/subscribe {club, playerId, token, subscription}   (null = כיבוי התראות)
//   POST /club/invite {club, playerId, token, game}              -> התראה לכל החברים: "בואו לשחק"
//   POST /push/key                                               -> המפתח הציבורי להרשמה להתראות
import { Room } from './room.js';
import { Club } from './club.js';

export { Room, Club };

const MAX_BODY_BYTES = 64 * 1024;
const ROUTES = ['/create', '/join', '/state', '/settings', '/start', '/ready', '/answers', '/vote', '/leave'];
const CLUB_ROUTES = ['/club/create', '/club/join', '/club/get', '/club/rename', '/club/subscribe', '/club/invite', '/club/leave'];
// בלי אותיות ומספרים שמתבלבלים (O/0, I/1/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJKMNP-Z2-9]{5}$/;
export const CLUB_RE = /^[A-HJKMNP-Z2-9]{6}$/;

export function newCode(length = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
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
    const isClub = CLUB_ROUTES.includes(pathname) || pathname === '/push/key';
    if (request.method !== 'POST' || (!ROUTES.includes(pathname) && !isClub)) return reply(404, { error: 'לא נמצא' });
    if (!(isClub ? env.CLUBS : env.ROOMS)) return reply(503, { error: 'השרת לא מוגדר' });

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

    // קהילות
    if (isClub) {
      const club = (code, path, payload) =>
        env.CLUBS.get(env.CLUBS.idFromName(code))
          .fetch(new Request(`https://club${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }))
          .then(async (res) => ({ status: res.status, data: await res.json() }));
      if (pathname === '/push/key') {
        const res = await club('~vapid', '/vapid', {});
        return reply(res.status, { publicKey: res.data.publicKey });
      }
      const path = pathname.slice('/club'.length);
      if (path === '/create') {
        for (let i = 0; i < 5; i++) {
          const code = newCode(6);
          const res = await club(code, path, { ...body, club: code });
          if (res.status !== 409) return reply(res.status, res.data);
        }
        return reply(503, { error: 'נסו שוב' });
      }
      const code = String(body.club || '').trim().toUpperCase();
      if (!CLUB_RE.test(code)) return reply(404, { error: 'קוד קהילה לא תקין' });
      const res = await club(code, path, { ...body, club: code });
      return reply(res.status, res.data);
    }

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

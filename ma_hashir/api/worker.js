// השרת של "מה השיר?" (Cloudflare Worker). כל משחק הוא Durable Object משלו, לפי קוד בן 5 תווים.
//   POST /create {player}                             -> מצב המשחק החדש (כולל code)
//   POST /join {code, player}                         -> הצטרפות (או עדכון שם/תמונה)
//   POST /state {code, playerId, token, v}            -> מצב המשחק, או {same: true} אם לא השתנה מאז v
//   POST /settings {..., settings: {mode, era, lang, count}}   (רק מי שפתח)
//   POST /team {..., team: 0|1} | {..., shuffle: true}         (בחירת קבוצה / ערבוב)
//   POST /start | /lobby                              -> משחק חדש / חזרה לחדר ההמתנה
//   POST /extend {..., q}                             -> הארכה ל-10 שניות (התשובה שווה 5 במקום 10)
//   POST /fifty {..., q}                              -> 50:50 (מוחק שתי תשובות לא נכונות)
//   POST /answer {..., q, choice}
//   POST /leave
//   GET  /audio?s=<מקור>                              -> קטע השיר (30 שניות), דרך השרת – כדי שהדפדפן יוכל לנגן אותו בדיוק
// player = {id, token, name, photo}. בלי סיסמה: מי שיש לו את הקוד יכול להצטרף.
import { Room } from './room.js';
import { Library } from './library.js';

export { Room, Library };

const MAX_BODY_BYTES = 64 * 1024;
const ROUTES = ['/create', '/join', '/state', '/settings', '/team', '/start', '/lobby', '/extend', '/fifty', '/answer', '/leave'];
// בלי אותיות ומספרים שמתבלבלים (O/0, I/1/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJKMNP-Z2-9]{5}$/;
// קטעי שירים מותר להביא רק מהאתרים האלה
const ITUNES_RE = /^https:\/\/[a-z0-9.-]+\.(mzstatic\.com|apple\.com)\//;
const DEEZER_RE = /^https:\/\/[a-z0-9.-]+\.dzcdn\.net\//;

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
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (originAllowed(origin, env.ALLOWED_ORIGINS)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// מקור השיר -> הכתובת של הקובץ. ב-Deezer הכתובת מתחלפת, אז שואלים אותם מחדש
export async function audioUrl(src, fetcher = fetch) {
  const s = String(src || '');
  if (s.startsWith('it:')) return ITUNES_RE.test(s.slice(3)) ? s.slice(3) : null;
  const m = s.match(/^dz:(\d{1,15})$/);
  if (!m) return null;
  const res = await fetcher(`https://api.deezer.com/track/${m[1]}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const preview = (await res.json().catch(() => ({})))?.preview || '';
  return DEEZER_RE.test(preview) ? preview : null;
}

async function audio(request, env, cors) {
  const fetcher = env.FETCH || fetch;
  const src = new URL(request.url).searchParams.get('s');
  let url;
  try {
    url = await audioUrl(src, fetcher);
  } catch {
    url = null;
  }
  if (!url) return new Response('not found', { status: 404, headers: cors });
  const res = await fetcher(url, { cf: { cacheEverything: true, cacheTtl: 86400 } }).catch(() => null);
  if (!res?.ok) return new Response('not found', { status: 502, headers: cors });
  return new Response(res.body, {
    status: 200,
    headers: {
      ...cors,
      'content-type': res.headers.get('content-type') || 'audio/mp4',
      'cache-control': 'public, max-age=3600',
    },
  });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (pathname === '/audio' && request.method === 'GET') return audio(request, env, cors);
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });
    if (!env.ROOMS) return reply(503, { error: 'השרת לא מוגדר' });

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

// השרת של "GTA 6 – סרטונים" (Cloudflare Worker): שומר קישורים לסרטונים, ו-Claude כותב לכל אחד כותרת ומוציא קודים.
//   POST /list                           -> {items, categories}
//   POST /add {url, note}                -> {item, duplicate?, retried?}  הקריאה רצה ברקע (ראו library.js)
//   POST /update {id, title?, note?, codes?, category?, emoji?} | /delete {id} | /retry {id} (לקרוא שוב)
//   POST /category {from, to?, emoji?}   -> שינוי שם / איחוד / סמל של קטגוריה
// צפייה בסרטון עם Gemini (google.js):
//   POST /video/watch {id}               -> "לצפות בסרטון": יוטיוב ישירות, אחר – הורדה ב-GitHub Actions (gta6-fetch.yml)
//   POST /video/upload?id=<id>           -> גוף = קובץ הווידאו עצמו (מהטלפון, או מההורדה האוטומטית). עובר ישר ל-Google
//   GET  /video/job?id=<id>              -> {url}  רק ל-gta6-fetch.yml (Bearer = GITHUB_TOKEN)
//   POST /video/fetch-failed {id, reason} -> ההורדה האוטומטית נכשלה (Bearer = GITHUB_TOKEN)
// בלי סיסמה. הגנה מעלויות: מגבלת הוספות ליום ומגבלת צפיות ליום (ראו library.js)
import { Library } from './library.js';
import { GoogleError, uploadVideo } from './google.js';

export { Library };

const MAX_BODY_BYTES = 128 * 1024;
// Cloudflare מקבל עד 100MB בבקשה אחת
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
const ROUTES = ['/list', '/add', '/update', '/delete', '/retry', '/category', '/video/watch'];
const ID_RE = /^[\w-]{6,64}$/;

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// השוואה בזמן קבוע (הטוקן של GitHub Actions)
function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function callLibrary(env, path, body) {
  const stub = env.LIBRARY.get(env.LIBRARY.idFromName('main'));
  const res = await stub.fetch(new Request(`https://library${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  return { status: res.status, data: await res.json() };
}

// קובץ וידאו -> Google (בזרם, בלי לשמור אצלנו) -> הסרטון מחכה לצפייה
async function uploadRoute(request, env, url, reply) {
  const id = url.searchParams.get('id') || '';
  if (!ID_RE.test(id)) return reply(400, { error: 'בקשה לא תקינה' });
  const size = Number(request.headers.get('content-length') || 0);
  if (!size) return reply(411, { error: 'הקובץ ריק' });
  if (size > MAX_VIDEO_BYTES) return reply(413, { error: 'הסרטון גדול מדי (עד 95MB). נסו סרטון קצר יותר.' });
  let mime = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') mime = 'video/mp4';
  if (!/^video\/[\w.+-]+$/.test(mime)) return reply(415, { error: 'צריך קובץ וידאו' });

  const can = await callLibrary(env, '/video/can-upload', { id });
  if (can.status !== 200) return reply(can.status, can.data);

  // ב-Cloudflare: זרם באורך ידוע (בלי לטעון את כל הקובץ לזיכרון). בבדיקות – הקובץ כולו
  let body;
  if (typeof FixedLengthStream === 'function') {
    const { readable, writable } = new FixedLengthStream(size);
    request.body.pipeTo(writable).catch(() => {});
    body = readable;
  } else {
    body = await request.arrayBuffer();
  }
  let file;
  try {
    file = await uploadVideo(env, body, size, mime);
  } catch (e) {
    return reply(e instanceof GoogleError ? 502 : 500, { error: e instanceof GoogleError ? e.message : 'ההעלאה נכשלה. נסו שוב.' });
  }
  const res = await callLibrary(env, '/video/ready', { id, file });
  return reply(res.status, res.data);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (!env.LIBRARY) return reply(503, { error: 'השרת לא מוגדר' });

    if (pathname === '/video/upload' && request.method === 'POST') {
      if (!env.GEMINI_API_KEY) return reply(400, { error: 'צפייה בסרטונים עוד לא מחוברת' });
      return uploadRoute(request, env, url, reply);
    }

    // רק להורדה האוטומטית (GitHub Actions)
    if (pathname === '/video/job' || pathname === '/video/fetch-failed') {
      const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!sameSecret(token, env.GITHUB_TOKEN || '')) return reply(401, { error: 'אין הרשאה' });
      if (pathname === '/video/job') {
        const res = await callLibrary(env, '/video/job', { id: url.searchParams.get('id') || '' });
        return reply(res.status, res.data);
      }
      const res = await callLibrary(env, '/video/fetch-failed', (await request.text()).slice(0, 2000) || '{}');
      return reply(res.status, res.data);
    }

    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });
    const res = await callLibrary(env, pathname, text);
    return reply(res.status, res.data);
  },
};

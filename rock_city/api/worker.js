// השרת של מערכת השעות של "רוק סיטי" (Cloudflare Worker). כל הנתונים ב-Durable Object אחד (School, ראו school.js).
//   POST /status                        -> { ready } האם כבר הוגדר מנהל
//   POST /setup {username, password}    -> { token } פעם ראשונה בלבד: יצירת המנהל
//   POST /login {username, password}    -> { token }
//   POST /state {v}                     -> כל הנתונים (לפי ההרשאה), או { same: true } אם לא השתנה כלום מאז v
//   POST /save {kind, item}             kind: lesson | student | teacher | payment | settings
//   POST /remove {kind, id}
//   POST /occurrence {lessonId, date, status, note}   ביטול / הגעה / היעדרות בשיעור מסוים
//   POST /answer {id, approve}          אישור או דחייה של בקשה לשינוי
//   POST /read {ids}                    סימון התראות כנקראו (ids = 'all' לכולן)
//   POST /invite {teacherId, level}     -> { key } קישור אישי חדש למורה (רק המנהל)
//   POST /revoke {teacherId}            ביטול הקישור של מורה
//   POST /account {password, username?, newPassword?}
//   POST /logout
// הכניסה: authorization: Bearer <סוד> – של המנהל (מקבל אחרי סיסמה) או הקישור האישי של מורה.
import { School } from './school.js';

export { School };

const MAX_BODY_BYTES = 200 * 1024;
const ROUTES = ['/status', '/setup', '/login', '/state', '/save', '/remove', '/occurrence', '/answer', '/read', '/invite', '/revoke', '/account', '/logout'];

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
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (!env.SCHOOL) return reply(503, { error: 'השרת לא מוגדר' });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });
    // רק מהאפליקציה עצמה (דפדפן מאתר אחר לא יכול לשנות כלום)
    if (!cors['access-control-allow-origin']) return reply(403, { error: 'אסור' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });
    const stub = env.SCHOOL.get(env.SCHOOL.idFromName('main'));
    const res = await stub.fetch(new Request(`https://school${pathname}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization') || '' },
      body: text,
    }));
    return reply(res.status, await res.json());
  },
};

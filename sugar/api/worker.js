// השרת של "יומן סוכר" (Cloudflare Worker). כל הנתונים ב-Durable Object אחד (Diary, ראו diary.js).
//   POST /sync {since, changes}     -> { rev, changes } שליחת השינויים מהמכשיר וקבלת מה שהשתנה מאז since
//   POST /ai {context, history, question} -> { answer, left } שיחה עם ה-AI (עד 60 שאלות ביום)
// בלי סיסמה: רק בקשות מהאתר של האפליקציה (ALLOWED_ORIGINS).
import { Diary } from './diary.js';

export { Diary };

const MAX_BODY_BYTES = 2.5 * 1024 * 1024;
const ROUTES = ['/sync', '/ai'];

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
    if (!env.DIARY) return reply(503, { error: 'השרת לא מוגדר' });
    const stub = () => env.DIARY.get(env.DIARY.idFromName('main'));

    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });
    // רק מהאפליקציה עצמה (דפדפן מאתר אחר לא יכול לשנות כלום)
    if (!cors['access-control-allow-origin']) return reply(403, { error: 'אסור' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });
    const res = await stub().fetch(new Request(`https://diary${pathname}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-origin': new URL(request.url).origin },
      body: text,
    }));
    return reply(res.status, await res.json());
  },
};

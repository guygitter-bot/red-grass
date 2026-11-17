// השרת של "בורסאי" (Cloudflare Worker): נתוני שוק חיים, ניתוח ותחזיות, תיק, התראות לטלפון וצ'אט עם AI.
// כל הבקשות: POST עם JSON. חוץ מ-/status, /setup, /login – צריך Authorization: Bearer <token>.
//   /status -> {hasPassword} · /setup {password} -> {token} (פעם ראשונה) · /login {password} -> {token} · /logout
//   /home -> {indices, open, outlook, buys, sells, scanned, unread}
//   /quotes {symbols} -> {quotes} · /stock {symbol, range} -> {quote, candles, analysis, forecast, backtest, news, opinion}
//   /opinion {symbol, refresh?} -> {opinion} (AI) · /search {q} -> {results}
//   /data -> {watch, holdings, demo, palerts, settings, signals}
//   /watch {symbol, remove?} · /holding {holding} · /holding/delete {id} · /demo/trade {symbol, side, qty} · /demo/reset
//   /price-alert {symbol, op, price} · /price-alert/delete {id} · /alerts · /alerts/read · /settings {...}
//   /chat {text} -> {messages} · /chat/history · /chat/clear
//   /push/key · /push/subscribe {sub} · /push/unsubscribe {endpoint} · /push/test
//   חיבור מאפליקציית "צוות" (הבוט 📈 בורסאי, tsevet/api/bursa.js): כותרת x-team-link עם מפתח שנגזר מהמפתח של Claude
//   (אותו סוד בשני השרתים, ולכן אין סוד חדש להגדיר). מותרות רק הפעולות שב-TEAM_ROUTES.
// הפרטים והמנוע שרץ ברקע: market.js
import { Market } from './market.js';

// מה הבוט של "צוות" יכול לעשות כאן: לקרוא נתונים ולנהל רשימת מעקב, תיק (רישום), תיק דמה והתראות מחיר.
// בלי סיסמה, כניסה, התראות לטלפון, איפוס תיק הדמה או מחיקת הצ'אט
export const TEAM_ROUTES = ['/home', '/quotes', '/stock', '/opinion', '/search', '/data', '/watch', '/holding', '/holding/delete',
  '/demo/trade', '/price-alert', '/price-alert/delete', '/alerts'];

// המפתח המשותף: HMAC של טקסט קבוע עם המפתח של Claude (אותה פונקציה ב-tsevet/api/bursa.js)
export async function teamKey(secret) {
  if (!secret) return '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('tsevet->bursa link v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export { Market };

const MAX_BODY_BYTES = 64 * 1024;

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
    if (!env.MARKET) return reply(503, { error: 'השרת לא מוגדר' });
    if (request.method !== 'POST' || !/^\/[a-z/-]{2,30}$/.test(pathname)) return reply(404, { error: 'לא נמצא' });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'גדול מדי' });

    // הבוט של "צוות": רק עם המפתח הנכון ורק לפעולות המותרות
    const link = request.headers.get('x-team-link');
    let team = false;
    if (link) {
      const expected = await teamKey(env.ANTHROPIC_API_KEY);
      if (!expected || !safeEqual(link, expected) || !TEAM_ROUTES.includes(pathname)) return reply(403, { error: 'אסור' });
      team = true;
    }

    const stub = env.MARKET.get(env.MARKET.idFromName('main'));
    const res = await stub.fetch(new Request(`https://market${pathname}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization') || '', ...(team ? { 'x-team': '1' } : {}) },
      body: text,
    }));
    return reply(res.status, await res.json());
  },
};

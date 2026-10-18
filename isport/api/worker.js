// השרת של Isport (Cloudflare Worker): קטלוג החולצות, תמונות ומסך הניהול.
//   ללקוחות (בלי כניסה):
//     POST /catalog            -> { v, shirts, categories, settings }   רק מוצרים שפורסמו, בקטגוריות מוצגות
//     GET  /img/<שם>           -> תמונה של חולצה (מהדלי, נשמרת במטמון לתמיד)
//   מנהל (סיסמה -> /login -> authorization: Bearer <token>):
//     /admin/state, /admin/shirt, /admin/shirt-delete, /admin/publish, /admin/settings, /admin/categories,
//     /admin/enrich, /admin/find-images (הסוכן), /admin/image-import, /admin/image-upload, /logout
//     /admin/backups, /admin/backup-now, /admin/restore (רק המפתח), /admin/client-password (רק המפתח)
//   כל לילה (cron ב-wrangler.toml): גיבוי ל-R2, מחיקת גיבויים ישנים ותמונות מהפח
import { Shop } from './shop.js';
import { isImageKey } from './model.js';

export { Shop };

const MAX_BODY_BYTES = 100 * 1024;
// תמונה שהועלתה מהמכשיר (base64)
const MAX_UPLOAD_BYTES = 8.5 * 1024 * 1024;
const ROUTES = [
  '/catalog', '/login', '/logout',
  '/admin/state', '/admin/shirt', '/admin/shirt-delete', '/admin/publish', '/admin/settings', '/admin/categories',
  '/admin/enrich', '/admin/find-images', '/admin/image-import', '/admin/image-upload',
  '/admin/backups', '/admin/backup-now', '/admin/restore', '/admin/client-password',
];

// "https://isport-shop-*.pages.dev" = כל כתובת שמתחילה כך (Cloudflare Pages מוסיף סיומת כשהשם תפוס)
function allowed(origin, env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .some((o) => {
      if (!o.includes('*')) return o === origin;
      const [head, tail] = o.split('*');
      return origin.startsWith(head) && origin.endsWith(tail) && /^[a-z0-9-]+$/.test(origin.slice(head.length, origin.length - tail.length));
    });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const headers = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (origin && allowed(origin, env)) headers['access-control-allow-origin'] = origin;
  return headers;
}

async function image(key, env) {
  if (!isImageKey(key) || !env.IMAGES) return new Response('Not found', { status: 404 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'cross-origin',
      'access-control-allow-origin': '*',
    },
  });
}

export default {
  // הגיבוי הלילי
  async scheduled(event, env, ctx) {
    const stub = env.SHOP.get(env.SHOP.idFromName('main'));
    ctx.waitUntil(
      stub
        .fetch(new Request('https://shop/internal/nightly', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))
        .then(async (res) => console.log('nightly', res.status, await res.text())),
    );
  },

  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json', 'x-content-type-options': 'nosniff' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (pathname.startsWith('/img/') && (request.method === 'GET' || request.method === 'HEAD')) return image(pathname.slice(5), env);
    if (!env.SHOP) return reply(503, { error: 'השרת לא מוגדר' });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });
    // רק מהאתר עצמו
    if (!cors['access-control-allow-origin']) return reply(403, { error: 'אסור' });

    const text = await request.text();
    if (text.length > (pathname === '/admin/image-upload' ? MAX_UPLOAD_BYTES : MAX_BODY_BYTES)) return reply(413, { error: 'גדול מדי' });
    const stub = env.SHOP.get(env.SHOP.idFromName('main'));
    const res = await stub.fetch(new Request(`https://shop${pathname}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: request.headers.get('authorization') || '',
        // הכתובת של המבקר (Cloudflare קובע אותה – אי אפשר לזייף) – לנעילה אחרי ניסיונות כניסה שגויים
        'x-client-ip': request.headers.get('cf-connecting-ip') || '',
      },
      body: text,
    }));
    return reply(res.status, await res.json());
  },
};

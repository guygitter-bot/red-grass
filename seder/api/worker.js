// השרת של סדר (Cloudflare Worker): שומר את המשימות כדי שיהיו זהות בטלפון ובמחשב.
//   POST /login {password}            -> {token}   (פעם אחת בכל מכשיר)
//   POST /sync  {since, changes}      -> {cursor, more, records}   (Authorization: Bearer <token>)
//   POST /push/key | /push/subscribe {subscription, tz} | /push/unsubscribe | /push/test
//                                     -> התראות לטלפון גם כשהאפליקציה סגורה (ראו vault.js, push.js)
//   POST /files/put {id, name, type, data} -> {file}   קובץ / תמונה למשימה (data = base64, עד 4MB)
//   POST /files/get {id}              -> {file: {id, name, type, size, data}}
//   POST /requests {text}            -> בקשה לשינוי באפליקציה: נפתחת כ-issue ב-GitHub (ו-Claude מטפל בה)
//   POST /requests/list               -> הבקשות והמצב של כל אחת
//   POST /requests/approve {number}   -> אישור השינוי: מיזוג ה-PR (בלי להיכנס ל-GitHub)
//   POST /requests/reject  {number}   -> לא מתאים: סגירת הבקשה
//   POST /requests/go      {number}   -> לבצע בקשה אחרי שראו כמה היא תעלה
//   POST /requests/retry   {number}   -> לנסות שוב בקשה שנכשלה
//   POST /credits {amount}            -> היתרה בחשבון הקרדיטים של Claude (מוקלדת ידנית; ראו costs.js)
//   POST /spaces/list | /spaces/create {name} | /spaces/reset {id} | /spaces/delete {id}
//                                     -> אפליקציה נפרדת לאדם נוסף: קישור משלו, סיסמה משלו ונתונים משלו (spaces.js)
// במרחב: POST /login {space, password, setup} – ושאר הכתובות כרגיל, עם החיבור של המרחב (רק בלי בקשות, יתרה ומרחבים).
// הסיסמה (SEDER_PASSWORD) היא סוד של השרת. בלי סיסמה מוגדרת השרת סגור לגמרי.
import { Vault, safeEqual, sessionToken } from './vault.js';
import { newSpaceId, spaceOfToken, validSpaceId } from './spaces.js';
import { approveRequest, createRequest, creditsOf, listRequests, rejectRequest, retryRequest, startRequest } from './requests.js';

export { Vault };

const MAX_BODY_BYTES = 4 * 1024 * 1024;
// קובץ מצורף מגיע כ-base64 (גדול בשליש מהקובץ עצמו)
const MAX_FILE_BODY_BYTES = 6 * 1024 * 1024;

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
    const ROUTES = ['/login', '/sync', '/push/key', '/push/subscribe', '/push/unsubscribe', '/push/test', '/files/put', '/files/get', '/requests', '/requests/list', '/requests/approve', '/requests/reject', '/requests/retry', '/requests/go', '/credits', '/spaces/list', '/spaces/create', '/spaces/reset', '/spaces/delete'];
    // רק באפליקציה הראשית: שינויים באפליקציה עצמה, היתרה, וניהול האנשים הנוספים
    const ownerOnly = pathname.startsWith('/requests') || pathname === '/credits' || pathname.startsWith('/spaces/');
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const text = await request.text();
    if (text.length > (pathname === '/files/put' ? MAX_FILE_BODY_BYTES : MAX_BODY_BYTES)) return reply(413, { error: 'גדול מדי' });

    const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const vaultOf = (name) => {
      const stub = env.VAULT.get(env.VAULT.idFromName(name));
      return (path, body, headers = {}) => stub.fetch(new Request(`https://vault${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body }));
    };

    // מרחב של אדם נוסף: הכול עובר לכספת שלו, והיא בודקת את הסיסמה / החיבור
    let space = spaceOfToken(auth);
    if (pathname === '/login') {
      let body;
      try {
        body = JSON.parse(text || '{}');
      } catch {
        return reply(400, { error: 'בקשה לא תקינה' });
      }
      space = body.space ?? '';
      if (space !== '' && !validSpaceId(space)) return reply(404, { error: 'הקישור לא תקין' });
    }
    if (space) {
      if (!validSpaceId(space)) return reply(401, { error: 'צריך להתחבר מחדש' });
      if (ownerOnly) return reply(403, { error: 'זה זמין רק באפליקציה הראשית' });
      const res = await vaultOf(`space:${space}`)(pathname, text, { authorization: `Bearer ${auth}`, 'x-seder-space': space });
      return reply(res.status, await res.json());
    }

    if (pathname !== '/login' && !safeEqual(auth, await sessionToken(env.SEDER_PASSWORD))) return reply(401, { error: 'צריך להתחבר מחדש' });

    const vault = vaultOf('main');

    if (pathname.startsWith('/spaces/')) {
      const body = JSON.parse(text || '{}');
      const { registry } = await (await vault('/registry/list', '{}')).json();
      if (pathname === '/spaces/list') {
        const spaces = await Promise.all(Object.entries(registry).map(async ([id, s]) => {
          const info = await (await vaultOf(`space:${id}`)('/space/info', '{}')).json();
          return { id, name: s.name, createdAt: s.createdAt, ready: !!info.ready };
        }));
        return reply(200, { spaces: spaces.sort((a, b) => b.createdAt - a.createdAt) });
      }
      if (pathname === '/spaces/create') {
        const id = newSpaceId();
        const added = await vault('/registry/add', JSON.stringify({ id, name: body.name }));
        const data = await added.json();
        if (!added.ok) return reply(added.status, data);
        await vaultOf(`space:${id}`)('/space/init', JSON.stringify({ id, name: data.name }));
        return reply(200, { space: { id, name: data.name, createdAt: Date.now(), ready: false } });
      }
      if (!validSpaceId(body.id) || !registry[body.id]) return reply(404, { error: 'לא נמצא' });
      if (pathname === '/spaces/reset') return reply(200, await (await vaultOf(`space:${body.id}`)('/space/reset', '{}')).json());
      await vaultOf(`space:${body.id}`)('/space/delete', '{}');
      await vault('/registry/remove', JSON.stringify({ id: body.id }));
      return reply(200, { ok: true });
    }

    if (pathname.startsWith('/requests')) {
      if (!env.SEDER_GITHUB_TOKEN || env.SEDER_GITHUB_TOKEN === 'none' || !env.GITHUB_REPO) return reply(503, { error: 'בקשות לשינוי עוד לא הוגדרו (חסר SEDER_GITHUB_TOKEN)' });
      try {
        if (pathname === '/requests/list') {
          const { credits } = await (await vault('/credits', '{}')).json();
          const [requests, balance] = await Promise.all([listRequests(env), creditsOf(env, credits)]);
          return reply(200, { requests, credits: balance });
        }
        const body = JSON.parse(text || '{}');
        if (pathname === '/requests/go') return reply(200, await startRequest(env, body.number));
        if (pathname === '/requests/approve') return reply(200, await approveRequest(env, body.number));
        if (pathname === '/requests/reject') return reply(200, await rejectRequest(env, body.number));
        if (pathname === '/requests/retry') return reply(200, await retryRequest(env, body.number));
        return reply(200, { request: await createRequest(env, body.text, body.context) });
      } catch (e) {
        return reply(e.status || 502, { error: e.message || 'GitHub לא זמין' });
      }
    }

    const res = await vault(pathname, text);
    return reply(res.status, await res.json());
  },
};

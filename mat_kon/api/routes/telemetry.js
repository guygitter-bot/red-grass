// דיווחים מהאפליקציה: תקלות, מדידת מהירות, ובדיקת קריאת קישור לבעלים.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { deps } from '../deps.js';
import { gatherSource, normalizeUrl } from '../source.js';
import { internal } from '../lib/http.js';
import { summarizeSource } from '../lib/recipe-input.js';

// תקלה מהאפליקציה, מדידת מהירות אצל משתמשים, ו-/debug/source (רק לבעלים)
export async function handleTelemetry(ctx) {
  const { request, env, reply, fail, url, accounts, readJson, ip, rate, user } = ctx;
  // תקלה באפליקציה (מסך "משהו השתבש") – רק ממי שמחובר, ברשימה נפרדת מתקלות השרת
  if (url.pathname === '/client-error' && request.method === 'POST') {
    const limited = await rate([{ key: `client-error:${ip}`, limit: 20, window: 3600 }]);
    if (limited) return limited;
    const { body } = await readJson();
    await internal(accounts, 'POST', '/errors/add', {
      list: 'client', where: String(body?.where || '').slice(0, 60), message: String(body?.message || '').slice(0, 300), user: user?.email || 'owner',
    });
    return reply(200, { ok: true });
  }


  // מדידת מהירות אצל משתמשים אמיתיים (פעם אחת בכל פתיחה): כמה זמן עד שהמתכונים על המסך, וכמה לקח לשרת לענות
  if (url.pathname === '/client-metrics' && request.method === 'POST') {
    const limited = await rate([{ key: `metrics:${ip}`, limit: 30, window: 3600 }]);
    if (limited) return limited;
    const { body } = await readJson();
    const ms = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(Math.round(Number(v)), 120000) : null);
    await internal(accounts, 'POST', '/metrics/add', {
      ready: ms(body?.ready), api: ms(body?.api), native: Boolean(body?.native),
      net: /^(slow-2g|2g|3g|4g)$/.test(String(body?.net)) ? body.net : '',
    });
    return reply(200, { ok: true });
  }

  // בדיקה (רק לבעל האפליקציה): מה השרת מצליח לקרוא מקישור (בלי AI). משמש את .github/workflows/mat-kon-probe.yml
  if (url.pathname === '/debug/source' && request.method === 'GET') {
    if (user) return fail(403, 'רק לבעל האפליקציה');
    const link = normalizeUrl(url.searchParams.get('url'));
    if (!link) return fail(400, 'זה לא נראה כמו קישור תקין');
    return reply(200, summarizeSource(await gatherSource(link, deps.fetch, { igDocId: env.IG_DOC_ID })));
  }
  return null;
}

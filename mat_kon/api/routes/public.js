// מה שפתוח בלי כניסה: תמונות מתכונים ותצוגה מקדימה של מתכון ששותף בקישור.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { internal } from '../lib/http.js';
import { sharePreview } from '../lib/recipe-input.js';

// תמונות מתכונים: קישור עם מזהה אקראי שאי אפשר לנחש
export async function handleImages(ctx) {
  const { request, env, fail, parts, bookOf } = ctx;
  if (parts[0] === 'img' && parts.length === 3 && request.method === 'GET') {
    if (!/^(book|community|[0-9a-f-]{36})$/.test(parts[1]) || !/^[0-9a-f-]{36}$/.test(parts[2])) return fail(404, 'Not found');
    // community: תמונות "הכנתי!" שמשתמשים העלו לשיחה על מתכון בקהילה
    const owner = parts[1] === 'community' ? env.BOOK.get(env.BOOK.idFromName('community')) : bookOf(parts[1] === 'book' ? null : parts[1]);
    const res = await internal(owner, 'GET', `/img/${parts[2]}`);
    if (!res.ok) return fail(404, 'Not found');
    return new Response(res.body, {
      headers: {
        'content-type': res.headers.get('content-type'), 'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*', // כדי שהגיבוי יוכל לשמור את התמונה עצמה
      },
    });
  }
  return null;
}

// מתכון ששותף בקישור – תצוגה מקדימה לכל מי שיש לו את הקישור
export async function handleSharePreview(ctx) {
  const { request, reply, fail, parts, ip, rate, getShare } = ctx;
  if (parts[0] === 'shares' && parts.length === 2 && request.method === 'GET') {
    const limited = await rate([{ key: `share-view:${ip}`, limit: 120, window: 3600 }]);
    if (limited) return limited;
    const share = await getShare(parts[1]);
    if (!share) return fail(404, 'הקישור לא נמצא או שפג תוקפו');
    return reply(200, { preview: sharePreview(share) });
  }
  return null;
}

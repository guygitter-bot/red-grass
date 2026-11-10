// החשבון והספר המשותף: בני משפחה, החלפת סיסמה ומחיקת חשבון.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { internal, bearer } from '../lib/http.js';

// שיתוף הספר, החלפת סיסמה ומחיקת חשבון
export async function handleAccount(ctx) {
  const { request, env, reply, fail, pass, url, parts, accounts, bookOf, readJson, rate, user } = ctx;
  // ---- שיתוף הספר: בעל הספר (בעל האפליקציה או מי שנרשם מהזמנה) מצרף בני משפחה ----
  if (parts[0] === 'members') {
    if (user && user.role !== 'holder') return fail(403, 'רק בעל הספר יכול לנהל את השיתוף');
    const bookId = user ? user.id : 'owner';
    if (parts.length === 1 && request.method === 'GET') return pass(await internal(accounts, 'POST', '/members', { bookId }));
    if (parts.length === 1 && request.method === 'POST') return pass(await internal(accounts, 'POST', '/members/invite', { bookId }));
    if (parts.length === 2 && request.method === 'DELETE') return pass(await internal(accounts, 'POST', '/members/remove', { bookId, userId: parts[1] }));
    if (parts.length === 3 && parts[1] === 'links' && request.method === 'DELETE') {
      return pass(await internal(accounts, 'POST', '/members/cancel', { bookId, token: parts[2] }));
    }
    return fail(405, 'Method not allowed');
  }

  // ---- החלפת סיסמה (משתמש שנרשם): כל שאר המכשירים מנותקים ----
  if (url.pathname === '/account/password' && request.method === 'POST') {
    if (!user) return fail(400, 'לבעל האפליקציה אין סיסמה כאן (סיסמת הבעלים מוגדרת ב-GitHub)');
    const limited = await rate([{ key: `password:${user.id}`, limit: 10, window: 900 }], 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.');
    if (limited) return limited;
    const { body, error } = await readJson();
    if (error) return error;
    return pass(await internal(accounts, 'POST', '/account/password', { userId: user.id, current: body.current, next: body.next, session: bearer(request) }));
  }

  // ---- מחיקת החשבון שלי (משתמש שנרשם; בעל ספר – גם הספר והחברים בו) ----
  if (url.pathname === '/account' && request.method === 'DELETE') {
    if (!user) return fail(400, 'לבעל האפליקציה אין חשבון למחוק');
    const res = await internal(accounts, 'POST', '/account/delete', { userId: user.id });
    const data = await res.json();
    if (res.ok) await internal(env.BOOK.get(env.BOOK.idFromName('community')), 'POST', '/community/remove-author', { authorId: user.id });
    if (res.ok && data.deletedBook) await internal(bookOf(user.id), 'DELETE', '/recipes');
    return reply(res.status, data);
  }
  return null;
}

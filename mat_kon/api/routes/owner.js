// כלים של בעל האפליקציה: גיבויים ושחזור, הזמנות ומשתמשים.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { backupStatus, restoreBook } from '../backup.js';
import { internal } from '../lib/http.js';

// גיבויים, שחזור, הזמנות ומשתמשים (רק לבעלים)
export async function handleOwnerTools(ctx) {
  const { request, env, reply, fail, pass, parts, accounts, bookOf, readJson, user, recordError } = ctx;
  // ---- גיבויים: רק בעל האפליקציה ----
  if (parts[0] === 'admin' && (parts[1] === 'backups' || parts[1] === 'restore')) {
    if (user) return fail(403, 'רק לבעל האפליקציה');
    if (parts[1] === 'backups' && request.method === 'GET') return reply(200, await backupStatus(env));
    if (parts[1] === 'restore' && request.method === 'POST') {
      const { body, error } = await readJson();
      if (error) return error;
      try {
        return reply(200, await restoreBook(env, String(body.date || ''), String(body.book || '')));
      } catch (e) {
        await recordError('restore', e);
        return fail(400, e.message);
      }
    }
    return fail(405, 'Method not allowed');
  }

  // ---- ניהול הזמנות: רק בעל האפליקציה ----
  if (parts[0] === 'invites' || parts[0] === 'users') {
    if (user) return fail(403, 'רק לבעל האפליקציה');
    if (parts[0] === 'invites' && parts.length === 1 && request.method === 'GET') return pass(await internal(accounts, 'GET', '/invites'));
    if (parts[0] === 'invites' && parts.length === 1 && request.method === 'POST') {
      const { body, error } = await readJson();
      if (error) return error;
      return pass(await internal(accounts, 'POST', '/invites', { name: body.name }));
    }
    if (parts[0] === 'invites' && parts.length === 2 && request.method === 'DELETE') {
      const res = await internal(accounts, 'DELETE', '/invites', { token: parts[1] });
      const data = await res.json();
      // מחיקת הזמנה שנוצלה מוחקת גם את המשתמש ואת ספר המתכונים שלו
      if (res.ok && data.deletedUserId) await internal(bookOf(data.deletedUserId), 'DELETE', '/recipes');
      return reply(res.status, data);
    }
    if (parts[0] === 'users' && parts.length === 3 && parts[2] === 'plan' && request.method === 'PUT') {
      const { body, error } = await readJson();
      if (error) return error;
      return pass(await internal(accounts, 'POST', '/users/plan', { userId: parts[1], plan: body.plan }));
    }
    return fail(405, 'Method not allowed');
  }
  return null;
}

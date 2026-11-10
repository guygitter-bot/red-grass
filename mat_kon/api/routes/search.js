// חיפוש מתכון ברשת לפי שם.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { canAdd } from '../accounts.js';
import { searchRecipes } from '../extract.js';

// חיפוש מתכון ברשת (AI)
export async function handleSearch(ctx) {
  const { request, env, reply, fail, parts, readJson, user, aiBudget, ai, aiFail } = ctx;
  // ---- חיפוש מתכון ברשת לפי שם ----
  if (parts[0] === 'search' && parts.length === 1 && request.method === 'POST') {
    if (!canAdd(user)) return fail(402, `נגמרו ${user.freeLimit} המתכונים החינמיים`, { paywall: true, paymentUrl: env.PAYMENT_URL || '' });
    const { body, error } = await readJson();
    if (error) return error;
    const q = String(body.q || '').trim().slice(0, 200);
    if (q.length < 2) return fail(400, 'מה לחפש?');
    const limited = await aiBudget();
    if (limited) return limited;
    try {
      return reply(200, { results: await searchRecipes(ai('search'), q) });
    } catch (e) {
      return aiFail(e, (!e.status && e.message) || 'החיפוש נכשל');
    }
  }

  return null;
}

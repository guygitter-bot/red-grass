// מתכון ששותף בקישור (אחרי כניסה): המתכון המלא ושמירה בספר.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.

// מתכון ששותף – מלא / שמירה
export async function handleShares(ctx) {
  const { request, reply, fail, parts, bookKeyOf, rate, getShare, user, saveCopy } = ctx;
  // ---- מתכון ששותף בקישור: המתכון המלא, ושמירה שלו בספר שלי (נספר כמו מתכון חדש) ----
  if (parts[0] === 'shares' && parts.length === 3 && ['full', 'save'].includes(parts[2])) {
    if (parts[2] === 'full' && request.method === 'GET') {
      const share = await getShare(parts[1]);
      if (!share) return fail(404, 'הקישור לא נמצא או שפג תוקפו');
      return reply(200, { by: share.by, recipe: share.recipe });
    }
    if (parts[2] === 'save' && request.method === 'POST') {
      const limited = await rate([{ key: `share-save:${bookKeyOf(user)}`, limit: 200, window: 86400 }], 'הגעתם למגבלה היומית. נסו שוב מחר.');
      if (limited) return limited;
      const share = await getShare(parts[1]);
      if (!share) return fail(404, 'הקישור לא נמצא או שפג תוקפו');
      const { res, data } = await saveCopy(share.recipe);
      if (res.ok && !data.updated) await getShare(parts[1], true);
      return reply(res.status, data);
    }
    return fail(405, 'Method not allowed');
  }
  return null;
}

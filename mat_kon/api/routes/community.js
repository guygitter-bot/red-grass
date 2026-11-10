// הקהילה: פרופיל (שם תצוגה), חיפוש במאגר, שמירה, דירוג, דיווח ושיחה על מתכון.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { moderateTalk } from '../extract.js';
import { publicSummary } from '../community.js';
import { DIET_IDS } from '../diet.js';
import { MAX_PHOTO_BYTES, internal } from '../lib/http.js';

// פרופיל לקהילה ומאגר הקהילה
export async function handleCommunity(ctx) {
  const { request, env, reply, fail, pass, url, parts, accounts, bookKeyOf, readJson, rate, user, aiBudget, ai, aiFail, saveCopy } = ctx;
  // ---- פרופיל לקהילה: שם תצוגה (בלי אימייל) ואישור תנאי השימוש ----
  if (url.pathname === '/profile') {
    if (request.method === 'GET') return pass(await internal(accounts, 'POST', '/profile/get', { userId: user?.id || null }));
    if (request.method === 'PUT') {
      const { body, error } = await readJson();
      if (error) return error;
      return pass(await internal(accounts, 'POST', '/profile/set', { userId: user?.id || null, displayName: body.displayName, acceptTerms: body.acceptTerms === true }));
    }
    return fail(405, 'Method not allowed');
  }

  // ---- מאגר הקהילה: חיפוש במתכונים מקישורים שמשתמשים שמרו (עם דירוג ומספר שמירות, בלי שמות) ----
  if (parts[0] === 'community') {
    const stub = env.BOOK.get(env.BOOK.idFromName('community'));
    if (parts.length === 1 && request.method === 'GET') {
      const limited = await rate([{ key: `community:${bookKeyOf(user)}`, limit: 300, window: 3600 }]);
      if (limited) return limited;
      const p = url.searchParams;
      const num = (k) => (Number(p.get(k)) > 0 ? Math.min(Number(p.get(k)), 100000) : 0);
      const filters = {
        maxMinutes: num('minutes'), maxCalories: num('calories'),
        kosher: ['meat', 'dairy', 'parve'].includes(p.get('kosher')) ? p.get('kosher') : '',
        vegan: p.get('vegan') === '1', glutenFree: p.get('gf') === '1',
        diets: String(p.get('diets') || '').split(',').filter((d) => DIET_IDS.includes(d)),
      };
      return pass(await internal(stub, 'POST', '/community/search', { q: String(p.get('q') || '').slice(0, 100), filters }));
    }
    if (!/^[\w-]{10,40}$/.test(parts[1] || '')) return fail(404, 'Not found');
    const res = await internal(stub, 'POST', '/community/get', { key: parts[1] });
    if (!res.ok) return fail(404, 'המתכון כבר לא במאגר');
    const { recipe, summary } = await res.json();
    if (parts.length === 2 && request.method === 'GET') return reply(200, { recipe, summary: publicSummary(summary) });
    // ---- שיחה על המתכון: טיפים, שאלות, תשובות ו"הכנתי!" (עם שם תצוגה, אחרי בדיקת AI) ----
    if (parts[2] === 'talk') {
      const viewer = user?.id || 'owner';
      if (parts.length === 3 && request.method === 'GET') return pass(await internal(stub, 'POST', '/community/talk/list', { key: parts[1], viewer }));
      if (parts.length === 3 && request.method === 'POST') {
        const profile = await (await internal(accounts, 'POST', '/profile/get', { userId: user?.id || null })).json();
        if (profile.blocked) return fail(403, 'החשבון לא יכול לכתוב בקהילה');
        if (!profile.displayName || !profile.terms) return fail(409, 'צריך לבחור שם תצוגה ולאשר את תנאי השימוש', { needProfile: true });
        const { body, error } = await readJson(MAX_PHOTO_BYTES);
        if (error) return error;
        const kind = body.parent ? 'reply' : body.kind === 'made' ? 'made' : 'tip';
        const text = String(body.text || '').replace(/\s+\n/g, '\n').trim().slice(0, 1000);
        const rating = kind === 'made' && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : 0;
        const photo = kind === 'made' && typeof body.image === 'string' ? body.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/)?.[1] : null;
        if (photo && photo.length > 540000) return fail(413, 'התמונה גדולה מדי');
        if (kind !== 'made' && text.length < 2) return fail(400, 'כתבו כמה מילים');
        if (kind === 'made' && !text && !rating && !photo) return fail(400, 'הוסיפו תמונה, דירוג או כמה מילים');
        const limited = await rate([{ key: `talk:${viewer}`, limit: 40, window: 86400 }], 'הגעתם למגבלה היומית של תגובות. נסו שוב מחר.')
          || (photo && (await rate([{ key: `talk-img:${viewer}`, limit: 10, window: 86400 }], 'הגעתם למגבלה היומית של תמונות. נסו שוב מחר.')));
        if (limited) return limited;
        const budget = await aiBudget();
        if (budget) return budget;
        let review = { decision: 'publish', imageOk: true, reason: '' };
        if (text || photo) {
          try {
            review = await moderateTalk(ai('moderation'), { text, image: photo, recipeTitle: recipe.title });
          } catch (e) {
            return aiFail(e, (!e.status && e.message) || 'הבדיקה לפני הפרסום לא הצליחה');
          }
        }
        if (review.decision === 'reject') return fail(422, review.reason || 'התגובה לא מתאימה לקהילה');
        let image = null;
        if (photo && review.imageOk) {
          const saved = await internal(stub, 'POST', '/img', { type: 'image/jpeg', data: photo });
          if (saved.ok) image = `${url.origin}/img/community/${(await saved.json()).id}`;
        }
        const item = {
          id: crypto.randomUUID().replace(/-/g, '').slice(0, 16), kind, text, rating, image, parent: kind === 'reply' ? String(body.parent).slice(0, 40) : null,
          authorId: viewer, author: profile.displayName, at: new Date().toISOString(), likes: [],
          flagged: review.decision === 'review', flagReason: review.decision === 'review' ? review.reason : '',
        };
        const added = await internal(stub, 'POST', '/community/talk/add', { key: parts[1], item });
        if (added.ok && item.flagged) await internal(accounts, 'POST', '/admin/notify', { title: '👀 תגובה בקהילה מחכה לבדיקה', body: `${recipe.title}: ${text.slice(0, 80)}`, tag: `talk-${item.id}`, url: '#content' });
        const data = await added.json();
        return reply(added.status, { ...data, imageRemoved: Boolean(photo && !image) });
      }
      if (!/^[a-f0-9]{16}$/.test(parts[3] || '')) return fail(404, 'Not found');
      if (parts.length === 4 && request.method === 'DELETE') return pass(await internal(stub, 'POST', '/community/talk/remove', { key: parts[1], id: parts[3], by: viewer }));
      if (parts.length === 5 && parts[4] === 'like' && request.method === 'POST') {
        const limited = await rate([{ key: `talk-like:${viewer}`, limit: 300, window: 3600 }]);
        if (limited) return limited;
        return pass(await internal(stub, 'POST', '/community/talk/like', { key: parts[1], id: parts[3], liker: viewer }));
      }
      if (parts.length === 5 && parts[4] === 'report' && request.method === 'POST') {
        const limited = await rate([{ key: `report:${bookKeyOf(user)}`, limit: 30, window: 86400 }], 'הגעתם למגבלת הדיווחים היומית.');
        if (limited) return limited;
        const { body, error } = await readJson();
        if (error) return error;
        const reason = ['offensive', 'personal', 'spam', 'other'].includes(body.reason) ? body.reason : 'other';
        const reported = await (await internal(stub, 'POST', '/community/talk/report', { key: parts[1], id: parts[3], rater: viewer, reason })).json();
        if (reported.justHidden) await internal(accounts, 'POST', '/admin/notify', { title: '🚩 תגובה הוסתרה אחרי דיווחים', body: String(reported.text || '').slice(0, 80), tag: `talk-${parts[3]}`, url: '#content' });
        return reply(200, { ok: true });
      }
      return fail(405, 'Method not allowed');
    }
    // דיווח על מתכון (פעם אחת לכל ספר)
    if (parts.length === 3 && parts[2] === 'report' && request.method === 'POST') {
      const limited = await rate([{ key: `report:${bookKeyOf(user)}`, limit: 30, window: 86400 }], 'הגעתם למגבלת הדיווחים היומית.');
      if (limited) return limited;
      const { body, error } = await readJson();
      if (error) return error;
      const reason = ['not-recipe', 'offensive', 'personal', 'copied', 'other'].includes(body.reason) ? body.reason : 'other';
      const reported = await (await internal(stub, 'POST', '/community/report', { key: parts[1], rater: bookKeyOf(user), reason })).json();
      if (reported.justHidden) await internal(accounts, 'POST', '/admin/notify', { title: '🚩 מתכון הוסתר אחרי דיווחים', body: reported.title, tag: `report-${parts[1]}`, url: '#content' });
      return reply(200, { ok: true });
    }
    if (parts.length === 3 && parts[2] === 'save' && request.method === 'POST') {
      const limited = await rate([{ key: `share-save:${bookKeyOf(user)}`, limit: 200, window: 86400 }], 'הגעתם למגבלה היומית. נסו שוב מחר.');
      if (limited) return limited;
      const { res: saved, data } = await saveCopy(recipe);
      return reply(saved.status, data);
    }
    return fail(405, 'Method not allowed');
  }
  return null;
}

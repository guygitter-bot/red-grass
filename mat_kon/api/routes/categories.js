// פרטי המשתמש והקטגוריות של הספר.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { CATEGORIES } from '../categories.js';
import { MAX_CUSTOM_CATEGORIES, internal } from '../lib/http.js';

// /me – מי אני והקטגוריות; קטגוריות משלי (הוספה, מחיקה, סדר ומועדפות)
export async function handleMeAndCategories(ctx) {
  const { request, env, reply, fail, pass, url, parts, readJson, user, bookStub, customCategories, allCategories } = ctx;
  if (url.pathname === '/me') {
    const categoryPrefs = await (await internal(bookStub(), 'GET', '/category-prefs')).json();
    return reply(200, { owner: !user, user, categories: await allCategories(), categoryPrefs, paymentUrl: env.PAYMENT_URL || '' });
  }

  // ---- קטגוריות משלי ----
  if (parts[0] === 'categories') {
    const book = bookStub();
    if (parts.length === 1 && request.method === 'GET') return pass(await internal(book, 'GET', '/categories'));
    // סדר האריחים במסך הקטגוריות ומועדפות: רשימות של שמות (עד 60, בלי כפילויות)
    if (parts[1] === 'prefs' && parts.length === 2 && request.method === 'PUT') {
      const { body, error } = await readJson();
      if (error) return error;
      const names = (v) => [...new Set((Array.isArray(v) ? v : []).filter((c) => typeof c === 'string').map((c) => c.trim().slice(0, 30)).filter(Boolean))].slice(0, 60);
      return pass(await internal(book, 'PUT', '/category-prefs', { order: names(body.order), favorites: names(body.favorites) }));
    }
    if (request.method === 'POST' && parts.length <= 2) {
      const { body, error } = await readJson();
      if (error) return error;
      const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      if (!name) return fail(400, 'נא לכתוב שם לקטגוריה');
      if (parts[1] === 'remove') {
        if (CATEGORIES.includes(name)) return fail(400, 'אי אפשר למחוק קטגוריה קבועה');
        return pass(await internal(book, 'POST', '/categories/remove', { name }));
      }
      const custom = await customCategories();
      if (CATEGORIES.includes(name) || custom.includes(name)) return fail(409, 'כבר יש קטגוריה בשם הזה');
      if (custom.length >= MAX_CUSTOM_CATEGORIES) return fail(400, `אפשר עד ${MAX_CUSTOM_CATEGORIES} קטגוריות משלכם`);
      return pass(await internal(book, 'PUT', '/categories', { custom: [...custom, name] }));
    }
    return fail(405, 'Method not allowed');
  }
  return null;
}

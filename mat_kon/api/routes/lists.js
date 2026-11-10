// הרשימות המשותפות: תכנון שבועי, מלאי, רשימת קניות, איפה לקנות, ועבודות ברקע.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { deps } from '../deps.js';
import { canAdd } from '../accounts.js';
import { aiMessage, ideasFromPantry, organizeShopping, scanPantry } from '../extract.js';
import { findStores } from '../stores.js';
import { MAX_EDIT_BYTES, MAX_PHOTO_BYTES, internal } from '../lib/http.js';
import { photoSource, strList, cleanPlan, cleanShopping, cleanOps, cleanPantry } from '../lib/recipe-input.js';

// תכנון, שינויים ברמת פריט, מלאי, סופרים, קניות ומצב עבודה ברקע
export async function handleLists(ctx) {
  const { request, env, reply, fail, pass, parts, bookFor, readJson, user, aiBudget, ai, aiFail } = ctx;
  // ---- תכנון ארוחות שבועי ----
  if (parts[0] === 'plan' && parts.length === 1) {
    const book = bookFor(user);
    if (request.method === 'GET') return pass(await internal(book, 'GET', '/plan'));
    if (request.method === 'PUT') {
      const { body, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      const plan = cleanPlan(body.plan);
      if (!plan) return fail(400, 'תכנון לא תקין');
      return pass(await internal(book, 'PUT', '/plan', { plan }));
    }
    return fail(405, 'Method not allowed');
  }

  // ---- שינויים ברמת פריט ברשימות המשותפות ----
  if (['shopping', 'pantry', 'plan'].includes(parts[0]) && parts[1] === 'ops' && parts.length === 2 && request.method === 'POST') {
    const { body, error } = await readJson(MAX_EDIT_BYTES);
    if (error) return error;
    const ops = cleanOps(parts[0], body.ops);
    if (!ops) return fail(400, 'שינוי לא תקין');
    return pass(await internal(bookFor(user), 'POST', `/ops/${parts[0]}`, { ops }));
  }

  // ---- המלאי בבית: מקרר ומזווה ----
  if (parts[0] === 'pantry') {
    const book = bookFor(user);
    if (parts.length === 1 && request.method === 'GET') return pass(await internal(book, 'GET', '/pantry'));
    if (parts.length === 1 && request.method === 'PUT') {
      const { body, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      const items = cleanPantry(body.items);
      if (!items) return fail(400, 'רשימה לא תקינה');
      return pass(await internal(book, 'PUT', '/pantry', { items }));
    }
    // זיהוי מוצרים מתמונה (מוצר אחד או כל המקרר/המדף). לא נשמר: המשתמש מאשר קודם
    if (parts[1] === 'scan' && parts.length === 2 && request.method === 'POST') {
      const { body, error } = await readJson(MAX_PHOTO_BYTES);
      if (error) return error;
      const photos = photoSource(body);
      if (typeof photos === 'string') return fail(400, photos);
      const limited = await aiBudget(photos.images.length > 1 ? 2 : 1);
      if (limited) return limited;
      try {
        const items = await scanPantry(ai('pantry-scan'), photos.images, {
          mode: body.mode === 'single' ? 'single' : 'many',
          place: body.place === 'pantry' ? 'pantry' : 'fridge',
        });
        return reply(200, { items });
      } catch (e) {
        if (aiMessage(e)) return aiFail(e);
        if (e.status === 400) return fail(400, 'לא הצלחתי לקרוא את התמונה. נסו תמונה ברורה יותר.');
        return aiFail(e, (!e.status && e.message) || 'לא הצלחתי לזהות מוצרים');
      }
    }
    // מתכונים ברשת לפי מה שיש בבית
    if (parts[1] === 'ideas' && parts.length === 2 && request.method === 'POST') {
      if (!canAdd(user)) return fail(402, `נגמרו ${user.freeLimit} המתכונים החינמיים`, { paywall: true, paymentUrl: env.PAYMENT_URL || '' });
      const { body, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      const items = strList(body.items, 150).map((i) => i.slice(0, 80));
      if (!items.length) return fail(400, 'אין מוצרים במלאי');
      const limited = await aiBudget();
      if (limited) return limited;
      try {
        return reply(200, { results: await ideasFromPantry(ai('ideas'), items, { wish: String(body.wish || '').trim().slice(0, 200) }) });
      } catch (e) {
        return aiFail(e, (!e.status && e.message) || 'החיפוש נכשל');
      }
    }
    return fail(405, 'Method not allowed');
  }

  // ---- איפה לקנות: סופרים קרובים, מחירים וקישורי הזמנה ----
  if (parts[0] === 'stores' && parts.length === 1 && request.method === 'POST') {
    const { body, error } = await readJson(MAX_EDIT_BYTES);
    if (error) return error;
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return fail(400, 'מיקום לא תקין');
    const items = [...new Set(strList(body.items, 60).map((i) => i.slice(0, 120)))];
    const limited = await aiBudget(items.length ? 2 : 1);
    if (limited) return limited;
    try {
      return reply(200, await findStores({ lat, lon, items }, { fetch: deps.fetch, client: ai('stores'), cheapersalKey: env.CHEAPERSAL_API_KEY }));
    } catch (e) {
      return aiFail(e, (!e.status && e.message) || 'לא הצלחתי למצוא חנויות');
    }
  }

  // ---- רשימת קניות ----
  if (parts[0] === 'shopping') {
    const book = bookFor(user);
    if (parts.length === 1 && request.method === 'GET') return pass(await internal(book, 'GET', '/shopping'));
    if (parts.length === 1 && request.method === 'PUT') {
      const { body, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      const items = cleanShopping(body.items);
      if (!items) return fail(400, 'רשימה לא תקינה');
      return pass(await internal(book, 'PUT', '/shopping', { items }));
    }
    // איחוד כפילויות וסידור לפי מחלקות (AI)
    if (parts[1] === 'organize' && request.method === 'POST') {
      const { body, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      const items = (Array.isArray(body.items) ? body.items : []).map((t) => String(t || '').trim().slice(0, 300)).filter(Boolean).slice(0, 300);
      if (!items.length) return fail(400, 'הרשימה ריקה');
      const limited = await aiBudget();
      if (limited) return limited;
      try {
        return reply(200, { groups: await organizeShopping(ai('shopping'), items) });
      } catch (e) {
        return aiFail(e, (!e.status && e.message) || 'לא הצלחתי לסדר את הרשימה');
      }
    }
    return fail(405, 'Method not allowed');
  }

  // ---- עבודה ברקע (הוספת מתכון מקישור) ----
  if (parts[0] === 'jobs' && parts.length === 2 && request.method === 'GET' && /^[\w-]{1,64}$/.test(parts[1])) {
    return pass(await internal(bookFor(user), 'GET', `/jobs/${parts[1]}`));
  }
  return null;
}

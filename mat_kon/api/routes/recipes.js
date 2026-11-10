// ספר המתכונים: הוספה (קישור, טקסט, צילום, ידני, שחזור), קריאה, עריכה, מחיקה, פרסום, שיתוף ו-AI על מתכון.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { buildRecipe, errorGroup, failure, recipeKind } from '../jobs.js';
import { sha256 } from '../accounts.js';
import { normalizeUrl } from '../source.js';
import { NoRecipeError, suggestSubstitutes, categoryFields, cleanNutrition, estimateNutrition, moderateRecipe, suggestCategories } from '../extract.js';
import { CATEGORIES } from '../categories.js';
import { communityIdentity, communityKey, publicCopy, publicSummary } from '../community.js';
import { DIETS, DIET_IDS } from '../diet.js';
import { MAX_EDIT_BYTES, MAX_SMALL_BYTES, MAX_TEXT_BYTES, MAX_PHOTO_BYTES, MAX_RESTORE_BYTES, MAX_CUSTOM_CATEGORIES, internal } from '../lib/http.js';
import { cleanPatch, validImage, photoSource, manualRecipe, restoredRecipe, sharedCopy, textSource } from '../lib/recipe-input.js';

// כל הכתובות של /recipes (האחרונה בתור – מה שלא נמצא מחזיר 404)
export async function handleRecipes(ctx) {
  const { request, env, reply, fail, pass, url, parts, accounts, bookKeyOf, bookFor, readJson, rate, user, session, aiBudget, ai, recordError, aiFail, customCategories, allCategories } = ctx;
  // ---- ספר המתכונים ----
  if (parts[0] !== 'recipes' || parts.length > 3) return fail(404, 'Not found');
  const id = parts[1];
  if (id && !/^[\w-]{1,64}$/.test(id)) return fail(404, 'Not found');
  const book = bookFor(user);
  // תמונה שהועלתה (data URL) נשמרת בנפרד מהמתכון, ובמתכון נשאר רק קישור קצר אליה
  const storeImage = async (image) => {
    if (typeof image !== 'string' || !image.startsWith('data:image/')) return image ?? null;
    const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return null;
    const res = await internal(book, 'POST', '/img', { type: m[1], data: m[2] });
    if (!res.ok) return null;
    const { id: imageId } = await res.json();
    return `${url.origin}/img/${bookKeyOf(user)}/${imageId}`;
  };

  // מתכון שנכתב ידנית: בלי AI ובלי מכסה
  if (request.method === 'POST' && parts.length === 2 && id === 'manual') {
    const limited = await rate([{ key: `manual:${bookKeyOf(user)}`, limit: 200, window: 86400 }], 'הגעתם למגבלת המתכונים הידניים היומית. נסו שוב מחר.');
    if (limited) return limited;
    const { body, error } = await readJson(MAX_EDIT_BYTES);
    if (error) return error;
    const recipe = manualRecipe(body);
    if (typeof recipe === 'string') return fail(400, recipe);
    Object.assign(recipe, categoryFields(Array.isArray(body.categories) ? body.categories : [body.category], await allCategories()));
    recipe.image = await storeImage(recipe.image);
    return pass(await internal(book, 'POST', '/recipes', recipe));
  }

  // שחזור מגיבוי: המתכונים נשמרים כמו שהם (בלי AI ובלי מכסה). מתכון שכבר קיים (אותו מקור) מתעדכן.
  if (request.method === 'POST' && parts.length === 2 && id === 'restore') {
    const limited = await rate([{ key: `restore:${bookKeyOf(user)}`, limit: 100, window: 86400 }], 'הגעתם למגבלת השחזורים היומית. נסו שוב מחר.');
    if (limited) return limited;
    const { body, error } = await readJson(MAX_RESTORE_BYTES);
    if (error) return error;
    const list = Array.isArray(body.recipes) ? body.recipes.slice(0, 200) : null;
    if (!list) return fail(400, 'קובץ הגיבוי לא תקין');
    if (Array.isArray(body.categories)) {
      const custom = await customCategories();
      const add = body.categories.map((c) => String(c || '').trim().slice(0, 30)).filter((c) => c && !CATEGORIES.includes(c) && !custom.includes(c));
      if (add.length) await internal(book, 'PUT', '/categories', { custom: [...custom, ...new Set(add)].slice(0, MAX_CUSTOM_CATEGORIES) });
    }
    // קטגוריה שלא נכנסה (מעבר ל-30) – המתכון עובר ל"אחר" ולא נעלם מהרשימות
    const categories = await allCategories();
    let restored = 0;
    let skipped = 0;
    const ids = {}; // מזהה בגיבוי -> מזהה בספר (לתכנון ולרשימת הקניות)
    for (const raw of list) {
      const recipe = restoredRecipe(raw, categories);
      if (!recipe) {
        skipped += 1;
        continue;
      }
      recipe.image = await storeImage(recipe.image);
      const res = await internal(book, 'POST', '/recipes?replace=1', { ...recipe, restored: true });
      if (res.ok) {
        restored += 1;
        if (typeof raw.id === 'string') ids[raw.id] = (await res.json()).recipe.id;
      }
    }
    return reply(200, { restored, skipped, ids });
  }

  // הוספת מתכון מקישור או מהודעת ווטסאפ, או רענון מתכון קיים מהמקור שלו
  const isAddText = request.method === 'POST' && parts.length === 2 && id === 'text';
  const isAddPhoto = request.method === 'POST' && parts.length === 2 && id === 'photo';
  const isAdd = (request.method === 'POST' && parts.length === 1) || isAddText || isAddPhoto;
  const isRefresh = request.method === 'POST' && parts.length === 3 && parts[2] === 'refresh';
  if (isAdd || isRefresh) {
    let link;
    let text = null;
    let hint = '';
    let restoredStub = false;
    if (isAdd) {
      const { body, error } = await readJson(isAddPhoto ? MAX_PHOTO_BYTES : isAddText ? MAX_TEXT_BYTES : MAX_SMALL_BYTES);
      if (error) return error;
      if (isAddPhoto) {
        text = photoSource(body);
        if (typeof text === 'string') return fail(400, text);
      } else if (isAddText) {
        text = textSource(body);
        if (!text) return fail(400, 'אין כאן טקסט של מתכון');
      } else {
        link = normalizeUrl(body.url);
        if (!link) return fail(400, 'זה לא נראה כמו קישור תקין');
        hint = String(body.hint || '');
      }
    } else {
      const res = await internal(book, 'GET', `/recipes/${id}`);
      if (!res.ok) return fail(404, 'המתכון לא נמצא');
      const { source, restored } = (await res.json()).recipe;
      if (source.kind === 'photo' || source.kind === 'manual') return fail(400, 'למתכון הזה אין מקור לקרוא ממנו שוב');
      // מתכון ששוחזר מגיבוי ועוד לא נקרא מהמקור – קריאה ראשונה שלו נספרת כמו הוספה
      restoredStub = Boolean(restored);
      if (['whatsapp', 'file', 'voice'].includes(source.kind) || source.text) text = textSource(source);
      else {
        link = source.url;
        hint = source.hint || '';
      }
    }
    // מכסה: נלקחת לפני העבודה ומוחזרת אם לא נוסף מתכון חדש
    const counts = Boolean(user) && (isAdd || restoredStub);
    if (counts) {
      const taken = await internal(accounts, 'POST', '/quota/take', { userId: user.id });
      if (!taken.ok) return fail(402, `נגמרו ${user.freeLimit} המתכונים החינמיים`, { paywall: true, paymentUrl: env.PAYMENT_URL || '' });
    }
    const giveBack = () => counts && internal(accounts, 'POST', '/quota/give', { userId: user.id });
    const limited = await aiBudget(isAddPhoto ? 2 : 1);
    if (limited) {
      await giveBack();
      return limited;
    }
    const categories = await allCategories();
    // ברקע: מחזירים מיד מספר עבודה, וה-Durable Object ממשיך גם אם האפליקציה נסגרה (קישור מסרטון לוקח עד 2 דקות)
    if (isAdd && !isAddPhoto && !isAddText && url.searchParams.get('async') === '1') {
      const job = await internal(book, 'POST', '/jobs', {
        input: { link, hint }, categories, quota: counts ? { userId: user.id } : null, owner: !user,
      });
      return pass(job);
    }
    let recipe;
    try {
      recipe = await buildRecipe(env, ai(recipeKind({ link, text })), { link, text, hint, fresh: isRefresh }, categories);
    } catch (e) {
      await giveBack();
      await recordError('extract', e, link ? errorGroup(link, e) : e instanceof NoRecipeError ? 'NoRecipeError:' : '');
      const f = failure(e, { isPhoto: isAddPhoto, owner: !user });
      return fail(f.status, f.error);
    }
    const more = (isAdd && recipe.more) || []; // ברענון – רק המתכון עצמו
    delete recipe.more;
    const thumb = recipe.image;
    recipe.image = await storeImage(thumb);
    const res = await internal(book, 'POST', '/recipes', recipe);
    const data = await res.json();
    // כמה מתכונים שונים באותו צילום/הודעה: כל אחד נשמר בנפרד (עם עותק משלו של התמונה) ונספר כמתכון
    if (res.ok && more.length) {
      data.more = [];
      for (const extra of more) {
        if (counts && !(await internal(accounts, 'POST', '/quota/take', { userId: user.id })).ok) break;
        extra.image = await storeImage(thumb);
        const r = await internal(book, 'POST', '/recipes', extra);
        const d = await r.json();
        if (r.ok) data.more.push(d.recipe);
        if (counts && (!r.ok || !d.counted)) await giveBack();
      }
    }
    // מתכון שכבר היה בספר (אותו קישור) לא נספר – המכסה חוזרת
    if (counts) {
      const result = !res.ok || !data.counted ? await giveBack() : null;
      const fresh = await internal(accounts, 'POST', '/auth', { session });
      data.user = fresh.ok ? (await fresh.json()).user : undefined;
      void result;
    }
    delete data.counted;
    return reply(res.status, data);
  }

  // המתכון הזה במאגר הקהילה (מקישור, עותק ממישהו, או שפרסמתי): המפתח, בשביל השיחה עליו בדף המתכון
  if (parts.length === 3 && parts[2] === 'community' && request.method === 'GET') {
    const res = await internal(book, 'GET', `/recipes/${id}`);
    if (!res.ok) return fail(404, 'המתכון לא נמצא');
    const { recipe } = await res.json();
    const identity = communityIdentity(recipe);
    const key = recipe.published || (identity ? await communityKey(identity) : null);
    if (!key) return reply(200, { key: null });
    const found = await internal(env.BOOK.get(env.BOOK.idFromName('community')), 'POST', '/community/get', { key });
    if (!found.ok) return reply(200, { key: null });
    return reply(200, { key, summary: publicSummary((await found.json()).summary) });
  }

  // פרסום מתכון אישי לקהילה (עם שם תצוגה), אחרי בדיקת AI. ביטול פרסום – בכל רגע
  if (parts.length === 3 && parts[2] === 'publish' && ['POST', 'DELETE'].includes(request.method)) {
    const res = await internal(book, 'GET', `/recipes/${id}`);
    if (!res.ok) return fail(404, 'המתכון לא נמצא');
    const { recipe } = await res.json();
    const comm = env.BOOK.get(env.BOOK.idFromName('community'));
    if (request.method === 'DELETE') {
      if (recipe.published) await internal(comm, 'POST', '/community/unpublish', { key: recipe.published });
      return pass(await internal(book, 'PUT', `/recipes/${id}`, { published: null }));
    }
    if (recipe.source?.url) return fail(400, 'מתכון מקישור כבר נמצא בקהילה, עם קרדיט למקור');
    if (recipe.source?.kind === 'community') return fail(400, 'זה מתכון שמישהו אחר פרסם בקהילה');
    const profile = await (await internal(accounts, 'POST', '/profile/get', { userId: user?.id || null })).json();
    if (profile.blocked) return fail(403, 'החשבון לא יכול לפרסם בקהילה');
    if (!profile.displayName || !profile.terms) return fail(409, 'צריך לבחור שם תצוגה ולאשר את תנאי השימוש', { needProfile: true });
    const limited = await rate([{ key: `publish:${bookKeyOf(user)}`, limit: 20, window: 86400 }], 'הגעתם למגבלת הפרסומים היומית. נסו שוב מחר.');
    if (limited) return limited;
    const budget = await aiBudget();
    if (budget) return budget;
    // רק תמונה שנשמרה אצלנו: תמונה מאתר חיצוני הייתה חושפת לאתר את כתובות הצופים בקהילה
    const image = typeof recipe.image === 'string' && recipe.image.startsWith(`${url.origin}/img/`) ? recipe.image : null;
    let review;
    try {
      review = await moderateRecipe(ai('moderation'), recipe, image);
    } catch (e) {
      return aiFail(e, (!e.status && e.message) || 'הבדיקה לפני הפרסום לא הצליחה');
    }
    if (review.decision === 'reject') return fail(422, review.reason || 'המתכון לא מתאים לפרסום בקהילה');
    const identity = `pub:${bookKeyOf(user)}:${id}`;
    const key = recipe.published || (await communityKey(identity));
    const copy = publicCopy({ ...recipe, image: review.imageOk ? image : null }, { keepImage: true });
    copy.source = { url: null, key: `community:${key}`, kind: 'community', identity, author: profile.displayName };
    await internal(comm, 'POST', '/community/publish', {
      key, recipe: copy, author: { id: user?.id || 'owner', name: profile.displayName }, flagged: review.decision === 'review', reason: review.reason,
    });
    if (review.decision === 'review') await internal(accounts, 'POST', '/admin/notify', { title: '👀 מתכון חדש בקהילה מחכה לבדיקה', body: `${copy.title} – ${review.reason || ''}`, tag: `review-${key}`, url: '#content' });
    const saved = await (await internal(book, 'PUT', `/recipes/${id}`, { published: key })).json();
    return reply(200, { ...saved, review: { decision: review.decision, imageRemoved: Boolean(image && !review.imageOk), reason: review.reason } });
  }

  // שיתוף מתכון בקישור: נשמר עותק של המתכון (בלי ההערות האישיות והדירוג), ולא גישה לספר
  if (parts.length === 3 && parts[2] === 'share' && request.method === 'POST') {
    const limited = await rate([{ key: `share:${bookKeyOf(user)}`, limit: 100, window: 86400 }], 'הגעתם למגבלת השיתופים היומית. נסו שוב מחר.');
    if (limited) return limited;
    const { body, error } = await readJson();
    if (error) return error;
    const res = await internal(book, 'GET', `/recipes/${id}`);
    if (!res.ok) return fail(404, 'המתכון לא נמצא');
    const copy = sharedCopy((await res.json()).recipe, await allCategories());
    if (!copy) return fail(400, 'אי אפשר לשתף את המתכון הזה');
    if (JSON.stringify(copy).length > 120000) return fail(413, 'המתכון גדול מדי לשיתוף');
    const by = String(user?.name || body.from || '').trim().slice(0, 60);
    return pass(await internal(accounts, 'POST', '/shares/put', { recipe: copy, by, userId: user ? user.id : 'owner' }));
  }
  if (parts.length === 1 && request.method === 'GET') return pass(await internal(book, 'GET', '/recipes'));
  if (parts.length === 2 && request.method === 'GET') return pass(await internal(book, 'GET', `/recipes/${id}`));
  if (parts.length === 2 && request.method === 'DELETE') return pass(await internal(book, 'DELETE', `/recipes/${id}`));
  // סידור מתכון קיים בכל הקטגוריות שמתאימות לו (AI קצר, בלי רשת, בלי מכסת מתכונים – רק בתקציב היומי)
  if (parts.length === 3 && parts[2] === 'categorize' && request.method === 'POST') {
    const res = await internal(book, 'GET', `/recipes/${id}`);
    if (!res.ok) return fail(404, 'המתכון לא נמצא');
    const { recipe } = await res.json();
    const limited = await aiBudget();
    if (limited) return limited;
    try {
      const fields = await suggestCategories(ai('categories'), recipe, await allCategories());
      return pass(await internal(book, 'PUT', `/recipes/${id}`, { ...fields, categorized: true }));
    } catch (e) {
      return aiFail(e, (!e.status && e.message) || 'לא הצלחתי לסדר את הקטגוריות');
    }
  }
  // חסר לי מצרך: תחליפים שמתאימים למתכון הזה (AI קצר; אותה שאלה שוב – מהזיכרון, בחינם)
  if (parts.length === 3 && parts[2] === 'substitute' && request.method === 'POST') {
    const { body, error } = await readJson();
    if (error) return error;
    const res = await internal(book, 'GET', `/recipes/${id}`);
    if (!res.ok) return fail(404, 'המתכון לא נמצא');
    const { recipe } = await res.json();
    const item = String(body.item || '').trim();
    // רק מצרך שבאמת מופיע במתכון (לא שאלה חופשית ל-AI)
    if (!(recipe.ingredients || []).some((g) => (g.items || []).includes(item))) return fail(400, 'המצרך לא נמצא במתכון');
    const diets = (Array.isArray(body.diets) ? body.diets : []).filter((d) => DIET_IDS.includes(d)).sort();
    const label = Object.fromEntries(DIETS.map((d) => [d.id, d.label]));
    const cacheKey = `${id}:${(await sha256(`${item}|${diets.join(',')}`)).replace(/[^\w]/g, '').slice(0, 24)}`;
    const cached = await (await internal(book, 'GET', `/subs?key=${encodeURIComponent(cacheKey)}`)).json();
    if (cached.value) return reply(200, cached.value);
    const limited = await aiBudget();
    if (limited) return limited;
    try {
      const out = { item, ...(await suggestSubstitutes(ai('substitute'), recipe, item, { diets: diets.map((d) => label[d]) })) };
      await internal(book, 'PUT', `/subs?key=${encodeURIComponent(cacheKey)}`, out);
      return reply(200, out);
    } catch (e) {
      return aiFail(e, (!e.status && e.message) || 'לא הצלחתי למצוא תחליף');
    }
  }
  // הערכה תזונתית למתכון קיים (מתכון ישן, או אחרי עריכת המצרכים): AI קצר, בלי מכסת מתכונים – רק בתקציב היומי
  if (parts.length === 3 && parts[2] === 'nutrition' && request.method === 'POST') {
    const res = await internal(book, 'GET', `/recipes/${id}`);
    if (!res.ok) return fail(404, 'המתכון לא נמצא');
    const { recipe } = await res.json();
    const limited = await aiBudget();
    if (limited) return limited;
    try {
      return pass(await internal(book, 'PUT', `/recipes/${id}`, { nutrition: await estimateNutrition(ai('nutrition'), recipe) }));
    } catch (e) {
      return aiFail(e, (!e.status && e.message) || 'לא הצלחתי להעריך את הערכים התזונתיים');
    }
  }
  if (parts.length === 2 && request.method === 'PUT') {
    const { body: patch, error } = await readJson(MAX_EDIT_BYTES);
    if (error) return error;
    delete patch.published; // רק דרך /publish
    // ערכים תזונתיים: רק בצורה הנכונה. שינוי במצרכים או במספר המנות – ההערכה הישנה כבר לא נכונה
    if ('nutrition' in patch) patch.nutrition = cleanNutrition(patch.nutrition);
    else if ('ingredients' in patch || 'servings' in patch) patch.nutrition = null;
    if ('categories' in patch) {
      const known = await allCategories();
      if (!Array.isArray(patch.categories) || !patch.categories.length || patch.categories.some((c) => !known.includes(c))) return fail(400, 'קטגוריה לא מוכרת');
      Object.assign(patch, categoryFields(patch.categories, known));
    } else if ('category' in patch && !(await allCategories()).includes(patch.category)) return fail(400, 'קטגוריה לא מוכרת');
    if ('rating' in patch && !(Number.isInteger(patch.rating) && patch.rating >= 0 && patch.rating <= 5)) return fail(400, 'דירוג לא תקין');
    if ('tags' in patch) {
      if (!Array.isArray(patch.tags)) return fail(400, 'תגיות לא תקינות');
      patch.tags = [...new Set(patch.tags.map((t) => String(t || '').trim().slice(0, 30)).filter(Boolean))].slice(0, 15);
    }
    if ('image' in patch && !validImage(patch.image)) return fail(400, 'תמונה לא תקינה');
    const bad = cleanPatch(patch);
    if (bad) return fail(400, bad);
    if ('image' in patch) {
      const uploaded = typeof patch.image === 'string' && patch.image.startsWith('data:image/');
      patch.image = await storeImage(patch.image);
      if (uploaded && patch.image) patch.imageFresh = true; // העלאה חדשה (ולא הפניה לתמונה קיימת)
    }
    return pass(await internal(book, 'PUT', `/recipes/${id}`, patch));
  }
  return fail(405, 'Method not allowed');
  return null;
}

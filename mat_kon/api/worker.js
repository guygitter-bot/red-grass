// השרת של mat-kon (Cloudflare Worker): מחזיק את מפתח ה-API של Anthropic ואת ספרי המתכונים.
// האפליקציה שולחת קישור, השרת קורא אותו (גם סרטונים), הסוכן מסדר מתכון בעברית עם קטגוריה,
// והמתכון נשמר בספר.
//
// שני סוגי שימוש:
//   - בעל האפליקציה: פתוח, בלי הרשמה ובלי הגבלה. ספר המתכונים "book" וניהול ההזמנות.
//   - משתמש שהוזמן (Authorization: Bearer <session>): נרשם מקישור הזמנה, מקבל ספר ריק משלו
//     (user:<id>), ו-FREE_RECIPES מתכונים בחינם. אחר כך צריך מנוי (plan=paid).
import { deps, trackedClient } from './deps.js';
import { buildRecipe, failure } from './jobs.js';
import { RecipeBook } from './store.js';
import { Accounts, canAdd } from './accounts.js';
import { gatherSource, normalizeUrl, sourceKind } from './source.js';
import { NoRecipeError, aiMessage, extractRecipe, ideasFromPantry, organizeShopping, scanPantry, searchRecipes } from './extract.js';
import { findStores } from './stores.js';
import { CATEGORIES } from './categories.js';

export { RecipeBook, Accounts };

// נקודות הזרקה לבדיקות
export { deps };

const MAX_EDIT_BYTES = 200 * 1024;
const MAX_SMALL_BYTES = 4000;
const MAX_TEXT_BYTES = 30000;
const MAX_PHOTO_BYTES = 9 * 1024 * 1024; // עד 4 תמונות מוקטנות
const MAX_IMAGE_FIELD = 160 * 1024; // תמונת מתכון שנשמרת בספר (מוקטנת בדפדפן)
const MAX_RESTORE_BYTES = 8 * 1024 * 1024; // מנה אחת מקובץ גיבוי (האפליקציה שולחת במנות)
const MAX_CUSTOM_CATEGORIES = 30;

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

const internal = (stub, method, path, body) =>
  stub.fetch(new Request(`https://do${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    const fail = (status, message, extra = {}) => reply(status, { error: message, ...extra });
    const pass = async (res) => reply(res.status, await res.json());

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.ANTHROPIC_API_KEY || !env.BOOK || !env.ACCOUNTS) return fail(500, 'השרת לא מוגדר');

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const accounts = env.ACCOUNTS.get(env.ACCOUNTS.idFromName('accounts'));
    const bookOf = (userId) => env.BOOK.get(env.BOOK.idFromName(userId ? `user:${userId}` : 'book'));
    // הספר שהמשתמש עובד עליו: שלו, ספר משותף של בעל ספר אחר, או הספר של בעל האפליקציה
    // המזהה של הספר בכתובות תמונות: 'book' לספר של בעל האפליקציה, או מזהה בעל הספר
    const bookKeyOf = (u) => (!u || u.bookId === 'owner' ? 'book' : u.bookId || u.id);
    const bookFor = (u) => (!u || u.bookId === 'owner' ? bookOf(null) : bookOf(u.bookId || u.id));

    const readJson = async (limit = MAX_SMALL_BYTES) => {
      const text = await request.text();
      if (text.length > limit) return { error: fail(413, 'הבקשה גדולה מדי') };
      try {
        const body = text ? JSON.parse(text) : {};
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        return { body };
      } catch {
        return { error: fail(400, 'בקשה לא תקינה') };
      }
    };

    // ---- הרשמה וכניסה (בלי זיהוי) ----
    // הגבלת קצב לפי כתובת (ולפי אימייל בכניסה), נבדקת ונספרת באותו צעד
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const rate = async (checks, message, trust) => {
      const res = await internal(accounts, 'POST', '/rate', { checks, message, trust });
      return res.ok ? null : pass(res);
    };

    if (request.method === 'POST' && ['invite', 'join', 'register', 'login', 'logout', 'logout-all'].includes(parts[0]) && parts.length === 1) {
      const { body, error } = await readJson();
      if (error) return error;
      if (parts[0] === 'logout' || parts[0] === 'logout-all') body.session = bearer(request);
      if (parts[0] === 'login') {
        const email = String(body.email || '').trim().toLowerCase();
        const limited = await rate([
          { key: `login-ip:${ip}`, limit: 30, window: 900 },
          { key: `login:${email}:${ip}`, limit: 10, window: 900 },
          { key: `login-all:${email}`, limit: 100, window: 3600, global: true },
        ], 'יותר מדי ניסיונות כניסה. נסו שוב בעוד רבע שעה.', { scope: `e:${email}`, device: body.device });
        if (limited) return limited;
      }
      if (['register', 'invite', 'join'].includes(parts[0])) {
        const limited = await rate([{ key: `signup-ip:${ip}`, limit: 30, window: 3600 }]);
        if (limited) return limited;
      }
      const path = { invite: '/invite/check', join: '/join/check' }[parts[0]] || `/${parts[0]}`;
      return pass(await internal(accounts, 'POST', path, body));
    }

    // ---- תמונות מתכונים: קישור עם מזהה אקראי שאי אפשר לנחש (תגית img לא שולחת כניסה) ----
    if (parts[0] === 'img' && parts.length === 3 && request.method === 'GET') {
      if (!/^(book|[0-9a-f-]{36})$/.test(parts[1]) || !/^[0-9a-f-]{36}$/.test(parts[2])) return fail(404, 'Not found');
      const res = await internal(bookOf(parts[1] === 'book' ? null : parts[1]), 'GET', `/img/${parts[2]}`);
      if (!res.ok) return fail(404, 'Not found');
      return new Response(res.body, {
        headers: {
          'content-type': res.headers.get('content-type'), 'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*', // כדי שהגיבוי יוכל לשמור את התמונה עצמה
        },
      });
    }

    // ---- הספר של בעל האפליקציה: פתוח, או נעול (רק במכשירים שנכנסו עם סיסמת הבעלים / חשבון הגוגל שלו) ----
    const setting = (v) => (v && v !== 'none' ? String(v) : '');
    const googleClientId = setting(env.GOOGLE_CLIENT_ID);
    const ownerPassword = setting(env.OWNER_PASSWORD);
    const ownerEmail = setting(env.OWNER_EMAIL).trim().toLowerCase();
    // בלי סיסמת בעלים ובלי חשבון גוגל של בעלים הספר נשאר סגור (כשל סגור), אלא אם הוגדר במפורש OWNER_OPEN=true
    const ownerLocked = Boolean(ownerPassword || (ownerEmail && googleClientId)) || env.OWNER_OPEN !== 'true';
    if (url.pathname === '/auth-config' && request.method === 'GET') {
      return reply(200, { googleClientId, ownerLocked, ownerPassword: Boolean(ownerPassword) });
    }
    if (url.pathname === '/owner-login' && request.method === 'POST') {
      if (!ownerPassword) return fail(400, 'כניסת בעלים לא מוגדרת');
      const { body, error } = await readJson();
      if (error) return error;
      // כל ניסיון נספר מראש (גם ניסיונות במקביל), לפי כתובת – וגם תקרה כללית נגד ניחוש מפוזר
      const limited = await rate([
        { key: `owner-ip:${ip}`, limit: 10, window: 900 },
        { key: 'owner-all', limit: 300, window: 900, global: true },
      ], 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.', { scope: 'owner', device: body.device });
      if (limited) return limited;
      if (!(await sameSecret(String(body.password || ''), ownerPassword))) return fail(401, 'הסיסמה שגויה');
      return pass(await internal(accounts, 'POST', '/owner-session', { device: body.device }));
    }

    // ---- כניסה והרשמה עם חשבון גוגל ----
    if (url.pathname === '/google' && request.method === 'POST') {
      if (!googleClientId) return fail(400, 'כניסה עם גוגל לא מוגדרת');
      const { body, error } = await readJson();
      if (error) return error;
      const limited = await rate([{ key: `google-ip:${ip}`, limit: 30, window: 900 }]);
      if (limited) return limited;
      const profile = await verifyGoogle(String(body.credential || ''), googleClientId);
      if (!profile) return fail(401, 'לא הצלחתי לאמת את חשבון הגוגל. נסו שוב.');
      // מתוך חשבון מחובר: חיבור גוגל לחשבון הקיים (ולא כניסה)
      if (body.link) {
        const auth = await internal(accounts, 'POST', '/auth', { session: bearer(request) });
        const me = auth.ok ? (await auth.json()).user : null;
        if (!me) return fail(401, 'צריך להיכנס מחדש');
        return pass(await internal(accounts, 'POST', '/google/link', { userId: me.id, ...profile }));
      }
      if (ownerEmail && profile.email.toLowerCase() === ownerEmail) return pass(await internal(accounts, 'POST', '/owner-session', {}));
      return pass(await internal(accounts, 'POST', '/google', { ...profile, token: body.token || '', join: body.join || '' }));
    }

    // ---- מי שולח: בעל האפליקציה (בלי טוקן, או טוקן של בעלים) או משתמש שהוזמן ----
    let user = null;
    let signedIn = false;
    const session = bearer(request);
    if (session) {
      const res = await internal(accounts, 'POST', '/auth', { session });
      if (!res.ok) return pass(res);
      user = (await res.json()).user;
      signedIn = true;
    }

    // תקציב יומי לפעולות AI (כל ספר בנפרד), כדי שאף משתמש לא יוכל לשרוף את הקרדיט
    const aiBudget = async (cost = 1) => {
      const limit = !user ? Number(env.AI_DAILY_OWNER || 300)
        : user.plan === 'paid' ? Number(env.AI_DAILY_PAID || 100) : Number(env.AI_DAILY_FREE || 25);
      const res = await internal(bookFor(user), 'POST', '/usage/take', { day: new Date().toISOString().slice(0, 10), limit, cost });
      return res.ok ? null : fail(429, 'הגעתם למכסה היומית של פעולות חכמות. אפשר להמשיך מחר.');
    };

    // לקוח AI שסופר טוקנים לספר (מעקב עלויות לבעל האפליקציה)
    const month = () => new Date().toISOString().slice(0, 7);
    const ai = () => trackedClient(env, (u) => internal(bookFor(user), 'POST', '/costs/add', { month: month(), ...u }).catch(() => {}));
    // תקלות נשמרות (50 אחרונות) כדי שבעל האפליקציה יראה אותן במסך הניהול
    const recordError = (where, e) => {
      console.error(where, e);
      return internal(accounts, 'POST', '/errors/add', {
        where, message: String(e?.message || e).slice(0, 300), status: e?.status || null, user: user?.email || (user ? user.id : 'owner'),
      }).catch(() => {});
    };

    // שגיאה מה-AI: הודעה ברורה בעברית במקום השגיאה הגולמית
    const aiFail = async (e, message) => {
      await recordError('ai', e);
      const friendly = aiMessage(e, { owner: !user });
      if (friendly) return fail(503, friendly);
      return fail(502, message);
    };

    // ספר נעול: בלי כניסה אין גישה לספר של בעל האפליקציה
    if (ownerLocked && !signedIn) return fail(401, 'צריך להיכנס', { login: true });

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


    // בדיקה (רק לבעל האפליקציה): מה השרת מצליח לקרוא מקישור (בלי AI). משמש את .github/workflows/mat-kon-probe.yml
    if (url.pathname === '/debug/source' && request.method === 'GET') {
      if (user) return fail(403, 'רק לבעל האפליקציה');
      const link = normalizeUrl(url.searchParams.get('url'));
      if (!link) return fail(400, 'זה לא נראה כמו קישור תקין');
      return reply(200, summarizeSource(await gatherSource(link, deps.fetch, { igDocId: env.IG_DOC_ID })));
    }


    // הקטגוריות של הספר: הקבועות ואלה שהמשתמש הוסיף
    const bookStub = () => bookFor(user);
    const customCategories = async () => (await (await internal(bookStub(), 'GET', '/categories')).json()).custom || [];
    const allCategories = async () => [...CATEGORIES, ...(await customCategories())];

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
        return reply(200, { results: await searchRecipes(ai(), q) });
      } catch (e) {
        return aiFail(e, (!e.status && e.message) || 'החיפוש נכשל');
      }
    }

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

    // ---- מחיקת החשבון שלי (משתמש שנרשם; בעל ספר – גם הספר והחברים בו) ----
    if (url.pathname === '/account' && request.method === 'DELETE') {
      if (!user) return fail(400, 'לבעל האפליקציה אין חשבון למחוק');
      const res = await internal(accounts, 'POST', '/account/delete', { userId: user.id });
      const data = await res.json();
      if (res.ok && data.deletedBook) await internal(bookOf(user.id), 'DELETE', '/recipes');
      return reply(res.status, data);
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
          const items = await scanPantry(ai(), photos.images, {
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
          return reply(200, { results: await ideasFromPantry(ai(), items, { wish: String(body.wish || '').trim().slice(0, 200) }) });
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
        return reply(200, await findStores({ lat, lon, items }, { fetch: deps.fetch, client: ai(), cheapersalKey: env.CHEAPERSAL_API_KEY }));
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
          return reply(200, { groups: await organizeShopping(ai(), items) });
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

    // ---- ניהול: עלויות ותקלות (רק בעל האפליקציה) ----
    if (parts[0] === 'admin') {
      if (user) return fail(403, 'רק לבעל האפליקציה');
      if (url.pathname === '/admin/usage' && request.method === 'GET') {
        const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : month();
        const { books, ownerMembers } = await (await internal(accounts, 'GET', '/books')).json();
        const price = { in: Number(env.AI_PRICE_IN || 5), out: Number(env.AI_PRICE_OUT || 25), search: Number(env.AI_PRICE_SEARCH || 0.01) };
        const withCost = async (row, stub) => {
          const c = await (await internal(stub, 'GET', `/costs/${m}`)).json();
          const usd = (c.input * price.in + c.output * price.out) / 1e6 + c.searches * price.search;
          return { ...row, ...c, usd: Math.round(usd * 100) / 100 };
        };
        const rows = await Promise.all([
          withCost({ id: 'owner', name: 'הספר שלי', plan: 'owner', members: ownerMembers }, bookOf(null)),
          ...books.map((b) => withCost({ id: b.id, name: b.name, email: b.email, plan: b.plan, added: b.added, members: b.members }, bookOf(b.id))),
        ]);
        return reply(200, { month: m, price, rows });
      }
      if (url.pathname === '/admin/errors' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/errors'));
      return fail(404, 'Not found');
    }

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
      const { body, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      const recipe = manualRecipe(body);
      if (typeof recipe === 'string') return fail(400, recipe);
      if (!(await allCategories()).includes(body.category)) recipe.category = 'אחר';
      else recipe.category = body.category;
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
        if (source.kind === 'whatsapp' || source.text) text = textSource(source);
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
        recipe = await buildRecipe(env, ai(), { link, text, hint }, categories);
      } catch (e) {
        await giveBack();
        await recordError('extract', e);
        const f = failure(e, { isPhoto: isAddPhoto, owner: !user });
        return fail(f.status, f.error);
      }
      recipe.image = await storeImage(recipe.image);
      const res = await internal(book, 'POST', '/recipes', recipe);
      const data = await res.json();
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

    if (parts.length === 1 && request.method === 'GET') return pass(await internal(book, 'GET', '/recipes'));
    if (parts.length === 2 && request.method === 'GET') return pass(await internal(book, 'GET', `/recipes/${id}`));
    if (parts.length === 2 && request.method === 'DELETE') return pass(await internal(book, 'DELETE', `/recipes/${id}`));
    if (parts.length === 2 && request.method === 'PUT') {
      const { body: patch, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      if ('category' in patch && !(await allCategories()).includes(patch.category)) return fail(400, 'קטגוריה לא מוכרת');
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
  },
};

// עריכת מתכון: כל שדה בצורה הנכונה, כדי שעריכה פגומה לא תפיל את הספר (גם לבני המשפחה שחולקים אותו).
// מתקן את patch במקום ומחזיר הודעת שגיאה אם משהו לא תקין
function cleanPatch(patch) {
  const lengths = { description: 500, servings: 100, prepTime: 100, cookTime: 100, totalTime: 100, notes: 1000, myNotes: 5000 };
  if ('title' in patch) {
    if (typeof patch.title !== 'string' || !patch.title.trim()) return 'נא לכתוב שם למתכון';
    patch.title = patch.title.trim().slice(0, 150);
  }
  for (const [k, n] of Object.entries(lengths)) {
    if (!(k in patch)) continue;
    if (typeof patch[k] !== 'string') return 'עריכה לא תקינה';
    patch[k] = patch[k].slice(0, n);
  }
  for (const k of ['ingredients', 'steps']) {
    if (!(k in patch)) continue;
    if (!Array.isArray(patch[k]) || patch[k].some((x) => !x || !Array.isArray(x.items))) return 'עריכה לא תקינה';
    patch[k] = sections(patch[k]);
  }
  if ('tips' in patch) {
    if (!Array.isArray(patch.tips)) return 'עריכה לא תקינה';
    patch.tips = strList(patch.tips, 30);
  }
  if ('favorite' in patch) patch.favorite = patch.favorite === true;
  return null;
}

// תמונת מתכון: קישור, או תמונה מוקטנת (data URL) קטנה מספיק כדי להישמר בספר
function validImage(v) {
  if (v === null) return true;
  if (typeof v !== 'string') return false;
  if (/^https:\/\//.test(v)) return v.length < 2000;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_IMAGE_FIELD;
}

// תמונות של מתכון (דף מספר, פתק, צילום מסך): עד 4, base64
function photoSource(body) {
  const images = Array.isArray(body.images) ? body.images : [];
  if (!images.length || images.length > 4) return 'צריך בין תמונה אחת ל-4 תמונות';
  const clean = [];
  for (const img of images) {
    const type = String(img?.type || '');
    const data = String(img?.data || '');
    if (!/^image\/(jpeg|png|webp)$/.test(type) || !/^[A-Za-z0-9+/=]+$/.test(data)) return 'תמונה לא תקינה';
    clean.push({ type, data });
  }
  return {
    images: clean,
    kind: 'photo',
    key: `photo:${crypto.randomUUID()}`,
    hint: String(body.hint || '').trim().slice(0, 500),
    image: validImage(body.thumb) ? body.thumb : null,
  };
}

const strList = (a, max = 200) => (Array.isArray(a) ? a.map((x) => String(x || '').trim().slice(0, 500)).filter(Boolean).slice(0, max) : []);
const sections = (a) =>
  (Array.isArray(a) ? a : [])
    .map((x) => ({ title: String(x?.title || '').trim().slice(0, 100), items: strList(x?.items) }))
    .filter((x) => x.items.length)
    .slice(0, 20);

// מתכון שהמשתמש כתב בעצמו
function manualRecipe(body) {
  const title = String(body.title || '').trim().slice(0, 150);
  if (!title) return 'נא לכתוב שם למתכון';
  const ingredients = sections(body.ingredients);
  const steps = sections(body.steps);
  if (!ingredients.length && !steps.length) return 'נא לכתוב מצרכים או אופן הכנה';
  if (body.image != null && !validImage(body.image)) return 'תמונה לא תקינה';
  const str = (v, n = 100) => String(v || '').trim().slice(0, n);
  return {
    title,
    originalTitle: title,
    description: str(body.description, 500),
    category: CATEGORIES.includes(body.category) ? body.category : 'אחר',
    tags: strList(body.tags, 5),
    servings: str(body.servings),
    prepTime: str(body.prepTime),
    cookTime: str(body.cookTime),
    totalTime: str(body.totalTime),
    ingredients,
    steps,
    tips: strList(body.tips, 30),
    confidence: 'high',
    notes: '',
    source: { url: null, key: `manual:${crypto.randomUUID()}`, kind: 'manual' },
    image: body.image || null,
  };
}

// תכנון: מפתח לכל יום (YYYY-MM-DD), בכל יום עד 12 ארוחות (מתכון מהספר או הערה חופשית)
function cleanPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
  const days = Object.keys(plan).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-120);
  const out = {};
  for (const day of days) {
    if (!Array.isArray(plan[day])) return null;
    const meals = plan[day]
      .slice(0, 12)
      .map((m) => ({
        id: String(m?.id || crypto.randomUUID()).slice(0, 64),
        title: String(m?.title || '').trim().slice(0, 150),
        ...(m?.recipeId ? { recipeId: String(m.recipeId).slice(0, 64) } : {}),
        ...(m?.meal ? { meal: String(m.meal).slice(0, 30) } : {}),
      }))
      .filter((m) => m.title);
    if (meals.length) out[day] = meals;
  }
  return out;
}

// סרטון מוטמע רק מהאתרים שהאפליקציה עצמה יוצרת (לא כל אתר, כדי שגיבוי לא יוכל להטמיע דף מתחזה)
const EMBED_ORIGIN = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|www\.tiktok\.com\/embed\/|www\.instagram\.com\/(p|reel|tv)\/|player\.vimeo\.com\/video\/)/;

function textHash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// מתכון מקובץ גיבוי: רק השדות המוכרים, מקור תקין (קישור או מפתח), תמונה תקינה
function restoredRecipe(r, categories) {
  if (!r || typeof r !== 'object') return null;
  const title = String(r.title || '').trim().slice(0, 150);
  const ingredients = sections(r.ingredients);
  const steps = sections(r.steps);
  if (!title || (!ingredients.length && !steps.length)) return null;
  const src = r.source && typeof r.source === 'object' ? r.source : {};
  const url = typeof src.url === 'string' && /^https?:\/\//.test(src.url) ? normalizeUrl(src.url) : null;
  const key = !url && typeof src.key === 'string' && /^(wa|photo|manual):[\w:-]{1,80}$/.test(src.key) ? src.key : null;
  const str = (v, n = 150) => String(v ?? '').trim().slice(0, n);
  const source = {
    url,
    // בלי קישור ובלי מפתח: מפתח קבוע לפי השם, כדי ששחזור חוזר לא יכפיל
    ...(key ? { key } : url ? {} : { key: `manual:restored-${textHash(title)}` }),
    kind: /^[a-z]{2,20}$/.test(src.kind) ? src.kind : url ? sourceKind(url) : 'manual',
    ...['title', 'author', 'site', 'chat', 'date', 'hint'].reduce((o, k) => (src[k] ? { ...o, [k]: str(src[k]) } : o), {}),
    ...(typeof src.text === 'string' ? { text: src.text.slice(0, 20000) } : {}),
    ...(typeof src.embed === 'string' && EMBED_ORIGIN.test(src.embed) ? { embed: src.embed.slice(0, 500) } : {}),
  };
  return {
    title,
    originalTitle: str(r.originalTitle) || title,
    description: str(r.description, 500),
    category: categories.includes(r.category) ? r.category : 'אחר',
    tags: strList(r.tags, 15),
    servings: str(r.servings, 100),
    prepTime: str(r.prepTime, 100),
    cookTime: str(r.cookTime, 100),
    totalTime: str(r.totalTime, 100),
    ingredients,
    steps,
    tips: strList(r.tips, 30),
    confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'medium',
    notes: str(r.notes, 1000),
    myNotes: str(r.myNotes, 5000),
    favorite: Boolean(r.favorite),
    rating: Number.isInteger(r.rating) && r.rating >= 0 && r.rating <= 5 ? r.rating : 0,
    image: validImage(r.image ?? null) ? r.image ?? null : null,
    source,
    ...(typeof r.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(r.createdAt) ? { createdAt: r.createdAt } : {}),
  };
}

// רשימת קניות: [{id, text, checked, recipeId?, recipeTitle?, group?}]
function cleanShopping(items) {
  if (!Array.isArray(items) || items.length > 500) return null;
  return items
    .map((i) => ({
      id: String(i?.id || crypto.randomUUID()).slice(0, 64),
      text: String(i?.text || '').trim().slice(0, 300),
      checked: Boolean(i?.checked),
      ...(i?.recipeId ? { recipeId: String(i.recipeId).slice(0, 64), recipeTitle: String(i.recipeTitle || '').slice(0, 150) } : {}),
      ...(i?.group ? { group: String(i.group).slice(0, 60) } : {}),
    }))
    .filter((i) => i.text);
}

// יום בתכנון: תאריך אמיתי, עד 120 יום אחורה ושנה קדימה
function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== day) return false;
  return t > Date.now() - 120 * 86400000 && t < Date.now() + 366 * 86400000;
}

// שינויים ברמת פריט: כל פריט עובר את אותו ניקוי כמו ברשימה שלמה
function cleanOps(kind, ops) {
  if (!Array.isArray(ops) || ops.length > 500) return null;
  const out = [];
  for (const o of ops) {
    const id = String(o?.id || '').slice(0, 64);
    if (!id || !['add', 'update', 'remove'].includes(o?.op)) return null;
    if (o.op === 'remove') {
      out.push({ op: 'remove', id });
      continue;
    }
    let item;
    if (kind === 'shopping') item = cleanShopping([{ ...o.item, id }])?.[0];
    else if (kind === 'pantry') item = cleanPantry([{ ...o.item, id }])?.[0];
    else {
      const day = String(o.item?.day || '');
      const plan = validDay(day) ? cleanPlan({ [day]: [{ ...o.item, id }] }) : null;
      item = plan?.[day]?.[0] && { ...plan[day][0], day };
    }
    if (!item) continue; // פריט לא תקין (למשל טקסט ריק) מדולג, ושאר השינויים נשמרים
    out.push({ op: o.op, id, item });
  }
  return out;
}

// המלאי: [{id, name, qty?, place: fridge|pantry, addedAt}]
function cleanPantry(items) {
  if (!Array.isArray(items) || items.length > 400) return null;
  return items
    .map((i) => ({
      id: String(i?.id || crypto.randomUUID()).slice(0, 64),
      name: String(i?.name || '').trim().slice(0, 80),
      ...(i?.qty ? { qty: String(i.qty).trim().slice(0, 40) } : {}),
      place: i?.place === 'pantry' ? 'pantry' : 'fridge',
      addedAt: typeof i?.addedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(i.addedAt) ? i.addedAt.slice(0, 30) : new Date().toISOString(),
    }))
    .filter((i) => i.name);
}

function summarizeSource(src) {
  const cut = (t, n = 300) => String(t || '').slice(0, n);
  return {
    kind: src.kind,
    title: cut(src.title, 120),
    author: src.author,
    image: Boolean(src.image),
    description: cut(src.description, 600),
    descriptionLength: src.description.length,
    transcriptLength: src.transcript.length,
    textLength: src.text.length,
    recipes: src.recipes.map((r) => ({ name: r.name, ingredients: r.ingredients.length, steps: r.instructions.length })),
    comments: src.comments.length,
    creatorComments: src.comments.filter((c) => c.byCreator).length,
    firstComments: src.comments.slice(0, 5).map((c) => `${c.byCreator ? '[CREATOR] ' : ''}@${c.author}: ${cut(c.text, 200)}`),
    linked: src.linked.map((l) => ({ url: l.url, recipes: l.recipes.length, textLength: l.text.length })),
    warnings: src.warnings,
    debug: src.debug,
  };
}

// מתכון מטקסט: הודעה בווטסאפ (בלי קישור), או טקסט שהמשתמש העתיק מפוסט שלא הצלחנו לקרוא (עם הקישור)
function textSource(body) {
  const text = String(body.text || '').trim().slice(0, 20000);
  if (text.length < 20) return null;
  const str = (v) => String(v || '').trim().slice(0, 120);
  const url = body.url ? normalizeUrl(body.url) : null;
  const key = url ? null : /^wa:[\w-]{1,40}$/.test(body.key) ? body.key : `wa:${text.length}:${text.slice(0, 40)}`;
  return {
    fromText: true, kind: url ? sourceKind(url) : 'whatsapp', url, key, text,
    chat: str(body.chat), author: str(body.author), date: str(body.date),
  };
}

// אימות טוקן הכניסה של גוגל (Google Identity Services): חתום ע"י גוגל, לאפליקציה שלנו, עם אימייל מאומת
async function verifyGoogle(credential, clientId) {
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential)) return null;
  try {
    const res = await deps.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) return null;
    const t = await res.json();
    const valid = t.aud === clientId
      && ['accounts.google.com', 'https://accounts.google.com'].includes(t.iss)
      && String(t.email_verified) === 'true'
      && Number(t.exp) * 1000 > Date.now()
      && t.sub && t.email;
    return valid ? { sub: String(t.sub), email: String(t.email), name: String(t.name || t.given_name || '') } : null;
  } catch {
    return null;
  }
}

// השוואת סיסמה בלי לחשוף את האורך או את התווים לפי זמן התגובה
async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(async (t) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function bearer(request) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S{10,200})$/i);
  return m ? m[1] : '';
}

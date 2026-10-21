// השרת של mat-kon (Cloudflare Worker): מחזיק את מפתח ה-API של Anthropic ואת ספרי המתכונים.
// האפליקציה שולחת קישור, השרת קורא אותו (גם סרטונים), הסוכן מסדר מתכון בעברית עם קטגוריה,
// והמתכון נשמר בספר.
//
// שני סוגי שימוש:
//   - בעל האפליקציה: פתוח, בלי הרשמה ובלי הגבלה. ספר המתכונים "book" וניהול ההזמנות.
//   - משתמש שהוזמן (Authorization: Bearer <session>): נרשם מקישור הזמנה, מקבל ספר ריק משלו
//     (user:<id>), ו-FREE_RECIPES מתכונים בחינם. אחר כך צריך מנוי (plan=paid).
import { deps, trackedClient } from './deps.js';
import { buildRecipe, errorGroup, failure, recipeKind } from './jobs.js';
import { RecipeBook } from './store.js';
import { Accounts, canAdd } from './accounts.js';
import { gatherSource, normalizeUrl, sourceKind } from './source.js';
import { NoRecipeError, aiMessage, categoryFields, cleanNutrition, estimateNutrition, extractRecipe, moderateRecipe, ideasFromPantry, organizeShopping, scanPantry, searchRecipes, suggestCategories } from './extract.js';
import { findStores } from './stores.js';
import { CATEGORIES } from './categories.js';
import { backupStatus, restoreBook, runBackup } from './backup.js';
import { communityKey, publicCopy, publicSummary } from './community.js';
import { DIET_IDS } from './diet.js';
import { cleanShots, fixAction, fixConfigured, fixStatus, getShot, pruneShots, saveShots, sendFix } from './fixes.js';

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
  // אפליקציית הניהול (mat_kon/admin) – Cloudflare Pages נפרד; כל הנתונים בה מוגנים בכניסת בעלים
  if (allowed.includes(origin) || /^https:\/\/mat-kon-admin(-[a-z0-9]+)?\.pages\.dev$/.test(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// הרשמה בלי קישור הזמנה (OPEN_SIGNUP): "app" – רק מהאפליקציה לאנדרואיד (המקור שלה https://localhost),
// "all" – מכל מקום, אחרת סגור. מי שנרשם כך מקבל את המסלול החינמי (FREE_RECIPES)
const APP_ORIGIN = 'https://localhost';
function openSignupAllowed(request, env) {
  const mode = String(env.OPEN_SIGNUP || '');
  return mode === 'all' || (mode === 'app' && request.headers.get('origin') === APP_ORIGIN);
}

const internal = (stub, method, path, body) =>
  stub.fetch(new Request(`https://do${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));

export default {
  // גיבוי לילי ל-R2 (ראו backup.js ו-[triggers] ב-wrangler.toml). תקלה נרשמת במסך "עלויות ותקלות"
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pruneShots(env).catch((e) => console.error('fix shots', e)));
    ctx.waitUntil(runBackup(env).catch((e) => {
      console.error('backup', e);
      return internal(env.ACCOUNTS.get(env.ACCOUNTS.idFromName('accounts')), 'POST', '/errors/add', { where: 'backup', message: String(e?.message || e).slice(0, 300), user: 'owner' }).catch(() => {});
    }));
  },

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
    const country = request.headers.get('cf-ipcountry') || '';
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
        body.country = country;
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
      // הרשמה בלי קישור הזמנה: רק כשמותר, ועם מגבלה נוספת לכל כתובת
      const openSignup = parts[0] === 'register' && body.open === true && !body.token && !body.join;
      delete body.open;
      if (openSignup) {
        if (!openSignupAllowed(request, env)) return fail(403, 'כדי להירשם צריך קישור הזמנה');
        const limited = await rate([{ key: `open-ip:${ip}`, limit: 5, window: 3600 }], 'יותר מדי הרשמות. נסו שוב מאוחר יותר.');
        if (limited) return limited;
        body.open = true;
      }
      // הצטרפות חוזרת עם סיסמה היא ניסיון סיסמה – אותן מגבלות כמו בכניסה
      if (parts[0] === 'register' && body.join) {
        const email = String(body.email || '').trim().toLowerCase();
        const limited = await rate([
          { key: `login:${email}:${ip}`, limit: 10, window: 900 },
          { key: `login-all:${email}`, limit: 100, window: 3600 },
        ], 'יותר מדי ניסיונות כניסה. נסו שוב בעוד רבע שעה.');
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

    // ---- מתכון ששותף בקישור: תצוגה מקדימה (שם, תמונה, מי שיתף) לכל מי שיש לו את הקישור, בלי כניסה.
    // המתכון המלא ושמירה בספר – רק אחרי כניסה לאפליקציה (ככה מי שקיבל קישור מצטרף) ----
    const getShare = async (token, saved = false) => {
      if (!/^[\w-]{20,64}$/.test(token)) return null;
      const res = await internal(accounts, 'POST', '/shares/get', { token, saved });
      return res.ok ? (await res.json()).share : null;
    };
    if (parts[0] === 'shares' && parts.length === 2 && request.method === 'GET') {
      const limited = await rate([{ key: `share-view:${ip}`, limit: 120, window: 3600 }]);
      if (limited) return limited;
      const share = await getShare(parts[1]);
      if (!share) return fail(404, 'הקישור לא נמצא או שפג תוקפו');
      return reply(200, { preview: sharePreview(share) });
    }

    // ---- הספר של בעל האפליקציה: פתוח, או נעול (רק במכשירים שנכנסו עם סיסמת הבעלים / חשבון הגוגל שלו) ----
    const setting = (v) => (v && v !== 'none' ? String(v) : '');
    const googleClientId = setting(env.GOOGLE_CLIENT_ID);
    const ownerPassword = setting(env.OWNER_PASSWORD);
    const ownerEmail = setting(env.OWNER_EMAIL).trim().toLowerCase();
    // בלי סיסמת בעלים ובלי חשבון גוגל של בעלים הספר נשאר סגור (כשל סגור), אלא אם הוגדר במפורש OWNER_OPEN=true
    const ownerLocked = Boolean(ownerPassword || (ownerEmail && googleClientId)) || env.OWNER_OPEN !== 'true';
    if (url.pathname === '/auth-config' && request.method === 'GET') {
      return reply(200, {
        googleClientId, ownerLocked, ownerPassword: Boolean(ownerPassword),
        openSignup: openSignupAllowed(request, env), freeLimit: Number(env.FREE_RECIPES ?? 10),
      });
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
      if (!(await sameSecret(String(body.password || ''), ownerPassword))) {
        await internal(accounts, 'POST', '/admin/security/event', { type: 'ownerFail', detail: country });
        return fail(401, 'הסיסמה שגויה');
      }
      return pass(await internal(accounts, 'POST', '/owner-session', { device: body.device, country }));
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
      if (ownerEmail && profile.email.toLowerCase() === ownerEmail) return pass(await internal(accounts, 'POST', '/owner-session', { country }));
      // הרשמה בלי קישור הזמנה עם גוגל (רק כשמותר; משתמש קיים פשוט נכנס)
      const open = body.open === true && !body.token && !body.join && openSignupAllowed(request, env);
      return pass(await internal(accounts, 'POST', '/google', { ...profile, token: body.token || '', join: body.join || '', open }));
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
    // kind: סוג הפעולה – לפירוט העלויות באפליקציית הניהול
    const ai = (kind = 'other') => trackedClient(env, (u) => internal(bookFor(user), 'POST', '/costs/add', { month: month(), kind, ...u }).catch(() => {}));
    // תקלות נשמרות (50 אחרונות) כדי שבעל האפליקציה יראה אותן במסך הניהול
    const recordError = (where, e, group = '') => {
      console.error(where, e);
      return internal(accounts, 'POST', '/errors/add', {
        where, message: String(e?.message || e).slice(0, 300), status: e?.status || null, user: user?.email || (user ? user.id : 'owner'),
        ...(group ? { group } : {}),
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
        return reply(200, { results: await searchRecipes(ai('search'), q) });
      } catch (e) {
        return aiFail(e, (!e.status && e.message) || 'החיפוש נכשל');
      }
    }

    // עותק של מתכון (שנשלח בקישור / מהקהילה) נשמר בספר שלי: נספר כמו מתכון חדש, והתמונה מועתקת לספר
    const saveCopy = async (raw) => {
      const recipe = restoredRecipe(raw, await allCategories());
      if (!recipe) return { res: { ok: false, status: 400 }, data: { error: 'המתכון לא תקין' } };
      const counts = Boolean(user);
      if (counts) {
        const taken = await internal(accounts, 'POST', '/quota/take', { userId: user.id });
        if (!taken.ok) return { res: { ok: false, status: 402 }, data: { error: `נגמרו ${user.freeLimit} המתכונים החינמיים`, paywall: true, paymentUrl: env.PAYMENT_URL || '' } };
      }
      recipe.image = await copyImage(recipe.image, {
        origin: url.origin, bookKey: bookKeyOf(user), source: (k) => bookOf(k === 'book' ? null : k), target: bookStub(),
      });
      const res = await internal(bookStub(), 'POST', '/recipes', recipe);
      const data = await res.json();
      if (counts) {
        if (!res.ok || !data.counted) await internal(accounts, 'POST', '/quota/give', { userId: user.id });
        const fresh = await internal(accounts, 'POST', '/auth', { session });
        data.user = fresh.ok ? (await fresh.json()).user : undefined;
      }
      delete data.counted;
      return { res, data };
    };

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

    // ---- ניהול: עלויות ותקלות (רק בעל האפליקציה) ----
    if (parts[0] === 'admin') {
      if (user) return fail(403, 'רק לבעל האפליקציה');
      // עלויות AI לחודש, לכל ספר
      const price = { in: Number(env.AI_PRICE_IN || 5), out: Number(env.AI_PRICE_OUT || 25), search: Number(env.AI_PRICE_SEARCH || 0.01) };
      const usage = async (m) => {
        const { books, ownerMembers } = await (await internal(accounts, 'GET', '/books')).json();
        const withCost = async (row, stub) => {
          const c = await (await internal(stub, 'GET', `/costs/${m}`)).json();
          const usd = (c.input * price.in + c.output * price.out) / 1e6 + c.searches * price.search;
          return { ...row, ...c, usd: Math.round(usd * 100) / 100 };
        };
        return Promise.all([
          withCost({ id: 'owner', name: 'הספר שלי', plan: 'owner', members: ownerMembers }, bookOf(null)),
          ...books.map((b) => withCost({ id: b.id, name: b.name, email: b.email, plan: b.plan, added: b.added, members: b.members }, bookOf(b.id))),
        ]);
      };
      if (url.pathname === '/admin/usage' && request.method === 'GET') {
        const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : month();
        return reply(200, { month: m, price, rows: await usage(m) });
      }
      // ---- אפליקציית הניהול: סקירה אחת של הכול ----
      if (url.pathname === '/admin/overview' && request.method === 'GET') {
        const now = new Date();
        const months = [0, 1, 2].map((i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
        const [stats, costs, community, backups, issues, settings, reports] = await Promise.all([
          internal(accounts, 'GET', '/admin/stats').then((r) => r.json()),
          Promise.all(months.map(async (m) => {
            const rows = await usage(m);
            const usd = Math.round(rows.reduce((n, r) => n + r.usd, 0) * 100) / 100;
            // לפי סוג פעולה, מכל הספרים: כמה פעמים, כמה עלה בסך הכול, ובממוצע לפעולה
            const kinds = {};
            for (const r of rows) {
              for (const [k, v] of Object.entries(r.byKind || {})) {
                const t = kinds[k] || (kinds[k] = { kind: k, ops: 0, usd: 0, searches: 0 });
                t.ops += v.ops;
                t.searches += v.searches;
                t.usd += (v.input * price.in + v.output * price.out) / 1e6 + v.searches * price.search;
              }
            }
            const byKind = Object.values(kinds).map((t) => ({ ...t, usd: Math.round(t.usd * 100) / 100, avg: t.ops ? Math.round((t.usd / t.ops) * 1000) / 1000 : null })).sort((a, b) => b.usd - a.usd);
            return { month: m, usd, byKind, top: rows.filter((r) => r.usd > 0).sort((a, b) => b.usd - a.usd).slice(0, 5).map((r) => ({ name: r.name, email: r.email, usd: r.usd })) };
          })),
          internal(env.BOOK.get(env.BOOK.idFromName('community')), 'POST', '/community/stats', {}).then((r) => r.json()),
          backupStatus(env).catch(() => null),
          internal(accounts, 'GET', '/admin/issues').then((r) => r.json()),
          internal(accounts, 'GET', '/admin/settings').then((r) => r.json()),
          internal(env.BOOK.get(env.BOOK.idFromName('community')), 'POST', '/community/reports', {}).then((r) => r.json()),
        ]);
        const open = issues.issues.filter((i) => i.status !== 'fixed');
        const alerts = [];
        const spend = settings.settings.spendAlert;
        if (spend && costs[0].usd >= spend) alerts.push({ level: 'serious', text: `ההוצאה על AI החודש ($${costs[0].usd}) עברה את הסף שקבעת ($${spend})` });
        if (open.some((i) => i.status === 'new')) alerts.push({ level: 'warning', text: `${open.filter((i) => i.status === 'new').length} תקלות חדשות שעוד לא טופלו` });
        const hidden = reports.items.filter((r) => r.hidden).length;
        if (reports.items.length) alerts.push({ level: hidden ? 'serious' : 'warning', text: `${reports.items.length} מתכונים בקהילה מחכים לבדיקה שלך${hidden ? ` (${hidden} מוסתרים אחרי דיווחים)` : ''}` });
                if (stats.today >= 50) alerts.push({ level: 'warning', text: `${stats.today} הרשמות היום – הרבה יותר מהרגיל` });
        const lastBackup = backups?.days?.at(-1);
        if (backups?.enabled && (!lastBackup || Date.now() - Date.parse(`${lastBackup}T00:00:00Z`) > 2 * 86400000)) alerts.push({ level: 'serious', text: 'הגיבוי הלילי לא רץ ביומיים האחרונים' });
        return reply(200, {
          stats, costs, community, backups: backups?.enabled ? { last: lastBackup || null, count: backups.days.length, ok: Boolean(backups.last) } : null,
          issues: { open: open.length, new: open.filter((i) => i.status === 'new').length, fixed: issues.issues.length - open.length },
          settings: settings.settings, alerts, reports: { pending: reports.items.length, hidden },
        });
      }
      if (url.pathname === '/admin/issues' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/issues'));
      if (parts[1] === 'issues' && parts.length === 3 && request.method === 'POST') {
        const { body, error } = await readJson();
        if (error) return error;
        return pass(await internal(accounts, 'POST', '/admin/issues/update', { sig: parts[2], status: body.status, note: body.note }));
      }
      // "שלח ל-Claude לטיפול": התקלה נפתחת ב-GitHub (בלי פרטי משתמשים) ו-Claude מכין תיקון לאישור
      if (parts[1] === 'issues' && parts.length === 4 && parts[3] === 'fix' && request.method === 'POST') {
        if (!fixConfigured(env)) return fail(503, 'השליחה ל-Claude לא מוגדרת בשרת');
        const { body, error } = await readJson(MAX_PHOTO_BYTES);
        if (error) return error;
        const shots = cleanShots(body.images);
        if (shots.length && !env.BACKUPS) return fail(503, 'שמירת צילומי מסך לא מוגדרת בשרת');
        const { issues } = await (await internal(accounts, 'GET', '/admin/issues')).json();
        const issue = issues.find((i) => i.sig === parts[2]);
        if (!issue) return fail(404, 'התקלה לא נמצאה');
        if (issue.fix) {
          const current = await fixStatus(env, issue.fix).catch(() => null);
          if (current && !['done', 'rejected', 'closed'].includes(current.status)) return fail(409, 'Claude כבר מטפל בתקלה הזו');
        }
        let number;
        try {
          number = await sendFix(env, issue, typeof body.note === 'string' ? body.note : '', await saveShots(env, shots));
        } catch (e) {
          return fail(502, `לא הצלחתי לשלוח ל-Claude (${e.message})`);
        }
        return pass(await internal(accounts, 'POST', '/admin/issues/update', { sig: issue.sig, status: 'working', fix: number }));
      }
      // צילום מסך שצורף לבקשה ל-Claude (רק לבעלים – התהליך ב-GitHub נכנס עם סיסמת הבעלים)
      if (parts[1] === 'fix-shot' && parts.length === 3 && request.method === 'GET') {
        const obj = await getShot(env, parts[2]);
        if (!obj) return fail(404, 'הצילום לא נמצא');
        return new Response(await obj.arrayBuffer(), { headers: { ...cors, 'content-type': 'image/jpeg', 'cache-control': 'private, no-store' } });
      }
      if (parts[1] === 'fix' && /^\d+$/.test(parts[2] || '') && fixConfigured(env)) {
        const number = Number(parts[2]);
        // רק בקשות ששלחנו מתקלה (לא כל issue במאגר)
        const { issues } = await (await internal(accounts, 'GET', '/admin/issues')).json();
        const issue = issues.find((i) => i.fix === number);
        if (!issue) return fail(404, 'הבקשה לא נמצאה');
        try {
          if (parts.length === 3 && request.method === 'GET') return reply(200, await fixStatus(env, number));
          const action = parts.length === 4 && request.method === 'POST' && ['approve', 'reject', 'retry', 'reply'].includes(parts[3]) ? parts[3] : '';
          if (!action) return fail(404, 'Not found');
          const { body, error } = await readJson(action === 'reply' ? MAX_PHOTO_BYTES : MAX_SMALL_BYTES);
          if (error) return error;
          const shots = action === 'reply' ? cleanShots(body.images) : [];
          if (shots.length && !env.BACKUPS) return fail(503, 'שמירת צילומי מסך לא מוגדרת בשרת');
          const out = await fixAction(env, number, action, body.text, await saveShots(env, shots));
          if (out.status === 200 && action === 'approve') await internal(accounts, 'POST', '/admin/issues/update', { sig: issue.sig, status: 'fixed' });
          if (out.status === 200 && action === 'reject') await internal(accounts, 'POST', '/admin/issues/update', { sig: issue.sig, status: 'new', fix: null });
          return reply(out.status, out.data);
        } catch (e) {
          return fail(502, `שגיאה מול GitHub (${e.message})`);
        }
      }
      if (url.pathname === '/admin/security' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/security'));
      // תכונות למשתמש מסוים (ניקוד ביס בדף המתכון)
      if (url.pathname === '/admin/features' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/users/features'));
      if (url.pathname === '/admin/features' && request.method === 'POST') {
        const { body, error } = await readJson();
        if (error) return error;
        return pass(await internal(accounts, 'POST', '/users/feature', { email: String(body.email || '').slice(0, 200), feature: body.feature, on: Boolean(body.on) }));
      }
      // התראות לטלפון של בעל האפליקציה
      if (parts[1] === 'push' && parts.length === 3) {
        if (parts[2] === 'key' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/push/key'));
        if (parts[2] === 'status' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/push/status'));
        if (parts[2] === 'test' && request.method === 'POST') return pass(await internal(accounts, 'POST', '/admin/push/test', {}));
        if (parts[2] === 'subscribe' && request.method === 'POST') {
          const { body, error } = await readJson();
          if (error) return error;
          return pass(await internal(accounts, 'POST', '/admin/push/subscribe', { subscription: body.subscription }));
        }
      }
      // דיווחים ומתכונים שבדיקת ה-AI לא הייתה בטוחה לגביהם: אישור / הסרה / חסימת המפרסם
      const community = env.BOOK.get(env.BOOK.idFromName('community'));
      if (url.pathname === '/admin/reports' && request.method === 'GET') return pass(await internal(community, 'POST', '/community/reports', {}));
      if (parts[1] === 'reports' && parts.length === 3 && request.method === 'POST') {
        const { body, error } = await readJson();
        if (error) return error;
        if (body.action === 'view') return pass(await internal(community, 'POST', '/community/get', { key: parts[2], admin: true }));
        const res = await internal(community, 'POST', '/community/moderate', { key: parts[2], action: body.action === 'approve' ? 'approve' : 'remove' });
        const data = await res.json();
        if (res.ok && body.action === 'block' && data.authorId && data.authorId !== 'owner') {
          await internal(accounts, 'POST', '/admin/block', { userId: data.authorId });
          await internal(community, 'POST', '/community/remove-author', { authorId: data.authorId });
        }
        return reply(res.status, data);
      }
      if (url.pathname === '/admin/settings' && request.method === 'PUT') {
        const { body, error } = await readJson();
        if (error) return error;
        return pass(await internal(accounts, 'POST', '/admin/settings', { spendAlert: body.spendAlert }));
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
        recipe = await buildRecipe(env, ai(recipeKind({ link, text })), { link, text, hint }, categories);
      } catch (e) {
        await giveBack();
        await recordError('extract', e, link ? errorGroup(link, e) : '');
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
      const image = typeof recipe.image === 'string' && /^https:\/\//.test(recipe.image) ? recipe.image : null;
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
    ...categoryFields(Array.isArray(body.categories) ? body.categories : [body.category]),
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
  const key = !url && typeof src.key === 'string' && /^(wa|photo|manual|community):[\w:-]{1,80}$/.test(src.key) ? src.key : null;
  const str = (v, n = 150) => String(v ?? '').trim().slice(0, n);
  const source = {
    url,
    // בלי קישור ובלי מפתח: מפתח קבוע לפי השם, כדי ששחזור חוזר לא יכפיל
    ...(key ? { key } : url ? {} : { key: `manual:restored-${textHash(title)}` }),
    kind: /^[a-z]{2,20}$/.test(src.kind) ? src.kind : url ? sourceKind(url) : 'manual',
    ...['title', 'author', 'site', 'chat', 'date', 'hint'].reduce((o, k) => (src[k] ? { ...o, [k]: str(src[k]) } : o), {}),
    ...((url || key?.startsWith('community:')) && typeof src.identity === 'string' && /^[a-z]+:.{3,600}$/.test(src.identity) ? { identity: src.identity } : {}),
    ...(typeof src.text === 'string' ? { text: src.text.slice(0, 20000) } : {}),
    ...(typeof src.embed === 'string' && EMBED_ORIGIN.test(src.embed) ? { embed: src.embed.slice(0, 500) } : {}),
  };
  return {
    title,
    originalTitle: str(r.originalTitle) || title,
    description: str(r.description, 500),
    ...categoryFields(Array.isArray(r.categories) ? [r.category, ...r.categories] : [r.category], categories),
    tags: strList(r.tags, 15),
    servings: str(r.servings, 100),
    prepTime: str(r.prepTime, 100),
    cookTime: str(r.cookTime, 100),
    totalTime: str(r.totalTime, 100),
    ingredients,
    steps,
    tips: strList(r.tips, 30),
    nutrition: cleanNutrition(r.nutrition),
    ...(['source', 'completed', 'guessed'].includes(r.basis) ? { basis: r.basis } : {}),
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

// מתכון לשיתוף: מה שצריך כדי לבשל, בלי מה שאישי (הערות שלי, דירוג, מועדף) ובלי טקסט המקור
// (הודעת ווטסאפ יכולה לכלול שמות ושיחה פרטית). מתכון בלי קישור נשמר אצל המקבל כמתכון "שנכתב ידנית"
function sharedCopy(raw, categories) {
  const r = restoredRecipe(raw, categories);
  if (!r) return null;
  delete r.myNotes;
  delete r.favorite;
  delete r.rating;
  delete r.createdAt;
  const src = r.source;
  r.source = src.url
    ? { url: src.url, kind: src.kind, ...['title', 'author', 'site', 'embed'].reduce((o, k) => (src[k] ? { ...o, [k]: src[k] } : o), {}) }
    : { url: null, key: src.key, kind: src.kind === 'photo' ? 'photo' : 'manual' };
  return r;
}

// תצוגה מקדימה של מתכון ששותף (בלי מצרכים ושלבים – אותם רואים באפליקציה)
function sharePreview(share) {
  const r = share.recipe || {};
  const count = (list) => (Array.isArray(list) ? list.reduce((n, s) => n + (Array.isArray(s?.items) ? s.items.length : 0), 0) : 0);
  return {
    title: String(r.title || ''),
    description: String(r.description || '').slice(0, 300),
    image: typeof r.image === 'string' && /^https:\/\//.test(r.image) ? r.image : null,
    category: String(r.category || ''),
    servings: String(r.servings || ''),
    time: String(r.totalTime || r.cookTime || r.prepTime || ''),
    ingredients: count(r.ingredients),
    steps: count(r.steps),
    by: share.by || '',
  };
}

// תמונה של מתכון ששותף: עותק בספר של המקבל (כדי שלא תיעלם אם מי ששיתף ימחק את המתכון)
async function copyImage(image, { origin, bookKey, source, target }) {
  const m = typeof image === 'string' && image.startsWith(`${origin}/img/`) && image.slice(origin.length).match(/^\/img\/(book|[0-9a-f-]{36})\/([0-9a-f-]{36})$/);
  if (!m) return image ?? null; // תמונה מאתר אחר נשארת קישור
  if (m[1] === bookKey) return image; // אותו ספר – אותה תמונה
  const res = await internal(source(m[1]), 'GET', `/img/${m[2]}`);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const saved = await internal(target, 'POST', '/img', { type, data: btoa(bin) });
  return saved.ok ? `${origin}/img/${bookKey}/${(await saved.json()).id}` : null;
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

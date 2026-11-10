// ההקשר של בקשה אחת לשרת (ctx): מה שכל הכתובות צריכות – תשובות, קריאת גוף הבקשה, הגבלת קצב, הספר של המשתמש,
// הגדרות הכניסה, ואחרי הזיהוי גם המשתמש עצמו, תקציב ה-AI, רישום תקלות והקטגוריות.
import { trackedClient } from './deps.js';
import { aiMessage } from './extract.js';
import { CATEGORIES } from './categories.js';
import { MAX_SMALL_BYTES, corsHeaders, internal } from './lib/http.js';
import { restoredRecipe, copyImage } from './lib/recipe-input.js';

// לפני הזיהוי: הכלים הבסיסיים של הבקשה
export function createContext(request, env) {
  const cors = corsHeaders(request, env);
  const reply = (status, data) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
  const fail = (status, message, extra = {}) => reply(status, { error: message, ...extra });
  const pass = async (res) => reply(res.status, await res.json());

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

  // הגבלת קצב לפי כתובת (ולפי אימייל בכניסה), נבדקת ונספרת באותו צעד
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const country = request.headers.get('cf-ipcountry') || '';
  const rate = async (checks, message, trust) => {
    const res = await internal(accounts, 'POST', '/rate', { checks, message, trust });
    return res.ok ? null : pass(res);
  };

  // ---- מתכון ששותף בקישור: תצוגה מקדימה (שם, תמונה, מי שיתף) לכל מי שיש לו את הקישור, בלי כניסה.
  // המתכון המלא ושמירה בספר – רק אחרי כניסה לאפליקציה (ככה מי שקיבל קישור מצטרף) ----
  const getShare = async (token, saved = false) => {
    if (!/^[\w-]{20,64}$/.test(token)) return null;
    const res = await internal(accounts, 'POST', '/shares/get', { token, saved });
    return res.ok ? (await res.json()).share : null;
  };

  // ---- הספר של בעל האפליקציה: פתוח, או נעול (רק במכשירים שנכנסו עם סיסמת הבעלים / חשבון הגוגל שלו) ----
  const setting = (v) => (v && v !== 'none' ? String(v) : '');
  const googleClientId = setting(env.GOOGLE_CLIENT_ID);
  const ownerPassword = setting(env.OWNER_PASSWORD);
  const ownerEmail = setting(env.OWNER_EMAIL).trim().toLowerCase();
  // בלי סיסמת בעלים ובלי חשבון גוגל של בעלים הספר נשאר סגור (כשל סגור), אלא אם הוגדר במפורש OWNER_OPEN=true
  const ownerLocked = Boolean(ownerPassword || (ownerEmail && googleClientId)) || env.OWNER_OPEN !== 'true';
  return { request, env, cors, reply, fail, pass, url, parts, accounts, bookOf, bookKeyOf, bookFor, readJson, ip, country, rate, getShare, setting, googleClientId, ownerPassword, ownerEmail, ownerLocked };
}

// אחרי הזיהוי: המשתמש (null = בעל האפליקציה), והכלים שתלויים בו
export function withUser(ctx, { user, signedIn, session }) {
  const { env, fail, url, accounts, bookOf, bookKeyOf, bookFor } = ctx;
  // תקציב יומי לפעולות AI (כל ספר בנפרד), כדי שאף משתמש לא יוכל לשרוף את הקרדיט
  const aiBudget = async (cost = 1) => {
    const limit = !user ? Number(env.AI_DAILY_OWNER || 300)
      : user.plan === 'paid' ? Number(env.AI_DAILY_PAID || 100) : Number(env.AI_DAILY_FREE || 25);
    // תקרת הוצאה יומית של כל האפליקציה (הגנה מפני ניצול): עוצרת משתמשים, לא את בעל האפליקציה
    if (user) {
      const spend = await (await internal(accounts, 'POST', '/spend/check', {})).json().catch(() => ({}));
      if (spend.stopped) return fail(503, 'יש עומס חריג היום, והפעולות החכמות נעצרו זמנית. נסו שוב מחר.');
    }
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


  // הקטגוריות של הספר: הקבועות ואלה שהמשתמש הוסיף
  const bookStub = () => bookFor(user);
  const customCategories = async () => (await (await internal(bookStub(), 'GET', '/categories')).json()).custom || [];
  const allCategories = async () => [...CATEGORIES, ...(await customCategories())];

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
  return Object.assign(ctx, { user, signedIn, session, aiBudget, month, ai, recordError, aiFail, bookStub, customCategories, allCategories, saveCopy });
}

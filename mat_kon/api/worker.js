// השרת של mat-kon (Cloudflare Worker): מחזיק את מפתח ה-API של Anthropic ואת ספרי המתכונים.
// האפליקציה שולחת קישור, השרת קורא אותו (גם סרטונים), הסוכן מסדר מתכון בעברית עם קטגוריה,
// והמתכון נשמר בספר.
//
// שני סוגי שימוש:
//   - בעל האפליקציה: פתוח, בלי הרשמה ובלי הגבלה. ספר המתכונים "book" וניהול ההזמנות.
//   - משתמש שהוזמן (Authorization: Bearer <session>): נרשם מקישור הזמנה, מקבל ספר ריק משלו
//     (user:<id>), ו-FREE_RECIPES מתכונים בחינם. אחר כך צריך מנוי (plan=paid).
import Anthropic from '@anthropic-ai/sdk';
import { RecipeBook } from './store.js';
import { Accounts, canAdd } from './accounts.js';
import { gatherSource, normalizeUrl, sourceKind } from './source.js';
import { NoRecipeError, extractRecipe, organizeShopping } from './extract.js';
import { CATEGORIES } from './categories.js';

export { RecipeBook, Accounts };

// נקודות הזרקה לבדיקות
export const deps = {
  anthropic: (env) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
  fetch: (...args) => fetch(...args),
};

const MAX_EDIT_BYTES = 200 * 1024;
const MAX_SMALL_BYTES = 4000;
const MAX_TEXT_BYTES = 30000;
const MAX_PHOTO_BYTES = 9 * 1024 * 1024; // עד 4 תמונות מוקטנות
const MAX_IMAGE_FIELD = 160 * 1024; // תמונת מתכון שנשמרת בספר (מוקטנת בדפדפן)

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
    if (request.method === 'POST' && ['invite', 'register', 'login', 'logout'].includes(parts[0]) && parts.length === 1) {
      const { body, error } = await readJson();
      if (error) return error;
      if (parts[0] === 'logout') body.session = bearer(request);
      return pass(await internal(accounts, 'POST', parts[0] === 'invite' ? '/invite/check' : `/${parts[0]}`, body));
    }

    // ---- מי שולח: בעל האפליקציה (בלי טוקן) או משתמש שהוזמן ----
    let user = null;
    const session = bearer(request);
    if (session) {
      const res = await internal(accounts, 'POST', '/auth', { session });
      if (!res.ok) return pass(res);
      user = (await res.json()).user;
    }

    // בדיקה: מה השרת מצליח לקרוא מקישור (בלי AI). משמש את .github/workflows/mat-kon-probe.yml
    if (url.pathname === '/debug/source' && request.method === 'GET') {
      const link = normalizeUrl(url.searchParams.get('url'));
      if (!link) return fail(400, 'זה לא נראה כמו קישור תקין');
      return reply(200, summarizeSource(await gatherSource(link, deps.fetch, { igDocId: env.IG_DOC_ID })));
    }

    if (url.pathname === '/me') {
      return reply(200, { owner: !user, user, categories: CATEGORIES, paymentUrl: env.PAYMENT_URL || '' });
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
      const book = bookOf(user?.id);
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

    // ---- רשימת קניות ----
    if (parts[0] === 'shopping') {
      const book = bookOf(user?.id);
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
        try {
          return reply(200, { groups: await organizeShopping(deps.anthropic(env), items) });
        } catch (e) {
          return fail(502, e.message || 'לא הצלחתי לסדר את הרשימה');
        }
      }
      return fail(405, 'Method not allowed');
    }

    // ---- ספר המתכונים ----
    if (parts[0] !== 'recipes' || parts.length > 3) return fail(404, 'Not found');
    const id = parts[1];
    if (id && !/^[\w-]{1,64}$/.test(id)) return fail(404, 'Not found');
    const book = bookOf(user?.id);

    // מתכון שנכתב ידנית: בלי AI ובלי מכסה
    if (request.method === 'POST' && parts.length === 2 && id === 'manual') {
      const { body, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      const recipe = manualRecipe(body);
      if (typeof recipe === 'string') return fail(400, recipe);
      return pass(await internal(book, 'POST', '/recipes', recipe));
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
      if (isAdd) {
        if (!canAdd(user)) {
          return fail(402, `נגמרו ${user.freeLimit} המתכונים החינמיים`, { paywall: true, paymentUrl: env.PAYMENT_URL || '' });
        }
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
        const { source } = (await res.json()).recipe;
        if (source.kind === 'photo' || source.kind === 'manual') return fail(400, 'למתכון הזה אין מקור לקרוא ממנו שוב');
        // מתכון מהודעת ווטסאפ או מטקסט שהודבק – נבנה שוב מאותו טקסט
        if (source.kind === 'whatsapp' || source.text) text = textSource(source);
        else {
          link = source.url;
          hint = source.hint || '';
        }
      }
      let recipe;
      try {
        const src = text || (await gatherSource(link, deps.fetch, { hint, igDocId: env.IG_DOC_ID }));
        recipe = await extractRecipe(deps.anthropic(env), src);
      } catch (e) {
        if (e instanceof NoRecipeError) return fail(422, e.message);
        console.error('extract failed', link || text.key, e);
        if (e.status === 400 && isAddPhoto) return fail(400, 'לא הצלחתי לקרוא את התמונות. נסו תמונה ברורה יותר.');
        return fail(502, `לא הצלחתי להוציא מתכון: ${e.message || e}`);
      }
      const res = await internal(book, 'POST', '/recipes', recipe);
      const data = await res.json();
      // רק מתכון חדש נספר במכסה (לא רענון ולא קישור שכבר נשמר)
      if (res.ok && user && isAdd && !data.updated) {
        data.user = (await (await internal(accounts, 'POST', '/count', { userId: user.id })).json()).user;
      }
      return reply(res.status, data);
    }

    if (parts.length === 1 && request.method === 'GET') return pass(await internal(book, 'GET', '/recipes'));
    if (parts.length === 2 && request.method === 'GET') return pass(await internal(book, 'GET', `/recipes/${id}`));
    if (parts.length === 2 && request.method === 'DELETE') return pass(await internal(book, 'DELETE', `/recipes/${id}`));
    if (parts.length === 2 && request.method === 'PUT') {
      const { body: patch, error } = await readJson(MAX_EDIT_BYTES);
      if (error) return error;
      if ('category' in patch && !CATEGORIES.includes(patch.category)) return fail(400, 'קטגוריה לא מוכרת');
      if ('image' in patch && !validImage(patch.image)) return fail(400, 'תמונה לא תקינה');
      return pass(await internal(book, 'PUT', `/recipes/${id}`, patch));
    }
    return fail(405, 'Method not allowed');
  },
};

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

function bearer(request) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S{10,200})$/i);
  return m ? m[1] : '';
}

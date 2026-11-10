// בדיקה וניקוי של מה שהאפליקציה שולחת לשרת: עריכת מתכון, תמונות, מתכון ידני, תכנון, רשימות, גיבוי ושיתוף.
// פונקציות טהורות (בלי גישה לשרת), חוץ מ-copyImage שמעתיקה תמונה בין ספרים.
import { normalizeUrl, sourceKind } from '../source.js';
import { categoryFields, cleanNutrition } from '../extract.js';
import { MAX_IMAGE_FIELD, internal } from './http.js';

// עריכת מתכון: כל שדה בצורה הנכונה, כדי שעריכה פגומה לא תפיל את הספר (גם לבני המשפחה שחולקים אותו).
// מתקן את patch במקום ומחזיר הודעת שגיאה אם משהו לא תקין
export function cleanPatch(patch) {
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
export function validImage(v) {
  if (v === null) return true;
  if (typeof v !== 'string') return false;
  if (/^https:\/\//.test(v)) return v.length < 2000;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_IMAGE_FIELD;
}

// תמונות של מתכון (דף מספר, פתק, צילום מסך): עד 4, base64
export function photoSource(body) {
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

export const strList = (a, max = 200) => (Array.isArray(a) ? a.map((x) => String(x || '').trim().slice(0, 500)).filter(Boolean).slice(0, max) : []);
export const sections = (a) =>
  (Array.isArray(a) ? a : [])
    .map((x) => ({ title: String(x?.title || '').trim().slice(0, 100), items: strList(x?.items) }))
    .filter((x) => x.items.length)
    .slice(0, 20);

// מתכון שהמשתמש כתב בעצמו
export function manualRecipe(body) {
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
export function cleanPlan(plan) {
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
export const EMBED_ORIGIN = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|www\.tiktok\.com\/embed\/|www\.instagram\.com\/(p|reel|tv)\/|player\.vimeo\.com\/video\/)/;

export function textHash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// מתכון מקובץ גיבוי: רק השדות המוכרים, מקור תקין (קישור או מפתח), תמונה תקינה
export function restoredRecipe(r, categories) {
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
export function sharedCopy(raw, categories) {
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
export function sharePreview(share) {
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
export async function copyImage(image, { origin, bookKey, source, target }) {
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
export function cleanShopping(items) {
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
export function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== day) return false;
  return t > Date.now() - 120 * 86400000 && t < Date.now() + 366 * 86400000;
}

// שינויים ברמת פריט: כל פריט עובר את אותו ניקוי כמו ברשימה שלמה
export function cleanOps(kind, ops) {
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
export function cleanPantry(items) {
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

export function summarizeSource(src) {
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
export function textSource(body) {
  const text = String(body.text || '').trim().slice(0, 20000);
  if (text.length < 20) return null;
  const str = (v) => String(v || '').trim().slice(0, 120);
  const url = body.url ? normalizeUrl(body.url) : null;
  // מסמך שהמשתמש העלה (Word, PDF, טקסט) – "מתוך קובץ"; chat הוא שם הקובץ
  const file = !url && (body.file === true || body.kind === 'file');
  // מתכון שהוקרא בקול (הטלפון כתב אותו) – "מתוך הקלטה"
  const voice = !url && !file && (body.voice === true || body.kind === 'voice');
  const prefix = file ? 'file' : voice ? 'voice' : 'wa';
  const key = url ? null : /^(wa|file|voice):[\w-]{1,40}$/.test(body.key) ? body.key : `${prefix}:${text.length}:${text.slice(0, 40)}`;
  return {
    fromText: true, kind: url ? sourceKind(url) : file ? 'file' : voice ? 'voice' : 'whatsapp', url, key, text,
    chat: str(body.chat), author: str(body.author), date: str(body.date),
  };
}

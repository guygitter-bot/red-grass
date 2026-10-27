// בניית מתכון ממקור (קישור / טקסט / תמונות): משותף לבקשה רגילה ולעבודה ברקע (Durable Object alarm)
import { gatherSource, isVideoKind, sourceIdentity, sourceKind } from './source.js';
import { NoRecipeError, aiMessage, categoryFields, extractRecipe } from './extract.js';
import { deps } from './deps.js';

// מתכון מקישור נשמר במטמון משותף (מופע אחד של RecipeBook בשם recipe-cache): אותו קישור – אותו מתכון אצל כל
// המשתמשים, גם כשהסוכן השלים או העריך משהו. נבדק לפי הקישור שנשלח, ואחרי הקריאה – לפי זהות המקור
const cacheOf = (env) => env.BOOK?.get(env.BOOK.idFromName('recipe-cache'));
// v2: מתכונים שנשמרו לפני שסומן אם הם משוערים (basis) לא נלקחים מהמטמון
const cacheKey = async (k) => 'v2:' + btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k)))));
async function cacheCall(env, path, body) {
  const stub = cacheOf(env);
  if (!stub) return null;
  try {
    const res = await stub.fetch(new Request(`https://do${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return res.ok ? res.json() : null;
  } catch {
    return null; // המטמון רק חוסך – תקלה בו לא עוצרת הוספת מתכון
  }
}
const cacheGet = async (env, keys) => (await cacheCall(env, '/cache/get', { keys: await Promise.all(keys.map(cacheKey)) }))?.recipe || null;
const cachePut = async (env, keys, recipe) => cacheCall(env, '/cache/put', { keys: await Promise.all(keys.map(cacheKey)), recipe });

// מתכון מהמטמון: הקטגוריות לפי הספר של המשתמש, וההערה שלו למקור (אם כתב)
function fromCache(recipe, categories, hint) {
  const copy = structuredClone(recipe);
  return {
    ...copy,
    ...categoryFields(copy.categories || [copy.category], categories),
    source: { ...copy.source, ...(hint ? { hint } : {}) },
    more: [],
  };
}

// סוג הפעולה למעקב עלויות: סרטון / אתר / צילום / טקסט
export function recipeKind({ link, text } = {}) {
  if (text) return text.images ? 'recipe-photo' : 'recipe-text';
  try {
    return isVideoKind(sourceKind(link)) ? 'recipe-video' : 'recipe-link';
  } catch {
    return 'recipe-link';
  }
}

export async function buildRecipe(env, client, { link, text, hint }, categories) {
  if (text) return extractRecipe(client, text, { categories });
  const alias = `url:${link}`;
  const quick = await cacheGet(env, [alias]);
  if (quick) return fromCache(quick, categories, hint);
  const src = await gatherSource(link, deps.fetch, { hint, igDocId: env.IG_DOC_ID });
  const identity = sourceIdentity(src);
  const known = identity !== alias && (await cacheGet(env, [identity]));
  if (known) {
    await cachePut(env, [alias], known);
    return fromCache(known, categories, hint);
  }
  const recipe = await extractRecipe(client, src, { categories });
  recipe.source = { ...recipe.source, identity }; // לזיהוי במאגר הקהילה
  const { more, ...shared } = recipe;
  void more;
  const { hint: ownHint, ...source } = shared.source || {};
  void ownHint;
  await cachePut(env, [...new Set([identity, alias])], { ...shared, source });
  return recipe;
}

// סוג התקלה לקיבוץ במסך התקלות: לפי סוג השגיאה והאתר (הודעת ה-AI מנוסחת כל פעם אחרת)
export function errorGroup(link, e) {
  let host = '';
  try {
    host = new URL(link).hostname.replace(/^(www|m|web)\./, '');
  } catch {
    host = '';
  }
  return `${e?.constructor?.name || 'Error'}:${host}`;
}

// שגיאה -> {status, error} בעברית
export function failure(e, { isPhoto = false, owner = false } = {}) {
  if (e instanceof NoRecipeError) return { status: 422, error: e.message };
  const friendly = aiMessage(e, { owner });
  if (friendly) return { status: 503, error: friendly };
  if (e?.status === 400 && isPhoto) return { status: 400, error: 'לא הצלחתי לקרוא את התמונות. נסו תמונה ברורה יותר.' };
  return { status: 502, error: e?.status ? 'לא הצלחתי להוציא מתכון. נסו שוב.' : `לא הצלחתי להוציא מתכון: ${e?.message || e}` };
}

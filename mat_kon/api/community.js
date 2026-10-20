// מאגר הקהילה: מתכונים מקישורים (ממילא ציבוריים ברשת) שמשתמשים שמרו, עם דירוגים ומספר שמירות – בלי שמות.
// נשמר במופע אחד של RecipeBook בשם community. מתכון אישי (צילום, כתיבה ידנית, ווטסאפ, טקסט שהודבק) לא נכנס,
// וגם לא הערות, דירוג אישי או עריכות של משתמש.
import { normalizeUrl, youtubeId } from './source.js';

export const MIN_RATINGS = 3; // ממוצע מוצג רק מ-3 דירוגים

// זהות המקור של מתכון בספר (כמו sourceIdentity בזמן הקריאה), או null אם הוא לא מתכון מקישור ציבורי
export function communityIdentity(recipe) {
  const src = recipe?.source;
  if (!src || typeof src.url !== 'string' || !src.url || src.text) return null;
  if (['whatsapp', 'photo', 'manual'].includes(src.kind)) return null;
  if (typeof src.identity === 'string' && /^[a-z]+:.{3,600}$/.test(src.identity)) return src.identity;
  const yt = youtubeId(src.url);
  if (yt) return `youtube:${yt}`;
  const pin = src.url.match(/pinterest\.[a-z.]+\/pin\/(?:[\w-]*--)?(\d{5,25})/);
  if (pin) return `pinterest:${pin[1]}`;
  return `url:${normalizeUrl(src.url) || src.url}`;
}

export async function communityKey(identity) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity)));
  return btoa(String.fromCharCode(...bytes.slice(0, 18))).replace(/\+/g, '-').replace(/\//g, '_');
}

// מה שמתפרסם: המתכון כמו שנבנה מהמקור, עם קרדיט וקישור. תמונה רק מהרשת (לא תמונה שהועלתה לספר של מישהו)
export function publicCopy(r) {
  const pick = (k) => (r[k] === undefined ? {} : { [k]: r[k] });
  const src = r.source || {};
  const image = typeof r.image === 'string' && /^https:\/\//.test(r.image) && !/\/img\/[^/]+\/[0-9a-f-]{36}$/.test(r.image) ? r.image : null;
  return {
    ...['title', 'originalTitle', 'description', 'category', 'categories', 'tags', 'servings', 'prepTime', 'cookTime', 'totalTime',
      'ingredients', 'steps', 'tips', 'nutrition', 'basis', 'confidence', 'notes'].reduce((o, k) => ({ ...o, ...pick(k) }), {}),
    image,
    source: {
      url: src.url, kind: src.kind,
      ...['title', 'author', 'site', 'embed', 'identity'].reduce((o, k) => (src[k] ? { ...o, [k]: src[k] } : o), {}),
    },
  };
}

// זמן הכנה בדקות מתוך טקסט בעברית ("45 דקות", "שעה וחצי", "1.5 שעות")
export function parseMinutes(text) {
  const t = String(text || '');
  if (!t) return null;
  let minutes = 0;
  const hours = t.match(/(\d+(?:\.\d+)?)\s*(?:שעות|שעה|ש['׳]|hours?|h\b)/i);
  if (hours) minutes += Number(hours[1]) * 60;
  else if (/שעתיים/.test(t)) minutes += 120;
  else if (/שעה/.test(t)) minutes += 60;
  if (/וחצי/.test(t) && /שע/.test(t)) minutes += 30;
  if (/ורבע/.test(t) && /שע/.test(t)) minutes += 15;
  const mins = t.match(/(\d+)\s*(?:דקות|דק['׳]?|דקה|min)/i);
  if (mins) minutes += Number(mins[1]);
  return minutes || null;
}

export function recipeMinutes(r) {
  const total = parseMinutes(r.totalTime);
  if (total) return total;
  const parts = [parseMinutes(r.prepTime), parseMinutes(r.cookTime)].filter(Boolean);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

// כשרות ותזונה לפי המצרכים (הערכה – מוצג כ"לפי המצרכים")
const MEAT = /(בשר|עוף|עופות|פרגית|חזה|שוקיים|כנפיים|הודו|כבש|טלה|בקר|אנטריקוט|סינטה|נקניק|קבב|שניצל|קציצ|המבורגר|כבד|פסטרמה|סלמי|ציר עוף|מרק עוף|אווז|ברווז)/;
const DAIRY = /(גבינ|חמאה|שמנת|יוגורט|קוטג|לבנה|פרמזן|מוצרלה|ריקוטה|מסקרפונה|צהובה|בולגרית|פטה|חלב(?!\s*(קוקוס|שקדים|סויה|שיבולת|אורז|צמחי)))/;
const ANIMAL = /(ביצ|דבש|דג|סלמון|טונה|אנשובי|סרדינ|שרימפ|פירות ים|ג'לטין|ז'לטין)/;
const GLUTEN = /(קמח(?!\s*(תירס|אורז|שקדים|כוסמת|תפוח|חומוס|קוקוס))|לחם|פסטה|ספגטי|אטריות|פירורי|סולת|בורגול|קוסקוס|פתיתים|בצק|טורטי|פיתה|לחמני|פריכיות|שיבולת שועל|קוואקר|שעורה|כוסמין|שמרים|בירה|רוטב סויה)/;

export function dietOf(r) {
  const text = (r.ingredients || []).flatMap((s) => s.items || []).join(' \n ');
  const meat = MEAT.test(text);
  const dairy = DAIRY.test(text);
  return {
    kosher: meat && dairy ? 'mixed' : meat ? 'meat' : dairy ? 'dairy' : 'parve',
    vegan: !meat && !dairy && !ANIMAL.test(text),
    glutenFree: !GLUTEN.test(text),
  };
}

// סיכום לחיפוש (נשמר בנפרד מהמתכון המלא, כדי שהחיפוש יהיה מהיר)
export function summarize(key, r, stats = { saves: 0, ratingSum: 0, ratingCount: 0 }) {
  const ingredients = (r.ingredients || []).flatMap((s) => s.items || []).join(' · ').slice(0, 1500);
  return {
    key,
    title: r.title || '',
    description: String(r.description || '').slice(0, 200),
    image: r.image || null,
    category: r.category || '',
    tags: r.tags || [],
    ingredients,
    minutes: recipeMinutes(r),
    calories: Number(r.nutrition?.calories) || null,
    ...dietOf(r),
    basis: r.basis || 'source',
    credit: r.source?.author || r.source?.site || '',
    url: r.source?.url || '',
    saves: stats.saves,
    ratingSum: stats.ratingSum,
    ratingCount: stats.ratingCount,
  };
}

// מה שהאפליקציה רואה: ממוצע רק מ-MIN_RATINGS דירוגים
export function publicSummary(s) {
  const { ratingSum, ingredients, ...rest } = s;
  void ingredients;
  return {
    ...rest,
    rating: s.ratingCount >= MIN_RATINGS ? Math.round((ratingSum / s.ratingCount) * 10) / 10 : null,
  };
}

// חיפוש: אותיות סופיות וניקוד לא משנים, כל מילה צריכה להופיע (בשם, בתגיות, במצרכים או בתיאור)
const norm = (t) => String(t || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]).replace(/["'׳״`]/g, '');
export function searchCommunity(summaries, q, filters = {}) {
  const words = norm(q).split(/[\s,.\-–]+/).filter((w) => w.length >= 2);
  const score = (s) => s.ratingCount >= MIN_RATINGS ? s.ratingSum / s.ratingCount : 0;
  const out = [];
  for (const s of summaries) {
    if (!s.saves) continue;
    if (filters.maxMinutes && !(s.minutes && s.minutes <= filters.maxMinutes)) continue;
    if (filters.maxCalories && !(s.calories && s.calories <= filters.maxCalories)) continue;
    if (filters.kosher && s.kosher !== filters.kosher) continue;
    if (filters.vegan && !s.vegan) continue;
    if (filters.glutenFree && !s.glutenFree) continue;
    const title = norm(s.title);
    const rest = norm(`${s.tags.join(' ')} ${s.category} ${s.description} ${s.ingredients}`);
    if (!words.every((w) => title.includes(w) || rest.includes(w))) continue;
    const relevance = words.filter((w) => title.includes(w)).length;
    out.push({ s, relevance });
  }
  out.sort((a, b) => b.relevance - a.relevance || score(b.s) - score(a.s) || b.s.saves - a.s.saves);
  return out.slice(0, 30).map((x) => publicSummary(x.s));
}

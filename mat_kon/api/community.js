// מאגר הקהילה: מתכונים מקישורים (ממילא ציבוריים ברשת) שמשתמשים שמרו, עם דירוגים ומספר שמירות – בלי שמות.
// נשמר במופע אחד של RecipeBook בשם community. מתכון אישי (צילום, כתיבה ידנית, ווטסאפ, טקסט שהודבק) לא נכנס,
// וגם לא הערות, דירוג אישי או עריכות של משתמש.
import { normalizeUrl, youtubeId } from './source.js';
import { DIET_IDS, dietInfo, matchesDiets, recipeDiet, recipeMinutes } from './diet.js';

export { parseMinutes, recipeMinutes } from './diet.js';

export const MIN_RATINGS = 3; // ממוצע מוצג רק מ-3 דירוגים
export const HIDE_AT_REPORTS = 3; // מתכון שפורסם ע"י משתמש מוסתר אחרי 3 דיווחים, עד שבעל האפליקציה בודק

// זהות המקור של מתכון בספר (כמו sourceIdentity בזמן הקריאה), או null אם הוא לא מתכון מקישור ציבורי
export function communityIdentity(recipe) {
  const src = recipe?.source;
  // עותק של מתכון שמשתמש פרסם (נשמר מהקהילה): נספר על אותו מתכון במאגר
  if (src?.kind === 'community' && typeof src.identity === 'string' && /^pub:[\w:-]{3,200}$/.test(src.identity)) return src.identity;
  if (!src || typeof src.url !== 'string' || !src.url || src.text) return null;
  if (['whatsapp', 'file', 'photo', 'manual'].includes(src.kind)) return null;
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

// מה שמתפרסם: המתכון כמו שנבנה מהמקור, עם קרדיט וקישור. תמונה רק מהרשת (לא תמונה שהועלתה לספר של מישהו),
// חוץ ממתכון שהמשתמש פרסם בעצמו (keepImage – אחרי בדיקה)
export function publicCopy(r, { keepImage = false } = {}) {
  const pick = (k) => (r[k] === undefined ? {} : { [k]: r[k] });
  const src = r.source || {};
  const image = typeof r.image === 'string' && /^https:\/\//.test(r.image) && (keepImage || !/\/img\/[^/]+\/[0-9a-f-]{36}$/.test(r.image)) ? r.image : null;
  return {
    ...['title', 'originalTitle', 'description', 'category', 'categories', 'tags', 'servings', 'prepTime', 'cookTime', 'totalTime',
      'ingredients', 'steps', 'tips', 'nutrition', 'diet', 'basis', 'confidence', 'notes'].reduce((o, k) => ({ ...o, ...pick(k) }), {}),
    image,
    source: {
      url: src.url, kind: src.kind,
      ...['title', 'author', 'site', 'embed', 'identity'].reduce((o, k) => (src[k] ? { ...o, [k]: src[k] } : o), {}),
    },
  };
}

// כשרות ותזונה לפי המצרכים (הערכה – מוצג כ"לפי המצרכים"). השדות האלה נשמרים בסיכום בשביל גרסאות ישנות של האפליקציה
export function dietOf(r) {
  const d = recipeDiet(r);
  return {
    kosher: d.meat ? 'meat' : d.dairy ? 'dairy' : d.parve ? 'parve' : 'mixed',
    vegan: d.vegan,
    glutenFree: d.gf,
  };
}

// סיכום לחיפוש (נשמר בנפרד מהמתכון המלא, כדי שהחיפוש יהיה מהיר)
export function summarize(key, r, stats = { saves: 0, ratingSum: 0, ratingCount: 0 }, author = null) {
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
    protein: Number.isFinite(Number(r.nutrition?.protein)) && r.nutrition?.protein !== null ? Number(r.nutrition.protein) : null,
    carbs: Number.isFinite(Number(r.nutrition?.carbs)) && r.nutrition?.carbs !== null ? Number(r.nutrition.carbs) : null,
    ...dietOf(r),
    // כל הסינונים שהמתכון מתאים להם (כולל סימון ה-AI וציוד מהשלבים) – לחיפוש
    dietIds: (() => { const d = recipeDiet(r); return DIET_IDS.filter((k) => d[k]); })(),
    basis: r.basis || 'source',
    credit: author ? `מתכון של ${author.name}` : r.source?.author || r.source?.site || '',
    url: r.source?.url || '',
    ...(author ? { personal: true, authorId: author.id, author: author.name } : {}),
    saves: stats.saves,
    ratingSum: stats.ratingSum,
    ratingCount: stats.ratingCount,
  };
}

// מה שהאפליקציה רואה: ממוצע רק מ-MIN_RATINGS דירוגים
export function publicSummary(s) {
  const { ratingSum, ingredients, authorId, reports, reportReasons, flagged, flagReason, hidden, dietIds, ...rest } = s;
  void ingredients, authorId, reports, reportReasons, flagged, flagReason, hidden, dietIds;
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
    if (!s.saves || s.hidden) continue;
    if (filters.maxMinutes && !(s.minutes && s.minutes <= filters.maxMinutes)) continue;
    if (filters.maxCalories && !(s.calories && s.calories <= filters.maxCalories)) continue;
    if (filters.kosher && s.kosher !== filters.kosher) continue;
    if (filters.vegan && !s.vegan) continue;
    if (filters.glutenFree && !s.glutenFree) continue;
    // סינונים לפי המצרכים (מחושב כאן, כך שגם מתכונים ישנים במאגר נכנסים)
    if (filters.diets?.length) {
      // סיכום חדש שומר את הסינונים; סיכום ישן – מחשבים מהמצרכים (בלי ציוד)
      const info = Array.isArray(s.dietIds)
        ? Object.fromEntries(DIET_IDS.map((k) => [k, s.dietIds.includes(k)]))
        : dietInfo(String(s.ingredients || '').split(' · '), { nutrition: { calories: s.calories, protein: s.protein, carbs: s.carbs }, minutes: s.minutes });
      if (!matchesDiets(info, filters.diets)) continue;
    }
    const title = norm(s.title);
    const rest = norm(`${s.tags.join(' ')} ${s.category} ${s.description} ${s.ingredients}`);
    if (!words.every((w) => title.includes(w) || rest.includes(w))) continue;
    const relevance = words.filter((w) => title.includes(w)).length;
    out.push({ s, relevance });
  }
  out.sort((a, b) => b.relevance - a.relevance || score(b.s) - score(a.s) || b.s.saves - a.s.saves);
  return out.slice(0, 30).map((x) => publicSummary(x.s));
}

// ---------- שיחה על מתכון (טיפים, שאלות, תשובות, "הכנתי!") ----------
export const TALK_MAX = 500;
export const TALK_KINDS = ['tip', 'made', 'reply'];

// מפתח התמונה באחסון של מופע הקהילה (תמונת "הכנתי!")
export function talkImageKey(t) {
  const m = typeof t?.image === 'string' && t.image.match(/\/img\/community\/([0-9a-f-]{36})$/);
  return m ? `img:${m[1]}` : null;
}

// מה שמשתמשים רואים: בלי מזהה הכותב ובלי מי עשה לייק – רק כמה, והאם זה שלי
export function publicTalk(t, viewer) {
  return {
    id: t.id, kind: t.kind, text: t.text || '', rating: t.rating || 0, image: t.image || null, parent: t.parent || null,
    author: t.author, at: t.at, likes: (t.likes || []).length,
    liked: Boolean(viewer && (t.likes || []).includes(viewer)), mine: Boolean(viewer && t.authorId === viewer),
    ...(t.hidden ? { hidden: true } : {}),
  };
}

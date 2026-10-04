// ייבוא מאפליקציות מתכונים אחרות.
// RecetteTek / "My Recipe Box" (קובץ .rtk): ZIP עם recipes_N.json, categories.json ותמונות PNG.
import { unzipSync, strFromU8 } from 'fflate';
import { CATEGORIES } from './categories';
import { textToSections } from './recipes';

const clean = (v) => String(v ?? '').replace(/[‎‏‪-‮]/g, '').trim();

// קטגוריה מהאפליקציה האחרת -> קטגוריה שלנו (כשיש מקבילה ברורה), אחרת נשארת קטגוריה משלכם
const ALIASES = {
  'קינוח': 'קינוחים', 'קינוחים': 'קינוחים', 'עוגה': 'עוגות', 'עוגות': 'עוגות', 'עוגיות': 'עוגיות ומאפים מתוקים',
  'סלט': 'סלטים', 'סלטים': 'סלטים', 'מרק': 'מרקים', 'מרקים': 'מרקים', 'לחם': 'לחמים ומאפים', 'לחמים': 'לחמים ומאפים',
  'עוף': 'עוף', 'בשר': 'בשר', 'דגים': 'דגים', 'דג': 'דגים', 'פסטה': 'פסטה ואורז', 'תוספות': 'תוספות', 'תוספת': 'תוספות',
  'ארוחת בוקר': 'ארוחת בוקר', 'משקאות': 'משקאות', 'רטבים': 'רטבים וממרחים', 'צמחוני': 'צמחוני וטבעוני', 'טבעוני': 'צמחוני וטבעוני',
};
export const mapCategory = (name) => {
  const n = clean(name).slice(0, 30);
  if (!n) return '';
  if (CATEGORIES.includes(n)) return n;
  return ALIASES[n] || n;
};

// "2025-11-28 15:58:20" או מספר מילישניות -> ISO
function isoDate(v) {
  if (typeof v === 'number' && v > 0) return new Date(v).toISOString();
  const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return m ? new Date(`${m[1]}T${m[2]}`).toISOString() : undefined;
}

// מתכון אחד של RecetteTek -> מתכון בפורמט הגיבוי של mat-kon (התמונה: שם הקובץ בתוך ה-ZIP, או קישור)
export function fromRecetteTek(r) {
  const title = clean(r.title);
  if (!title) return null;
  const url = /^https?:\/\//.test(clean(r.url)) ? clean(r.url) : '';
  const category = mapCategory((r.categories || []).map((c) => (typeof c === 'string' ? c : c?.title)).find(Boolean));
  const picture = (r.pictures || []).map((p) => String(p).split('/').pop()).find(Boolean) || '';
  const rating = Math.round(Number(r.rating) || 0);
  return {
    id: clean(r.uuid) || undefined,
    title,
    description: clean(r.description),
    category: category || 'אחר',
    servings: clean(r.quantity),
    prepTime: clean(r.preparationTime),
    cookTime: clean(r.cookingTime),
    totalTime: clean(r.totalTime),
    ingredients: textToSections(r.ingredients),
    steps: textToSections(r.instructions),
    myNotes: clean(r.notes),
    favorite: Boolean(r.favorite),
    rating: rating >= 0 && rating <= 5 ? rating : 0,
    source: url ? { url } : { kind: 'manual' },
    picture,
    originalPicture: /^https:\/\//.test(clean(r.originalPicture)) ? clean(r.originalPicture) : '',
    createdAt: isoDate(r.lastModifiedDate),
  };
}

export const isRecetteTek = (files) => Object.keys(files).some((n) => /^recipes_\d+\.json$/.test(n));

// קריאת קובץ .rtk: מתכונים, קטגוריות, והתמונות (Blob לפי שם קובץ)
export function readRecetteTek(bytes) {
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('לא הצלחתי לפתוח את הקובץ');
  }
  if (!isRecetteTek(files)) throw new Error('הקובץ הזה לא גיבוי של My Recipe Box / RecetteTek');
  const json = (name) => {
    try {
      return JSON.parse(strFromU8(files[name]));
    } catch {
      return [];
    }
  };
  const raw = Object.keys(files).filter((n) => /^recipes_\d+\.json$/.test(n)).sort().flatMap(json);
  const recipes = raw.map(fromRecetteTek).filter(Boolean);
  const categories = [...new Set([
    ...json('categories.json').map((c) => mapCategory(c?.title)),
    ...recipes.map((r) => r.category),
  ])].filter((c) => c && !CATEGORIES.includes(c));
  const images = {};
  for (const r of recipes) {
    const data = r.picture && files[r.picture];
    if (data) images[r.picture] = new Blob([data], { type: r.picture.endsWith('.png') ? 'image/png' : 'image/jpeg' });
  }
  return { recipes, categories, images };
}

// מה צריך להשלים מהמקור (הסוכן קורא את הקישור): מתכון עם קישור ובלי מצרכים
export const needsSource = (r) => Boolean(r.source?.url) && !r.ingredients.length;

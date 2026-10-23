// ייבוא מאפליקציות מתכונים אחרות.
// RecetteTek / "My Recipe Box" (קובץ .rtk): ZIP עם recipes_N.json, categories.json ותמונות PNG.
// עוד: Paprika, Recipe Keeper, Cookmate / My Cookbook – readImportFile מזהה לבד איזה קובץ זה.
import { gunzipSync, strFromU8, unzipSync } from 'fflate';
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

// ---------- עוד אפליקציות (בלי AI, כמו RecetteTek). פורמט לכל אחת – לפי קובץ הגיבוי שהיא מייצאת ----------

const decodeXml = (s) => clean(String(s ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|li|div)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()];
  })
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n'));
const httpUrl = (v) => (String(v || '').match(/https?:\/\/[^\s"'<>]+/) || [])[0] || '';
const stars = (v) => {
  const n = Math.round(Number(v) || 0);
  return n >= 0 && n <= 5 ? n : 0;
};
// "PT1H20M" -> "שעה ו-20 דקות"; טקסט רגיל נשאר כמו שהוא
function duration(v) {
  const t = clean(v);
  const m = t.match(/^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (!m || (!m[1] && !m[2])) return t;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  return [h ? (h === 1 ? 'שעה' : `${h} שעות`) : '', min ? `${min} דקות` : ''].filter(Boolean).join(' ו-');
}
const imageType = (name) => (/\.png$/i.test(name) ? 'image/png' : 'image/jpeg');
// קטגוריות שאין להן מקבילה אצלנו – נוספות כקטגוריות משלכם
const ownCategories = (recipes) => [...new Set(recipes.map((r) => r.category))].filter((c) => c && !CATEGORIES.includes(c));
const base = (r) => ({
  id: undefined, description: '', category: 'אחר', servings: '', prepTime: '', cookTime: '', totalTime: '',
  myNotes: '', favorite: false, rating: 0, picture: '', originalPicture: '', ...r,
});

// Paprika: קובץ .paprikarecipes = ZIP של קבצי .paprikarecipe, כל אחד JSON דחוס (gzip). התמונה בתוך המתכון (base64)
export function fromPaprika(r, i = 0) {
  const title = clean(r.name);
  if (!title) return null;
  const url = httpUrl(r.source_url);
  const picture = r.photo_data ? `paprika-${i}.jpg` : '';
  return base({
    id: clean(r.uid) || undefined,
    title,
    description: clean(r.description),
    category: mapCategory((r.categories || []).find(Boolean)) || 'אחר',
    servings: clean(r.servings),
    prepTime: clean(r.prep_time),
    cookTime: clean(r.cook_time),
    totalTime: clean(r.total_time),
    ingredients: textToSections(r.ingredients),
    steps: textToSections(r.directions),
    myNotes: [clean(r.notes), clean(r.nutritional_info)].filter(Boolean).join('\n\n'),
    favorite: Boolean(r.on_favorites),
    rating: stars(r.rating),
    source: url ? { url } : { kind: 'manual' },
    picture,
    photoData: r.photo_data || '',
    originalPicture: /^https:\/\//.test(clean(r.image_url)) ? clean(r.image_url) : '',
    createdAt: isoDate(r.created),
  });
}
const isGzip = (b) => b && b[0] === 0x1f && b[1] === 0x8b;
function readPaprika(files) {
  const raw = [];
  for (const [name, data] of Object.entries(files)) {
    if (!/\.paprikarecipe$/i.test(name)) continue;
    try {
      raw.push(JSON.parse(strFromU8(isGzip(data) ? gunzipSync(data) : data)));
    } catch {
      // מתכון פגום – מדלגים
    }
  }
  const recipes = raw.map(fromPaprika).filter(Boolean);
  const images = {};
  for (const r of recipes) {
    if (r.photoData) {
      try {
        images[r.picture] = new Blob([Uint8Array.from(atob(r.photoData), (c) => c.charCodeAt(0))], { type: 'image/jpeg' });
      } catch {
        r.picture = '';
      }
    }
    delete r.photoData;
  }
  return { app: 'Paprika', recipes, categories: ownCategories(recipes), images };
}

// Recipe Keeper: ZIP עם recipes.html (מתכון לכל recipe-details, שדות לפי itemprop) ותיקיית images
const prop = (html, name) => {
  const meta = html.match(new RegExp(`<meta[^>]*itemprop="${name}"[^>]*>`, 'i'));
  if (meta) return decodeXml((meta[0].match(/content="([^"]*)"/i) || [])[1]);
  const el = html.match(new RegExp(`<(\\w+)([^>]*itemprop="${name}"[^>]*)>([\\s\\S]*?)</\\1>`, 'i'));
  if (!el) return '';
  // ערך מכונה (למשל זמן "PT1H20M") עדיף על הטקסט המוצג
  const content = el[2].match(/content="([^"]*)"/i);
  return decodeXml(content ? content[1] : el[3]);
};
export function fromRecipeKeeper(html) {
  const title = prop(html, 'name');
  if (!title) return null;
  const sourceHtml = (html.match(/<(\w+)[^>]*itemprop="recipeSource"[^>]*>[\s\S]*?<\/\1>/i) || [''])[0];
  const url = httpUrl(sourceHtml);
  const picture = ((html.match(/<img[^>]*src="([^"]+)"/i) || [])[1] || '').replace(/^\.?\//, '');
  return base({
    id: prop(html, 'recipeId') || undefined,
    title,
    category: mapCategory(prop(html, 'recipeCourse') || prop(html, 'recipeCategory').split(',')[0]) || 'אחר',
    servings: prop(html, 'recipeYield'),
    prepTime: duration(prop(html, 'prepTime')),
    cookTime: duration(prop(html, 'cookTime')),
    ingredients: textToSections(prop(html, 'recipeIngredients')),
    steps: textToSections(prop(html, 'recipeDirections')),
    myNotes: prop(html, 'recipeNotes'),
    favorite: /^true$/i.test(prop(html, 'recipeIsFavourite')),
    rating: stars(prop(html, 'recipeRating')),
    source: url ? { url } : { kind: 'manual' },
    picture: /^https?:/.test(picture) ? '' : picture,
    originalPicture: /^https:\/\//.test(picture) ? picture : '',
  });
}
function readRecipeKeeper(files) {
  const page = Object.keys(files).find((n) => /(^|\/)recipes\.html$/i.test(n));
  const html = strFromU8(files[page]);
  const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  const recipes = html.split(/<div[^>]*class="recipe-details"/i).slice(1).map(fromRecipeKeeper).filter(Boolean);
  const images = {};
  for (const r of recipes) {
    const data = r.picture && (files[dir + r.picture] || files[r.picture]);
    if (data) images[r.picture] = new Blob([data], { type: imageType(r.picture) });
  }
  return { app: 'Recipe Keeper', recipes, categories: ownCategories(recipes), images };
}

// Cookmate / My Cookbook: קובץ .mcb = ZIP עם XML (<cookbook><recipe>…) ותמונות
const tag = (xml, name) => (xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i')) || [])[1] || '';
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'gi'))].map((m) => decodeXml(m[1])).filter(Boolean);
export function fromCookmate(xml) {
  const title = decodeXml(tag(xml, 'title'));
  if (!title) return null;
  const list = (name) => {
    const block = tag(xml, name);
    const items = tags(block, 'li');
    return items.length ? items.join('\n') : decodeXml(block);
  };
  const url = httpUrl(decodeXml(tag(xml, 'url')));
  const picture = decodeXml(tag(xml, 'imagepath')).replace(/^\.?\//, '');
  const imageUrl = decodeXml(tag(xml, 'imageurl'));
  return base({
    title,
    description: decodeXml(tag(xml, 'description')),
    category: mapCategory(tags(xml, 'category')[0]) || 'אחר',
    servings: decodeXml(tag(xml, 'quantity')),
    prepTime: decodeXml(tag(xml, 'preptime')),
    cookTime: decodeXml(tag(xml, 'cooktime')),
    totalTime: decodeXml(tag(xml, 'totaltime')),
    ingredients: textToSections(list('ingredient')),
    steps: textToSections(list('recipetext')),
    myNotes: list('comments'),
    rating: stars(decodeXml(tag(xml, 'rating'))),
    source: url ? { url } : { kind: 'manual' },
    picture,
    originalPicture: /^https:\/\//.test(imageUrl) ? imageUrl : '',
  });
}
function readCookmate(files) {
  const xmls = Object.keys(files).filter((n) => /\.xml$/i.test(n)).map((n) => strFromU8(files[n])).filter((x) => /<recipe>/i.test(x));
  const recipes = xmls.flatMap((x) => [...x.matchAll(/<recipe>([\s\S]*?)<\/recipe>/gi)].map((m) => fromCookmate(m[1]))).filter(Boolean);
  const images = {};
  for (const r of recipes) {
    const key = r.picture && Object.keys(files).find((n) => n === r.picture || n.endsWith(`/${r.picture.split('/').pop()}`));
    if (key) images[r.picture] = new Blob([files[key]], { type: imageType(key) });
  }
  return { app: 'Cookmate', recipes, categories: ownCategories(recipes), images };
}

// קובץ גיבוי מאחת האפליקציות הנתמכות: מזהים לפי מה שיש בפנים (לא לפי שם הקובץ – באנדרואיד הוא לפעמים משתנה)
export function readImportFile(bytes) {
  // מתכון בודד של Paprika (.paprikarecipe) הוא JSON דחוס, לא ZIP
  if (isGzip(bytes)) {
    const one = readPaprika({ 'one.paprikarecipe': bytes });
    if (one.recipes.length) return one;
  }
  // Cookmate יכול לייצא גם XML בלי ZIP
  if (bytes[0] === 0x3c) {
    const out = readCookmate({ 'cookbook.xml': bytes });
    if (out.recipes.length) return out;
  }
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('לא הצלחתי לפתוח את הקובץ');
  }
  const names = Object.keys(files);
  let out = null;
  if (isRecetteTek(files)) out = { app: 'My Recipe Box', ...readRecetteTek(bytes) };
  else if (names.some((n) => /\.paprikarecipe$/i.test(n))) out = readPaprika(files);
  else if (names.some((n) => /(^|\/)recipes\.html$/i.test(n))) out = readRecipeKeeper(files);
  else if (names.some((n) => /\.xml$/i.test(n))) out = readCookmate(files);
  if (!out) throw new Error('הקובץ הזה לא גיבוי מאפליקציה שאנחנו מכירים');
  if (!out.recipes.length) throw new Error('לא מצאתי מתכונים בקובץ');
  return out;
}

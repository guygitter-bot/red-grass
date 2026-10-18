// ניקוי ובדיקה של כל מה שנכנס לשרת (חולצות, הגדרות). לא סומכים על שום דבר שמגיע מהדפדפן.
// קוד המוצר ושמות הפאצ'ים כפולים ב-web/src/lib/shirt.js – לשנות בשניהם.

export const MAX_IMAGES = 4;
export const KINDS = ['club', 'national'];

// קטגוריות. template קובע איך מוצר בקטגוריה מתנהג (ההגדרות כפולות ב-web/src/lib/shirt.js):
//   football   – חולצת כדורגל: שם, מספר, פאץ' ושרוול ארוך
//   basketball – גופיית כדורסל: שם ומספר
//   plain      – מוצר רגיל (נעליים, תיקים…): בלי התאמה אישית, ההערה למוכר = קוד המוצר
export const TEMPLATES = ['football', 'basketball', 'plain'];
export const MAX_CATEGORIES = 20;
export const DEFAULT_CATEGORIES = [
  { id: 'football', name: 'חולצות כדורגל', template: 'football', active: true },
  { id: 'basketball', name: 'גופיות כדורסל', template: 'basketball', active: true },
  { id: 'shoes', name: 'נעליים', template: 'plain', active: true },
  { id: 'bags', name: 'תיקים', template: 'plain', active: true },
];
const isCategoryId = (s) => typeof s === 'string' && /^[a-z][a-z0-9-]{1,30}$/.test(s);

export const fail = (status, message) => Object.assign(new Error(message), { status });

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

export const isId = (s) => typeof s === 'string' && /^[a-z]{2,6}-[A-Za-z0-9_-]{6,24}$/.test(s);
// שם קובץ תמונה שהשרת עצמו נתן
export const isImageKey = (s) => typeof s === 'string' && /^img-[A-Za-z0-9_-]{8,32}\.(webp|jpg|png|avif)$/.test(s);

// "Real Madrid" -> "RealMadrid", "Paris Saint-Germain" -> "ParisSaintGermain"
export function codePart(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

// "2025/26" -> "26", "2026" -> "26", "26" -> "26"
export function shortYear(year) {
  const m = String(year ?? '').match(/(\d{2})\D*$/);
  return m ? m[1] : '';
}

// קוד אוטומטי: Team-Type-Year-Color
export function autoCode({ team, type, year, color }) {
  return [codePart(team), codePart(type), shortYear(year), codePart(color)].filter(Boolean).join('-');
}

export function cleanCode(s) {
  return String(s ?? '').replace(/\s+/g, '').replace(/[^A-Za-z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export function cleanUrl(s) {
  const raw = clean(s, 600);
  if (!raw) return '';
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw fail(400, 'הקישור לא תקין');
  }
  if (u.protocol !== 'https:') throw fail(400, 'הקישור חייב להתחיל ב-https://');
  return u.toString();
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  for (const t of tags) {
    const v = clean(t, 30);
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
    if (out.length >= 15) break;
  }
  return out;
}

// חולצה מהמנהל -> חולצה שנשמרת. שדות חסרים (חולצות ישנות) מקבלים ברירת מחדל
// categories = הקטגוריות הקיימות (מוצר בלי קטגוריה – מחולצה ישנה – הוא חולצת כדורגל)
export function cleanShirt(b, categories = DEFAULT_CATEGORIES) {
  if (!b || typeof b !== 'object') throw fail(400, 'חסרים פרטים');
  const category = categories.find((c) => c.id === (b.category || 'football'));
  if (!category) throw fail(400, 'הקטגוריה לא קיימת');
  const plain = category.template === 'plain';
  const team = clean(b.team, 60);
  if (!team) throw fail(400, plain ? 'חסר שם מותג' : 'חסר שם קבוצה / נבחרת');
  const shirt = {
    category: category.id,
    team,
    teamHe: clean(b.teamHe, 60),
    kind: KINDS.includes(b.kind) ? b.kind : 'club',
    type: clean(b.type, 30),
    year: clean(b.year, 9),
    color: clean(b.color, 30),
    colorHe: clean(b.colorHe, 30),
    country: clean(b.country, 40),
    countryHe: clean(b.countryHe, 40),
    league: clean(b.league, 50),
    leagueHe: clean(b.leagueHe, 50),
    description: cleanText(b.description, 800),
    tags: cleanTags(b.tags),
    longSleeve: category.template === 'football' && b.longSleeve === true,
    published: b.published === true,
    featured: b.featured === true,
    codeManual: b.codeManual === true,
    flyLink: cleanUrl(b.flyLink),
    images: Array.isArray(b.images) ? [...new Set(b.images.filter(isImageKey))].slice(0, MAX_IMAGES) : [],
  };
  shirt.code = shirt.codeManual ? cleanCode(b.code) : '';
  if (!shirt.code) {
    shirt.codeManual = false;
    shirt.code = autoCode(shirt);
  }
  if (!shirt.code) throw fail(400, `אי אפשר ליצור קוד מוצר – כתבו את שם ה${plain ? 'מותג' : 'קבוצה'} באנגלית`);
  if (shirt.published && !shirt.flyLink) throw fail(400, 'אי אפשר לפרסם חולצה בלי קישור FlyLinking');
  return shirt;
}

// מה שהלקוחות רואים (בלי שדות פנימיים)
export function publicShirt(s, now = Date.now()) {
  const { published, codeManual, createdAt, updatedAt, ...rest } = s;
  return { ...rest, category: s.category || 'football', isNew: now - (createdAt || 0) < 21 * 24 * 60 * 60 * 1000 };
}

export const DEFAULT_SETTINGS = { whatsapp: '', instagram: '', announcement: '' };

export function cleanSettings(b) {
  const whatsapp = String(b?.whatsapp ?? '').replace(/\D/g, '').slice(0, 15);
  let instagram = clean(b?.instagram, 40).replace(/^@/, '');
  if (!/^[A-Za-z0-9._]*$/.test(instagram)) throw fail(400, 'שם המשתמש באינסטגרם לא תקין');
  return { whatsapp, instagram, announcement: clean(b?.announcement, 120) };
}

// רשימת הקטגוריות מהמנהל. קטגוריה שיש בה מוצרים לא נמחקת (אפשר להסתיר אותה)
export function cleanCategories(list, used = new Set()) {
  if (!Array.isArray(list) || !list.length) throw fail(400, 'צריך לפחות קטגוריה אחת');
  if (list.length > MAX_CATEGORIES) throw fail(400, `אפשר עד ${MAX_CATEGORIES} קטגוריות`);
  const out = [];
  for (const c of list) {
    const name = clean(c?.name, 30);
    if (!name) throw fail(400, 'לכל קטגוריה צריך שם');
    const id = isCategoryId(c?.id) ? c.id : '';
    if (!id) throw fail(400, 'מזהה קטגוריה לא תקין');
    if (out.some((x) => x.id === id)) throw fail(400, 'קטגוריה כפולה');
    out.push({ id, name, template: TEMPLATES.includes(c.template) ? c.template : 'plain', active: c.active !== false });
  }
  for (const id of used) if (!out.some((c) => c.id === id)) throw fail(400, 'אי אפשר למחוק קטגוריה שיש בה מוצרים – אפשר להסתיר אותה');
  if (!out.some((c) => c.active)) throw fail(400, 'צריך לפחות קטגוריה אחת מוצגת');
  return out;
}

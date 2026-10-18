// הנתונים של הרוכשים: ניקוי ובדיקה של כל מה שמגיע מהאפליקציה.
//
// category -> { id, name, emoji, order, active }
// supplier -> { id, name, categoryIds: [..], area, contact, phone, email, website, about, knowledge, notes,
//               active, createdAt, removedAt, keyHash }
//             active=false = "הורד מהרשימה": לא מוצג ללקוחות והקישור שלו לא עובד, אבל כל הנתונים נשמרים.
//             knowledge = בנק המידע של העוזר (טקסט חופשי: מחירים, אחריות, זמני אספקה, שאלות נפוצות)
//             notes = הערות פנימיות של המנהל (לא מוצגות לאף אחד אחר)
// offer    -> { id, supplierId, categoryId, title, details, price, regularPrice, validUntil, hot, active, file, createdAt }
//             file = { name, type, size } או null (הקובץ עצמו נשמר בנפרד: file:<id>)
// lead     -> { id, supplierId, offerId, categoryId, name, phone, city, note, summary, chat: [{ role, text }],
//               status, amount, supplierNote, createdAt, updatedAt, history: [{ at, status, by }], custKeyHash }

export const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
export const STATUS_LABELS = { new: 'חדש', contacted: 'חזרו ללקוח', quoted: 'נשלחה הצעה', won: 'נסגרה עסקה', lost: 'לא רלוונטי' };
export const AREAS = ['כל הארץ', 'מרכז', 'שרון', 'ירושלים', 'צפון', 'חיפה והקריות', 'דרום', 'שפלה'];

export const DEFAULT_CATEGORIES = [
  ['מקלחונים', '🚿'],
  ['סניטריה', '🚽'],
  ['תאורה', '💡'],
  ['אלומיניום', '🪟'],
  ['מוצרי חשמל', '🔌'],
  ['שיפוצים', '🧱'],
  ['מיזוג אוויר', '❄️'],
  ['מטבחים', '🍳'],
  ['דלתות', '🚪'],
  ['ריצוף וחיפוי', '🔲'],
].map(([name, emoji], i) => ({ id: `cat-${i + 1}`, name, emoji, order: i, active: true }));

// קבצים להצעות מחיר: PDF ותמונות. הגבלה כדי שיישמרו כערך אחד באחסון
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_BYTES = 1400 * 1024;

const ID_RE = /^[\w-]{4,40}$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const text = (s, max = 80) =>
  String(s ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
const line = (s, max) => text(s, max).replace(/\n/g, ' ');
const date = (s) => (DATE_RE.test(String(s ?? '')) ? String(s) : '');
// סכום בשקלים (0 = לא צוין)
const money = (n) => {
  const x = Math.round(Number(String(n ?? '').replace(/[,₪\s]/g, '')));
  return Number.isFinite(x) && x > 0 ? Math.min(x, 10000000) : 0;
};
export const isId = (s) => ID_RE.test(String(s ?? ''));
export const fail = (status, error) => Object.assign(new Error(error), { status });
function need(cond, msg) {
  if (!cond) throw fail(400, msg);
}

export function cleanCategory(c) {
  need(isId(c?.id), 'מזהה לא תקין');
  const name = line(c.name, 40);
  need(name, 'צריך שם לקטגוריה');
  return { id: c.id, name, emoji: [...line(c.emoji, 8)].slice(0, 2).join('') || '🏠', order: Number.isFinite(+c.order) ? +c.order : 0, active: c.active !== false };
}

// שדות שהמנהל עורך (active, keyHash ותאריכים נקבעים בשרת)
export function cleanSupplier(s, categories) {
  need(isId(s?.id), 'מזהה לא תקין');
  const name = line(s.name, 60);
  need(name, 'צריך שם לספק');
  const ids = new Set(categories.map((c) => c.id));
  return {
    id: s.id,
    name,
    categoryIds: [...new Set(Array.isArray(s.categoryIds) ? s.categoryIds : [])].filter((id) => ids.has(id)).slice(0, 12),
    area: line(s.area, 60),
    contact: line(s.contact, 60),
    phone: line(s.phone, 30),
    email: line(s.email, 80),
    website: /^https?:\/\/\S+$/i.test(String(s.website || '').trim()) ? line(s.website, 200) : '',
    about: text(s.about, 1500),
    knowledge: text(s.knowledge, 30000),
    notes: text(s.notes, 2000),
  };
}

export function cleanOffer(o, suppliers, categories) {
  need(isId(o?.id), 'מזהה לא תקין');
  const supplier = suppliers.find((s) => s.id === o.supplierId);
  need(supplier, 'ספק לא קיים');
  const title = line(o.title, 120);
  need(title, 'צריך כותרת להצעה');
  const categoryId = categories.some((c) => c.id === o.categoryId) ? o.categoryId : supplier.categoryIds[0] || '';
  return {
    id: o.id,
    supplierId: supplier.id,
    categoryId,
    title,
    details: text(o.details, 3000),
    price: money(o.price),
    regularPrice: money(o.regularPrice),
    discount: line(o.discount, 40),
    validUntil: date(o.validUntil),
    hot: !!o.hot,
    active: o.active !== false,
  };
}

// קובץ שמגיע מהאפליקציה: { name, type, data(base64) }
export function cleanFile(f) {
  need(f && FILE_TYPES.includes(f.type), 'אפשר לצרף רק PDF או תמונה');
  const data = String(f.data || '');
  need(/^[A-Za-z0-9+/]+=*$/.test(data), 'קובץ לא תקין');
  const size = Math.floor((data.length * 3) / 4);
  need(size <= MAX_FILE_BYTES, 'הקובץ גדול מדי (עד 1.4MB)');
  return { name: line(f.name, 120) || 'הצעת מחיר', type: f.type, size, data };
}

// פנייה של לקוח
export function cleanLead(l) {
  const name = line(l?.name, 60);
  const phone = line(l?.phone, 30);
  need(name, 'צריך שם');
  need(/^[0-9+\-\s()]{9,20}$/.test(phone) && phone.replace(/\D/g, '').length >= 9, 'מספר הטלפון לא תקין');
  need(l.consent === true, 'צריך לאשר העברת הפרטים לספק');
  const chat = (Array.isArray(l.chat) ? l.chat : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .slice(-40)
    .map((m) => ({ role: m.role, text: text(m.text, 2000) }))
    .filter((m) => m.text);
  return { name, phone, city: line(l.city, 40), note: text(l.note, 1000), summary: text(l.summary, 1500), chat };
}

export function cleanLeadUpdate(u) {
  const out = {};
  if (u.status !== undefined) {
    need(STATUSES.includes(u.status), 'סטטוס לא תקין');
    out.status = u.status;
  }
  if (u.amount !== undefined) out.amount = money(u.amount);
  if (u.supplierNote !== undefined) out.supplierNote = text(u.supplierNote, 1000);
  return out;
}

// הצעה שהלקוחות רואים: פעילה, של ספק פעיל, ולא פג תוקפה
export function offerVisible(o, suppliers, today) {
  if (!o.active) return false;
  if (o.validUntil && o.validUntil < today) return false;
  return suppliers.some((s) => s.id === o.supplierId && s.active);
}

// מה שלקוח רואה על ספק (בלי בנק המידע, הערות פנימיות ופרטי קשר פנימיים)
export function publicSupplier(s) {
  return { id: s.id, name: s.name, categoryIds: s.categoryIds, area: s.area, website: s.website, about: s.about, hasAssistant: true };
}

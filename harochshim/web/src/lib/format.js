// עזרים: מחירים, תאריכים, מצבי ליד, ייצוא לאקסל, קבצים
export const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
export const STATUS_LABELS = { new: 'חדש', contacted: 'חזרו ללקוח', quoted: 'נשלחה הצעה', won: 'נסגרה עסקה', lost: 'לא רלוונטי' };
// צבע לכל מצב (מסגרת + טקסט)
export const STATUS_STYLE = {
  new: 'text-sky-ink border-sky',
  contacted: 'text-amber-700 border-amber-500 dark:text-amber-300',
  quoted: 'text-violet-700 border-violet-400 dark:text-violet-300',
  won: 'text-emerald-700 border-emerald-500 dark:text-emerald-300',
  lost: 'text-muted border-line',
};
// ליד "חדש" שלא טופל 48 שעות
export const STALE_MS = 48 * 60 * 60 * 1000;
export const isStale = (lead, now = Date.now()) => lead.status === 'new' && now - lead.createdAt > STALE_MS;

export const money = (n) => (n ? `₪${Number(n).toLocaleString('he-IL')}` : '');

export function savePercent(o) {
  if (!o.price || !o.regularPrice || o.regularPrice <= o.price) return 0;
  return Math.round(((o.regularPrice - o.price) / o.regularPrice) * 100);
}

export function shortDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export function dateTime(ms) {
  const d = new Date(ms);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const newId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

// ---------- ייצוא לאקסל (CSV עם BOM כדי שהעברית תיפתח נכון) ----------
const cell = (v) => {
  const s = String(v ?? '');
  // נוסחה שמתחילה ב-= וכו' – מנטרלים (שלא תרוץ באקסל)
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function leadsCsv(leads, { suppliers, offers, categories }) {
  const name = (list, id, field = 'name') => list.find((x) => x.id === id)?.[field] || '';
  const head = ['תאריך', 'ספק', 'קטגוריה', 'הטבה', 'שם הלקוח', 'טלפון', 'עיר', 'מצב', 'סכום עסקה', 'סיכום', 'הערת הספק', 'הערת הלקוח'];
  const rows = leads.map((l) => [
    dateTime(l.createdAt),
    name(suppliers, l.supplierId),
    name(categories, l.categoryId),
    name(offers, l.offerId, 'title'),
    l.name,
    l.phone,
    l.city,
    STATUS_LABELS[l.status] || l.status,
    l.amount || '',
    l.summary,
    l.supplierNote,
    l.note,
  ]);
  return `﻿${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

export function download(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- קבצים ----------
// קובץ שמגיע מהשרת ({ name, type, data }) -> נפתח בלשונית חדשה
export function openFile(file) {
  const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
  const win = window.open(url, '_blank');
  if (!win) download(file.name, bytes, file.type);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('לא הצלחתי לקרוא את הקובץ'));
    r.readAsDataURL(blob);
  });

export const MAX_FILE_BYTES = 1400 * 1024;

// PDF כמו שהוא; תמונה מוקטנת ל-JPEG (צילום מסך של הצעה בדרך כלל גדול)
export async function readFile(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_FILE_BYTES) throw new Error('הקובץ גדול מדי (עד 1.4MB). אפשר לשמור אותו מחדש בגודל קטן יותר');
    return { name: file.name, type: file.type, data: await toBase64(file) };
  }
  if (!file.type.startsWith('image/')) throw new Error('אפשר לצרף רק PDF או תמונה');
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob.size <= MAX_FILE_BYTES) return { name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', data: await toBase64(blob) };
  }
  throw new Error('התמונה גדולה מדי');
}

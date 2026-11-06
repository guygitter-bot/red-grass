// שמירה בטלפון בלבד (localStorage): תוצאות הניתוח – כדי שסריקה חוזרת תהיה מהירה – ותמונות שסומנו "להשאיר"
const FEATS = 'gl_feats_v1';
const KEPT = 'gl_kept_v1';

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // מקום מלא / מצב פרטי – הניתוח פשוט ייעשה שוב בפעם הבאה
  }
}

// מפתח לכל תמונה: מזהה + זמן שינוי (תמונה שנערכה מנותחת מחדש)
export const featKey = (p) => `${p.id}:${p.mod || 0}`;

export function loadFeats() {
  return read(FEATS, {});
}

// שומרים רק תמונות שעדיין קיימות, כדי שהמטמון לא יגדל בלי סוף
export function saveFeats(photos, feats) {
  const out = {};
  for (const p of photos) {
    const f = feats[p.id];
    if (f && !f.err) out[featKey(p)] = f;
  }
  write(FEATS, out);
}

export function loadKept() {
  const v = read(KEPT, []);
  return new Set(Array.isArray(v) ? v.map(String) : []);
}

export function saveKept(set) {
  write(KEPT, [...set]);
}

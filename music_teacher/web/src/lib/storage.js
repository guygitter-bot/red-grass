// שמירה מקומית בטוחה: תמיד עם ברירת מחדל, גם במצב פרטי או אחרי ניקוי נתונים
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // מצב פרטי – נשמר רק לשיחה הזאת
  }
}

const GUITAR_KEY = 'mt_guitar';
const PROGRESS_KEY = 'mt_progress';

export const GUITAR_TYPES = ['classical', 'electric'];

export function getGuitarType() {
  const v = readJSON(GUITAR_KEY, 'classical');
  return GUITAR_TYPES.includes(v) ? v : 'classical';
}
export function setGuitarType(t) {
  if (GUITAR_TYPES.includes(t)) writeJSON(GUITAR_KEY, t);
}

// התקדמות בשיעורים: { "1": true, "2": true }
export function getProgress() {
  const v = readJSON(PROGRESS_KEY, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
export function markLessonDone(id) {
  writeJSON(PROGRESS_KEY, { ...getProgress(), [id]: true });
}

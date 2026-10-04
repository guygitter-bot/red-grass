// תאריכים נשמרים כמחרוזת מקומית "YYYY-MM-DD" ושעות כ-"HH:MM" – בלי אזורי זמן ובלי הפתעות
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now = new Date()) {
  return toKey(now);
}

export function addDays(key, days) {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function diffDays(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000);
}

// "היום", "מחר", "יום שלישי", "12 באוקטובר"
export function dayLabel(key, now = new Date()) {
  const diff = diffDays(todayKey(now), key);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === 2) return 'מחרתיים';
  if (diff === -1) return 'אתמול';
  const d = fromKey(key);
  if (diff > 0 && diff < 7) return `יום ${DAY_NAMES[d.getDay()]}`;
  return `${d.getDate()} ב${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

export function shortDate(key) {
  const d = fromKey(key);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export function weekdayShort(key) {
  return DAY_NAMES[fromKey(key).getDay()].slice(0, 1) + "'";
}

// מועד מלא של משימה (תאריך + שעה, או סוף היום כשאין שעה)
export function dueDate(task) {
  if (!task.due) return null;
  const d = fromKey(task.due);
  if (task.time) {
    const [h, m] = task.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(23, 59, 0, 0);
  }
  return d;
}

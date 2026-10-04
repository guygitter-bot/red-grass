// תאריכים נשמרים כמחרוזת מקומית "YYYY-MM-DD" ושעות כ-"HH:MM" – בלי אזורי זמן ובלי הפתעות
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const pad = (n) => String(n).padStart(2, '0');

// ברכה לפי השעה, עם השם מההגדרות אם נכתב ("בוקר טוב, נועה")
export function greeting(h, name = '') {
  const text = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  const clean = (name || '').trim();
  return clean ? `${text}, ${clean}` : text;
}

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

// אותו יום בחודש, n חודשים אחר כך. כשאין יום כזה (31 בפברואר) – היום האחרון בחודש
export function addMonths(key, months) {
  const [y, m, d] = key.split('-').map(Number);
  const last = new Date(y, m - 1 + months + 1, 0);
  return toKey(new Date(last.getFullYear(), last.getMonth(), Math.min(d, last.getDate())));
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

// א' ב' ג' ד' ה' ו' ש'
export function weekdayShort(key) {
  return `${'אבגדהוש'[fromKey(key).getDay()]}'`;
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

// הקלדת שעה בספרות (במקום השעון העגול של הטלפון): "1030" → "10:30", הנקודתיים נכנסות לבד
export function timeDraft(raw) {
  const text = String(raw || '').replace(/[.,;\s]/g, ':').replace(/[^\d:]/g, '');
  if (text.includes(':')) {
    const [h, ...rest] = text.split(':');
    return `${h.slice(0, 2)}:${rest.join('').slice(0, 2)}`;
  }
  const d = text.slice(0, 4);
  if (d.length < 3) return d;
  // 3 ספרות: "130" → "13:0" (ממשיכים להקליד), אבל "930" → "9:30"
  if (d.length === 3) return Number(d.slice(0, 2)) <= 23 ? `${d.slice(0, 2)}:${d[2]}` : `${d[0]}:${d.slice(1)}`;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

// מה שהוקלד → "HH:MM", מחרוזת ריקה כשנמחק, או null כשזו לא שעה ("25:00")
export function parseTime(text) {
  const t = timeDraft(text);
  if (!t) return '';
  const [h, m = ''] = t.split(':');
  if (!h) return null;
  const hh = Number(h);
  const mm = Number(m || 0);
  if (hh > 23 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

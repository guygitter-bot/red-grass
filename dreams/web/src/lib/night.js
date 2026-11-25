// "לילה" = מהערב עד הצהריים שאחריו. כוונה שנקבעה ב-23:30 או ב-00:30 וחלום שנרשם ב-07:00 – כולם באותו לילה.
// מפתח הלילה הוא התאריך של הערב (YYYY-MM-DD, לפי השעון המקומי).
export const DAY_STARTS_AT = 15; // מ-15:00 מתחיל לילה חדש

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nightKey(date = new Date()) {
  const d = new Date(date);
  if (d.getHours() < DAY_STARTS_AT) d.setDate(d.getDate() - 1);
  return ymd(d);
}

// הלילה הקודם / הבא למפתח נתון
export function shiftNight(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + days, 12));
}

// בוקר = בין 4:00 ל-15:00 (אז מציעים לרשום חלום)
export function isMorning(date = new Date()) {
  const h = new Date(date).getHours();
  return h >= 4 && h < DAY_STARTS_AT;
}

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// "ליל שלישי, 24.11"
export function nightLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return `ליל ${DAYS[date.getDay()]}, ${d}.${m}`;
}

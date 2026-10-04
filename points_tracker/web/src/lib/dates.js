// תאריכים תמיד כמחרוזת YYYY-MM-DD לפי זמן מקומי.

export function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateString(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toDateString(new Date());

export function addDays(dateStr, days) {
  const d = parseDateString(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

// השבוע מתחיל ביום ראשון.
export function weekDates(dateStr) {
  const d = parseDateString(dateStr);
  const start = addDays(dateStr, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDisplayDate(dateStr) {
  const d = parseDateString(dateStr);
  const dateText = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const t = today();
  if (dateStr === t) return `היום, ${dateText}`;
  if (dateStr === addDays(t, -1)) return `אתמול, ${dateText}`;
  if (dateStr === addDays(t, 1)) return `מחר, ${dateText}`;
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ברכה לפי השעה: בוקר 5–12, צהריים 12–17, ערב בשאר הזמן.
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'בוקר טוב';
  if (h >= 12 && h < 17) return 'צהריים טובים';
  return 'ערב טוב';
}

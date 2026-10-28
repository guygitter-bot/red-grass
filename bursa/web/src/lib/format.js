// עיצוב מספרים וזמנים. המספרים תמיד משמאל לימין (‎LRM‎) כדי שלא יתהפכו בתוך עברית
const LRM = '‎';

export const SYMBOLS = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };

export function currencySymbol(cur) {
  return SYMBOLS[cur] || (cur ? `${cur} ` : '');
}

const grouped = (n, digits) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// מחיר: 2 ספרות אחרי הנקודה, ו-4 כשהמחיר קטן מ-1
export function fmtPrice(n) {
  if (n == null || !Number.isFinite(n)) return '–';
  return grouped(n, Math.abs(n) < 1 ? 4 : 2);
}

// מחיר עם סימן מטבע: $1,234.50
export function fmtMoney(n, cur = 'USD', digits) {
  if (n == null || !Number.isFinite(n)) return '–';
  const body = digits == null ? fmtPrice(Math.abs(n)) : grouped(Math.abs(n), digits);
  return `${LRM}${n < 0 ? '-' : ''}${currencySymbol(cur)}${body}`;
}

// סכום בשקלים בלי אגורות
export const fmtILS = (n) => fmtMoney(n, 'ILS', 0);

// אחוז עם סימן: ‎+1.2%‎ / ‎-0.5%‎
export function fmtPct(n, digits = 1, signed = true) {
  if (n == null || !Number.isFinite(n)) return '–';
  const abs = Math.abs(n).toFixed(digits);
  const zero = Number(abs) === 0;
  const sign = n < 0 && !zero ? '-' : signed && !zero ? '+' : '';
  return `${LRM}${sign}${abs}%`;
}

// מספר עם סימן (רווח/הפסד): ‎+$12.30‎
export function fmtSigned(n, cur = 'ILS', digits = 0) {
  if (n == null || !Number.isFinite(n)) return '–';
  const body = `${currencySymbol(cur)}${grouped(Math.abs(n), digits)}`;
  return `${LRM}${n < 0 ? '-' : n > 0 ? '+' : ''}${body}`;
}

// מספר קצר: 1.2K / 3.4M / 5.6B
export function fmtCompact(n) {
  if (n == null || !Number.isFinite(n)) return '–';
  const abs = Math.abs(n);
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, letter] of units) {
    if (abs >= size) return `${LRM}${(n / size).toFixed(abs / size >= 100 ? 0 : 1).replace(/\.0$/, '')}${letter}`;
  }
  return `${LRM}${Math.round(n)}`;
}

// "לפני X דקות". ms = זמן באלפיות שנייה
export function timeAgo(ms, now = Date.now()) {
  if (!ms) return '';
  const min = Math.floor((now - ms) / 60000);
  if (min < 1) return 'עכשיו';
  if (min === 1) return 'לפני דקה';
  if (min < 60) return `לפני ${min} דקות`;
  const h = Math.floor(min / 60);
  if (h === 1) return 'לפני שעה';
  if (h < 24) return `לפני ${h} שעות`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'אתמול';
  if (d < 30) return `לפני ${d} ימים`;
  const mo = Math.floor(d / 30);
  return mo === 1 ? 'לפני חודש' : `לפני ${mo} חודשים`;
}

// אותו דבר כשהזמן בשניות (חדשות, נרות)
export const timeAgoSec = (sec, now) => (sec ? timeAgo(sec * 1000, now) : '');

// תאריך קצר בעברית: 5 במרץ 2026
export function fmtDate(sec) {
  if (!sec) return '';
  return new Date(sec * 1000).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// צבע לפי סימן: up / down / muted (שמות מחלקות של Tailwind)
export function tone(n) {
  if (n == null || !Number.isFinite(n) || n === 0) return 'text-muted';
  return n > 0 ? 'text-up' : 'text-down';
}

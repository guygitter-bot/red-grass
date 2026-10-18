// עלות משוערת של ההשלמה האוטומטית לפי המחירון של Claude (המודל בשרת: claude-opus-5-5).
// החשבון המדויק – ב-Anthropic Console (מפתח נפרד לאתר: ISPORT_ANTHROPIC_API_KEY).
export const PRICES = {
  input: 4 / 1e6, // $ לטוקן
  output: 20 / 1e6,
  cacheRead: 0.2 / 1e6,
  cacheWrite: 5 / 1e6,
  search: 10 / 1000, // $ לחיפוש ברשת
};
// שער דולר משוער (לתצוגה בלבד)
export const USD_ILS = 3.7;

export function monthCost(m = {}) {
  const usd =
    (m.input || 0) * PRICES.input +
    (m.output || 0) * PRICES.output +
    (m.cacheRead || 0) * PRICES.cacheRead +
    (m.cacheWrite || 0) * PRICES.cacheWrite +
    (m.searches || 0) * PRICES.search;
  return { usd, ils: usd * USD_ILS };
}

export const money = (n, sign = '₪') => `${sign}${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString('he-IL')}`;

// "2026-10" -> "אוקטובר 2026"
export const monthName = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

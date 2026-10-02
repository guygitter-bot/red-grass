// חישוב נקודות. אותה נוסחה בדיוק נמצאת ב-points_tracker/points.py (הסוכן ב-GitHub).

// נוסחת הנקודות הקלאסית (PointsPlus): ערכים בגרמים.
export function pointsFromNutrition({ protein = 0, carbs = 0, fat = 0, fiber = 0 } = {}) {
  const raw = protein / 10.9375 + carbs / 9.2105 + fat / 3.8889 - fiber / 12.5;
  return Math.max(0, raw);
}

// נקודות למנה לפי ערכים ל-100 גרם ומשקל המנה.
export function pointsForGrams(per100, grams) {
  if (!per100 || !(grams > 0)) return 0;
  return pointsFromNutrition(per100) * (grams / 100);
}

export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// 2 -> "2", 2.5 -> "2.5", 2.25 -> "2.3"
export function formatPoints(n) {
  const r = round1(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export const PORTION_PRESETS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5, 2, 3];

const FRACTIONS = [
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

// 0.5 -> "½", 1.5 -> "1.5", 2 -> "2", 0.4 -> "0.4"
// (בלי "1½": בטקסט מימין לשמאל הוא מוצג הפוך)
export function formatQty(q) {
  if (q < 1) {
    const match = FRACTIONS.find(([v]) => Math.abs(v - q) < 0.01);
    if (match) return match[1];
  }
  return String(Math.round(q * 100) / 100);
}

// תיאור מילולי לכמות: "חצי", "רבע", "2 ×"
export function qtyPrefix(q) {
  const words = { 0.25: 'רבע', 0.5: 'חצי', 0.75: 'שלושה רבעים' };
  for (const [v, w] of Object.entries(words)) if (Math.abs(q - v) < 0.01) return `${w} `;
  if (Math.abs(q - 1) < 1e-6) return '';
  return `${formatQty(q)} × `;
}

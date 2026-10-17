// חישוב "ביסים" – הנוסחה של ביס. אותה נוסחה בדיוק נמצאת ב-points_tracker/points.py (הסוכן ב-GitHub).
// (שמות הפונקציות נשארו "points" כדי לא לשבור קוד ונתונים קיימים.)
//
// ביסים = (קלוריות − 3 × חלבון − 4 × סיבים) / 35, ל-100 גרם, לא פחות מ-0.
// כלומר: בסיס של אנרגיה (35 קלוריות = ביס אחד), עם הנחה על חלבון ועל סיבים תזונתיים, שמשביעים יותר.
// אם אין קלוריות (למשל הזנה ידנית), מחשבים אותן מהמאקרו: 4 לחלבון ולפחמימות, 9 לשומן.
export const KCAL_PER_BITE = 35;

export function kcalOf({ kcal, protein = 0, carbs = 0, fat = 0 } = {}) {
  return kcal > 0 ? kcal : 4 * protein + 4 * carbs + 9 * fat;
}

export function pointsFromNutrition(per100 = {}) {
  const { protein = 0, fiber = 0 } = per100;
  return Math.max(0, (kcalOf(per100) - 3 * protein - 4 * fiber) / KCAL_PER_BITE);
}

// ביסים למנה לפי ערכים ל-100 גרם ומשקל המנה.
export function pointsForGrams(per100, grams) {
  if (!per100 || !(grams > 0)) return 0;
  return pointsFromNutrition(per100) * (grams / 100);
}

// מאכל עם ערכים תזונתיים ומשקל מקבל תמיד ערך מחושב מחדש (כך כל המאגר עובר לנוסחה החדשה לבד).
// מאכל שהוזן ידנית רק עם מספר, או שהמספר שלו תוקן ידנית (manualPoints), נשאר כמו שהוא.
export function withComputedPoints(food) {
  if (!food?.per100 || !(food.grams > 0) || food.manualPoints) return food;
  return { ...food, points: round1(pointsForGrams(food.per100, food.grams)) };
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

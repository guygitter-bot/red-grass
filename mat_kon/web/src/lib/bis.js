// ניקוד "ביס" למנה (האפליקציה points_tracker). אותה נוסחה בדיוק כמו ב-points_tracker/web/src/lib/points.js
// (בדיקה מוודאת) – מוצג רק למשתמש שבעל האפליקציה פתח לו את זה (user.features.bis).
export function bisPoints({ protein = 0, carbs = 0, fat = 0, fiber = 0 } = {}) {
  const n = (v) => Number(v) || 0;
  const raw = n(protein) / 10.9375 + n(carbs) / 9.2105 + n(fat) / 3.8889 - n(fiber) / 12.5;
  return Math.max(0, raw);
}

// 2 -> "2", 2.5 -> "2.5", 2.25 -> "2.3"
export function formatBis(n) {
  const r = Math.round((Number(n) || 0) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

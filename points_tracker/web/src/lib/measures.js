// מידות ביתיות (כף, כפית, כוס, יחידה...) והמרה לגרמים ולנקודות.
import { pointsForGrams, round1 } from './points';

// הערכה כללית, רק כשאין לסוכן מידע על המאכל הספציפי. המשקל משתנה מאוד בין מאכלים
// (כף פרמזן מגורד ~5 ג', כף שמן ~13 ג', כף דבש ~21 ג'), לכן אפשר תמיד לתקן את הגרמים.
export const GENERIC_UNITS = [
  { name: 'כפית', grams: 5, generic: true },
  { name: 'כף', grams: 15, generic: true },
  { name: 'כוס', grams: 240, generic: true },
];

export const GRAM_UNIT = { name: 'גרם', grams: 1 };

// "פרמזן תנובה (100 ג')" -> "פרמזן תנובה"
export const baseName = (name) => String(name || '').replace(/\s*\(\s*100\s*ג'?\s*\)\s*$/, '').trim();

// רשימת המידות למאכל: גרמים, ואז המידות של המאכל (מהסוכן / מהתווית), ואם אין - הערכה כללית.
export function unitsFor(food) {
  const own = (food?.units || []).filter((u) => u && u.name && u.grams > 0);
  const extra = food?.grams > 0 && food.grams !== 100 && !own.some((u) => Math.abs(u.grams - food.grams) < 0.5)
    ? [{ name: `מנה`, grams: food.grams }]
    : [];
  const list = [...own, ...extra];
  return [GRAM_UNIT, ...(list.length ? list : GENERIC_UNITS)];
}

export function portionPoints(per100, grams) {
  return round1(pointsForGrams(per100, grams));
}

// תיאור כמות: "2 כף (10 ג')", "150 ג'"
export function portionLabel(unit, count, grams) {
  if (unit.name === GRAM_UNIT.name) return `${Math.round(grams)} ג'`;
  const n = Math.round(count * 100) / 100;
  return `${n === 1 ? '' : `${n} `}${unit.name} (${Math.round(grams)} ג')`;
}

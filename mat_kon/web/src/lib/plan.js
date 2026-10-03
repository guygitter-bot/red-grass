// תכנון ארוחות שבועי: שבוע מתחיל ביום ראשון, מפתח לכל יום YYYY-MM-DD (לפי שעון מקומי)

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const MEALS = ['ארוחת בוקר', 'ארוחת צהריים', 'ארוחת ערב'];

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function weekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: dateKey(d), name: DAY_NAMES[i], date: d };
  });
}

export const shiftWeek = (start, weeks) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7);

export const shortDate = (d) => `${d.getDate()}.${d.getMonth() + 1}`;

// ימים שעברו לפני יותר מחודשיים נמחקים כדי שהתכנון לא יגדל בלי סוף
export function prunePlan(plan, today = new Date()) {
  const limit = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60));
  return Object.fromEntries(Object.entries(plan || {}).filter(([day, meals]) => day >= limit && meals?.length));
}

export function addMeal(plan, day, meal) {
  return { ...plan, [day]: [...(plan[day] || []), meal] };
}

export function removeMeal(plan, day, id) {
  const meals = (plan[day] || []).filter((m) => m.id !== id);
  const next = { ...plan };
  if (meals.length) next[day] = meals;
  else delete next[day];
  return next;
}

// מתכונים שמתוכננים בימים האלה (כל מתכון פעם אחת לכל הופעה)
export function plannedRecipes(plan, days, recipes) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return days.flatMap((d) => (plan[d.key] || []).map((m) => byId.get(m.recipeId)).filter(Boolean));
}

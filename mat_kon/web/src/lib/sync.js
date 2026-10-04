// סנכרון רשימות משותפות (קניות, מלאי, תכנון) ברמת פריט: במקום לשלוח את כל הרשימה ("האחרון מנצח"),
// שולחים רק מה השתנה מאז הסנכרון האחרון – הוסף, עודכן, נמחק – והשרת מחיל את זה על הרשימה העדכנית.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// מה השתנה בין הרשימה שסונכרנה לרשימה הנוכחית (לפי id)
export function diffItems(before, after) {
  const prev = new Map(before.map((i) => [i.id, i]));
  const next = new Map(after.map((i) => [i.id, i]));
  const ops = [];
  for (const [id] of prev) if (!next.has(id)) ops.push({ op: 'remove', id });
  for (const [id, item] of next) {
    if (!prev.has(id)) ops.push({ op: 'add', id, item });
    else if (!same(prev.get(id), item)) ops.push({ op: 'update', id, item });
  }
  return ops;
}

// מחיל שינויים על רשימה (כמו שהשרת עושה) – כדי לשמור שינויים מקומיים שעוד לא נשלחו
export function applyOps(list, ops) {
  const out = [...list];
  for (const o of ops) {
    const at = out.findIndex((x) => x.id === o.id);
    if (o.op === 'remove') {
      if (at >= 0) out.splice(at, 1);
    } else if (o.op === 'update') {
      if (at >= 0) out[at] = o.item;
    } else if (o.op === 'add' && at < 0) out.push(o.item);
  }
  return out;
}

// תכנון: {day: [meals]} <-> רשימה שטוחה עם day
export const planToItems = (plan) => Object.entries(plan || {}).flatMap(([day, meals]) => meals.map((m) => ({ ...m, day })));
export function itemsToPlan(items) {
  const plan = {};
  for (const { day, ...meal } of items) (plan[day] ||= []).push(meal);
  return plan;
}

// "מה יש לי במקרר": אילו מתכונים אפשר להכין עם מה שיש בבית
import { normalize } from './recipes';

// מצרכי בסיס שכמעט תמיד יש בבית
export const STAPLES = ['מלח', 'פלפל', 'פלפל שחור', 'שמן', 'שמן זית', 'מים', 'סוכר', 'קמח', 'שום', 'בצל', 'פפריקה', 'כמון', 'אבקת אפייה', 'סודה לשתייה', 'תמצית וניל', 'סוכר וניל'];

// שורש פשוט לעברית: ביצה/ביצים, עגבנייה/עגבניות, תפוח/תפוחים
export function stem(word) {
  let w = normalize(word);
  for (const suffix of ['יות', 'ים', 'ות', 'יה', 'ה', 'ת']) {
    if (w.length - suffix.length >= 3 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  // עגבני(ה) / עגבנ(יות)
  if (w.length > 3 && w.endsWith('י')) w = w.slice(0, -1);
  return w;
}

const words = (text) => normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// האם שורת מצרך מכילה את הפריט (כל המילים של הפריט, גם עם ה/ו/ב/ל/מ בהתחלה)
export function lineHas(line, item) {
  const lineStems = words(line).flatMap((w) => [stem(w), stem(w.replace(/^[והבלמש]/, ''))]);
  const itemWords = words(item).map(stem);
  return itemWords.length > 0 && itemWords.every((iw) => lineStems.some((lw) => lw === iw || (iw.length >= 4 && lw.startsWith(iw))));
}

const isStaple = (line) => STAPLES.some((s) => lineHas(line, s) && words(line).length <= words(s).length + 4);

export function matchRecipes(recipes, have, { ignoreStaples = true } = {}) {
  const items = have.map((h) => h.trim()).filter(Boolean);
  if (!items.length) return [];
  return recipes
    .map((recipe) => {
      const lines = (recipe.ingredients || []).flatMap((s) => s.items);
      const needed = ignoreStaples ? lines.filter((l) => !isStaple(l)) : lines;
      const matched = needed.filter((l) => items.some((i) => lineHas(l, i)));
      const missing = needed.filter((l) => !matched.includes(l));
      return { recipe, matched, missing, total: needed.length, score: needed.length ? matched.length / needed.length : 0 };
    })
    .filter((m) => m.matched.length > 0)
    .sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || a.missing.length - b.missing.length);
}

// מה חסר בבית למתכון (שורות המצרכים שאין להן פריט מתאים במלאי)
export function missingLines(lines, have, { ignoreStaples = true } = {}) {
  const items = have.map((h) => h.trim()).filter(Boolean);
  const needed = ignoreStaples ? lines.filter((l) => !isStaple(l)) : lines;
  return needed.filter((l) => !items.some((i) => lineHas(l, i)));
}

// מיזוג מוצרים חדשים למלאי: אותו שם באותו מקום מתעדכן (כמות) ולא נכפל
export function mergePantry(list, added) {
  const out = [...list];
  for (const a of added) {
    const name = a.name.trim();
    if (!name) continue;
    const i = out.findIndex((x) => x.place === a.place && normalize(x.name) === normalize(name));
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, place: a.place, addedAt: new Date().toISOString(), ...(a.qty ? { qty: a.qty } : {}) };
    if (i >= 0) out[i] = { ...out[i], ...(a.qty ? { qty: a.qty } : {}), addedAt: item.addedAt };
    else out.push(item);
  }
  return out;
}

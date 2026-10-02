import sharedDb from '../../../data/foods.json';

export const SHARED_FOODS = sharedDb.foods;

// נרמול טקסט עברי לחיפוש: בלי ניקוד, גרשיים, פיסוק ורווחים כפולים.
export function normalize(text) {
  return String(text || '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'`׳״]/g, '')
    .replace(/[()\-–/.,:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// סופיות: "פיתות" -> "פית", כדי ש"פיתה" ימצא גם "פיתות".
const stem = (w) => (w.length > 3 ? w.replace(/(ות|ים|ה)$/, '') : w);

export function searchFoods(db, query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ').map(stem);
  const scored = [];
  for (const item of db) {
    const name = normalize(item.name);
    const hay = `${name} ${(item.aliases || []).map(normalize).join(' ')}`;
    if (!tokens.every((t) => hay.includes(t))) continue;
    let score = 0;
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 50;
    if (hay.includes(q)) score += 20;
    score -= name.length / 10;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}

export function findByName(db, name) {
  const n = normalize(name);
  return db.find((f) => normalize(f.name) === n) || null;
}

// מאגר משותף (מהסוכן ב-GitHub) + מאכלים אישיים. גרסה אישית גוברת.
export function mergeFoodDb(shared, userFoods) {
  const byName = new Map(shared.map((f) => [normalize(f.name), f]));
  for (const f of userFoods) byName.set(normalize(f.name), { ...f, source: f.source || 'user' });
  return [...byName.values()];
}

// מעבר מהגרסה הקודמת, ששמרה את כל המאגר ב-localStorage: משאירים רק מה שהמשתמש הוסיף או שינה.
export function extractUserFoods(savedDb, shared) {
  const sharedByName = new Map(shared.map((f) => [normalize(f.name), f]));
  return savedDb.filter((f) => {
    const s = sharedByName.get(normalize(f.name));
    return !s || Number(s.points) !== Number(f.points);
  });
}

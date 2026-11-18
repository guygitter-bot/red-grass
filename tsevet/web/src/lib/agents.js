// עזרים לבוטים: צבע קבוע לכל בוט, חיפוש לפי מפתח
const HUES = [248, 280, 215, 168, 330, 30, 190, 350, 130, 60];

export function hueOf(key, agents = []) {
  const i = agents.findIndex((a) => a.key === key);
  if (i >= 0) return HUES[i % HUES.length];
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function findAgent(agents, key) {
  return agents.find((a) => a.key === key) || null;
}

export const TIERS = [
  ['haiku', 'חסכוני'],
  ['sonnet', 'מאוזן'],
  ['opus', 'חזק'],
];

// תמונות הבוטים (דמויות בדויות, נוצרו ב-AI): public/avatars/<מפתח>.webp. בוט בלי תמונה – מוצג האימוג'י שלו
const PHOTOS = ['creative', 'campaigns', 'editor', 'librarian', 'social', 'doctor', 'lawyer', 'coder', 'bursai', 'travel', 'manager'];
export const photoOf = (key) => (PHOTOS.includes(key) ? `avatars/${key}.webp` : '');

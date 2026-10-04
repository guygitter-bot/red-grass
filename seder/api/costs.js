// עלויות של בקשות לשינוי: הערכה לפני הביצוע, העלות בפועל, והיתרה בחשבון הקרדיטים של Claude.
// הכול נשמר כהערות נסתרות בסוף ה-issue של הבקשה (אחרי השורה "---"), כך שאין צורך באחסון נוסף:
//   <!-- seder-estimate {"size":"small","usd":0.4,"note":"..."} -->   ההערכה (נכתבת פעם אחת, לפני הביצוע)
//   <!-- seder-cost {"kind":"work","usd":0.32,"at":"2026-10-04T20:45:39Z"} -->   כל הרצה של Claude (הערכה / עבודה)
// ב-Anthropic אין דרך לקרוא את היתרה, ולכן המשתמשת מקלידה אותה (amount + setAt) ומכאן מורידים את מה שהוצא.

export const SIZES = ['small', 'medium', 'large'];
// מחיר ברירת מחדל לפי גודל השינוי, עד שיש היסטוריה (שינוי קטן עלה בפועל כ-0.32$)
export const DEFAULT_PRICE = { small: 0.4, medium: 1.2, large: 3 };
// מחירי Haiku 4.5 לכל מיליון טוקנים – לחישוב העלות של ההערכה עצמה
export const HAIKU_PRICE = { input: 1, output: 5 };

const MARK = /<!--\s*seder-(estimate|cost)\s+(\{.*?\})\s*-->/g;

const money = (n) => Math.round(n * 10000) / 10000;
const validUsd = (n, max = 1000) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < max;
const MAX_CREDITS = 100000;

function marks(body) {
  const out = [];
  for (const m of String(body || '').matchAll(MARK)) {
    try {
      out.push({ type: m[1], data: JSON.parse(m[2]) });
    } catch {
      // הערה פגומה – מדלגים
    }
  }
  return out;
}

// ההערכה של הבקשה (או null). usd חסר = לא הצלחנו להעריך
export function parseEstimate(body) {
  const e = marks(body).find((m) => m.type === 'estimate')?.data;
  if (!e) return null;
  return {
    size: SIZES.includes(e.size) ? e.size : null,
    usd: validUsd(e.usd) ? e.usd : null,
    note: typeof e.note === 'string' ? e.note.slice(0, 300) : '',
  };
}

// כל ההרצות שעלו כסף בבקשה הזו
export function parseCosts(body) {
  return marks(body)
    .filter((m) => m.type === 'cost' && validUsd(m.data.usd) && !Number.isNaN(Date.parse(m.data.at)))
    .map((m) => ({ kind: m.data.kind === 'estimate' ? 'estimate' : 'work', usd: m.data.usd, at: m.data.at }));
}

export const totalCost = (costs) => money(costs.reduce((s, c) => s + c.usd, 0));

// הערה נסתרת לשמירה בסוף ה-issue. "--" אסור בתוך הערת HTML, ולכן מוחלף
export function marker(type, data) {
  return `<!-- seder-${type} ${JSON.stringify(data).replace(/--/g, '- -')} -->`;
}

// כמה יעלה שינוי בגודל הזה: החציון של העלות בפועל ב-10 הבקשות האחרונות באותו גודל, ובלי היסטוריה – ברירת המחדל
export function priceFor(size, history = []) {
  const key = SIZES.includes(size) ? size : 'medium';
  const past = history.filter((h) => h.size === key && h.usd > 0).slice(0, 10).map((h) => h.usd).sort((a, b) => a - b);
  if (past.length < 2) return DEFAULT_PRICE[key];
  const mid = Math.floor(past.length / 2);
  const median = past.length % 2 ? past[mid] : (past[mid - 1] + past[mid]) / 2;
  // מעגלים כלפי מעלה לעשרה סנט – עדיף הערכה קצת גבוהה מדי
  return Math.max(0.1, Math.ceil(median * 10) / 10);
}

// ההיסטוריה מתוך ה-issues של הבקשות (החדשות קודם): גודל לפי ההערכה, והעלות של העבודה בפועל
export function historyOf(issues) {
  return issues
    .map((i) => {
      const est = parseEstimate(i.body);
      const work = parseCosts(i.body).filter((c) => c.kind === 'work');
      return est?.size && work.length ? { size: est.size, usd: totalCost(work) } : null;
    })
    .filter(Boolean);
}

// עלות של קריאה ל-Haiku לפי הטוקנים
export function haikuCost(usage = {}) {
  const tokens = (n) => (Number.isFinite(n) ? n : 0);
  return money((tokens(usage.input_tokens) * HAIKU_PRICE.input + tokens(usage.output_tokens) * HAIKU_PRICE.output) / 1e6);
}

// היתרה: מה שהוקלד, פחות כל מה שהוצא אחרי שהוקלד
export function balanceOf(credits, issues) {
  if (!credits || !validUsd(credits.amount, MAX_CREDITS) || Number.isNaN(Date.parse(credits.setAt))) return null;
  const since = Date.parse(credits.setAt);
  const spent = money(issues.flatMap((i) => parseCosts(i.body)).filter((c) => Date.parse(c.at) > since).reduce((s, c) => s + c.usd, 0));
  return { amount: credits.amount, setAt: credits.setAt, spent, balance: money(credits.amount - spent) };
}

// הסכום שהמשתמשת הקלידה (אפשר גם "12.5$" או "12,5")
export function cleanAmount(value) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[$\s]/g, '').replace(',', '.'));
  return validUsd(n, MAX_CREDITS) && String(value ?? '').trim() !== '' ? Math.round(n * 100) / 100 : null;
}

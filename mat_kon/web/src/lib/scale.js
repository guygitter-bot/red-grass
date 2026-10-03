// שינוי מספר מנות: מכפילים את הכמויות בשורות המצרכים.
// מכפילים כל מספר בשורה, חוץ ממספרים שהם לא כמות: אחוזים, ס"מ, מעלות, זמנים, גודל (L) וכו'.

const FRACTIONS = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };
const WORDS = [
  ['חצי', 0.5],
  ['רבע', 0.25],
  ['שליש', 1 / 3],
];

// אחרי המספר: לא כמות
const NOT_AMOUNT = /^\s*(%|אחוז|ס["״]?מ|סנטימטר|cm|מעלות|°|דקות|דקה|דק['׳]|שעות|שעה|שניות|minutes?|min|hours?|[LMS]\b)/i;
// לפני המספר: לא כמות ("מעל 16%", "גודל 3")
const NOT_AMOUNT_BEFORE = /(מעל|עד|גודל|מספר|תבנית|קוטר|מס['׳])\s*$/;

const NUMBER = /(\d+(?:[.,]\d+)?\s*[½⅓⅔¼¾⅛]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅛])(?:\s*[-–]\s*(\d+(?:[.,]\d+)?|\d+\/\d+))?/g;

export function parseNumber(s) {
  const t = String(s).trim().replace(',', '.');
  if (t in FRACTIONS) return FRACTIONS[t];
  const mixedSymbol = t.match(/^(\d+(?:\.\d+)?)\s*([½⅓⅔¼¾⅛])$/);
  if (mixedSymbol) return Number(mixedSymbol[1]) + FRACTIONS[mixedSymbol[2]];
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

// מספר יפה לקריאה: שברים נפוצים כסימנים, גרמים ומ"ל שלמים
export function formatAmount(n) {
  if (!Number.isFinite(n)) return '';
  if (n >= 20) return String(Math.round(n));
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  const symbols = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
  const [value, symbol] = symbols.reduce((best, s) => (Math.abs(s[0] - rest) < Math.abs(best[0] - rest) ? s : best));
  // שמיניות (1⅛, 2⅜...) רק כשזה בדיוק שמינית
  const eighth = Math.round(rest * 8);
  if (eighth % 2 === 1 && Math.abs(eighth / 8 - rest) < 0.01) return `${whole || ''}${{ 1: '⅛', 3: '⅜', 5: '⅝', 7: '⅞' }[eighth]}`;
  if (Math.abs(value - rest) < 0.04) {
    const w = value === 1 ? whole + 1 : whole;
    if (!symbol) return String(w);
    return w ? `${w}${symbol}` : symbol;
  }
  return String(Math.round(n * 10) / 10);
}

export function scaleIngredient(line, factor) {
  const text = String(line || '');
  if (!factor || Math.abs(factor - 1) < 1e-9) return text;
  let out = '';
  let last = 0;
  let changed = false;
  for (const m of text.matchAll(NUMBER)) {
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (NOT_AMOUNT.test(after) || NOT_AMOUNT_BEFORE.test(before)) continue;
    // מספר שהוא חלק ממילה/קוד (L1, B12) - לא נוגעים
    if (/[A-Za-z]$/.test(before)) continue;
    const a = formatAmount(parseNumber(m[1]) * factor);
    const b = m[2] ? `-${formatAmount(parseNumber(m[2]) * factor)}` : '';
    out += text.slice(last, m.index) + a + b;
    last = m.index + m[0].length;
    changed = true;
  }
  out += text.slice(last);
  if (changed) return out;
  // "חצי כוס סוכר" - כמות במילים בתחילת השורה
  for (const [word, value] of WORDS) {
    if (text.startsWith(`${word} `)) return `${formatAmount(value * factor)} ${text.slice(word.length + 1)}`;
  }
  // "ביצה" / "קורט מלח" בלי כמות - מוסיפים מכפיל רק כשמגדילים בשלמים
  return text;
}

// כמה מנות כתוב במתכון ("6 מנות", "12-14 עוגיות") - המספר הראשון, או null ("תבנית 24 ס"מ")
export function baseServings(servings) {
  const t = String(servings || '');
  if (/תבנית|קוטר|ס["״]מ|cm/i.test(t) && !/מנות|יחידות|עוגיות|כדורים|פרוסות|servings|pieces/i.test(t)) return null;
  const m = t.match(/\d+(?:[.,]\d+)?/);
  const n = m ? parseNumber(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 && n < 500 ? n : null;
}

export const scaleSections = (sections, factor) =>
  (sections || []).map((s) => ({ ...s, items: s.items.map((i) => scaleIngredient(i, factor)) }));

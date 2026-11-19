// כלים משותפים למחוללי השאלות (פונקציות טהורות)

// שאלה עם 4 תשובות לבחירה. התשובה והמסיחים הופכים למחרוזות, בלי כפילויות
export function mc(rng, base, answer, distractors, count = 4) {
  const ans = String(answer);
  const seen = new Set([ans]);
  const wrong = [];
  for (const d of rng.shuffle(distractors.map(String))) {
    if (!seen.has(d)) { seen.add(d); wrong.push(d); }
  }
  if (wrong.length < count - 1) throw new Error(`חסרים מסיחים: ${base.text}`);
  const options = rng.shuffle([ans, ...wrong.slice(0, count - 1)]);
  return { ...base, options, answer: ans };
}

// שאלה עם תשובה מספרית שהילד מקליד
export function numInput(base, answer) {
  return { ...base, input: true, answer: String(answer) };
}

// תשובה מספרית: לפעמים לבחירה (עם מסיחים קרובים) ולפעמים להקלדה
export function numQ(rng, base, answer, extras = [], pInput = 0.5) {
  if (rng.chance(pInput)) return numInput(base, answer);
  return numChoice(rng, base, answer, extras);
}

export function numChoice(rng, base, answer, extras = []) {
  const pool = [];
  for (const e of rng.shuffle(extras)) if (Number.isInteger(e) && e >= 0 && e !== answer) pool.push(e);
  const near = [1, 2, 3, 5, 10, 20, 100].flatMap((k) => [answer + k, answer - k]).filter((x) => x >= 0 && x !== answer);
  const small = rng.shuffle(near.filter((x) => Math.abs(x - answer) <= Math.max(3, answer * 0.3)));
  const rest = rng.shuffle(near);
  return mc(rng, base, answer, [...pool, ...small, ...rest]);
}

// ---- מחשבון קטן לתרגילים (לבדיקת התשובות, ולחישוב טעויות נפוצות) ----
// opts.ltr: כל הפעולות באותו סדר חשיבות משמאל לימין; opts.noParens: מתעלמים מסוגריים
export function evalExpr(src, opts = {}) {
  let toks = src.replace(/\s*=\s*□?\s*$/, '').match(/\d+|[+−\-×*:/()]/g) || [];
  if (opts.noParens) toks = toks.filter((t) => t !== '(' && t !== ')');
  let i = 0;
  const peek = () => toks[i];
  const mul = (t) => t === '×' || t === '*' || t === ':' || t === '/';
  const add = (t) => t === '+' || t === '-' || t === '−';
  const apply = (o, a, b) => (o === '×' || o === '*' ? a * b : o === ':' || o === '/' ? a / b : o === '+' ? a + b : a - b);
  function prim() {
    const t = toks[i++];
    if (t === '(') { const v = opts.ltr ? flat() : sum(); i++; return v; }
    return Number(t);
  }
  function term() {
    let v = prim();
    while (mul(peek())) { const o = toks[i++]; v = apply(o, v, prim()); }
    return v;
  }
  function sum() {
    let v = term();
    while (add(peek())) { const o = toks[i++]; v = apply(o, v, term()); }
    return v;
  }
  function flat() {
    let v = prim();
    while (i < toks.length && peek() !== ')') { const o = toks[i++]; v = apply(o, v, prim()); }
    return v;
  }
  return opts.ltr ? flat() : sum();
}

// ---- שמות והקשרים לבעיות מילוליות ----
export const NAMES = [
  { n: 'דני', g: 'm' }, { n: 'יובל', g: 'm' }, { n: 'איתי', g: 'm' }, { n: 'עומר', g: 'm' }, { n: 'גיא', g: 'm' }, { n: 'אורי', g: 'm' },
  { n: 'נועה', g: 'f' }, { n: 'מאיה', g: 'f' }, { n: 'שירה', g: 'f' }, { n: 'תמר', g: 'f' }, { n: 'יעל', g: 'f' }, { n: 'רותם', g: 'f' },
];
// צורת פועל לפי המין של השם
export const v = (p, m, f) => (p.g === 'm' ? m : f);
export const OBJECTS = ['בולים', 'מדבקות', 'גולות', 'קלפים', 'עפרונות', 'מחברות', 'ספרים', 'כדורים'];
export const CONTAINERS = [
  { s: 'קופסה', pl: 'קופסאות' }, { s: 'שקית', pl: 'שקיות' }, { s: 'סל', pl: 'סלים' }, { s: 'מגש', pl: 'מגשים' }, { s: 'צלחת', pl: 'צלחות' },
];
export const twoNames = (rng) => {
  const a = rng.pick(NAMES);
  let b = rng.pick(NAMES);
  while (b.n === a.n) b = rng.pick(NAMES);
  return [a, b];
};

// שברים: "3/4" (מוצג בממשק כשבר עומד)
export const F = (n, d) => `${n}/${d}`;
// השוואת שברים בלי מספרים עשרוניים: חיובי = הראשון גדול
export const cmpFrac = (a, b) => a[0] * b[1] - b[0] * a[1];
export const DEN = [2, 3, 4, 5, 6, 8, 10, 12];

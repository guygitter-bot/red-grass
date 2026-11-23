// מספרים טבעיים ופעולות חשבון (נושאים 1-8). כל פונקציה מקבלת rng ומחזירה שאלה אחת
import { mc, numQ, numInput, evalExpr, NAMES, v, OBJECTS, CONTAINERS, twoNames } from './common.js';
import { numberLineSvg } from '../svg.js';

const ASK = 'מה התוצאה?';

// ---------- 1. סדרות ----------
const STEPS = [2, 3, 4, 5, 6, 10, 20, 25, 50, 100];
// סדרה של 9 איברים, עולה או יורדת, עד 9999
function sequence(rng) {
  const d = rng.pick(STEPS);
  const dec = rng.chance(0.3);
  const span = d * 8;
  const maxStart = Math.min(9999 - span, d >= 50 ? 3000 : 300);
  const start = d >= 20 || rng.chance(0.4) ? d * rng.int(0, Math.floor(maxStart / d)) : rng.int(0, maxStart);
  const terms = Array.from({ length: 9 }, (_, i) => (dec ? start + span - i * d : start + i * d));
  return { d, dec, terms };
}
const showSeq = (a) => a.join(', ');

function seqMissing(rng) {
  const { d, dec, terms } = sequence(rng);
  const shown = terms.slice(0, 6);
  const idx = rng.int(1, 4);
  const ans = shown[idx];
  const expr = shown.map((t, i) => (i === idx ? '□' : t)).join(', ');
  return numQ(rng, { kind: 'seq', text: 'מה המספר החסר בסדרה?', expr, explain: `בסדרה ${dec ? 'מחסירים' : 'מוסיפים'} ${d} בכל צעד, ולכן המספר החסר הוא ${ans}.` }, ans, [ans + d, ans - d, ans + 1, ans - 1]);
}

function seqNext(rng) {
  const { d, dec, terms } = sequence(rng);
  const ans = terms[4];
  return numQ(rng, { kind: 'seq', text: 'מה המספר הבא בסדרה?', expr: `${showSeq(terms.slice(0, 4))}, …`, explain: `${terms[3]} ${dec ? '−' : '+'} ${d} = ${ans}. בסדרה ${dec ? 'מחסירים' : 'מוסיפים'} ${d} בכל צעד.` }, ans, [ans + d, ans - d, terms[3], ans + 1]);
}

function seqRule(rng) {
  const { d, dec, terms } = sequence(rng);
  const ans = `${dec ? 'מחסירים' : 'מוסיפים'} ${d}`;
  const others = STEPS.filter((s) => s !== d);
  const o1 = rng.pick(others);
  const o2 = rng.pick(others);
  const opts = [`${dec ? 'מוסיפים' : 'מחסירים'} ${d}`, `מוסיפים ${o1}`, `מחסירים ${o2}`, `${dec ? 'מחסירים' : 'מוסיפים'} ${o1 === d ? 1 : o1}`];
  return mc(rng, { kind: 'seq', text: 'מה הכלל של הסדרה?', expr: `${showSeq(terms.slice(0, 5))}, …`, explain: `בודקים את ההפרש בין שני מספרים סמוכים: ${terms[0]} ו-${terms[1]}. ${dec ? 'מחסירים' : 'מוסיפים'} ${d} בכל צעד.` }, ans, opts);
}

function seqBelongs(rng) {
  const { d, terms } = sequence(rng);
  const k = rng.int(5, 8);
  const ans = terms[k];
  const bad = [1, 2, 3, 5, 10, Math.floor(d / 2), d + 1, d - 1, 7].filter((o) => o > 0 && o % d !== 0).flatMap((o) => [ans + o, ans - o]).filter((x) => x >= 0);
  return mc(rng, { kind: 'seq', text: 'איזה מהמספרים יופיע בהמשך הסדרה?', expr: `${showSeq(terms.slice(0, 5))}, …`, explain: `מוסיפים/מחסירים ${d} שוב ושוב, והמספר ${ans} הוא אחד מאיברי הסדרה. שאר המספרים לא נופלים על הקפיצות.` }, ans, bad);
}

// ---------- 2. בניית מספרים מספרות נתונות ----------
const KINDS = {
  max: ['המספר הגדול ביותר', () => true, (a) => Math.max(...a), 'מסדרים את הספרות מהגדולה לקטנה.'],
  min: ['המספר הקטן ביותר', () => true, (a) => Math.min(...a), 'מסדרים את הספרות מהקטנה לגדולה, אבל המספר לא יכול להתחיל ב-0 – אז שמים את הספרה הקטנה ביותר שאינה 0 בהתחלה.'],
  maxEven: ['המספר הזוגי הגדול ביותר', (n) => n % 2 === 0, (a) => Math.max(...a), 'מספר זוגי נגמר בספרה זוגית. בוחרים ספרה זוגית לסוף, ואת השאר מסדרים מהגדולה לקטנה.'],
  minEven: ['המספר הזוגי הקטן ביותר', (n) => n % 2 === 0, (a) => Math.min(...a), 'מספר זוגי נגמר בספרה זוגית, והוא לא מתחיל ב-0. בודקים את האפשרויות ובוחרים את הקטנה.'],
  maxOdd: ['המספר האי-זוגי הגדול ביותר', (n) => n % 2 === 1, (a) => Math.max(...a), 'מספר אי-זוגי נגמר בספרה אי-זוגית. בוחרים ספרה אי-זוגית לסוף, ואת השאר מסדרים מהגדולה לקטנה.'],
};
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
}
function digitsQ(rng) {
  for (;;) {
    const cnt = rng.chance(0.8) ? 4 : 3;
    let ds = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, cnt);
    if (rng.chance(0.5) && !ds.includes(0)) ds[0] = 0;
    const all = permutations(ds);
    const valid = all.filter((p) => p[0] !== 0).map((p) => Number(p.join('')));
    const kind = rng.pick(Object.keys(KINDS));
    const [label, filter, choose, hint] = KINDS[kind];
    const list = valid.filter(filter);
    if (list.length < 2) continue;
    const ans = choose(list);
    // טעות נפוצה: מספר שמתחיל ב-0
    const trap = kind === 'min' && ds.includes(0) ? [...ds].sort((a, b) => a - b).join('') : null;
    const near = valid.filter((n) => n !== ans).sort((a, b) => Math.abs(a - ans) - Math.abs(b - ans)).slice(0, 6);
    const dist = [...near];
    if (trap && rng.chance(0.8)) dist.unshift(trap);
    if (new Set([...dist, ans]).size < 4) continue;
    // המסיחים הקרובים מופיעים קודם, ואם יש "טעות נפוצה" – היא תמיד בפנים
    const picked = trap && dist[0] === trap ? [trap, ...rng.shuffle(near).slice(0, 2)] : rng.shuffle(near).slice(0, 3);
    return mc(rng, {
      kind: 'digits', meta: { digits: ds, which: kind },
      text: `בונים מספר בן ${cnt} ספרות מהספרות שבתרגיל, כל ספרה פעם אחת בדיוק (מספר לא מתחיל ב-0). מהו ${label}?`,
      expr: ds.join(', '), explain: `${hint} התשובה: ${ans}.`,
    }, ans, picked);
  }
}

// ---------- 3. ארבע פעולות החשבון ----------
function calc(rng, expr, ans, extras, explain, pInput = 0.55) {
  return numQ(rng, { kind: 'calc', text: ASK, expr: `${expr} = □`, meta: { expr }, explain }, ans, extras, pInput);
}
const opsGens = [
  (rng) => {
    const a = rng.int(1000, 8999), b = rng.int(100, 10000 - a);
    const s = a + b;
    return calc(rng, `${a} + ${b}`, s, [s + 10, s - 10, s + 100, s - 100, s + 1000], `${a} + ${b} = ${s}. מחברים יחידות, עשרות, מאות ואלפים – ומעבירים לעמודה הבאה כשצריך.`);
  },
  (rng) => {
    const a = rng.int(1000, 9999), b = rng.int(100, a - 1);
    const s = a - b;
    return calc(rng, `${a} − ${b}`, s, [s + 10, s - 10, s + 100, s - 100, s + 1000], `${a} − ${b} = ${s}. מחסירים עמודה אחרי עמודה, ו"שואלים" מהעמודה הבאה כשצריך.`);
  },
  (rng) => {
    const a = rng.int(2, 10), b = rng.int(2, 10);
    return calc(rng, `${a} × ${b}`, a * b, [a * b + a, a * b - a, a * b + b, a * b - b, a + b], `${a} × ${b} = ${a * b}. כך זה בלוח הכפל.`, 0.4);
  },
  (rng) => {
    let a = rng.int(11, 99); if (a % 10 === 0) a += rng.int(1, 9);
    const b = rng.int(2, 9);
    const t = Math.floor(a / 10) * 10, u = a % 10;
    return calc(rng, `${a} × ${b}`, a * b, [a * b + 10, a * b - 10, t * b + u, a * b + b], `מפרקים: ${t} × ${b} = ${t * b}, ו-${u} × ${b} = ${u * b}. ביחד ${a * b}.`);
  },
  (rng) => {
    const x = rng.int(2, 9), y = rng.int(2, 9);
    const form = rng.int(0, 2);
    const a = form === 0 ? x * 10 : form === 1 ? x * 100 : x * 10;
    const b = form === 2 ? y * 10 : y;
    const ans = a * b;
    return calc(rng, `${a} × ${b}`, ans, [ans * 10, ans / 10, ans + 10, ans - 10], `מכפילים ${a / (form === 1 ? 100 : 10)} × ${b / (form === 2 ? 10 : 1)} = ${(a / (form === 1 ? 100 : 10)) * (b / (form === 2 ? 10 : 1))} ואחר כך מוסיפים את האפסים: ${ans}.`);
  },
  (rng) => {
    const d = rng.int(2, 9), q = rng.chance(0.5) ? rng.int(2, 12) : rng.int(10, 99);
    return calc(rng, `${d * q} : ${d}`, q, [q + 1, q - 1, q + 10, q * 2, d], `${d * q} : ${d} = ${q}, כי ${q} × ${d} = ${d * q}.`);
  },
  (rng) => {
    const d = rng.int(2, 9), q = rng.int(2, 20), r = rng.int(1, d - 1);
    const a = d * q + r;
    const ans = `${q} ושארית ${r}`;
    const rs = Array.from({ length: d - 1 }, (_, i) => i + 1).filter((x) => x !== r);
    const opts = [...rs.map((x) => `${q} ושארית ${x}`), `${q + 1} ושארית ${r}`, `${q - 1} ושארית ${r}`, `${q + 1} ושארית ${rs.length ? rs[0] : r + d}`, `${q}`].filter((o) => o !== ans && !o.startsWith('0 '));
    return mc(rng, { kind: 'rem', text: 'מה התוצאה? (מנה ושארית)', expr: `${a} : ${d}`, meta: { a, d }, explain: `${d} × ${q} = ${d * q}, ו-${a} − ${d * q} = ${r}. לכן ${a} : ${d} = ${q} ושארית ${r}. השארית תמיד קטנה מהמחלק.` }, ans, opts);
  },
];

// ---------- 4. סדר פעולות החשבון ----------
const orderPatterns = [
  (r) => { const a = r.int(2, 30), b = r.int(2, 9), c = r.int(2, 9); return [`${a} + ${b} × ${c}`, `קודם כפל: ${b} × ${c} = ${b * c}, ואחר כך ${a} + ${b * c} = ${a + b * c}.`]; },
  (r) => { const b = r.int(2, 6), c = r.int(2, 6), a = b * c + r.int(0, 20); return [`${a} − ${b} × ${c}`, `קודם כפל: ${b} × ${c} = ${b * c}, ואחר כך ${a} − ${b * c} = ${a - b * c}.`]; },
  (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(1, 30); return [`${a} × ${b} + ${c}`, `קודם כפל: ${a} × ${b} = ${a * b}, ואחר כך ${a * b} + ${c} = ${a * b + c}.`]; },
  (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(1, a * b); return [`${a} × ${b} − ${c}`, `קודם כפל: ${a} × ${b} = ${a * b}, ואחר כך ${a * b} − ${c} = ${a * b - c}.`]; },
  (r) => { const b = r.int(2, 9), q = r.int(2, 9), c = r.int(1, 20); return [`${b * q} : ${b} + ${c}`, `קודם חילוק: ${b * q} : ${b} = ${q}, ואחר כך ${q} + ${c} = ${q + c}.`]; },
  (r) => { const a = r.int(2, 30), c = r.int(2, 9), q = r.int(2, 9); return [`${a} + ${c * q} : ${c}`, `קודם חילוק: ${c * q} : ${c} = ${q}, ואחר כך ${a} + ${q} = ${a + q}.`]; },
  (r) => { const a = r.int(2, 15), b = r.int(2, 15), c = r.int(2, 9); return [`(${a} + ${b}) × ${c}`, `קודם הסוגריים: ${a} + ${b} = ${a + b}, ואחר כך ${a + b} × ${c} = ${(a + b) * c}.`]; },
  (r) => { const b = r.int(2, 9), a = b + r.int(1, 15), c = r.int(2, 9); return [`(${a} − ${b}) × ${c}`, `קודם הסוגריים: ${a} − ${b} = ${a - b}, ואחר כך ${a - b} × ${c} = ${(a - b) * c}.`]; },
  (r) => { const a = r.int(2, 9), b = r.int(2, 15), c = r.int(2, 15); return [`${a} × (${b} + ${c})`, `קודם הסוגריים: ${b} + ${c} = ${b + c}, ואחר כך ${a} × ${b + c} = ${a * (b + c)}.`]; },
  (r) => { const b = r.int(2, 15), c = r.int(2, 15), a = b + c + r.int(0, 20); return [`${a} − (${b} + ${c})`, `קודם הסוגריים: ${b} + ${c} = ${b + c}, ואחר כך ${a} − ${b + c} = ${a - b - c}.`]; },
  (r) => { const c = r.int(2, 9), q = r.int(3, 12), a = r.int(1, c * q - 1); const b = c * q - a; return [`(${a} + ${b}) : ${c}`, `קודם הסוגריים: ${a} + ${b} = ${a + b}, ואחר כך ${a + b} : ${c} = ${q}.`]; },
  (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9), d = r.int(2, 9); return [`${a} × ${b} + ${c} × ${d}`, `קודם שני הכפלים: ${a * b} ו-${c * d}, ואחר כך ${a * b} + ${c * d} = ${a * b + c * d}.`]; },
  (r) => { const b = r.int(2, 9), c = r.int(2, 9), a = r.int(2, 30), d = r.int(1, a + b * c); return [`${a} + ${b} × ${c} − ${d}`, `קודם כפל: ${b} × ${c} = ${b * c}. אחר כך משמאל לימין: ${a} + ${b * c} = ${a + b * c}, ו-${a + b * c} − ${d} = ${a + b * c - d}.`]; },
  // חילוק במספר שבסוגריים: 60 : (4 + 6) – חייבת להישאר האחרונה ברשימה (orderDiv)
  (r) => { const c = r.int(4, 10), a = r.int(1, c - 1), q = r.int(2, 9); return [`${c * q} : (${a} + ${c - a})`, `קודם הסוגריים: ${a} + ${c - a} = ${c}, ואחר כך ${c * q} : ${c} = ${q}.`]; },
];
function orderQ(rng, pattern) {
  for (;;) {
    const [expr, steps] = (pattern || rng.pick(orderPatterns))(rng);
    const ans = evalExpr(expr);
    if (!Number.isInteger(ans) || ans < 0) continue;
    const wrong = evalExpr(expr, expr.includes('(') ? { noParens: true } : { ltr: true });
    const extras = Number.isInteger(wrong) && wrong >= 0 && wrong !== ans ? [wrong] : [];
    const q = { kind: 'calc', text: 'מה התוצאה? (שימו לב לסדר הפעולות)', expr: `${expr} = □`, meta: { expr }, explain: `${steps} סדר הפעולות: סוגריים, אחר כך כפל וחילוק, ובסוף חיבור וחיסור.` };
    return numQ(rng, q, ans, [...extras, ans + 10, ans - 10, ans + 1], extras.length ? 0.35 : 0.5);
  }
}

// ---------- 5. תכונות האפס והאחד ----------
function zeroOne(rng) {
  const n = rng.int(2, 99);
  const forms = [
    [`${n} × 0`, 0, 'כל מספר כפול 0 נותן 0.'],
    [`0 × ${n}`, 0, 'כל מספר כפול 0 נותן 0.'],
    [`${n} × 1`, n, 'כל מספר כפול 1 נשאר אותו דבר.'],
    [`1 × ${n}`, n, 'כל מספר כפול 1 נשאר אותו דבר.'],
    [`${n} : 1`, n, 'כשמחלקים ב-1 המספר נשאר אותו דבר.'],
    [`0 : ${n}`, 0, 'אם מחלקים 0 לכמה חלקים – עדיין אין כלום: 0.'],
    [`${n} + 0`, n, 'כשמוסיפים 0 המספר נשאר אותו דבר.'],
    [`${n} − 0`, n, 'כשמחסירים 0 המספר נשאר אותו דבר.'],
    [`${n} − ${n}`, 0, 'כשמחסירים מספר מעצמו מקבלים 0.'],
    [`${n} : ${n}`, 1, 'כשמחלקים מספר בעצמו מקבלים 1.'],
  ];
  const [expr, ans, why] = rng.pick(forms);
  return numQ(rng, { kind: 'calc', text: ASK, expr: `${expr} = □`, meta: { expr }, explain: `${expr} = ${ans}. ${why}` }, ans, [0, 1, n, n + 1, n - 1], 0.25);
}
function zeroOneMissing(rng) {
  const n = rng.int(2, 99);
  const forms = [
    [`□ × 1 = ${n}`, n, 'כפל ב-1 לא משנה את המספר.'],
    [`${n} × □ = ${n}`, 1, 'מספר כפול 1 נשאר אותו דבר.'],
    [`${n} × □ = 0`, 0, 'רק כפל ב-0 נותן 0.'],
    [`${n} + □ = ${n}`, 0, 'חיבור של 0 לא משנה את המספר.'],
    [`${n} − □ = ${n}`, 0, 'חיסור של 0 לא משנה את המספר.'],
    [`${n} − □ = 0`, n, 'מחסירים את המספר מעצמו.'],
    [`□ : 1 = ${n}`, n, 'חילוק ב-1 לא משנה את המספר.'],
    [`${n} : □ = ${n}`, 1, 'חילוק ב-1 לא משנה את המספר.'],
    [`${n} : □ = 1`, n, 'מספר מחולק בעצמו נותן 1.'],
    [`□ : ${n} = 0`, 0, '0 מחולק בכל מספר נותן 0.'],
  ];
  const [expr, ans, why] = rng.pick(forms);
  return numQ(rng, { kind: 'missing', text: 'איזה מספר חסר?', expr, meta: { expr }, explain: `המספר החסר הוא ${ans}. ${why}` }, ans, [0, 1, n, n + 1], 0.3);
}
function zeroOneTrue(rng) {
  const n = rng.int(2, 99);
  const T = [`${n} × 0 = 0`, `${n} × 1 = ${n}`, `${n} + 0 = ${n}`, `${n} − 0 = ${n}`, `${n} − ${n} = 0`, `${n} : ${n} = 1`, `0 : ${n} = 0`, `${n} : 1 = ${n}`];
  const Fa = [`${n} × 0 = ${n}`, `${n} × 1 = 1`, `${n} + 0 = 0`, `${n} − 0 = 0`, `${n} − ${n} = ${n}`, `${n} : ${n} = 0`, `0 : ${n} = ${n}`, `${n} : 1 = 1`, `${n} × 1 = 0`, `0 × ${n} = ${n}`];
  const ans = rng.pick(T);
  return mc(rng, { kind: 'truth', text: 'איזה שוויון נכון?', explain: `${ans} – זו התכונה הנכונה. בשאר השוויונות יש טעות בתוצאה.` }, ans, Fa);
}

// ---------- 6. משמעות הכפל – השוואה "פי כמה" ----------
function timesMore(rng) {
  const [p1, p2] = twoNames(rng);
  const o = rng.pick(OBJECTS), a = rng.int(2, 12), k = rng.int(2, 10);
  const ans = a * k;
  return numQ(rng, { kind: 'times', text: `ל${p1.n} יש ${a} ${o}. ל${p2.n} יש פי ${k} יותר ${o}. כמה ${o} יש ל${p2.n}?`, explain: `פי ${k} זה כפול ${k}: ${a} × ${k} = ${ans}.` }, ans, [a + k, ans + a, ans - a, a]);
}
function timesHowMany(rng) {
  const a = rng.int(2, 12), k = rng.int(2, 10);
  const b = a * k;
  return numQ(rng, { kind: 'times', text: `פי כמה גדול המספר ${b} מהמספר ${a}?`, explain: `${b} : ${a} = ${k}, כי ${a} × ${k} = ${b}. לכן ${b} גדול פי ${k} מ-${a}.` }, k, [b - a, k + 1, k - 1, a], 0.5);
}
function timesReverse(rng) {
  const [p1, p2] = twoNames(rng);
  const o = rng.pick(OBJECTS), a = rng.int(2, 12), k = rng.int(2, 10);
  const b = a * k;
  const defObj = 'ה' + o;
  return numQ(rng, { kind: 'times', text: `ל${p1.n} יש ${b} ${o}. זה פי ${k} ממספר ${defObj} שיש ל${p2.n}. כמה ${o} יש ל${p2.n}?`, explain: `${b} גדול פי ${k} ממה שיש ל${p2.n}, לכן מחלקים: ${b} : ${k} = ${a}.` }, a, [b - k, b * k, k, a + 1]);
}
function timesDouble(rng) {
  const base = rng.int(3, 25), k = rng.pick([2, 3, 4, 5, 10]);
  const ans = base * k;
  return numQ(rng, { kind: 'times', text: `איזה מספר גדול פי ${k} מ-${base}?`, explain: `גדול פי ${k} מ-${base} זה ${base} × ${k} = ${ans}.` }, ans, [base + k, ans + base, ans - base]);
}

// ---------- 7. בעיות מילוליות ----------
function wordProblem(rng) {
  const p = rng.pick(NAMES), o = rng.pick(OBJECTS), c = rng.pick(CONTAINERS);
  const T = [
    () => { const a = rng.int(12, 90), b = rng.int(12, 90); return [`${p.n} ${v(p, 'אסף', 'אספה')} ${a} ${o} ביום ראשון ועוד ${b} ${o} ביום שני. כמה ${o} ${v(p, 'אסף', 'אספה')} ${p.n} בסך הכול?`, a + b, `${a} + ${b} = ${a + b}`, [a - b > 0 ? a - b : a, a + b + 10, a * 2]]; },
    () => { const a = rng.int(100, 900), b = rng.int(20, a - 10); return [`בספרייה של בית הספר היו ${a} ספרים. ${b} ספרים הושאלו. כמה ספרים נשארו בספרייה?`, a - b, `${a} − ${b} = ${a - b}`, [a + b, a - b + 10, a - b - 10]]; },
    () => { const a = rng.int(6, 24), b = rng.int(3, 9); return [`בכל ${c.s} יש ${a} ${o}. כמה ${o} יש ב-${b} ${c.pl}?`, a * b, `${a} × ${b} = ${a * b}`, [a + b, a * b + a, a * b - b]]; },
    () => { const a = rng.int(3, 12), b = rng.int(3, 9); return [`${a * b} ${o} חולקו שווה בשווה ל-${b} ${c.pl}. כמה ${o} יש בכל ${c.s}?`, a, `${a * b} : ${b} = ${a}`, [a * b - b, a + 1, b, a * b]]; },
    () => { const d = rng.int(3, 9), q = rng.int(3, 12), r = rng.int(1, d - 1); const x = d * q + r; return [`ל${p.n} יש ${x} ${o}. ${v(p, 'הוא ממלא', 'היא ממלאת')} שקיות, ובכל שקית ${d} ${o}. כמה שקיות מלאות יהיו?`, q, `${x} : ${d} = ${q} ושארית ${r}, ולכן יש ${q} שקיות מלאות (ועוד ${r} ${o} שנשארו).`, [q + 1, r, x - d]]; },
    () => { const a = rng.int(2, 6), pr = rng.int(3, 12), pay = a * pr < 50 ? 50 : 100; return [`${p.n} ${v(p, 'קנה', 'קנתה')} ${a} מחברות, מחיר כל מחברת ${pr} ש"ח. ${v(p, 'הוא שילם', 'היא שילמה')} בשטר של ${pay} ש"ח. כמה עודף ${v(p, 'קיבל', 'קיבלה')}?`, pay - a * pr, `${a} × ${pr} = ${a * pr} ש"ח עלו המחברות. ${pay} − ${a * pr} = ${pay - a * pr}.`, [a * pr, pay - pr, pay - a * pr + 10]]; },
    () => { const a = rng.int(30, 80), b = rng.int(5, 25), d = rng.int(5, 25); return [`באוטובוס היו ${a} נוסעים. בתחנה ירדו ${b} נוסעים ועלו ${d} נוסעים. כמה נוסעים יש באוטובוס עכשיו?`, a - b + d, `${a} − ${b} = ${a - b}, ואחר כך ${a - b} + ${d} = ${a - b + d}`, [a + b + d, a - b - d > 0 ? a - b - d : a, a - d + b]]; },
    () => { const a = rng.int(8, 20), b = rng.int(8, 20), k = rng.int(2, 6); return [`בכיתה ${a} בנות ו-${b} בנים. כל תלמיד קיבל ${k} מדבקות. כמה מדבקות חולקו בסך הכול?`, (a + b) * k, `${a} + ${b} = ${a + b} תלמידים. ${a + b} × ${k} = ${(a + b) * k}`, [a + b + k, a * k, (a + b) * k - k]]; },
    () => { const [p1, p2] = twoNames(rng); const a = rng.int(10, 60), b = rng.int(5, 30); return [`ל${p1.n} יש ${a} ${o}. ל${p2.n} יש ${b} ${o} יותר מאשר ל${p1.n}. כמה ${o} יש לשניהם יחד?`, 2 * a + b, `ל${p2.n} יש ${a} + ${b} = ${a + b}. ביחד: ${a} + ${a + b} = ${2 * a + b}`, [a + b, a + b + b, 2 * a]]; },
    () => { const b = rng.int(2, 6), cc = rng.int(2, 5), a = b * cc + rng.int(1, 15); return [`סרט באורך ${a} מטרים. גזרו ממנו ${b} חתיכות, כל חתיכה באורך ${cc} מטרים. כמה מטרים נשארו מהסרט?`, a - b * cc, `${b} × ${cc} = ${b * cc} מטרים נגזרו. ${a} − ${b * cc} = ${a - b * cc}`, [b * cc, a - cc, a + b * cc]]; },
    () => { const pr = rng.int(3, 9), q = rng.int(4, 12), k = rng.int(2, 6), m = rng.int(2, 6); return [`ארטיק עולה ${pr} ש"ח וגלידה עולה ${q} ש"ח. כמה עולים ${k} ארטיקים ו-${m} גלידות?`, k * pr + m * q, `${k} × ${pr} = ${k * pr}, ו-${m} × ${q} = ${m * q}. ביחד ${k * pr + m * q} ש"ח`, [(k + m) * pr, (k + m) * q, k * pr + q]]; },
    () => { const a = rng.int(6, 20), b = rng.int(3, 9), tot = a * b + rng.int(5, 60); return [`${p.n} ${v(p, 'קרא', 'קראה')} ${a} עמודים בכל יום במשך ${b} ימים. הספר מכיל ${tot} עמודים. כמה עמודים נשארו ${v(p, 'לו', 'לה')} לקרוא?`, tot - a * b, `${a} × ${b} = ${a * b} עמודים נקראו. ${tot} − ${a * b} = ${tot - a * b}`, [a * b, tot - a, tot + a * b]]; },
  ];
  const [text, ans, explain, extras] = rng.pick(T)();
  return numQ(rng, { kind: 'word', text, explain: `הפתרון: ${explain}.`.replace('..', '.') }, ans, extras, 0.5);
}

// ---------- 8. כתיבת שאלה מילולית לתרגיל נתון ----------
// סיפור קצר לכל פעולה, עם אותם מספרים
function story(op, a, b, c) {
  const { p, o, ct } = c;
  switch (op) {
    case '+': return `ל${p.n} יש ${a} ${o}. ${p.n} ${v(p, 'קיבל', 'קיבלה')} עוד ${b} ${o}. כמה ${o} יש ל${p.n} עכשיו?`;
    case '−': return `ל${p.n} יש ${a} ${o}. ${p.n} ${v(p, 'נתן', 'נתנה')} ${b} ${o} לחבר. כמה ${o} נשארו ל${p.n}?`;
    case '×': return `בכל ${ct.s} יש ${a} ${o}. כמה ${o} יש ב-${b} ${ct.pl}?`;
    default: return `יש ${a} ${o}. מחלקים אותם שווה בשווה ל-${b} ${ct.pl}. כמה ${o} יהיו בכל ${ct.s}?`;
  }
}
function writeProblem(rng) {
  const c = { p: rng.pick(NAMES), o: rng.pick(OBJECTS), ct: rng.pick(CONTAINERS) };
  const op = rng.pick(['+', '−', '×', ':']);
  let a, b;
  if (op === '+') { a = rng.int(12, 80); b = rng.int(10, 60); }
  else if (op === '−') { a = rng.int(40, 99); b = rng.int(10, a - 5); }
  else if (op === '×') { a = rng.int(3, 12); b = rng.int(3, 9); }
  else { b = rng.int(3, 9); a = b * rng.int(3, 12); }
  const sym = op;
  const right = story(op, a, b, c);
  // מסיחים: פעולות אחרות עם אותם מספרים (חילוק רק כשהוא מתחלק), ואם חסר – אותה פעולה עם מספרים אחרים
  const dist = [];
  for (const o2 of ['+', '−', '×', ':']) {
    if (o2 === op) continue;
    if (o2 === ':' && a % b !== 0) continue;
    if (o2 === '−' && a <= b) continue;
    dist.push(story(o2, a, b, c));
  }
  // אותה פעולה עם מספרים אחרים (בחילוק – מספרים שמתחלקים)
  if (op === ':') dist.push(story(op, a + b, b, c), story(op, a + 2 * b, b, c));
  else dist.push(story(op, a + rng.int(1, 3), b, c), story(op, a, b + rng.int(1, 3), c));
  const explain = `הסימן ${sym} מתאים לסיפור: ${right}`;
  return mc(rng, { kind: 'write', text: 'איזו בעיה מילולית מתאימה לתרגיל?', expr: `${a} ${sym} ${b}`, meta: { op, a, b }, explain }, right, dist);
}

// ---------- דף התרגול של המורה: וריאנטים חדשים (משמשים גם את הנושא "דף התרגול" וגם את המבחן המסכם) ----------
const uniq = (arr) => [...new Set(arr)];

// השלימו את שלושת המספרים הבאים בסדרה
function seqTriple(rng) {
  const d = rng.pick([2, 5, 10, 10, 20, 50, 100, 100]);
  const s = rng.chance(0.25) ? -1 : 1;
  const start = s > 0 ? rng.int(1000, 6000) : rng.int(4000, 9000);
  const t = [0, 1, 2].map((i) => start + s * i * d);
  const last = t[2];
  const at = (first, step, n = 3) => Array.from({ length: n }, (_, i) => first + s * step * i);
  const ans = at(last + s * d, d);
  const dist = [
    at(last + s, 1), // קפיצות של 1
    at(last + s * 10 * d, 10 * d), // קפיצות גדולות פי 10
    [last + s * d, last + s * d + s * 10 * d, last + s * d + s * 20 * d], // רק הראשון נכון
    at(last - s * d, -d), // כיוון הפוך
    [ans[0], ans[1], ans[2] + s * 10], // האחרון שגוי
  ].map((a) => a.join(', '));
  return mc(rng, { kind: 'seq3', meta: { terms: t, d: s * d }, text: 'השלימו את שלושת המספרים הבאים בסדרה.', expr: `${t.join(', ')}, …`, explain: `ההפרש בין כל שני מספרים סמוכים הוא ${d}. ${s > 0 ? 'מוסיפים' : 'מחסירים'} ${d} שוב ושוב: ${ans.join(', ')}.` }, ans.join(', '), dist);
}

// ציר מספרים עם קטע מושחר: איזה מספר נמצא בקטע?
function seqLine(rng) {
  const st = rng.pick([100, 100, 100, 10, 1000]);
  const from = st * rng.int(1, Math.min(90, Math.floor((9999 - 5 * st) / st)));
  const k = rng.int(0, 4);
  const a = from + k * st;
  const r = rng.pick([2, 3, 4, 6, 7, 8]) * (st / 10);
  const x = a + r;
  const pool = [1, 2, 3, 4].map((j) => a + j * st + r);
  if (Number.isInteger(r / 10)) pool.push(a + 2 * st + r / 10);
  if (a - st + r >= 0) pool.push(a - st + r);
  return mc(rng, { kind: 'seq-line', meta: { a, st, r }, svg: numberLineSvg(from, st, 6, k), text: 'איזה מספר נמצא בקטע המושחר בציר המספרים?', explain: `הקטע המושחר מתחיל ב-${a} ונגמר ב-${a + st}, ולכן המספר שנמצא בתוכו הוא ${x}. שאר המספרים נמצאים מחוץ לקטע.` }, x, pool);
}

// בעזרת ספרות נתונות: מספר שעומד בתנאי (גדול/קטן מ-T, ולפעמים זוגי/אי-זוגי)
const isPermOf = (n, ds) => { const s = String(n); return s.length === ds.length && [...s].sort().join('') === ds.map(String).sort().join(''); };
function digitsRule(rng, withParity) {
  for (;;) {
    const rest = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const ds = rng.shuffle(rng.chance(0.75) ? [0, ...rest.slice(0, 3)] : rest.slice(0, 4));
    const t = rng.pick(ds.filter((x) => x > 0));
    const T = t * 1000;
    const cmp = withParity ? (rng.chance(0.7) ? '<' : '>') : '>';
    const parity = withParity ? rng.pick(['odd', 'even']) : null;
    const okCmp = (n) => (cmp === '>' ? n > T : n < T);
    const okPar = (n) => !parity || (parity === 'odd' ? n % 2 === 1 : n % 2 === 0);
    const valid = (n) => isPermOf(n, ds) && String(n)[0] !== '0' && okCmp(n) && okPar(n);
    const perms = permutations(ds).filter((p) => p[0] !== 0).map((p) => Number(p.join('')));
    const goods = perms.filter(valid), breaks = perms.filter((n) => !valid(n));
    if (!goods.length || !breaks.length) continue;
    const ans = rng.pick(goods);
    const digs = String(ans).split('').map(Number);
    const rep = [], miss = [];
    const foreign = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !ds.includes(x));
    for (let pos = 0; pos < 4; pos++) {
      for (const d of [...ds, ...foreign]) {
        if (d === digs[pos]) continue;
        const c = digs.slice(); c[pos] = d;
        const n = Number(c.join(''));
        if (c[0] === 0 || isPermOf(n, ds) || !okCmp(n) || !okPar(n)) continue;
        (new Set(c).size < 4 ? rep : miss).push(n);
      }
    }
    if (!rep.length || !miss.length) continue;
    const opts = [rng.pick(rep), rng.pick(miss), rng.pick(breaks)];
    if (new Set([ans, ...opts]).size < 4) continue;
    if ([ans, ...opts].filter(valid).length !== 1) continue;
    const word = parity ? `${parity === 'odd' ? 'אי-זוגי' : 'זוגי'} ` : '';
    return mc(rng, {
      kind: 'digits-rule', meta: { digits: ds, T, cmp, parity },
      text: `בעזרת הספרות ${ds.join(', ')} (כל ספרה פעם אחת בדיוק) – איזה מספר ${word}${cmp === '>' ? 'גדול' : 'קטן'} מ-${T}?`,
      explain: `התשובה היא ${ans}: הוא בנוי מכל הספרות פעם אחת${parity ? `, נגמר בספרה ${parity === 'odd' ? 'אי-זוגית' : 'זוגית'}` : ''} והוא ${cmp === '>' ? 'גדול' : 'קטן'} מ-${T}. במסיחים יש מספר שחוזר על ספרה, מספר עם ספרה שלא ניתנה, ומספר שלא עומד בתנאי.`,
    }, ans, opts);
  }
}
const digitsGreater = (rng) => digitsRule(rng, false);
const digitsParity = (rng) => digitsRule(rng, true);

// תרגילים משולבים עם 0 ו-1
const COMBO = [
  (n) => [`${n} : ${n} + 0`, 1, `${n} : ${n} = 1 (מספר מחולק בעצמו), ואחר כך 1 + 0 = 1.`],
  (n) => [`1 × (${n} − ${n})`, 0, `קודם הסוגריים: ${n} − ${n} = 0, ואחר כך 1 × 0 = 0.`],
  (n) => [`0 : ${n} + 1`, 1, `0 : ${n} = 0 (0 מחולק בכל מספר), ואחר כך 0 + 1 = 1.`],
  (n, m) => [`${n} × 0 + ${m}`, m, `${n} × 0 = 0, ואחר כך 0 + ${m} = ${m}.`],
  (n, m) => [`${n} + 0 × ${m}`, n, `קודם כפל: 0 × ${m} = 0, ואחר כך ${n} + 0 = ${n}.`],
  (n, m) => [`${m} × (${n} : ${n})`, m, `קודם הסוגריים: ${n} : ${n} = 1, ואחר כך ${m} × 1 = ${m}.`],
  (n) => [`(${n} : 1) − ${n}`, 0, `${n} : 1 = ${n}, ואחר כך ${n} − ${n} = 0.`],
];
const zeroCombo = (i) => (rng) => {
  const n = rng.int(100, 999), m = rng.int(2, 99);
  const [expr, ans, why] = COMBO[i](n, m);
  return numQ(rng, { kind: 'calc', text: ASK, expr: `${expr} = □`, meta: { expr }, explain: `${why} התוצאה ${ans}.` }, ans, [0, 1, n, m], 0.3);
};
const zeroOneCombined = (rng) => zeroCombo(rng.int(0, COMBO.length - 1))(rng);

// תרגילי חשבון בסגנון הדף
const opsAddSmall = (rng) => {
  const a = rng.int(200, 900), b = rng.int(21, 99);
  return calc(rng, `${a} + ${b}`, a + b, [a + b + 10, a + b - 10, a + b + 100, a + b - 1], `${a} + ${b} = ${a + b}. מחברים יחידות, עשרות ומאות, ומעבירים לעמודה הבאה כשצריך.`);
};
const opsSubZeros = (rng) => {
  const a = rng.pick([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]);
  const b = rng.int(1, 9) * 100 + rng.int(1, 9) * 10 + (rng.chance(0.3) ? rng.int(1, 9) : 0);
  const h = Math.floor(b / 100) * 100, r = b - h, s = a - b;
  return calc(rng, `${a} − ${b}`, s, [s + 100, s - 100, s + 10, s - 10, a - h + r], `${a} − ${b} = ${s}. אפשר לחסר בחלקים: ${a} − ${h} = ${a - h}, ואחר כך ${a - h} − ${r} = ${s}. (או: ${a} הוא ${a - 1} ועוד 1, ומחסירים עמודה אחרי עמודה).`);
};
const opsHandy = (rng) => {
  const a = rng.pick([25, 25, 50, 20]), b = rng.int(2, 12);
  const why = a === 25 ? '4 פעמים 25 הם 100.' : a === 50 ? '2 פעמים 50 הם 100.' : '5 פעמים 20 הם 100.';
  return calc(rng, `${a} × ${b}`, a * b, [a * b + a, a * b - a, a + b, a * b + 10], `${a} × ${b} = ${a * b}. כדאי לזכור: ${why}`, 0.5);
};
const opsDivTable = (rng) => {
  const d = rng.int(6, 9), q = rng.int(6, 12);
  return calc(rng, `${d * q} : ${d}`, q, [q + 1, q - 1, q + 2, d], `${d * q} : ${d} = ${q}, כי ${d} × ${q} = ${d * q}.`, 0.5);
};
const orderDiv = (rng) => orderQ(rng, orderPatterns[orderPatterns.length - 1]);

// השלימו את הסימן < > =
function signQ(rng, L, lv, R, rv) {
  const sign = lv < rv ? '<' : lv > rv ? '>' : '=';
  const why = sign === '=' ? 'שני הצדדים שווים' : lv > rv ? 'הצד השמאלי גדול יותר' : 'הצד השמאלי קטן יותר';
  return { kind: 'sign', meta: { L, R, lv, rv }, text: 'השלימו את הסימן המתאים: < , > או =', expr: `${L} □ ${R}`, options: ['<', '=', '>'], answer: sign, explain: `מחשבים כל צד: ${L} = ${lv} ו-${R} = ${rv}. ${why}, ולכן הסימן הוא ${sign}.` };
}
function signProducts(rng) {
  const a = rng.int(2, 9), m = rng.int(2, 9), p = rng.int(1, 2);
  const b = m * 10 ** p, half = b / 10;
  const mode = rng.pick(['eq', 'eq', 'gt', 'lt']);
  let c = half;
  if (mode === 'gt') c = half + rng.int(1, 4);
  if (mode === 'lt') c = Math.max(1, half - rng.int(1, Math.min(4, half - 1)));
  return signQ(rng, `${a} × ${b}`, a * b, `${a * 10} × ${c}`, a * 10 * c);
}
function signThree(rng) {
  const [x, y, z] = [rng.int(2, 9), rng.int(2, 9), rng.int(2, 9)];
  const mode = rng.pick(['eq', 'gt', 'lt']);
  let right;
  if (mode === 'eq') right = rng.pick([[x * y, z, 1], [x, y * z, 1], [x * z, y]]);
  else if (mode === 'gt') right = [x, y, 1, 1];
  else right = [x, y, z, rng.int(2, 3)];
  right = rng.shuffle(right);
  const left = [x, y, z];
  const pr = (a) => a.reduce((s, t) => s * t, 1);
  return signQ(rng, left.join(' × '), pr(left), right.join(' × '), pr(right));
}

// פי כמה גדול תרגיל מתרגיל (בלי לחשב)
function timesExpr(rng) {
  const A = rng.int(12, 99), k2 = rng.int(2, 5), m = rng.int(2, 5), k1 = k2 * m;
  return numQ(rng, { kind: 'times', meta: { A, k1, k2, m }, text: `פי כמה ${A} × ${k1} גדול מ-${A} × ${k2}?`, explain: `בשני התרגילים יש ${A}. ב-${A} × ${k1} מכפילים ב-${k1}, וב-${A} × ${k2} ב-${k2}, ו-${k1} הוא פי ${m} מ-${k2} (${k2} × ${m} = ${k1}). לכן התשובה ${m} – אין צורך לחשב.` }, m, [m + 1, m - 1, k1, k2, k1 - k2], 0.4);
}

// בעיות מילוליות בסגנון הדף
function wordLibrary(rng) {
  const a = rng.int(50, 400), give = rng.int(10, Math.floor(a / 2)), b = a - give;
  const t = rng.pick([
    `בספרייה היו ${a} ספרים. אחרי שהספרנית נתנה ספרים לתלמידים נשארו ${b}. כמה ספרים נתנה?`,
    `בחנות היו ${a} חולצות. אחרי שנמכרו כמה חולצות נשארו ${b}. כמה חולצות נמכרו?`,
    `באוטובוס היו ${a} נוסעים. בתחנה ירדו כמה נוסעים ונשארו ${b}. כמה נוסעים ירדו?`,
  ]);
  return numQ(rng, { kind: 'word', meta: { a, b }, text: t, explain: `כדי לדעת כמה נלקחו מחסרים מההתחלה את מה שנשאר: ${a} − ${b} = ${give}.` }, give, [a + b, give + 10, give - 10, b], 0.5);
}
function wordClasses(rng) {
  for (;;) {
    const c = [rng.int(20, 45), rng.int(20, 45), rng.int(20, 45)], T = rng.int(120, 260);
    const s = c[0] + c[1] + c[2], rest = T - s;
    if (rest < 15 || rest > 70) continue;
    return numQ(rng, { kind: 'word', meta: { T, c }, text: `בשכבה ד' ${T} תלמידים. בכיתה ד1 יש ${c[0]} תלמידים, בכיתה ד2 ${c[1]}, בכיתה ד3 ${c[2]}, והשאר לומדים בכיתה ד4. כמה תלמידים לומדים בכיתה ד4?`, explain: `קודם מחברים את שלוש הכיתות: ${c.join(' + ')} = ${s}. אחר כך מחסירים מכלל השכבה: ${T} − ${s} = ${rest}.` }, rest, [s, T + s, rest + 10, rest - 10, T - c[0]], 0.5);
  }
}
function wordGroups(rng) {
  const g = rng.pick([4, 5, 10, 10, 20, 25]), k = rng.int(4, 20), T = g * k;
  return numQ(rng, { kind: 'word', meta: { T, g }, text: `בשכבה ${T} תלמידים. מחלקים אותם לקבוצות של ${g} תלמידים. כמה קבוצות יהיו?`, explain: `כמה פעמים ${g} נכנס ב-${T}? ${T} : ${g} = ${k}, כי ${g} × ${k} = ${T}.` }, k, [g, k + 1, k - 1, k * 2], 0.5);
}
function wordSplit(rng) {
  const T = rng.pick([120, 150, 180, 200, 240, 300]);
  const pairs = [];
  for (let k = 2; k <= 20; k++) if (T % k === 0 && T / k >= 5 && T / k <= 60) pairs.push([k, T / k]);
  const [k, g] = rng.pick(pairs);
  const fmt = ([a, b]) => `${a} קבוצות של ${b} תלמידים`;
  const cand = [[k + 1, g], [k, g + 5], [k - 1, g], [k, g - 5], [k + 2, g], [k * 2, g + 5]].filter(([a, b]) => a >= 2 && b >= 5 && a * b !== T);
  return mc(rng, { kind: 'word', meta: { T }, text: `בשכבה ${T} תלמידים. רוצים לחלק אותם לקבוצות שוות. איזו חלוקה אפשרית?`, explain: `חלוקה אפשרית היא כזו שמספר הקבוצות כפול מספר התלמידים בקבוצה נותן ${T}. ${k} × ${g} = ${T}, ולכן ${fmt([k, g])}. בשאר החלוקות המכפלה שונה.` }, fmt([k, g]), cand.map(fmt));
}

// מספר חסר וחוסר שוויון
function missingSub(rng) {
  const a = rng.pick([200, 300, 400, 500, 600, 700, 800, 1000]), x = rng.int(2, Math.floor(a / 10) * 0.8 | 0) * 10 + rng.pick([0, 0, 5]);
  const c = a - x;
  return numQ(rng, { kind: 'missing', text: 'איזה מספר חסר?', expr: `${a} − □ = ${c}`, meta: { expr: `${a} − □ = ${c}` }, explain: `המספר החסר הוא ${x}, כי ${a} − ${c} = ${x}. בדיקה: ${a} − ${x} = ${c}.` }, x, [a, c, x + 10, x - 10, a + c], 0.5);
}
function missingIneq(rng) {
  const a = rng.pick([300, 400, 500, 600, 800, 1000]), t = rng.int(6, Math.min(30, (a - 40) / 10)) * 10, c = a - t;
  const gt = rng.chance(0.65);
  const sign = gt ? '>' : '<';
  let x, wrong;
  if (gt) { x = rng.int(2, t / 5 - 1) * 5; wrong = uniq([t, t + 10, t + 20, t + 30, t + 50, c]).filter((n) => n >= t && n <= a); }
  else { x = rng.int(t / 5 + 1, a / 5) * 5; wrong = uniq([t, t - 10, t - 20, t - 30, t - 50, 10]).filter((n) => n <= t && n >= 0); }
  return mc(rng, { kind: 'ineq', meta: { a, c, sign }, text: 'איזה מספר מתאים במקום □?', expr: `${a} − □ ${sign} ${c}`, explain: `${a} − ${t} = ${c}, לכן כדי שיהיה ${gt ? 'יותר' : 'פחות'} מ-${c} צריך ${gt ? 'לחסר פחות' : 'לחסר יותר'} מ-${t}. המספר ${x} ${gt ? 'קטן' : 'גדול'} מ-${t}, ולכן הוא מתאים.` }, x, wrong);
}

// כתיבת שאלה לתרגיל חילוק (חלוקה שווה או "כמה קבוצות")
function writeDivision(rng) {
  const c = { p: rng.pick(NAMES), o: rng.pick(OBJECTS), ct: rng.pick(CONTAINERS) };
  const b = rng.int(2, 9), q = rng.int(3, 10), a = b * q;
  const { p, o, ct } = c;
  const right = rng.chance(0.5)
    ? story(':', a, b, c)
    : `ל${p.n} יש ${a} ${o}. ${p.n} ${v(p, 'שם', 'שמה')} ${b} ${o} בכל ${ct.s}. כמה ${ct.pl} יהיו?`;
  const dist = ['+', '−', '×'].map((o2) => story(o2, a, b, c));
  dist.push(story('+', a + b, b, c), story('×', a + 1, b, c));
  return mc(rng, { kind: 'write-div', text: 'איזו בעיה מילולית מתאימה לתרגיל?', expr: `${a} : ${b}`, meta: { op: ':', a, b }, explain: `חילוק מתאים לחלוקה שווה (${a} ${o} ל-${b}) או לשאלה "כמה קבוצות של ${b} יש ב-${a}". ${a} : ${b} = ${q}.` }, right, dist);
}

// כל הווריאנטים החדשים של הדף, לפי נושא (הנושא "דף התרגול" והמבחן המסכם משתמשים בהם)
export const sheetNumbers = {
  seqTriple, seqLine, digitsGreater, digitsParity, zeroCombo, zeroOneCombined, opsAddSmall, opsSubZeros, opsHandy, opsDivTable, orderDiv,
  signProducts, signThree, timesExpr, wordLibrary, wordClasses, wordGroups, wordSplit, missingSub, missingIneq, writeDivision,
};

export const numbersGens = {
  sequences: [seqMissing, seqNext, seqRule, seqBelongs, seqTriple, seqLine],
  digits: [digitsQ, digitsGreater, digitsParity],
  ops: [...opsGens, opsAddSmall, opsSubZeros, opsHandy, opsDivTable, signProducts, signThree, missingSub, missingIneq],
  order: [orderQ],
  zero_one: [zeroOne, zeroOneMissing, zeroOneTrue, zeroOneCombined],
  times_more: [timesMore, timesHowMany, timesReverse, timesDouble, timesExpr],
  word_problems: [wordProblem, wordLibrary, wordClasses, wordGroups, wordSplit],
  write_problem: [writeProblem, writeDivision],
};

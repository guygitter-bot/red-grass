// מספרים טבעיים ופעולות חשבון (נושאים 1-8). כל פונקציה מקבלת rng ומחזירה שאלה אחת
import { mc, numQ, numInput, evalExpr, NAMES, v, OBJECTS, CONTAINERS, twoNames } from './common.js';

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
    const a = rng.int(11, 99), b = rng.int(2, 9);
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
];
function orderQ(rng) {
  for (;;) {
    const [expr, steps] = rng.pick(orderPatterns)(rng);
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
  const wording = k === 2 ? 'כפול' : `פי ${k}`;
  return numQ(rng, { kind: 'times', text: `מה המספר שהוא ${wording} ${base}?`, explain: `${wording} ${base} זה ${base} × ${k} = ${ans}.` }, ans, [base + k, ans + base, ans - base]);
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

export const numbersGens = {
  sequences: [seqMissing, seqNext, seqRule, seqBelongs],
  digits: [digitsQ],
  ops: opsGens,
  order: [orderQ],
  zero_one: [zeroOne, zeroOneMissing, zeroOneTrue],
  times_more: [timesMore, timesHowMany, timesReverse, timesDouble],
  word_problems: [wordProblem],
  write_problem: [writeProblem],
};

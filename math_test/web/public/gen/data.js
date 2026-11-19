// חקר נתונים (נושא 18): דיאגרמות עמודות ופיקטוגרמות
import { mc, numQ } from './common.js';
import { barChartSvg, pictogramSvg } from '../svg.js';

// כל נושא: כותרת, קטגוריות ונוסחי השאלות (בעברית תקנית לכל נושא)
const SETS = [
  { title: 'ספורט אהוב על ילדי הכיתה', unit: 'ילדים', cats: ['כדורגל', 'כדורסל', 'שחייה', 'טניס', "ג'ודו"],
    value: (c) => `כמה ילדים בחרו ב${c}?`, diff: (a, b) => `בכמה ילדים יותר בחרו ב${a} מאשר ב${b}?`,
    most: 'איזה ספורט הכי אהוב?', least: 'איזה ספורט הכי פחות אהוב?', total: 'כמה ילדים השתתפו בסקר בסך הכול?' },
  { title: 'פירות אהובים', unit: 'ילדים', cats: ['תפוח', 'בננה', 'ענבים', 'תות', 'אבטיח'],
    value: (c) => `כמה ילדים בחרו ב${c}?`, diff: (a, b) => `בכמה ילדים יותר בחרו ב${a} מאשר ב${b}?`,
    most: 'איזה פרי הכי אהוב?', least: 'איזה פרי הכי פחות אהוב?', total: 'כמה ילדים השתתפו בסקר בסך הכול?' },
  { title: 'חיות מחמד בכיתה', unit: 'ילדים', cats: ['כלב', 'חתול', 'ציפור', 'דג', 'אוגר'],
    value: (c) => `כמה ילדים מגדלים ${c}?`, diff: (a, b) => `בכמה ילדים יותר מגדלים ${a} מאשר ${b}?`,
    most: 'איזו חיית מחמד הכי נפוצה?', least: 'איזו חיית מחמד הכי פחות נפוצה?', total: 'כמה חיות מחמד יש בכיתה בסך הכול?' },
  { title: 'ספרים שנקראו', unit: 'ספרים', cats: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי'],
    value: (c) => `כמה ספרים נקראו ב${c}?`, diff: (a, b) => `בכמה ספרים יותר נקראו ב${a} מאשר ב${b}?`,
    most: 'באיזה חודש נקראו הכי הרבה ספרים?', least: 'באיזה חודש נקראו הכי מעט ספרים?', total: 'כמה ספרים נקראו בסך הכול?' },
];

// נתונים עם ערכים שונים זה מזה (כדי שיהיה "הכי" אחד)
function dataset(rng, pict) {
  const set = rng.pick(SETS);
  const n = rng.chance(0.5) ? 4 : 5;
  const cats = rng.shuffle(set.cats).slice(0, n);
  let step, vals;
  for (;;) {
    step = pict ? rng.pick([2, 5, 10]) : rng.pick([1, 2, 5, 10]);
    const max = pict ? 8 : step === 1 ? 10 : step === 2 ? 10 : step === 5 ? 6 : 6;
    vals = cats.map(() => rng.int(1, max) * step);
    if (new Set(vals).size === n) break;
  }
  const chart = pict
    ? pictogramSvg({ title: set.title, cats, vals, per: step, unit: set.unit })
    : barChartSvg({ title: set.title, cats, vals, step });
  const how = pict ? `כל עיגול שווה ${step} ${set.unit}.` : `קוראים את גובה העמודה מול הקווים שבצד${step > 1 ? ` (הקפיצות הן ${step})` : ''}.`;
  return { set, cats, vals, chart, how, step };
}
const meta = (d) => ({ cats: d.cats, vals: d.vals });

function value(rng, pict) {
  const d = dataset(rng, pict), i = rng.int(0, d.cats.length - 1);
  return numQ(rng, { kind: 'chart', meta: { ...meta(d), ask: 'value', i }, svg: d.chart, text: d.set.value(d.cats[i]), explain: `${d.how} התשובה: ${d.vals[i]}.` }, d.vals[i], d.vals.filter((_, j) => j !== i).concat([d.vals[i] + d.step, d.vals[i] - d.step]), 0.45);
}
function most(rng, pict, big) {
  const d = dataset(rng, pict);
  const target = big ? Math.max(...d.vals) : Math.min(...d.vals);
  const i = d.vals.indexOf(target);
  return mc(rng, { kind: 'chart', meta: { ...meta(d), ask: big ? 'max' : 'min' }, svg: d.chart, text: big ? d.set.most : d.set.least, explain: `${pict ? (big ? 'השורה הארוכה ביותר' : 'השורה הקצרה ביותר') : (big ? 'העמודה הגבוהה ביותר' : 'העמודה הנמוכה ביותר')} היא של ${d.cats[i]}: ${target}.` }, d.cats[i], d.cats.filter((_, j) => j !== i));
}
function diff(rng, pict) {
  const d = dataset(rng, pict);
  const [i, j] = rng.shuffle(d.vals.map((_, k) => k)).slice(0, 2);
  const [hi, lo] = d.vals[i] > d.vals[j] ? [i, j] : [j, i];
  const ans = d.vals[hi] - d.vals[lo];
  return numQ(rng, { kind: 'chart', meta: { ...meta(d), ask: 'diff', hi, lo }, svg: d.chart, text: d.set.diff(d.cats[hi], d.cats[lo]), explain: `${d.cats[hi]}: ${d.vals[hi]}, ${d.cats[lo]}: ${d.vals[lo]}. ההפרש: ${d.vals[hi]} − ${d.vals[lo]} = ${ans}.` }, ans, [d.vals[hi] + d.vals[lo], d.vals[hi], ans + d.step, Math.abs(ans - d.step)], 0.45);
}
function total(rng, pict) {
  const d = dataset(rng, pict);
  const ans = d.vals.reduce((s, x) => s + x, 0);
  return numQ(rng, { kind: 'chart', meta: { ...meta(d), ask: 'total' }, svg: d.chart, text: d.set.total, explain: `מחברים את כל הערכים: ${d.vals.join(' + ')} = ${ans}.` }, ans, [ans - d.vals[0], ans + d.step, ans - d.step, ans + d.vals[1]], 0.5);
}

export const dataGens = {
  chart: [
    (r) => value(r, false), (r) => most(r, false, true), (r) => most(r, false, false), (r) => diff(r, false), (r) => total(r, false),
    (r) => value(r, true), (r) => most(r, true, true), (r) => diff(r, true), (r) => total(r, true),
  ],
};

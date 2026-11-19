// שברים פשוטים (נושאים 9-11)
import { mc, numQ, F, cmpFrac, DEN } from './common.js';
import { pieSvg, barsSvg, squaresSvg } from '../svg.js';

const HALF = [1, 2];
// כל השברים הפשוטים (קטנים מ-1) במכנים שבנושא
const ALL = DEN.flatMap((d) => Array.from({ length: d - 1 }, (_, i) => [i + 1, d]));
const str = (f) => F(f[0], f[1]);
const sample = (rng, arr, k) => rng.shuffle(arr).slice(0, k);
const values = (fs) => fs.map(str);
const same = (a, b) => cmpFrac(a, b) === 0;

// ---------- 9. השוואת שברים ----------
function sameDenominator(rng) {
  const d = rng.pick([5, 6, 8, 10, 12]);
  const fs = sample(rng, Array.from({ length: d - 1 }, (_, i) => [i + 1, d]), 4);
  const big = rng.chance(0.5);
  const sorted = [...fs].sort(cmpFrac);
  const ans = big ? sorted[3] : sorted[0];
  return mc(rng, {
    kind: 'frac', meta: { fracs: fs, op: big ? 'max' : 'min' },
    text: `איזה שבר ${big ? 'גדול' : 'קטן'} ביותר?`,
    explain: `כשהמכנה זהה (${d}) משווים את המונים: ${big ? 'ככל שהמונה גדול יותר השבר גדול יותר' : 'ככל שהמונה קטן יותר השבר קטן יותר'}. התשובה: ${str(ans)}.`,
  }, str(ans), values(fs.filter((f) => f !== ans)));
}

function sameNumerator(rng) {
  const n = rng.int(1, 3);
  const ds = sample(rng, DEN.filter((d) => d > n), 4);
  const fs = ds.map((d) => [n, d]);
  const big = rng.chance(0.5);
  const sorted = [...fs].sort(cmpFrac);
  const ans = big ? sorted[3] : sorted[0];
  return mc(rng, {
    kind: 'frac', meta: { fracs: fs, op: big ? 'max' : 'min' },
    text: `איזה שבר ${big ? 'גדול' : 'קטן'} ביותר?`,
    explain: `כשהמונה זהה (${n}) צריך להסתכל על המכנה: ככל שהמכנה גדול יותר, החלקים קטנים יותר. לכן ${big ? 'השבר הגדול הוא זה עם המכנה הקטן' : 'השבר הקטן הוא זה עם המכנה הגדול'}: ${str(ans)}.`,
  }, str(ans), values(fs.filter((f) => f !== ans)));
}

// לעומת חצי: מי גדול / קטן / שווה לחצי
function versusHalf(rng) {
  const mode = rng.pick(['gt', 'lt', 'eq']);
  const eqs = ALL.filter((f) => same(f, HALF));
  const gts = ALL.filter((f) => cmpFrac(f, HALF) > 0), lts = ALL.filter((f) => cmpFrac(f, HALF) < 0);
  let ans, others, text, why;
  if (mode === 'eq') {
    ans = rng.pick(eqs); others = sample(rng, [...gts, ...lts], 3);
    text = 'איזה שבר שווה לחצי?';
    why = `${str(ans)} שווה לחצי: המונה הוא חצי מהמכנה.`;
  } else if (mode === 'gt') {
    ans = rng.pick(gts); others = sample(rng, lts, 3);
    text = 'איזה שבר גדול מחצי?';
    why = `חצי מ-${ans[1]} הוא ${ans[1] / 2}. ${ans[0]} גדול מזה, ולכן ${str(ans)} גדול מחצי.`;
  } else {
    ans = rng.pick(lts); others = sample(rng, gts, 3);
    text = 'איזה שבר קטן מחצי?';
    why = `חצי מ-${ans[1]} הוא ${ans[1] / 2}. ${ans[0]} קטן מזה, ולכן ${str(ans)} קטן מחצי.`;
  }
  return mc(rng, { kind: 'frac', meta: { fracs: [ans, ...others], op: mode, ref: HALF }, text, explain: why }, str(ans), values(others));
}

// פסים מצוירים: איזה שבר הכי גדול / קטן
function barsCompare(rng) {
  for (;;) {
    const ds = sample(rng, [2, 3, 4, 5, 6, 8], 4);
    const fs = ds.map((d) => [rng.int(1, d - 1), d]);
    let ok = true;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (same(fs[i], fs[j])) ok = false;
    if (!ok) continue;
    const big = rng.chance(0.5);
    const sorted = [...fs].sort(cmpFrac);
    const ans = big ? sorted[3] : sorted[0];
    return mc(rng, {
      kind: 'frac', meta: { fracs: fs, op: big ? 'max' : 'min' }, svg: barsSvg(fs),
      text: `בכל פס החלק הצבוע מייצג שבר. איזה שבר ${big ? 'גדול' : 'קטן'} ביותר?`,
      explain: `משווים את אורך החלק הצבוע בכל פס. ${big ? 'הארוך ביותר' : 'הקצר ביותר'} הוא ${str(ans)}.`,
    }, str(ans), values(fs.filter((f) => f !== ans)));
  }
}

// סידור שלושה שברים מהקטן לגדול
function orderThree(rng) {
  let fs;
  if (rng.chance(0.5)) {
    const d = rng.pick([6, 8, 10, 12]);
    fs = sample(rng, Array.from({ length: d - 1 }, (_, i) => [i + 1, d]), 3);
  } else {
    const n = rng.int(1, 3);
    fs = sample(rng, DEN.filter((d) => d > n), 3).map((d) => [n, d]);
  }
  const sorted = [...fs].sort(cmpFrac);
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((p) => p.map((i) => sorted[i]));
  const join = (a) => values(a).join(', ');
  return mc(rng, {
    kind: 'frac', meta: { fracs: sorted, op: 'order' },
    text: 'איזה סידור הוא מהשבר הקטן לשבר הגדול?',
    explain: `משווים בין השברים לפי המונה או לפי המכנה. הסדר מהקטן לגדול: ${join(sorted)}.`,
  }, join(sorted), perms.slice(1).map(join));
}

// ---------- 10. שברים גדולים / קטנים משבר נתון ----------
function biggerSmaller(rng) {
  for (;;) {
    const d = rng.pick(DEN.filter((x) => x >= 3));
    const ref = [rng.int(1, d - 1), d];
    const gt = rng.chance(0.5);
    // רוב השאלות: אותו מכנה או אותו מונה (קל יותר), ולפעמים כל שבר
    const local = ALL.filter((f) => f[1] === d || f[0] === ref[0]);
    const pool = rng.chance(0.7) ? local : ALL;
    const yes = pool.filter((f) => (gt ? cmpFrac(f, ref) > 0 : cmpFrac(f, ref) < 0));
    const no = pool.filter((f) => (gt ? cmpFrac(f, ref) < 0 : cmpFrac(f, ref) > 0));
    if (!yes.length || no.length < 3) continue;
    const ans = rng.pick(yes), others = sample(rng, no, 3);
    // שברים שווי ערך לא מופיעים יחד (אפשר להתבלבל)
    if (others.some((o, i) => others.slice(i + 1).some((q) => same(o, q)))) continue;
    return mc(rng, {
      kind: 'frac', meta: { fracs: [ans, ...others], op: gt ? 'gt' : 'lt', ref },
      text: `איזה שבר ${gt ? 'גדול' : 'קטן'} מ-${str(ref)}?`,
      explain: `${str(ans)} ${gt ? 'גדול' : 'קטן'} מ-${str(ref)}. כשהמכנה זהה משווים מונים, וכשהמונה זהה – ככל שהמכנה גדול יותר השבר קטן יותר.`,
    }, str(ans), values(others));
  }
}

// ---------- 11. השלמת השלם לפי חלק נתון ----------
function wholeSquares(rng) {
  const d = rng.pick([2, 3, 4, 5, 6, 8, 10]), p = rng.int(1, Math.min(3, d - 1));
  const k = rng.int(1, 6);
  const shaded = p * k, whole = d * k;
  if (shaded > 24 || whole > 60) return wholeSquares(rng);
  const explain = p === 1
    ? `${F(1, d)} מהשלם הם ${shaded} ריבועים, ולכן השלם הוא ${shaded} × ${d} = ${whole}.`
    : `${F(p, d)} הם ${shaded} ריבועים, אז ${F(1, d)} הוא ${shaded} : ${p} = ${k}. השלם הוא ${k} × ${d} = ${whole}.`;
  return numQ(rng, { kind: 'whole', meta: { p, d, part: shaded }, svg: squaresSvg(shaded), text: `הריבועים הצבועים בציור הם ${F(p, d)} מכל הריבועים. כמה ריבועים יש בסך הכול?`, explain }, whole, [shaded + d, shaded * (d - 1), whole + d, shaded * p], 0.5);
}

function wholeWord(rng) {
  const d = rng.pick([2, 3, 4, 5, 6, 8, 10]), p = rng.int(1, Math.min(3, d - 1)), k = rng.int(2, 9);
  const n = p * k, whole = d * k;
  const t = rng.pick([
    `${F(p, d)} מהתלמידים בכיתה הם ${n} תלמידים. כמה תלמידים יש בכיתה?`,
    `אכלו ${F(p, d)} מהעוגיות שבקופסה, וזה ${n} עוגיות. כמה עוגיות היו בקופסה בהתחלה?`,
    `${F(p, d)} מהספרים במדף הם ספרי קומיקס, ${n} ספרים. כמה ספרים יש במדף?`,
    `עברנו ${F(p, d)} מהדרך, וזה ${n} ק"מ. מה אורך הדרך כולה (בק"מ)?`,
  ]);
  const explain = p === 1
    ? `${F(1, d)} מהשלם הוא ${n}, ולכן השלם הוא ${n} × ${d} = ${whole}.`
    : `${F(p, d)} הם ${n}, אז ${F(1, d)} הוא ${n} : ${p} = ${k}. השלם הוא ${k} × ${d} = ${whole}.`;
  return numQ(rng, { kind: 'whole', meta: { p, d, part: n }, text: t, explain }, whole, [n + d, n * (d - 1), n * p, whole + d], 0.5);
}

function wholeComplement(rng) {
  const d = rng.pick([4, 5, 6, 8, 10, 12]), p = rng.int(1, d - 1);
  const ans = F(d - p, d);
  const cands = [d - p + 1, d - p - 1, p + 1, p, 1].filter((n) => n >= 1 && n <= d - 1).map((n) => F(n, d)).concat([F(d - p, p), F(p, d - p)]);
  const withPic = rng.chance(0.5);
  const base = withPic
    ? { svg: pieSvg(p, d), text: 'איזה שבר מייצג את החלק שלא צבוע בעוגה?', explain: `בעוגה ${d} חלקים, ${p} מהם צבועים. נשארו ${d - p} חלקים לא צבועים: ${ans}.` }
    : { text: `איזה שבר משלים את ${F(p, d)} לשלם?`, explain: `השלם הוא ${F(d, d)}. ${d} − ${p} = ${d - p}, ולכן ${ans} משלים את ${F(p, d)} לשלם.` };
  return mc(rng, { kind: 'whole', meta: { p, d, complement: true }, ...base }, ans, cands);
}

export const fractionGens = {
  compare_frac: [sameDenominator, sameNumerator, versusHalf, barsCompare, orderThree],
  bigger_smaller: [biggerSmaller],
  whole_from_part: [wholeSquares, wholeWord, wholeComplement],
};

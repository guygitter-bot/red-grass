// מדידות אורכים (נושא 12)
import { mc, numQ } from './common.js';
import { rulerSvg } from '../svg.js';

const U = { mm: 'מ"מ', cm: 'ס"מ', m: "מ'", km: 'ק"מ' };
const MM = { mm: 1, cm: 10, m: 1000, km: 1000000 };
const WORDS = { mm: 'מילימטר', cm: 'סנטימטר', m: 'מטר', km: 'קילומטר' };

// המרה בין יחידות: לקטנה (כפל) או לגדולה (חילוק)
function convert(rng) {
  const pairs = [['cm', 'mm'], ['m', 'cm'], ['km', 'm']];
  const [big, small] = rng.pick(pairs);
  const f = MM[big] / MM[small];
  const k = rng.int(2, 9) + (rng.chance(0.3) ? 10 : 0);
  if (rng.chance(0.55)) {
    const ans = k * f;
    return numQ(rng, { kind: 'length', text: `השלימו: ${k} ${U[big]} = □ ${U[small]}`, explain: `1 ${U[big]} = ${f} ${U[small]}, ולכן ${k} ${U[big]} = ${k} × ${f} = ${ans} ${U[small]}.` }, ans, [k * f * 10, k + f, k * (f / 10), k], 0.5);
  }
  const total = k * f;
  return numQ(rng, { kind: 'length', text: `השלימו: ${total} ${U[small]} = □ ${U[big]}`, explain: `1 ${U[big]} = ${f} ${U[small]}, ולכן ${total} ${U[small]} : ${f} = ${k} ${U[big]}.` }, k, [k * 10, k + 1, k - 1, total / (f * 10) || 1], 0.5);
}

// יחידה מעורבת: 2 מ' ו-30 ס"מ
function mixed(rng) {
  const forms = [
    ['m', 'cm', 100, rng.int(1, 9), rng.int(1, 9) * 10 + rng.int(0, 1) * 5],
    ['cm', 'mm', 10, rng.int(1, 20), rng.int(1, 9)],
    ['km', 'm', 1000, rng.int(1, 5), rng.int(1, 9) * 100],
  ];
  const [big, small, f, a, b] = rng.pick(forms);
  const ans = a * f + b;
  return numQ(rng, { kind: 'length', text: `השלימו: ${a} ${U[big]} ו-${b} ${U[small]} = □ ${U[small]}`, explain: `${a} ${U[big]} = ${a * f} ${U[small]}. ועוד ${b} ${U[small]} – ביחד ${ans} ${U[small]}.` }, ans, [a + b, a * f, a * f * 10 + b, ans + f], 0.5);
}

// השוואת אורכים ביחידות שונות: הכי ארוך / הכי קצר
function compare(rng) {
  for (;;) {
    const cms = rng.shuffle([30, 40, 50, 60, 80, 90, 100, 120, 150, 200, 250, 300, 400, 500]).slice(0, 4);
    const items = cms.map((c) => {
      const forms = [`${c} ${U.cm}`, `${c * 10} ${U.mm}`];
      if (c % 100 === 0) forms.push(`${c / 100} ${U.m}`);
      return { c, s: rng.pick(forms) };
    });
    if (new Set(items.map((i) => i.s)).size < 4) continue;
    const long = rng.chance(0.5);
    const sorted = [...items].sort((a, b) => a.c - b.c);
    const ans = long ? sorted[3] : sorted[0];
    return mc(rng, {
      kind: 'length', meta: { mm: items.map((i) => i.c * 10), long },
      text: `איזה אורך ${long ? 'הכי ארוך' : 'הכי קצר'}?`,
      explain: `כדי להשוות ממירים הכול לאותה יחידה (ס"מ): ${items.map((i) => `${i.s} = ${i.c} ${U.cm}`).join(', ')}. ${long ? 'הארוך' : 'הקצר'} ביותר הוא ${ans.s}.`,
    }, ans.s, items.filter((i) => i !== ans).map((i) => i.s));
  }
}

// קריאת סרגל
function ruler(rng) {
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const c = rng.int(3, 9);
    return numQ(rng, { kind: 'ruler', svg: rulerSvg(10, 0, c * 10), text: 'כמה סנטימטרים אורך הפס הצבוע?', explain: `הפס מתחיל ב-0 ונגמר ב-${c}, לכן אורכו ${c} ס"מ.` }, c, [c + 1, c - 1, c * 10, 10 - c], 0.4);
  }
  if (kind === 1) {
    const s = rng.int(1, 4), e = rng.int(s + 2, 9);
    return numQ(rng, { kind: 'ruler', svg: rulerSvg(10, s * 10, e * 10), text: 'כמה סנטימטרים אורך הפס הצבוע?', explain: `הפס מתחיל ב-${s} ונגמר ב-${e}. אורכו ${e} − ${s} = ${e - s} ס"מ.` }, e - s, [e, s, e + s, e - s + 1], 0.4);
  }
  const c = rng.int(2, 8), m = rng.int(1, 9);
  const mm = c * 10 + m;
  return numQ(rng, { kind: 'ruler', svg: rulerSvg(10, 0, mm), text: 'כמה מילימטרים אורך הפס הצבוע?', explain: `הפס עובר ${c} ס"מ שלמים ועוד ${m === 1 ? 'קו קטן אחד' : `${m} קווים קטנים`} (מ"מ). ${c} ס"מ = ${c * 10} מ"מ, ועוד ${m}: ${mm} מ"מ.` }, mm, [c * 10, c + m, mm + 10, mm - 10, c * 100 + m], 0.5);
}

// באיזו יחידה מודדים
const THINGS = [
  ['אורך עיפרון', 'cm'], ['עובי של מטבע', 'mm'], ['אורך הכיתה', 'm'], ['המרחק בין תל אביב לירושלים', 'km'],
  ['אורך נמלה', 'mm'], ['הגובה של ילד', 'cm'], ['אורך מגרש כדורגל', 'm'], ['אורך נהר הירדן', 'km'],
  ['רוחב של דלת', 'cm'], ['עובי של דף בספר', 'mm'], ['גובה של בניין', 'm'], ['אורך של חבל קפיצה', 'm'],
];
function chooseUnit(rng) {
  const [thing, u] = rng.pick(THINGS);
  const ans = `${WORDS[u]} (${U[u]})`;
  return mc(rng, { kind: 'unit', text: `באיזו יחידה הכי מתאים למדוד: ${thing}?`, explain: `${thing} נמדד בדרך כלל ב${WORDS[u]}.` }, ans, Object.keys(U).filter((k) => k !== u).map((k) => `${WORDS[k]} (${U[k]})`));
}

// מלכודת הסרגל: העיפרון לא מתחיל ב-0, ולכן האורך הוא סוף פחות התחלה
function rulerTrap(rng) {
  const s = rng.int(1, 4), e = rng.int(s + 3, 9), ans = e - s;
  const pool = [e, s, ans - 1, ans + 1, e + s].filter((x, i, a) => x > 0 && x !== ans && a.indexOf(x) === i);
  return mc(rng, { kind: 'ruler-trap', meta: { s, e }, svg: rulerSvg(10, s * 10, e * 10, true), text: 'מה אורך העיפרון בסנטימטרים?', explain: `העיפרון לא מתחיל ב-0 אלא ב-${s}, ונגמר ב-${e}. סופרים מאיפה שהוא מתחיל: ${e} − ${s} = ${ans} ס"מ.` }, ans, pool.slice(0, 3));
}
export const sheetMeasure = { rulerTrap };

export const measureGens = { length: [convert, convert, mixed, compare, ruler, ruler, chooseUnit, rulerTrap] };

// גיאומטריה (נושאים 13-17): צלעות מקבילות, היקף, שטח, זוויות, אלכסונים
import { mc, numQ, numChoice } from './common.js';
import { svg, poly, rect, regularPts, sideLabels, vertexLabels, rowSvg, angleEl, angleSvg, COL } from '../svg.js';

// ---------- צורות מוכנות (בתוך תיבה של 100×90) ----------
// pairs = מספר זוגות הצלעות המקבילות. הקודקודים מסודרים A,B,C,D: שמאל-למעלה, ימין-למעלה, ימין-למטה, שמאל-למטה
const SHAPES = {
  triangle: { name: 'משולש', pairs: 0, why: 'במשולש אין צלעות מקבילות – כל שתי צלעות נפגשות בקודקוד.', pts: (r) => [[r.int(25, 75), 12], [92, 72], [8, 72]] },
  pentagon: { name: 'מחומש משוכלל', pairs: 0, why: 'במחומש משוכלל אין אף זוג צלעות מקבילות.', pts: () => regularPts(5, 50, 47, 40) },
  hexagon: { name: 'משושה משוכלל', pairs: 3, why: 'במשושה משוכלל כל צלע מקבילה לצלע שמולה: 3 זוגות.', pts: () => regularPts(6, 50, 45, 40, 0) },
  trapezoid: { name: 'טרפז', pairs: 1, why: 'בטרפז יש רק זוג אחד של צלעות מקבילות – הבסיסים.', pts: (r) => [[5 + r.int(10, 30), 16], [95 - r.int(10, 30), 16], [95, 70], [5, 70]] },
  rectangle: { name: 'מלבן', pairs: 2, why: 'במלבן הצלעות שמול זו מקבילות: 2 זוגות.', pts: (r) => { const w = r.int(70, 90), h = r.int(40, 56); return [[(100 - w) / 2, 45 - h / 2], [(100 + w) / 2, 45 - h / 2], [(100 + w) / 2, 45 + h / 2], [(100 - w) / 2, 45 + h / 2]]; } },
  square: { name: 'ריבוע', pairs: 2, why: 'בריבוע הצלעות שמול זו מקבילות: 2 זוגות.', pts: () => [[22, 14], [78, 14], [78, 70], [22, 70]] },
  parallelogram: { name: 'מקבילית', pairs: 2, why: 'במקבילית הצלעות שמול זו מקבילות: 2 זוגות.', pts: (r) => { const s = r.int(12, 26); return [[5 + s, 16], [95, 16], [95 - s, 70], [5, 70]]; } },
};
const shapeSvg = (pts) => svg(100, 90, poly(pts), 'ציור', 1.5);
const cellOf = (pts) => poly(pts);

// ---------- 13. צלעות מקבילות ----------
function parallelCount(rng) {
  const key = rng.pick(Object.keys(SHAPES)), s = SHAPES[key];
  const named = rng.chance(0.4);
  return mc(rng, {
    kind: 'parallel', meta: { shape: key, pairs: s.pairs }, svg: shapeSvg(s.pts(rng)),
    text: named ? `כמה זוגות של צלעות מקבילות יש ב${s.name}?` : 'כמה זוגות של צלעות מקבילות יש בצורה שבציור?',
    explain: s.why,
  }, s.pairs, [0, 1, 2, 3]);
}
const PAIRS_TEXT = ['באיזו צורה אין אף זוג צלעות מקבילות?', 'באיזו צורה יש בדיוק זוג אחד של צלעות מקבילות?', 'באיזו צורה יש בדיוק שני זוגות של צלעות מקבילות?', 'באיזו צורה יש בדיוק שלושה זוגות של צלעות מקבילות?'];
function parallelPick(rng) {
  const k = rng.pick([0, 1, 2, 3]);
  const keys = Object.keys(SHAPES);
  const ans = rng.pick(keys.filter((x) => SHAPES[x].pairs === k));
  const others = rng.shuffle(keys.filter((x) => SHAPES[x].pairs !== k)).slice(0, 3);
  const order = rng.shuffle([ans, ...others]);
  const letters = ['א', 'ב', 'ג', 'ד'];
  const idx = order.indexOf(ans);
  return {
    kind: 'parallel', meta: { shapes: order, pairs: order.map((x) => SHAPES[x].pairs), k },
    svg: rowSvg(order.map((x) => cellOf(SHAPES[x].pts(rng))), 100, 90),
    text: PAIRS_TEXT[k], options: letters, answer: letters[idx],
    explain: `${letters[idx]} היא ${SHAPES[ans].name}. ${SHAPES[ans].why}`,
  };
}
// צלע מקבילה לצלע נתונה, בצורה עם אותיות
function parallelNamed(rng) {
  const key = rng.pick(['rectangle', 'square', 'parallelogram', 'trapezoid']);
  const pts = SHAPES[key].pts(rng).map(([x, y]) => [x + 20, y + 10]);
  const pic = svg(140, 110, poly(pts) + vertexLabels(pts, ['A', 'B', 'C', 'D']), `${SHAPES[key].name} ABCD`);
  const base = { kind: 'parallel-named', meta: { shape: key }, svg: pic };
  if (key === 'trapezoid') {
    if (rng.chance(0.5)) {
      return mc(rng, { ...base, text: 'בטרפז ABCD יש זוג אחד של צלעות מקבילות. מהן?', explain: 'הצלעות AB ו-DC הן הבסיסים של הטרפז – הן מקבילות. AD ו-BC (השוקיים) לא מקבילות.' }, 'AB ו-DC', ['AD ו-BC', 'AB ו-BC', 'AC ו-BD']);
    }
    return mc(rng, { ...base, text: 'איזו צלע מקבילה לצלע AB?', explain: 'AB ו-DC הן הבסיסים של הטרפז – הן מקבילות.' }, 'DC', ['BC', 'AD', 'AC']);
  }
  if (rng.chance(0.5)) return mc(rng, { ...base, text: 'איזו צלע מקבילה לצלע AB?', explain: `ב${SHAPES[key].name} הצלע שמול AB היא DC, והן מקבילות. AC הוא אלכסון, לא צלע.` }, 'DC', ['BC', 'AD', 'AC']);
  return mc(rng, { ...base, text: 'איזו צלע מקבילה לצלע BC?', explain: `ב${SHAPES[key].name} הצלע שמול BC היא AD, והן מקבילות. AC הוא אלכסון, לא צלע.` }, 'AD', ['AB', 'DC', 'AC']);
}

// ---------- 14. היקף מצולעים ----------
const UNIT = 'ס"מ';
function perimeterRect(rng) {
  const a = rng.int(4, 15), b = rng.int(2, a - 1);
  const pts = [[20, 14], [20 + 110, 14], [20 + 110, 14 + 70], [20, 14 + 70]];
  const pic = svg(150, 100, poly(pts) + sideLabels(pts, [String(a), String(b), '', '']), 'מלבן עם שתי צלעות מסומנות', 1.2);
  const ans = 2 * (a + b);
  return numQ(rng, { kind: 'perimeter', meta: { sides: [a, b, a, b] }, svg: pic, text: `למלבן שבציור אורך ${a} ${UNIT} ורוחב ${b} ${UNIT}. מהו ההיקף שלו (בס"מ)?`, explain: `ההיקף הוא סכום כל הצלעות: ${a} + ${b} + ${a} + ${b} = ${ans}. אפשר גם 2 × (${a} + ${b}) = ${ans}.` }, ans, [a * b, a + b, 2 * a + b, a + 2 * b], 0.5);
}
function perimeterPolygon(rng) {
  const n = rng.pick([3, 4, 5]);
  const sides = Array.from({ length: n }, () => rng.int(3, 14));
  const pts = n === 3 ? [[60, 12], [112, 82], [8, 82]] : n === 4 ? [[14, 12], [106, 20], [112, 82], [8, 76]] : regularPts(5, 60, 50, 42);
  const pic = svg(130, 112, poly(pts) + sideLabels(pts, sides.map(String), { gap: 12, size: 13 }), 'מצולע עם אורכי הצלעות');
  const ans = sides.reduce((s, x) => s + x, 0);
  return numQ(rng, { kind: 'perimeter', meta: { sides }, svg: pic, text: 'אורכי הצלעות בס"מ. מהו ההיקף של המצולע?', explain: `מחברים את כל הצלעות: ${sides.join(' + ')} = ${ans} ${UNIT}.` }, ans, [ans - sides[0], ans + 1, ans - 1, ans + 10, sides[0] * n], 0.5);
}
function perimeterSquare(rng) {
  const a = rng.int(2, 25);
  const pts = [[30, 14], [90, 14], [90, 74], [30, 74]];
  const pic = rng.chance(0.5) ? svg(120, 90, poly(pts) + sideLabels(pts, [String(a), '', '', '']), 'ריבוע') : undefined;
  return numQ(rng, { kind: 'perimeter', meta: { sides: [a, a, a, a] }, ...(pic ? { svg: pic } : {}), text: `אורך צלע של ריבוע הוא ${a} ${UNIT}. מהו ההיקף שלו (בס"מ)?`, explain: `לריבוע 4 צלעות שוות: 4 × ${a} = ${4 * a} ${UNIT}.` }, 4 * a, [a * a, 2 * a, a + 4, 3 * a], 0.5);
}
function perimeterMissing(rng) {
  const t = rng.int(0, 3);
  if (t === 0) {
    const a = rng.int(5, 15), b = rng.int(2, a - 1), P = 2 * (a + b);
    const pts = [[20, 14], [130, 14], [130, 84], [20, 84]];
    const pic = svg(150, 100, poly(pts) + sideLabels(pts, [String(a), '?', '', '']), 'מלבן עם צלע חסרה');
    return numQ(rng, { kind: 'perimeter-missing', svg: pic, meta: { P, a, ans: b }, text: `היקף המלבן הוא ${P} ס"מ ואורכו ${a} ס"מ. מהו רוחבו (בס"מ)?`, explain: `חצי מההיקף הוא ${P} : 2 = ${P / 2}, והוא אורך + רוחב. לכן הרוחב ${P / 2} − ${a} = ${b}.` }, b, [P - a, P / 2, a - b, P / 2 + a], 0.5);
  }
  if (t === 1) {
    const s = rng.int(3, 20);
    return numQ(rng, { kind: 'perimeter-missing', meta: { P: 4 * s, ans: s }, text: `היקף ריבוע הוא ${4 * s} ס"מ. מה אורך כל צלע (בס"מ)?`, explain: `לריבוע 4 צלעות שוות, ולכן ${4 * s} : 4 = ${s} ${UNIT}.` }, s, [4 * s - 4, s * 2, s + 4, 2 * s + 2], 0.5);
  }
  if (t === 2) {
    const s = rng.int(3, 20);
    return numQ(rng, { kind: 'perimeter-missing', meta: { P: 3 * s, ans: s }, text: `היקף משולש שווה צלעות הוא ${3 * s} ס"מ. מה אורך כל צלע (בס"מ)?`, explain: `למשולש שווה צלעות 3 צלעות שוות, ולכן ${3 * s} : 3 = ${s} ${UNIT}.` }, s, [3 * s - 3, s * 2, s + 3, 4 * s], 0.5);
  }
  const a = rng.int(4, 15), b = rng.int(4, 15), c = rng.int(4, 15), P = a + b + c;
  return numQ(rng, { kind: 'perimeter-missing', meta: { P, a, b, ans: c }, text: `היקף משולש הוא ${P} ס"מ. שתי צלעות שלו באורך ${a} ס"מ ו-${b} ס"מ. מה אורך הצלע השלישית (בס"מ)?`, explain: `${a} + ${b} = ${a + b}, ו-${P} − ${a + b} = ${c}. הצלע השלישית היא ${c} ${UNIT}.` }, c, [a + b, P - a, P + a, P - b], 0.5);
}
function perimeterFence(rng) {
  const a = rng.int(6, 30), b = rng.int(3, a - 1);
  return numQ(rng, { kind: 'perimeter', meta: { sides: [a, b, a, b] }, text: `סביב גינה מלבנית שאורכה ${a} מטרים ורוחבה ${b} מטרים בונים גדר. כמה מטרים של גדר צריך?`, explain: `הגדר עוברת על כל הצלעות: ${a} + ${b} + ${a} + ${b} = ${2 * (a + b)} מטרים.` }, 2 * (a + b), [a * b, a + b, 2 * a + b], 0.5);
}

// ---------- 15. שטחים ----------
// צורה על משבצות: מלבן אחד, או שני מלבנים שנוגעים זה בזה
function cellShape(rng) {
  const w1 = rng.int(2, 5), h1 = rng.int(1, 3);
  const cells = new Set();
  const add = (x0, y0, w, h) => { for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) cells.add(`${x},${y}`); };
  add(0, 0, w1, h1);
  if (rng.chance(0.6)) {
    const x2 = rng.int(0, w1 - 1), w2 = rng.int(1, Math.min(5, 6 - x2));
    add(x2, h1, w2, rng.int(1, 3));
  }
  return [...cells].map((c) => c.split(',').map(Number));
}
function areaGrid(rng) {
  const cells = cellShape(rng);
  const S = 28, W = Math.max(...cells.map((c) => c[0])) + 1, H = Math.max(...cells.map((c) => c[1])) + 1;
  let out = '';
  for (const [x, y] of cells) out += rect(10 + x * S, 10 + y * S, S, S, { fill: COL.a, stroke: 'var(--card, #fff)', width: 1.5 });
  const pic = svg(20 + W * S, 20 + H * S, out, 'צורה על משבצות');
  const n = cells.length;
  return numQ(rng, { kind: 'area', meta: { cells }, svg: pic, text: 'כל משבצת היא סנטימטר רבוע אחד. מה שטח הצורה (בס"מ רבועים)?', explain: `סופרים את המשבצות הצבועות: ${n}. לכן השטח ${n} ס"מ רבועים.` }, n, [n + 1, n - 1, n + 2, n - 2], 0.5);
}
function areaRect(rng) {
  const a = rng.int(3, 14), b = rng.int(2, a - 1);
  const pts = [[20, 14], [130, 14], [130, 84], [20, 84]];
  const pic = svg(150, 100, poly(pts) + sideLabels(pts, [String(a), String(b), '', '']), 'מלבן');
  return numQ(rng, { kind: 'area', meta: { rect: [a, b] }, svg: pic, text: `למלבן אורך ${a} ס"מ ורוחב ${b} ס"מ. מה שטחו (בס"מ רבועים)?`, explain: `שטח מלבן = אורך × רוחב: ${a} × ${b} = ${a * b} ס"מ רבועים.` }, a * b, [2 * (a + b), a + b, a * b + a, a * b - b], 0.5);
}
function areaSquare(rng) {
  const a = rng.int(2, 12);
  return numQ(rng, { kind: 'area', meta: { rect: [a, a] }, text: `אורך צלע של ריבוע הוא ${a} ס"מ. מה שטחו (בס"מ רבועים)?`, explain: `שטח ריבוע = צלע × צלע: ${a} × ${a} = ${a * a} ס"מ רבועים.` }, a * a, [4 * a, 2 * a, a + a + 1, a * a + a], 0.5);
}
function areaMissing(rng) {
  const a = rng.int(3, 12), b = rng.int(2, 11);
  return numQ(rng, { kind: 'area-missing', meta: { area: a * b, a, ans: b }, text: `שטח מלבן הוא ${a * b} ס"מ רבועים ואורכו ${a} ס"מ. מה רוחבו (בס"מ)?`, explain: `שטח = אורך × רוחב, לכן הרוחב הוא ${a * b} : ${a} = ${b} ס"מ.` }, b, [a * b - a, a + b, a * b / 2 | 0, b + 1], 0.5);
}
// ציור מלבן יחסי בתוך תא של שורת ציורים
function rectCell(a, b, scale) {
  const w = a * scale, h = b * scale;
  return rect((100 - w) / 2, (90 - h) / 2, w, h, { fill: COL.a });
}
function areaCompare(rng) {
  for (;;) {
    const dims = Array.from({ length: 4 }, () => { const a = rng.int(2, 9), b = rng.int(2, 9); return [Math.max(a, b), Math.min(a, b)]; });
    const areas = dims.map(([a, b]) => a * b);
    if (new Set(areas).size < 4) continue;
    const big = rng.chance(0.5);
    const target = big ? Math.max(...areas) : Math.min(...areas);
    const idx = areas.indexOf(target);
    const letters = ['א', 'ב', 'ג', 'ד'];
    return {
      kind: 'area-compare', meta: { areas, big },
      svg: rowSvg(dims.map(([a, b]) => rectCell(a, b, 8)), 100, 90, dims.map(([a, b]) => `${a} × ${b}`)),
      text: `מידות המלבנים בס"מ כתובות מתחת לכל ציור. איזה מלבן שטחו ${big ? 'הגדול' : 'הקטן'} ביותר?`,
      options: letters, answer: letters[idx],
      explain: `שטחי המלבנים: ${dims.map(([a, b], i) => `${letters[i]}: ${a} × ${b} = ${a * b}`).join(', ')}. ${big ? 'הגדול' : 'הקטן'} ביותר הוא ${letters[idx]}.`,
    };
  }
}
function samePerimeter(rng) {
  const s = rng.int(8, 14);
  const as = rng.shuffle(Array.from({ length: Math.floor(s / 2) }, (_, i) => i + 1)).slice(0, 4);
  const dims = as.map((a) => [s - a, a]);
  const areas = dims.map(([a, b]) => a * b);
  const big = rng.chance(0.6);
  const idx = areas.indexOf(big ? Math.max(...areas) : Math.min(...areas));
  const letters = ['א', 'ב', 'ג', 'ד'];
  const sc = 80 / s;
  return {
    kind: 'area-compare', meta: { areas, big, perimeter: 2 * s },
    svg: rowSvg(dims.map(([a, b]) => rectCell(a, b, sc)), 100, 90, dims.map(([a, b]) => `${a} × ${b}`)),
    text: `לכל המלבנים אותו היקף: ${2 * s} ס"מ. מידות המלבנים כתובות מתחת לציורים. לאיזה מלבן השטח ${big ? 'הגדול' : 'הקטן'} ביותר?`,
    options: letters, answer: letters[idx],
    explain: `גם כשההיקף זהה, השטחים שונים: ${dims.map(([a, b], i) => `${letters[i]}: ${a * b}`).join(', ')}. ${big ? 'ככל שהמלבן קרוב יותר לריבוע השטח גדול יותר' : 'ככל שהמלבן ארוך וצר יותר השטח קטן יותר'}.`,
  };
}

// ---------- 16. זוויות ----------
const KIND_OF = (d) => (d < 90 ? 'חדה' : d === 90 ? 'ישרה' : 'קהה');
const ANGLE_WHY = {
  חדה: 'זווית חדה קטנה מזווית ישרה (פחות מ-90°).',
  ישרה: 'זווית ישרה היא פינה של ריבוע, בדיוק 90°.',
  קהה: 'זווית קהה גדולה מזווית ישרה, אבל קטנה מקו ישר (בין 90° ל-180°).',
};
function randAngle(rng, kind) {
  if (kind === 'חדה') return rng.int(4, 15) * 5;
  if (kind === 'ישרה') return 90;
  return rng.int(21, 33) * 5;
}
function angleClassify(rng) {
  const kind = rng.pick(['חדה', 'ישרה', 'קהה']);
  const deg = randAngle(rng, kind);
  return mc(rng, { kind: 'angle', meta: { deg }, svg: angleSvg(deg, rng.int(0, 359)), text: 'איזו זווית מופיעה בציור?', explain: ANGLE_WHY[kind] }, kind, ['חדה', 'ישרה', 'קהה'], 3);
}
function angleRow(degs, rng) {
  return rowSvg(degs.map((d) => angleEl(d, rng.int(0, 359), 55, 50, 46)), 110, 100);
}
function angleCompare(rng) {
  for (;;) {
    const degs = Array.from({ length: 4 }, () => rng.int(4, 33) * 5);
    const sorted = [...degs].sort((a, b) => a - b);
    if (sorted.some((d, i) => i && d - sorted[i - 1] < 15)) continue;
    const big = rng.chance(0.5);
    const idx = degs.indexOf(big ? sorted[3] : sorted[0]);
    const letters = ['א', 'ב', 'ג', 'ד'];
    return { kind: 'angle-compare', meta: { degs, big }, svg: angleRow(degs, rng), text: `איזו זווית ${big ? 'גדולה' : 'קטנה'} ביותר?`, options: letters, answer: letters[idx], explain: `זווית גדולה יותר היא זווית ש"נפתחת" יותר, בלי קשר לאורך הקווים. ${big ? 'הגדולה' : 'הקטנה'} ביותר היא ${letters[idx]}.` };
  }
}
function angleWhich(rng) {
  const target = rng.pick(['חדה', 'קהה']);
  const ans = randAngle(rng, target);
  const rest = Array.from({ length: 3 }, () => randAngle(rng, rng.pick(['ישרה', target === 'חדה' ? 'קהה' : 'חדה'])));
  const degs = rng.shuffle([ans, ...rest]);
  const idx = degs.indexOf(ans);
  const letters = ['א', 'ב', 'ג', 'ד'];
  return { kind: 'angle-which', meta: { degs, target }, svg: angleRow(degs, rng), text: `איזו זווית ${target === 'חדה' ? 'חדה' : 'קהה'}?`, options: letters, answer: letters[idx], explain: `${ANGLE_WHY[target]} זו זווית ${letters[idx]}.` };
}
const RIGHT_SHAPES = [
  ['מלבן', 4, [[15, 15], [85, 15], [85, 65], [15, 65]]],
  ['ריבוע', 4, [[22, 12], [78, 12], [78, 68], [22, 68]]],
  ['משולש ישר זווית', 1, [[18, 12], [18, 72], [85, 72]]],
  ['טרפז ישר זווית', 2, [[15, 15], [60, 15], [88, 70], [15, 70]]],
  ['מקבילית', 0, [[30, 15], [92, 15], [70, 70], [8, 70]]],
  ['משולש שווה צלעות', 0, [[50, 12], [90, 75], [10, 75]]],
  ['צורת האות L', 5, [[10, 8], [45, 8], [45, 38], [90, 38], [90, 74], [10, 74]]],
];
function angleCountRight(rng) {
  const [name, n, pts] = rng.pick(RIGHT_SHAPES);
  return numChoice(rng, { kind: 'angle-count', meta: { shape: name, count: n }, svg: svg(100, 84, poly(pts), name, 1.5), text: 'כמה זוויות ישרות יש בצורה שבציור?', explain: `${name === 'צורת האות L' ? 'בצורת האות L יש 5 פינות ישרות; בפינה הפנימית הזווית גדולה מזווית ישרה.' : name === 'מקבילית' || name === 'משולש שווה צלעות' ? `ב${name} אין אף פינה ישרה.` : (n === 1 ? `ב${name} יש פינה ישרה אחת.` : `ב${name} יש ${n} פינות ישרות.`)}` }, n, [n + 1, n - 1, 4, 2, 3, 0]);
}

// ---------- 17. אלכסונים ----------
const POLYS = { 3: ['משולש', 0, 'במשולש כל קודקוד שכן לשני האחרים, ולכן אין אלכסונים.'], 4: ['מרובע', 2, 'במרובע מכל קודקוד יוצא אלכסון אחד, וביחד 2 אלכסונים.'], 5: ['מחומש', 5, 'במחומש מכל קודקוד יוצאים 2 אלכסונים. 5 × 2 : 2 = 5.'], 6: ['משושה', 9, 'במשושה מכל קודקוד יוצאים 3 אלכסונים. 6 × 3 : 2 = 9.'] };
// מצולע קמור עם קצת עיוות, כדי שלא ייראה תמיד משוכלל
function looseShape(rng, n) {
  const start = rng.int(0, 359);
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i + rng.int(-6, 6)) * Math.PI) / 180, r = rng.int(35, 40);
    return [60 + r * Math.cos(a), 60 + r * Math.sin(a)];
  });
}
function diagCount(rng) {
  const n = rng.int(3, 6), [name, ans, why] = POLYS[n];
  return numChoice(rng, { kind: 'diag', meta: { n, count: ans }, svg: svg(120, 120, poly(looseShape(rng, n)), name, 1.3), text: `כמה אלכסונים יש ב${name}?`, explain: `אלכסון מחבר שני קודקודים שאינם שכנים. ${why}` }, ans, [n, n - 1, n + 1, ans + 1, ans * 2, 3]);
}
function diagWhichPolygon(rng) {
  const n = rng.int(3, 6), [name, ans, why] = POLYS[n];
  const names = Object.values(POLYS).map((p) => p[0]);
  return mc(rng, { kind: 'diag', meta: { n, count: ans }, text: ans === 0 ? 'לאיזה מצולע אין אף אלכסון?' : `לאיזה מצולע יש ${ans === 2 ? 'שני' : ans} אלכסונים?`, explain: `${name}: ${why}` }, name, names);
}
function diagIdentify(rng) {
  const n = rng.pick([4, 5]);
  const pts = looseShape(rng, n);
  const names = 'ABCDE'.slice(0, n).split('');
  const pic = svg(120, 120, poly(pts) + vertexLabels(pts, names, { gap: 13 }), `מצולע עם קודקודים ${names.join(', ')}`);
  const sides = names.map((c, i) => c + names[(i + 1) % n]);
  const diags = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (j !== i + 1 && !(i === 0 && j === n - 1)) diags.push(names[i] + names[j]);
  const ans = rng.pick(diags);
  const wrong = rng.shuffle(sides).slice(0, 3);
  return mc(rng, { kind: 'diag-id', meta: { n, sides, diags }, svg: pic, text: 'איזה מהקטעים הוא אלכסון?', explain: `אלכסון מחבר שני קודקודים שאינם שכנים. ${ans} מחבר קודקודים שאינם שכנים, והקטעים האחרים הם צלעות של המצולע.` }, ans, wrong);
}

export const geometryGens = {
  parallel: [parallelCount, parallelPick, parallelNamed],
  perimeter: [perimeterRect, perimeterPolygon, perimeterSquare, perimeterMissing, perimeterFence],
  area: [areaGrid, areaRect, areaSquare, areaMissing, areaCompare, samePerimeter],
  angles: [angleClassify, angleCompare, angleWhich, angleCountRight],
  diagonals: [diagCount, diagWhichPolygon, diagIdentify],
};
export { SHAPES };

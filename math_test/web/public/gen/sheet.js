// דף התרגול של המורה: המבחן המסכם בנוי לפי הדף (סדר קבוע, שאלה לכל סעיף), והנושא "דף התרגול" מערבב את אותם וריאנטים
import { sheetNumbers as N } from './numbers.js';
import { sheetFractions as F } from './fractions.js';
import { sheetMeasure as M } from './measure.js';
import { sheetGeometry as G } from './geometry.js';

const SUB = ['', 'א', 'ב', 'ג', 'ד', 'ה'];

// [מספר שאלה בדף, נושא אמיתי, מחולל]. כמה שורות עם אותו מספר = סעיפים א, ב, ג...
const PLAN = [
  [1, 'sequences', N.seqTriple],
  [2, 'digits', N.digitsGreater], [2, 'digits', N.digitsParity],
  [3, 'zero_one', N.zeroCombo(0)], [3, 'zero_one', N.zeroCombo(1)], [3, 'zero_one', N.zeroCombo(2)],
  [4, 'ops', N.opsAddSmall], [4, 'ops', N.opsSubZeros], [4, 'ops', N.opsHandy], [4, 'ops', N.opsDivTable], [4, 'order', N.orderDiv],
  [5, 'word_problems', N.wordLibrary],
  [6, 'ops', N.signProducts], [6, 'ops', N.signThree],
  [7, 'times_more', N.timesExpr],
  [8, 'word_problems', N.wordClasses], [8, 'word_problems', N.wordGroups], [8, 'word_problems', N.wordSplit],
  [9, 'compare_frac', F.fracClaim],
  [10, 'ops', N.missingSub], [10, 'ops', N.missingIneq],
  [11, 'sequences', N.seqLine],
  [12, 'whole_from_part', F.timeWho], [12, 'whole_from_part', F.timeDiff],
  [13, 'whole_from_part', F.wholeLShape],
  [14, 'compare_frac', F.fracEqual],
  [15, 'write_problem', N.writeDivision],
  [16, 'parallel', G.parallelSide],
  [17, 'perimeter', G.perimeterGrid],
  [18, 'area', G.areaPairs],
  [19, 'angles', G.angleQuadMin], [19, 'angles', G.angleQuadObtuse],
  [20, 'diagonals', G.diagNot],
  [21, 'length', M.rulerTrap],
];

// תווית לכל שאלה: "שאלה 4 ב" (בלי אות כשיש סעיף אחד)
export const EXAM_STEPS = PLAN.map(([no, topic, fn], i) => {
  const count = PLAN.filter((p) => p[0] === no).length;
  const sub = count > 1 ? SUB[PLAN.slice(0, i + 1).filter((p) => p[0] === no).length] : '';
  return { no, topic, fn, label: `שאלה ${no}${sub ? ` ${sub}` : ''}` };
});
export const SHEET_EXAM_SIZE = EXAM_STEPS.length;

// הנושא "דף התרגול": כל הוריאנטים של הדף (בלי כפילויות של אותו מחולל)
export const SHEET_GENS = [
  N.seqTriple, N.seqLine, N.digitsGreater, N.digitsParity, N.zeroOneCombined, N.opsAddSmall, N.opsSubZeros, N.opsHandy, N.opsDivTable, N.orderDiv,
  N.signProducts, N.signThree, N.timesExpr, N.wordLibrary, N.wordClasses, N.wordGroups, N.wordSplit, N.missingSub, N.missingIneq, N.writeDivision,
  F.fracClaim, F.fracEqual, F.timeWho, F.timeDiff, F.wholeLShape,
  G.parallelSide, G.perimeterGrid, G.areaPairs, G.angleQuadMin, G.angleQuadObtuse, G.diagNot, G.diagIs, M.rulerTrap,
];

// מחולל השאלות: נושא ← שאלה. הכול פונקציות טהורות עם rng (בדיקות בלי דפדפן)
import { makeRng } from '../rand.js';
import { ROUND_SIZE, EXAM_SIZE } from '../topics.js';
import { numbersGens } from './numbers.js';
import { fractionGens } from './fractions.js';
import { measureGens } from './measure.js';
import { geometryGens } from './geometry.js';
import { dataGens } from './data.js';
import { EXAM_STEPS, SHEET_GENS } from './sheet.js';

export const GENERATORS = { ...numbersGens, ...fractionGens, ...measureGens, ...geometryGens, ...dataGens, teacher_sheet: SHEET_GENS };

// תיאור קצר של השאלה לדוח להורים (עד 60 תווים)
export function questionKey(q) {
  return String(q.expr || q.text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

// שאלה אחת מנושא (וריאנט אקראי, או לפי אינדקס)
export function genQuestion(topic, rng, variant) {
  const list = GENERATORS[topic];
  const fn = variant === undefined ? rng.pick(list) : list[variant % list.length];
  const q = fn(rng);
  return { ...q, topic, key: questionKey(q) };
}

// סיבוב אחד בנושא: 10 שאלות, כל הוריאנטים מתחלפים, בלי שאלות כפולות
export function buildRound(topic, seed, size = ROUND_SIZE) {
  const rng = makeRng(seed);
  const variants = rng.shuffle(GENERATORS[topic].map((_, i) => i));
  const out = [];
  const seen = new Set();
  for (let i = 0; i < size; i++) {
    let q;
    for (let tries = 0; tries < 20; tries++) {
      q = genQuestion(topic, rng, variants[(i + tries) % variants.length]);
      if (!seen.has(q.key + q.answer)) break;
    }
    seen.add(q.key + q.answer);
    out.push(q);
  }
  return out;
}

// מבחן מסכם לפי דף התרגול של המורה: שאלה לכל סעיף, בסדר הדף, עם מספרים חדשים בכל פעם (אותו זרע = אותן שאלות).
// כל שאלה שומרת את הנושא האמיתי שלה, ולכן הדיווח לשרת לפי נושא ממשיך לעבוד
export function buildExam(seed) {
  const rng = makeRng(seed);
  return EXAM_STEPS.map((step) => {
    const q = step.fn(rng);
    return { ...q, topic: step.topic, key: questionKey(q), no: step.label };
  });
}

export const build = (mode, seed) => (mode === 'exam' ? buildExam(seed) : buildRound(mode, seed));

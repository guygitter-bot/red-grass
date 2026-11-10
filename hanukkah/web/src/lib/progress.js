// ההתקדמות נשמרת ב-localStorage. תמיד בתוך try/catch, וסובלנית לשדות ישנים או חסרים.
const KEY = 'ch_progress_v1';
export const LEVELS = ['easy', 'medium', 'hard'];
export const STORY_CHAPTERS = 7;
export const CATCH_TIERS = [15, 40];
export const SCRAMBLE_PER_STAR = 5;

const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
const intList = (v, max) =>
  Array.isArray(v) ? [...new Set(v.filter((x) => Number.isInteger(x) && x >= 0 && x < max))].sort((a, b) => a - b) : [];

export function emptyProgress() {
  return {
    story: [],
    quiz: { easy: { best: 0, stars: 0, rounds: 0 }, medium: { best: 0, stars: 0, rounds: 0 }, hard: { best: 0, stars: 0, rounds: 0 } },
    memory: { small: 0, medium: 0, large: 0 }, // מספר מהלכים הכי טוב (0 = עוד לא הושלם)
    dreidel: { wins: 0, played: 0 },
    candles: [], // לילות (1-8) שהודלקו בלי טעויות
    catchBest: 0,
    scramble: [], // מזהי מילים שנפתרו
    facts: [],
    riddles: [],
    cards: 0,
  };
}

// מנרמל כל ערך: שדה חסר או פגום מקבל ברירת מחדל
export function safeProgress(raw) {
  const e = emptyProgress();
  if (!raw || typeof raw !== 'object') return e;
  const q = raw.quiz && typeof raw.quiz === 'object' ? raw.quiz : {};
  for (const l of LEVELS) {
    const x = q[l] && typeof q[l] === 'object' ? q[l] : {};
    e.quiz[l] = { best: Math.min(8, num(x.best)), stars: Math.min(3, num(x.stars)), rounds: num(x.rounds) };
  }
  const m = raw.memory && typeof raw.memory === 'object' ? raw.memory : {};
  for (const k of Object.keys(e.memory)) e.memory[k] = num(m[k]);
  const d = raw.dreidel && typeof raw.dreidel === 'object' ? raw.dreidel : {};
  e.dreidel = { wins: num(d.wins), played: num(d.played) };
  e.story = intList(raw.story, STORY_CHAPTERS);
  e.candles = Array.isArray(raw.candles) ? [...new Set(raw.candles.filter((n) => Number.isInteger(n) && n >= 1 && n <= 8))].sort() : [];
  e.catchBest = num(raw.catchBest);
  e.scramble = intList(raw.scramble, 1000);
  e.facts = intList(raw.facts, 1000);
  e.riddles = intList(raw.riddles, 1000);
  e.cards = num(raw.cards);
  return e;
}

export function loadProgress() {
  try {
    return safeProgress(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // אין אחסון (חלון פרטי וכו') – ממשיכים בלי שמירה
  }
}

export function quizStars(score) {
  if (score >= 7) return 3;
  if (score >= 5) return 2;
  if (score >= 3) return 1;
  return 0;
}

// סך הכוכבים: פרק בסיפור, כוכבי חידון, לילות שהודלקו, ניצחונות בסביבון (עד 3), גדלי זיכרון שהושלמו,
// ניקוד בתפוס, וכל 5 מילים מבולבלות
export function totalStars(p) {
  const s = safeProgress(p);
  let t = s.story.length;
  for (const l of LEVELS) t += s.quiz[l].stars;
  t += s.candles.length;
  t += Math.min(3, s.dreidel.wins);
  t += Object.values(s.memory).filter((v) => v > 0).length;
  t += CATCH_TIERS.filter((n) => s.catchBest >= n).length;
  t += Math.min(4, Math.floor(s.scramble.length / SCRAMBLE_PER_STAR));
  return t;
}

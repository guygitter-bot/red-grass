// התקדמות בתרגול: כוכבים לכל פריט (סעיף בשיר / תרגיל טכניקה), ציון שיא, רצף ימים ודקות תרגול.
// פונקציות טהורות (נבדקות ב-progress.test.js). פריט = מפתח טקסט: `song:<יוטיוב>:<סעיף>` או `ex:<תרגיל>`.
// תאריכים = מפתחות 'YYYY-MM-DD' לפי השעון המקומי של המשתמש; חישובי ימים ב-UTC כדי שלא יושפעו משעון קיץ.

// כללי הכוכבים (מוצגים גם בממשק): 1★ מ-60%, 2★ מ-80%, 3★ מ-95% – אבל 3★ רק במהירות מלאה (100%)
export const STAR_RULES = [60, 80, 95];
export const PASS_FOR_BPM = 90; // ציון שממנו מציעים "עוד 5 BPM"
export const MIN_SECONDS = 5; // תרגול קצר מזה לא נספר

export function starsFor(score, speed = 1) {
  const s = Number(score) || 0;
  let n = s >= STAR_RULES[2] ? 3 : s >= STAR_RULES[1] ? 2 : s >= STAR_RULES[0] ? 1 : 0;
  if (n === 3 && speed < 0.999) n = 2; // במהירות איטית – עד שני כוכבים
  return n;
}

// 'YYYY-MM-DD' לפי השעון המקומי
export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
export function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

// רצף: ימים רצופים עם תרגול. אם היום עוד לא תרגלו – הרצף נשמר עד סוף היום (סופרים מאתמול)
export function streakOf(days, today = dayKey()) {
  const has = (k) => (days && days[k] > 0) || false;
  let k = has(today) ? today : prevDay(today);
  let n = 0;
  while (has(k)) {
    n++;
    k = prevDay(k);
  }
  return n;
}

const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function safeItem(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const best = Math.round(num(r.best, 0, 100, 0));
  return {
    best,
    stars: Math.round(num(r.stars, 0, 3, 0)),
    runs: Math.round(num(r.runs, 0, 1e6, 0)),
    bestBpm: Math.round(num(r.bestBpm, 0, 400, 0)),
    last: typeof r.last === 'string' && KEY_RE.test(r.last) ? r.last : '',
  };
}

// נרמול: נתונים חסרים / ישנים / שבורים לא מפילים כלום
export function safeProgress(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const items = {};
  if (r.items && typeof r.items === 'object') {
    for (const [k, v] of Object.entries(r.items)) if (typeof k === 'string' && k.length < 80) items[k] = safeItem(v);
  }
  const days = {};
  if (r.days && typeof r.days === 'object') {
    for (const [k, v] of Object.entries(r.days)) if (KEY_RE.test(k)) days[k] = Math.round(num(v, 0, 86400, 0));
  }
  return { v: 1, items, days };
}

export function totalSeconds(p) {
  return Object.values(p.days).reduce((a, b) => a + b, 0);
}
export function totalMinutes(p) {
  const sec = totalSeconds(p);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0; // תרגול קצר נספר כדקה, שלא יופיע 0
}
export function totalStars(p) {
  return Object.values(p.items).reduce((a, it) => a + it.stars, 0);
}

// רושם תרגול שהסתיים: run = { key, score (0..100), speed, seconds, bpm (לתרגיל), notes }. מחזיר { progress, stars, newBest, gained }
export function recordRun(prev, run, now = new Date()) {
  const p = safeProgress(prev);
  const seconds = Math.round(num(run.seconds, 0, 86400, 0));
  if (!run.key || seconds < MIN_SECONDS) return { progress: p, stars: 0, newBest: false, gained: false, counted: false };
  const old = p.items[run.key] || safeItem(null);
  const score = Math.round(num(run.score, 0, 100, 0));
  const stars = starsFor(score, run.speed ?? 1);
  const day = dayKey(now);
  const item = {
    best: Math.max(old.best, score),
    stars: Math.max(old.stars, stars),
    runs: old.runs + 1,
    bestBpm: score >= PASS_FOR_BPM && run.bpm ? Math.max(old.bestBpm, Math.round(run.bpm)) : old.bestBpm,
    last: day,
  };
  const next = { ...p, items: { ...p.items, [run.key]: item }, days: { ...p.days, [day]: (p.days[day] || 0) + seconds } };
  return { progress: next, stars, newBest: score > old.best, gained: item.stars > old.stars, counted: true };
}

// ההצעה הבאה: תרגיל הטכניקה הראשון (לפי הסדר) שעוד אין לו 2 כוכבים; אחר כך תרגיל עם פחות מ-3; ואם הכול מושלם – null
// exercises = [{ id }]
export function suggestNext(p, exercises) {
  const stars = (ex) => p.items[`ex:${ex.id}`]?.stars || 0;
  const first = exercises.find((ex) => stars(ex) < 2);
  if (first) return { id: first.id, stars: stars(first), reason: stars(first) === 0 ? 'new' : 'again' };
  const rest = exercises.find((ex) => stars(ex) < 3);
  if (rest) return { id: rest.id, stars: stars(rest), reason: 'polish' };
  return null;
}

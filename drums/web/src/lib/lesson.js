// מנוע מצב הלימוד: פונקציות טהורות (נבדקות ב-lesson.test.js). אין כאן אודיו ולא DOM.
// סעיף (section) = { steps (צעדים בתיבה), bars, hits: { מזהה חלק: [מקומות] } } מתוך data/grooves.js.
// כל תיבה = 4 פעמות; הצעד הוא חלק שווה מהתיבה (16 = שש-עשרה, 12 = שלישיות).
import { PIECES } from './kit';

export const BEATS = 4;
// חלון דירוג במילישניות
export const WINDOW = { perfect: 50, good: 120 };
// כמה זמן מדגישים חלק "עכשיו" סביב המכה (שניות): קצת לפני וקצת אחרי
export const NOW_BEFORE = 0.05;
export const NOW_AFTER = 0.14;

export function barSeconds(bpm, speed = 1) {
  return (BEATS * 60) / (bpm * Math.max(speed, 0.1));
}
export function stepSeconds(section, bpm, speed = 1) {
  return barSeconds(bpm, speed) / section.steps;
}
export function loopSeconds(section, bpm, speed = 1) {
  return barSeconds(bpm, speed) * section.bars;
}
export function totalSteps(section) {
  return section.steps * section.bars;
}

// אילו חלקים מנגנים בצעד מסוים
export function hitsAt(section, index) {
  return Object.keys(section.hits).filter((p) => section.hits[p].includes(index));
}

// לוח הזמנים של הסעיף: [{ index, time (שניות מתחילת הסעיף), pieces }] רק בצעדים שיש בהם מכה
export function scheduleFor(section, bpm, speed = 1) {
  const step = stepSeconds(section, bpm, speed);
  const out = [];
  for (let i = 0; i < totalSteps(section); i++) {
    const pieces = hitsAt(section, i);
    if (pieces.length) out.push({ index: i, time: i * step, pieces });
  }
  return out;
}

// הכי קרוב מבין המכות שמצפים להן לחלק הזה. expected = [{ time, pieces, key? }]. מחזיר { grade, delta, event } או miss
export function matchHit(pieceId, timeSec, expected, windowMs = WINDOW.good) {
  let best = null;
  for (const ev of expected) {
    if (!ev.pieces.includes(pieceId)) continue;
    const d = timeSec - ev.time;
    if (!best || Math.abs(d) < Math.abs(best.delta)) best = { delta: d, event: ev };
  }
  const ms = best ? Math.abs(best.delta) * 1000 : Infinity;
  if (ms <= WINDOW.perfect) return { grade: 'perfect', ...best };
  if (ms <= Math.max(windowMs, WINDOW.perfect)) return { grade: 'good', ...best };
  return { grade: 'miss', delta: best ? best.delta : 0, event: null };
}

// 'perfect' (עד 50ms) / 'good' (עד 120ms) / 'miss'
export function gradeHit(pieceId, timeSec, expected, windowMs = WINDOW.good) {
  return matchHit(pieceId, timeSec, expected, windowMs).grade;
}

// מועמדים לדירוג סביב רגע מסוים: המכות של המעבר הנוכחי ושל השכנים (בלולאה). time מוחלט מתחילת הסעיף.
// key ייחודי לכל מכה (מעבר:צעד) כדי שאפשר יהיה לסמן שכבר נוגנה
export function candidatesAround(events, loopLen, timeSec, loop = true) {
  const pass0 = Math.floor(timeSec / loopLen);
  const out = [];
  for (let pass = pass0 - 1; pass <= pass0 + 1; pass++) {
    if (pass < 0 || (!loop && pass > 0)) continue;
    for (const ev of events) out.push({ time: pass * loopLen + ev.time, pieces: ev.pieces, key: `${pass}:${ev.index}` });
  }
  return out;
}

// מה מודגש ברגע מסוים בתוך הלולאה (pos בשניות, 0..loopLen):
// now = חלקים להכות עכשיו, soon = המכה הבאה (אם בטווח maxAhead שניות). הלולאה "עוטפת"
export function cueAt(events, loopLen, pos, maxAhead = Infinity) {
  const now = new Set();
  let soonTime = Infinity;
  let soon = [];
  for (const ev of events) {
    for (const shift of [-loopLen, 0, loopLen]) {
      const t = ev.time + shift;
      if (pos >= t - NOW_BEFORE && pos <= t + NOW_AFTER) ev.pieces.forEach((p) => now.add(p));
      else if (t > pos + NOW_BEFORE && t < soonTime) {
        soonTime = t;
        soon = ev.pieces;
      }
    }
  }
  const soonSet = soonTime - pos <= maxAhead ? new Set(soon) : new Set();
  return { now, soon: soonSet };
}

// ציון באחוזים: מושלם = 1, טוב = 0.6, מחולק במספר המכות שכבר "נסגרו"
export function scorePercent({ perfect = 0, good = 0, missed = 0 }) {
  const total = perfect + good + missed;
  if (!total) return 0;
  return Math.round(((perfect + 0.6 * good) / total) * 100);
}

// ---- סנכרון עם השיר לפי הקשות ----
// tapTimes = זמני ההקשות בשניות של הסרטון, bpm = הקצב של הביט. המשתמש מקיש בכל פעם שהוא שומע פעמה
// (הכי טוב – הפעמה הראשונה בתיבה; אבל גם כל פעמה או כל פעמה שנייה מתקבלים).
// מחזיר { ok, phase, unit } – phase = היסט בשניות (בתוך unit = אורך הפעולה שהוקשה) שממנו מתחילה הפעמה,
// או { ok:false, reason: 'few' | 'tempo' | 'loose' }
export function phaseFromTaps(tapTimes, bpm) {
  const taps = (tapTimes || []).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  if (taps.length < 4) return { ok: false, reason: 'few' };
  const gaps = [];
  for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const spb = 60 / bpm;
  const k = Math.round(median / spb);
  if (![1, 2, 4].includes(k) || Math.abs(median - k * spb) / (k * spb) > 0.12) {
    return { ok: false, reason: 'tempo', tapBpm: Math.round(60 / median) };
  }
  const unit = k * spb;
  // ממוצע מעגלי של זמני ההקשה בתוך unit (כך שהקשה "בסוף" ו"בהתחלה" לא מתבטלות)
  let sx = 0;
  let sy = 0;
  for (const t of taps) {
    const a = ((t % unit) / unit) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const R = Math.hypot(sx, sy) / taps.length;
  if (R < 0.6) return { ok: false, reason: 'loose' };
  const phase = (((Math.atan2(sy, sx) / (2 * Math.PI)) * unit) % unit + unit) % unit;
  return { ok: true, phase, unit, k, spread: R };
}

// מיקום (שניות) בתוך הלולאה, גם לזמן שלילי
export function wrap(t, len) {
  return ((t % len) + len) % len;
}

// ---- התאמת הביט לסט שיש למשתמש ----
const num = (id) => Number(id.replace(/\D/g, '')) || 1;
const ofType = (pieces, re) => pieces.filter((id) => re.test(id)).sort((a, b) => num(a) - num(b));
const nearest = (list, n) => list.slice().sort((a, b) => Math.abs(num(a) - n) - Math.abs(num(b) - n))[0] || null;

// לאן ממפים חלק שאין בסט. null אם אין שום חלופה
export function fitPiece(id, available) {
  if (available.includes(id)) return id;
  const toms = ofType(available, /^tom\d$/);
  const floors = ofType(available, /^floor\d$/);
  const crashes = ofType(available, /^crash\d$/);
  const pick = (...opts) => opts.find((o) => o && available.includes(o)) || null;
  if (/^tom\d$/.test(id)) return nearest(toms, num(id)) || floors[0] || pick('snare');
  if (/^floor\d$/.test(id)) return nearest(floors, num(id)) || toms[toms.length - 1] || pick('snare');
  if (/^crash\d$/.test(id)) return nearest(crashes, num(id)) || pick('china', 'splash', 'ride', 'hihatOpen');
  if (id === 'china' || id === 'splash') return crashes[0] || pick('ride', 'hihatOpen');
  if (id === 'ride') return pick('hihat', 'crash1');
  if (id === 'hihatOpen') return pick('hihat', 'ride');
  if (id === 'hihat') return pick('ride', 'hihatOpen');
  if (id === 'kick2') return pick('kick');
  if (id === 'cowbell') return pick('ride', 'hihat');
  return null;
}

// מתאים סעיף לחלקי סט נתונים: { section, notes } – notes = הודעות קצרות בעברית על חלקים שהוחלפו
export function fitSection(section, available) {
  const hits = {};
  const notes = [];
  for (const [piece, idxs] of Object.entries(section.hits)) {
    const to = fitPiece(piece, available);
    if (!to) continue;
    if (to !== piece) {
      const msg = `אין ${PIECES[piece]?.label || piece} בסט – מוצג על ${PIECES[to]?.label || to}`;
      if (!notes.includes(msg)) notes.push(msg);
    }
    hits[to] = [...new Set([...(hits[to] || []), ...idxs])].sort((a, b) => a - b);
  }
  return { section: { ...section, hits }, notes };
}

// סדר השורות בציר הזמן: מלמעלה (מצילות) למטה (בס), כמו בתווים לתופים
const ROW_ORDER = ['crash2', 'crash1', 'china', 'splash', 'ride', 'cowbell', 'hihatOpen', 'hihat', 'tom4', 'tom3', 'tom2', 'tom1', 'snare', 'floor1', 'floor2', 'kick2', 'kick'];
export function rowsFor(section) {
  const used = Object.keys(section.hits).filter((p) => section.hits[p].length);
  return ROW_ORDER.filter((p) => used.includes(p));
}

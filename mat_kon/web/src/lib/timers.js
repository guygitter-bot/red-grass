// זמנים בתוך שלבי ההכנה ("אופים 30 דקות", "שעה וחצי", "45-50 דקות") - לטיימרים במצב בישול.

const WORD_HOURS = [
  [/שעתיים וחצי/, 150],
  [/שעתיים/, 120],
  [/שעה וחצי/, 90],
  [/שעה ורבע/, 75],
  [/(?<![\d\s]\s?)שעה(?!\s*\d)/, 60],
  [/חצי שעה/, 30],
  [/רבע שעה/, 15],
];

const UNIT = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(דקות|דקה|דק['׳]|שעות|שעה|שניות|minutes?|mins?|hours?|hrs?|seconds?|secs?)/gi;

// מחזיר רשימת זמנים בשניות עם התווית כפי שנכתבה, בלי כפילויות
export function findDurations(text) {
  const t = String(text || '');
  const out = [];
  const add = (seconds, label) => {
    if (seconds > 0 && seconds <= 24 * 3600 && !out.some((d) => d.seconds === seconds)) out.push({ seconds, label });
  };
  for (const m of t.matchAll(UNIT)) {
    const unit = m[3].toLowerCase();
    // טווח (45-50 דקות): לוקחים את המקסימום, בטוח יותר לבדוק לפניו
    const n = Number((m[2] || m[1]).replace(',', '.'));
    const mult = /^(שעות|שעה|hours?|hrs?)$/.test(unit) ? 3600 : /^(שניות|seconds?|secs?)$/.test(unit) ? 1 : 60;
    add(Math.round(n * mult), m[0].trim());
  }
  let rest = t.replace(UNIT, ' ');
  for (const [re, minutes] of WORD_HOURS) {
    const m = rest.match(re);
    if (m) {
      add(minutes * 60, m[0]);
      rest = rest.replace(re, ' ');
    }
  }
  return out;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

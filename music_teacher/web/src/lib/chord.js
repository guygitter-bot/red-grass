// אקורדים: מפרט נתונים (בלי תלת־ממד) + בדיקת תקינות + חישוב מיקום הסימונים על הצוואר.
// מפרט: { name, fingers: [{ finger: 1..4, string: 1..6, fret: 1..n, label? }], open: [מיתרים פתוחים], muted: [מיתרים שלא מנגנים] }
// כל מיתר חייב להופיע בדיוק פעם אחת: לחוץ, פתוח או מושתק. אקורד חדש = מפרט חדש, בלי קוד חדש.

export const STRINGS = 6;
// צבע קבוע לכל אצבע: אותו צבע בדיאגרמה, במקרא, על הצוואר ובטבעת על קצה האצבע (לבן על כולם נקרא היטב, גם בלילה)
export const FINGER_COLORS = { 1: '#2563eb', 2: '#15803d', 3: '#c2410c', 4: '#7e22ce' };
export const FINGER_NAMES_HE = { 1: 'מורה', 2: 'אמה', 3: 'קמיצה', 4: 'זרת' };
// כמה מהמרווח שבין שני שריגים האצבע עומדת מאחורי חוט השריג (מהצד של האום). האמה קצת רחוקה יותר מהחוט והקמיצה קרובה יותר,
// כך שבשתי אצבעות על אותו שריג (למשל Am, E) הקצוות לא נוגעים זה בזה
export const PRESS_BEHIND = 0.3;
export const PRESS_BEHIND_BY_FINGER = { 1: 0.26, 2: 0.46, 3: 0.2, 4: 0.26 };

// מיקום (x לאורך הצוואר) שבו האצבע לוחצת בשריג fret: ממש מאחורי חוט השריג. fretX(n) = מרחק חוט n מהאום
export function pressX(fretX, fret, finger) {
  if (fret <= 0) return 0.2;
  const k = PRESS_BEHIND_BY_FINGER[finger] ?? PRESS_BEHIND;
  return fretX(fret) - k * (fretX(fret) - fretX(fret - 1));
}

// בדיקת תקינות. מחזיר רשימת שגיאות (ריקה = תקין)
export function validateChord(spec, { maxFret = 12 } = {}) {
  const errs = [];
  if (!spec || typeof spec !== 'object') return ['אין מפרט אקורד'];
  const fingers = Array.isArray(spec.fingers) ? spec.fingers : [];
  const open = Array.isArray(spec.open) ? spec.open : [];
  const muted = Array.isArray(spec.muted) ? spec.muted : [];
  const isStr = (s) => Number.isInteger(s) && s >= 1 && s <= STRINGS;
  const usedFingers = new Set();
  const usedStrings = new Map(); // מיתר -> סוג
  const mark = (s, kind) => {
    if (!isStr(s)) {
      errs.push(`מיתר לא תקין: ${s}`);
      return;
    }
    if (usedStrings.has(s)) errs.push(`מיתר ${s} מופיע פעמיים (${usedStrings.get(s)} ו-${kind})`);
    else usedStrings.set(s, kind);
  };
  fingers.forEach((f) => {
    if (!Number.isInteger(f.finger) || f.finger < 1 || f.finger > 4) errs.push(`אצבע לא תקינה: ${f.finger}`);
    else if (usedFingers.has(f.finger)) errs.push(`אצבע ${f.finger} מופיעה פעמיים`);
    else usedFingers.add(f.finger);
    if (!Number.isInteger(f.fret) || f.fret < 1 || f.fret > maxFret) errs.push(`שריג לא תקין לאצבע ${f.finger}: ${f.fret}`);
    mark(f.string, 'לחוץ');
  });
  open.forEach((s) => mark(s, 'פתוח'));
  muted.forEach((s) => mark(s, 'מושתק'));
  for (let s = 1; s <= STRINGS; s++) if (!usedStrings.has(s)) errs.push(`מיתר ${s} לא מוגדר (לחוץ, פתוח או מושתק)`);
  return errs;
}

// הסימונים על הצוואר, במערכת הצירים של הגיטרה (x לאורך הצוואר מהאום, y מעל הלוח, z לרוחב: מיתר 6 חיובי).
// geom = { fretX(n), zS(i, x), ys(x) }. fingers: עיגול על המיתר, ממש מאחורי השריג. open/muted: O/X מעל האום.
export function chordMarkers(spec, geom, { lift = 0.07, nutLift = 0.62 } = {}) {
  const fingers = ((spec && spec.fingers) || [])
    .slice()
    .sort((a, b) => a.finger - b.finger)
    .map((f) => {
      const x = pressX(geom.fretX, f.fret, f.finger);
      return { kind: 'finger', finger: f.finger, string: f.string, fret: f.fret, color: FINGER_COLORS[f.finger], x, y: geom.ys(x) + lift, z: geom.zS(f.string, x) };
    });
  const nut = (list, kind) => (list || []).map((s) => ({ kind, string: s, x: 0, y: geom.ys(0) + nutLift, z: geom.zS(s, 0) }));
  return { fingers, open: nut(spec && spec.open, 'open'), muted: nut(spec && spec.muted, 'muted') };
}

// סדר הנחת האצבעות באנימציה: לפי מספר האצבע (1, 2, 3...)
export function pressOrder(spec) {
  return ((spec && spec.fingers) || []).map((f) => f.finger).sort((a, b) => a - b);
}

// אילו אצבעות כבר למטה אחרי elapsed שניות (step = שניות לכל אצבע; reduced = הכול מיד)
export function fingersDownAt(spec, elapsed, { step = 0.6, delay = 0.5, reduced = false } = {}) {
  const order = pressOrder(spec);
  if (reduced) return order;
  if (elapsed < delay) return [];
  const n = Math.max(0, Math.min(order.length, Math.floor((elapsed - delay) / step) + 1));
  return order.slice(0, n);
}

// מפרט נקי למורה: fingers = האצבעות שלמטה עכשיו, layout = כל האקורד (כדי שהיד תתמקם נכון גם כשאצבעות עוד באוויר)
export function handSpec(spec, down) {
  const set = down ? new Set(down) : null;
  const all = ((spec && spec.fingers) || []).map(({ finger, string, fret }) => ({ finger, string, fret }));
  return { fingers: set ? all.filter((f) => set.has(f.finger)) : all, layout: all };
}

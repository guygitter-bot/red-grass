// איכות הבמה התלת־ממדית: בחירת רמה לפי מהירות, וזיהוי "מסך שחור" – פונקציות טהורות (נבדקות ב-quality.test.js).

// סף: ממוצע פריימים איטי מזה (בקרוב 40 לשנייה) במשך שתי בדיקות רצופות – יורדים רמה
export const SLOW_FPS = 42;
export const SLOW_CHECKS = 2;

// state = { level, slow }; מחזיר מצב חדש ו-changed אם צריך לרדת רמה. levels = מספר הרמות. locked = איכות נעולה (?q=high)
export function nextQuality(state, avgFps, levels, locked) {
  const { level, slow } = state;
  if (locked || avgFps >= SLOW_FPS || level >= levels - 1) return { level, slow: 0, changed: false };
  if (slow + 1 >= SLOW_CHECKS) return { level: level + 1, slow: 0, changed: true };
  return { level, slow: slow + 1, changed: false };
}

// דגימות = מערך של [r,g,b,a] מנקודות בקנבס. הרקע הכי כהה של הבמה הוא כמעט שחור אך לא אפס (כחול ≥ 3), ולכן
// "שחור מוחלט" בכל הנקודות = הקנבס ריק (איבדנו את ההקשר, או שהציור לא מגיע למסך)
export function isBlank(samples) {
  if (!samples || !samples.length) return false;
  return samples.every((p) => p[0] + p[1] + p[2] <= 1);
}

// כמה בדיקות ריקות ברצף עד שמתאוששים (בדיקה כל ~1 שנייה)
export const BLANK_LIMIT = 2;

// מה עושים כשהבמה בצרות: פעם ראשונה – בונים אותה מחדש באיכות הנמוכה; פעם שנייה – חוזרים לבמה השטוחה
export function recoveryStep(attempt) {
  return attempt < 1 ? 'safe' : 'flat';
}

// טקסט תג ה-BPM (תמיד עם מספר; בלי נתון – מקף)
export function bpmLabel(bpm) {
  const n = Math.round(Number(bpm));
  return Number.isFinite(n) && n > 0 ? `${n} BPM` : '– BPM';
}

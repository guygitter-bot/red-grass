// איכות ציור מתכווננת: מדרגות מהכבד לקל, ומשגיח שמוריד מדרגה כשהמכשיר לא עומד בקצב.
// פונקציות טהורות (בלי תלת־ממד) כדי שאפשר יהיה לבדוק אותן.

// dpr = תקרת צפיפות פיקסלים, shadows = גודל מפת צל (0 = בלי צל אמיתי), ao = סגירת סביבה (GTAO), dof = טשטוש עומק שדה בתקריב
export const TIERS = [
  { name: 'min', dpr: 1, shadows: 0, ao: false, dof: false },
  { name: 'low', dpr: 1.25, shadows: 0, ao: false, dof: false },
  { name: 'mid', dpr: 1.5, shadows: 1024, ao: false, dof: false },
  { name: 'high', dpr: 1.75, shadows: 2048, ao: true, dof: true },
];
export const TOP = TIERS.length - 1;

// מדרגת התחלה: טלפון או מכשיר חלש (מעט ליבות / זיכרון) מתחילים באמצע, מחשב מלא בראש
export function startTier({ coarse = false, cores = 8, memory = 8 } = {}) {
  if (coarse || cores <= 4 || memory <= 4) return 2;
  return TOP;
}

// מקבלים מספר מדרגה מוכרח (בדיקות / ‎?q=‎): מחזיר null אם אין
export function forcedTier(v) {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(TOP, n)) : null;
}

// משגיח: אחרי warm פריימים ראשונים (טעינת דגמים, מעבר מצלמה) מודדים חלון של frames פריימים.
// אם הממוצע מעל limitMs – מוריד מדרגה (onDrop) ומתחיל חלון חדש. פריים ארוך מאוד (לשונית ברקע) מבטל את החלון.
export function createGovernor({ limitMs = 25, frames = 60, warm = 90, hiddenMs = 400, onDrop } = {}) {
  let skip = warm;
  let n = 0;
  let sum = 0;
  return {
    push(ms) {
      if (ms > hiddenMs) {
        n = 0;
        sum = 0;
        return false;
      }
      if (skip > 0) {
        skip--;
        return false;
      }
      n++;
      sum += ms;
      if (n < frames) return false;
      const avg = sum / n;
      n = 0;
      sum = 0;
      if (avg > limitMs) {
        skip = warm; // אחרי הורדה נותנים למכשיר להתייצב לפני המדידה הבאה
        if (onDrop) onDrop(avg);
        return true;
      }
      return false;
    },
    reset() {
      skip = warm;
      n = 0;
      sum = 0;
    },
  };
}

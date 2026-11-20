// עוצמת מכה (0..1) ממה שהמכשיר נותן: לחץ המגע (PointerEvent.pressure), גודל כף האצבע (width/height), ואם אין – האזור + קצת אנושיות.
// הרבה מסכים מחזירים ערך קבוע (0.5 / 0 / 1) – לכן "לחץ בעל משמעות" נבדק גם לפי שינוי בין מכות. מקלדת = בינוני־חזק.
// פונקציות טהורות (הרנדום מוזרק) – נבדקות ב-velocity.test.js.
import { zoneVelBias } from './zones';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const MIN_VEL = 0.22;

// איתות לחץ: רק למגע / עט, ורק ערך שאינו ברירת המחדל (0, 0.5)
export function pressureSignal(info) {
  if (!info || info.pointerType === 'mouse') return null;
  const p = info.pressure;
  if (!(typeof p === 'number') || !(p > 0) || p === 0.5) return null;
  return clamp(p, 0, 1);
}

// איתות גודל מגע: אצבע קלה ≈ 12px, מכה חזקה (כף שטוחה) ≈ 48px. עכבר = 1 ולכן לא נחשב
export function contactSignal(info) {
  if (!info || info.pointerType === 'mouse') return null;
  const s = Math.max(Number(info.width) || 0, Number(info.height) || 0);
  if (!(s > 3)) return null;
  return clamp((s - 12) / 36, 0, 1);
}

const varies = (arr) => arr.length < 3 || Math.max(...arr) - Math.min(...arr) > 0.03;
const push = (arr, v) => {
  arr.push(v);
  if (arr.length > 5) arr.shift();
};

// מעריך עם זיכרון קצר: אם האיתות לא משתנה (מסך עם ערך קבוע) – מתעלמים ממנו
export function createVelocity(rand = Math.random) {
  const hp = [];
  const hc = [];
  return {
    // info = { pressure, width, height, pointerType, key }, type = סוג החלק, zone = שם האזור
    estimate(info, type, zone) {
      if (info && info.key) return clamp(0.74 + rand() * 0.16, MIN_VEL, 1); // מקלדת
      const p = pressureSignal(info);
      const c = contactSignal(info);
      if (p !== null) push(hp, p);
      if (c !== null) push(hc, c);
      const useP = p !== null && varies(hp);
      const useC = !useP && c !== null && varies(hc);
      const bias = zoneVelBias(type, zone);
      let v;
      if (useP || useC) {
        const sig = useP ? p : c;
        v = 0.3 + 0.7 * sig + (rand() - 0.5) * 0.06;
      } else {
        v = 0.72 + (rand() - 0.5) * 0.2; // אין איתות – אנושיות קלה סביב בינוני־חזק
      }
      return clamp(v + bias, MIN_VEL, 1);
    },
  };
}

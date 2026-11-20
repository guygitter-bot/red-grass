// רטט קצר בכל מכה (אנדרואיד). בס חזק יותר, ועוצמת המכה מוסיפה קצת. נשמר ב-localStorage דרך storage.js (ברירת מחדל: דולק)
import { loadHaptics, saveHaptics } from './storage';

export function hapticsSupported() {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  } catch {
    return false;
  }
}

// כמה מילישניות: בס 12–15, שאר התופים 9–12, מצילות 8–10
export function hapticMs(type, vel = 0.75) {
  const v = Math.min(1, Math.max(0, vel));
  if (type === 'kick') return Math.round(12 + 3 * v);
  if (type === 'snare' || type === 'tom' || type === 'floor') return Math.round(9 + 3 * v);
  return Math.round(8 + 2 * v);
}

let on = loadHaptics();
export function hapticsOn() {
  return on;
}
export function setHaptics(v) {
  on = !!v;
  saveHaptics(on);
}
export function buzz(type, vel) {
  if (!on || !hapticsSupported()) return;
  try {
    navigator.vibrate(hapticMs(type, vel));
  } catch {
    // לא נתמך / חסום
  }
}

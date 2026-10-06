// נעילה: מבקשים סיסמה רק אחרי יותר מ-10 דקות בלי שימוש (גם אם האפליקציה נסגרה לגמרי ונפתחה שוב).
// הזמן של השימוש האחרון נשמר במכשיר (לכל מרחב בנפרד); "נעילה עכשיו" מוחקת אותו.
// עם רשת – הסיסמה נבדקת בשרת. בלי רשת – מול "טביעה" של הסיסמה שנשמרה במכשיר בכניסה המוצלחת האחרונה
// (PBKDF2 עם מלח; הסיסמה עצמה לא נשמרת).
import { NetworkError, login } from './sync';
import { scoped } from './space';

const VERIFIER_KEY = scoped('seder_verifier');
const ACTIVE_KEY = scoped('seder_active');
const ITERATIONS = 150000;
// חזרה לאפליקציה (או פתיחה מחדש) אחרי יותר מזה בלי שימוש -> נעילה מחדש
export const RELOCK_AFTER_MS = 10 * 60 * 1000;

// האפליקציה פתוחה ובשימוש עכשיו (נקרא בכניסה, כשיוצאים ממנה, ופעם בכמה שניות בזמן השימוש)
export function markActive(now = Date.now()) {
  try {
    localStorage.setItem(ACTIVE_KEY, String(now));
  } catch {
    // אחסון חסום – תמיד יבקש סיסמה
  }
}

export function clearActive() {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // אחסון חסום
  }
}

// האם אפשר להיכנס בלי סיסמה: היה שימוש לפני פחות מ-10 דקות (שעון שזז אחורה – נועלים)
export function recentlyActive(now = Date.now(), last = readActive()) {
  return last != null && last <= now && now - last <= RELOCK_AFTER_MS;
}

function readActive() {
  try {
    const n = Number(localStorage.getItem(ACTIVE_KEY));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return toB64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256));
}

export async function saveVerifier(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  try {
    localStorage.setItem(VERIFIER_KEY, JSON.stringify({ salt: toB64(salt), hash }));
  } catch {
    // אחסון חסום – בלי פתיחה בלי רשת
  }
}

export function hasVerifier() {
  try {
    return !!localStorage.getItem(VERIFIER_KEY);
  } catch {
    return false;
  }
}

export async function checkLocal(password) {
  try {
    const { salt, hash } = JSON.parse(localStorage.getItem(VERIFIER_KEY));
    return (await derive(password, fromB64(salt))) === hash;
  } catch {
    return false;
  }
}

// פתיחה: קודם בשרת; רק כשאין רשת/שרת – בדיקה במכשיר. סיסמה שגויה בשרת לא עוברת לבדיקה מקומית
// setup – פתיחה ראשונה של קישור לאדם נוסף: הסיסמה נבחרת עכשיו
export async function unlock(password, { setup = false } = {}) {
  try {
    const res = await login(password, { setup });
    if (res.needsSetup) return { ok: false, needsSetup: true, name: res.name };
    await saveVerifier(password);
    return { ok: true, online: true };
  } catch (e) {
    if (!(e instanceof NetworkError)) return { ok: false, error: e.message || 'סיסמה שגויה' };
    if (!hasVerifier()) return { ok: false, error: 'צריך אינטרנט בכניסה הראשונה במכשיר הזה' };
    if (await checkLocal(password)) return { ok: true, online: false };
    return { ok: false, error: 'סיסמה שגויה' };
  }
}

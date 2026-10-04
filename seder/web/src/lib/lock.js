// נעילה: בכל פתיחה של האפליקציה מבקשים סיסמה.
// עם רשת – הסיסמה נבדקת בשרת. בלי רשת – מול "טביעה" של הסיסמה שנשמרה במכשיר בכניסה המוצלחת האחרונה
// (PBKDF2 עם מלח; הסיסמה עצמה לא נשמרת).
import { NetworkError, login } from './sync';

const VERIFIER_KEY = 'seder_verifier';
const ITERATIONS = 150000;
// חזרה לאפליקציה אחרי יותר מזה ברקע -> נעילה מחדש
export const RELOCK_AFTER_MS = 5 * 60 * 1000;

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
export async function unlock(password) {
  try {
    await login(password);
    await saveVerifier(password);
    return { ok: true, online: true };
  } catch (e) {
    if (!(e instanceof NetworkError)) return { ok: false, error: e.message || 'סיסמה שגויה' };
    if (!hasVerifier()) return { ok: false, error: 'צריך אינטרנט בכניסה הראשונה במכשיר הזה' };
    if (await checkLocal(password)) return { ok: true, online: false };
    return { ok: false, error: 'סיסמה שגויה' };
  }
}

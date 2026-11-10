// כלים משותפים לשרת: מגבלות גודל, כותרות CORS, פנייה פנימית ל-Durable Objects, וזיהוי (גוגל, סיסמה, טוקן).
import { deps } from '../deps.js';

export const MAX_EDIT_BYTES = 200 * 1024;
export const MAX_SMALL_BYTES = 4000;
export const MAX_TEXT_BYTES = 30000;
export const MAX_PHOTO_BYTES = 9 * 1024 * 1024; // עד 4 תמונות מוקטנות
export const MAX_IMAGE_FIELD = 160 * 1024; // תמונת מתכון שנשמרת בספר (מוקטנת בדפדפן)
export const MAX_RESTORE_BYTES = 8 * 1024 * 1024; // מנה אחת מקובץ גיבוי (האפליקציה שולחת במנות)
export const MAX_CUSTOM_CATEGORIES = 30;

export function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  // אפליקציית הניהול (mat_kon/admin) – Cloudflare Pages נפרד; כל הנתונים בה מוגנים בכניסת בעלים.
  // רק הפרויקט שלנו והתצוגות המקדימות שלו (<hash>.mat-kon-admin.pages.dev) – לא כל פרויקט ששמו מתחיל ב-mat-kon-admin-
  if (allowed.includes(origin) || /^https:\/\/([a-z0-9-]+\.)?mat-kon-admin\.pages\.dev$/.test(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// הרשמה בלי קישור הזמנה (OPEN_SIGNUP): "app" – רק מהאפליקציה לאנדרואיד (המקור שלה https://localhost),
// "all" – מכל מקום, אחרת סגור. מי שנרשם כך מקבל את המסלול החינמי (FREE_RECIPES)
export const APP_ORIGIN = 'https://localhost';
export function openSignupAllowed(request, env) {
  const mode = String(env.OPEN_SIGNUP || '');
  return mode === 'all' || (mode === 'app' && request.headers.get('origin') === APP_ORIGIN);
}

export const internal = (stub, method, path, body) =>
  stub.fetch(new Request(`https://do${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));


// אימות טוקן הכניסה של גוגל (Google Identity Services): חתום ע"י גוגל, לאפליקציה שלנו, עם אימייל מאומת
export async function verifyGoogle(credential, clientId) {
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential)) return null;
  try {
    const res = await deps.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) return null;
    const t = await res.json();
    const valid = t.aud === clientId
      && ['accounts.google.com', 'https://accounts.google.com'].includes(t.iss)
      && String(t.email_verified) === 'true'
      && Number(t.exp) * 1000 > Date.now()
      && t.sub && t.email;
    return valid ? { sub: String(t.sub), email: String(t.email), name: String(t.name || t.given_name || '') } : null;
  } catch {
    return null;
  }
}

// השוואת סיסמה בלי לחשוף את האורך או את התווים לפי זמן התגובה
export async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(async (t) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function bearer(request) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S{10,200})$/i);
  return m ? m[1] : '';
}

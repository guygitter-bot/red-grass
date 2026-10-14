// אפליקציה נפרדת לאדם נוסף ("מרחב"): בעלת האפליקציה יוצרת קישור (https://seder-tasks.pages.dev/?u=<מזהה>),
// ומי שפותח אותו בוחר סיסמה ומקבל אפליקציה ריקה משלו – משימות, תחומים, קבצים ותזכורות נפרדים לגמרי.
// כל מרחב הוא כספת (Durable Object) משלו בשם space:<מזהה>, עם הסיסמה שלו:
//   space -> { id, name, createdAt, salt, hash, session }   (hash/session ריקים עד שבוחרים סיסמה)
// החיבור של מכשיר במרחב: "<מזהה>.<session>". איפוס סיסמה מוחק את session – כל המכשירים מתנתקים.
// הרשימה של המרחבים (לניהול) נשמרת אצל בעלת האפליקציה: registry -> { <id>: { name, createdAt } }
export const MAX_SPACES = 30;
const SPACE_RE = /^[A-Za-z0-9_-]{16}$/;
// PBKDF2 ב-Cloudflare Workers מוגבל ל-100,000 סבבים
const ITERATIONS = 100000;

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const validSpaceId = (id) => typeof id === 'string' && SPACE_RE.test(id);
export const newSpaceId = () => b64url(crypto.getRandomValues(new Uint8Array(12)));
export const newSecret = () => b64url(crypto.getRandomValues(new Uint8Array(24)));

export function cleanName(name) {
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  return clean.length >= 1 && clean.length <= 40 ? clean : null;
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256);
  return b64url(new Uint8Array(bits));
}

// החיבור מהכותרת authorization: מזהה המרחב הוא מה שלפני הנקודה (לבעלת האפליקציה אין נקודה)
export function spaceOfToken(token) {
  const i = typeof token === 'string' ? token.indexOf('.') : -1;
  return i > 0 ? token.slice(0, i) : '';
}

// כניסה: סיסמה אחת לבעלים (נקבעת בכניסה הראשונה), ואסימון לכל מכשיר שנכנס.
// נשמר במפתח auth: { salt, hash, tries: [זמני ניסיונות שגויים], tokens: [sha256 של האסימון] }
import { fail } from './http.js';

const ITERATIONS = 100_000;
// הגבלת ניסיונות: 5 ניסיונות שגויים בכל 10 דקות
export const MAX_TRIES = 5;
export const TRIES_WINDOW_MS = 10 * 60 * 1000;
const MAX_TOKENS = 20;
export const MIN_PASSWORD = 6;

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256));
}

// השוואה בזמן קבוע
function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function issue(storage, auth) {
  const token = randomHex();
  auth.tokens = [...(auth.tokens || []), await sha(token)].slice(-MAX_TOKENS);
  await storage.put('auth', auth);
  return token;
}

export const isReady = async (storage) => Boolean(await storage.get('auth'));

// כניסה: בפעם הראשונה הסיסמה נקבעת, אחר כך נבדקת
export async function login(storage, password, now = Date.now()) {
  password = String(password || '');
  const auth = await storage.get('auth');
  if (!auth) {
    if (password.length < MIN_PASSWORD) throw fail(400, `סיסמה של ${MIN_PASSWORD} תווים לפחות`);
    const salt = randomHex(16);
    return issue(storage, { salt, hash: await hashPassword(password, salt), tries: [], tokens: [] });
  }
  const tries = (auth.tries || []).filter((t) => now - t < TRIES_WINDOW_MS);
  if (tries.length >= MAX_TRIES) throw fail(429, 'יותר מדי ניסיונות. אפשר לנסות שוב בעוד כמה דקות');
  if (!safeEqual(await hashPassword(password, auth.salt), auth.hash)) {
    auth.tries = [...tries, now];
    await storage.put('auth', auth);
    throw fail(401, 'הסיסמה לא נכונה');
  }
  auth.tries = [];
  return issue(storage, auth);
}

const bearer = (headers) => (headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

// כל כתובת חוץ מהכניסה עוברת כאן
export async function requireSession(storage, headers) {
  const token = bearer(headers);
  const auth = await storage.get('auth');
  if (!token || !auth || !(auth.tokens || []).includes(await sha(token))) throw fail(401, 'צריך להיכנס מחדש');
}

export async function logout(storage, headers) {
  const auth = await storage.get('auth');
  if (!auth) return;
  const mine = await sha(bearer(headers));
  auth.tokens = (auth.tokens || []).filter((t) => t !== mine);
  await storage.put('auth', auth);
}

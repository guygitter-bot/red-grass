// כניסה לאפליקציה: סיסמה אחת (נקבעת בכניסה הראשונה), וסוד לכל מכשיר שנכנס.
// נשמר ב-Durable Object במפתח auth: { salt, hash, fails, lockUntil, tokens: [sha256 של הסוד] }
const ITERATIONS = 100_000;
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TOKENS = 20;
export const MIN_PASSWORD = 6;

export const fail = (status, error) => Object.assign(new Error(error), { status });
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const randomHex = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
export const sha = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256));
}

// השוואה בזמן קבוע
export function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// חתימה (HMAC) – לקישורים זמניים לקבצים
export async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))).slice(0, 40);
}

async function issue(storage, auth) {
  const token = randomHex();
  auth.tokens = [...(auth.tokens || []), await sha(token)].slice(-MAX_TOKENS);
  await storage.put('auth', auth);
  return token;
}

export const isReady = async (storage) => Boolean(await storage.get('auth'));

// פעם ראשונה בלבד: קביעת הסיסמה
export async function setup(storage, password) {
  if (await storage.get('auth')) throw fail(403, 'כבר נקבעה סיסמה');
  if (String(password || '').length < MIN_PASSWORD) throw fail(400, `סיסמה של ${MIN_PASSWORD} תווים לפחות`);
  const salt = randomHex(16);
  return issue(storage, { salt, hash: await hashPassword(String(password), salt), fails: 0, lockUntil: 0, tokens: [] });
}

async function check(storage, password) {
  const auth = await storage.get('auth');
  if (!auth) throw fail(403, 'עוד לא נקבעה סיסמה');
  if (auth.lockUntil > Date.now()) throw fail(429, 'יותר מדי ניסיונות. אפשר לנסות שוב בעוד רבע שעה');
  if (!safeEqual(await hashPassword(String(password || ''), auth.salt), auth.hash)) {
    auth.fails = (auth.fails || 0) + 1;
    if (auth.fails >= MAX_FAILS) {
      auth.fails = 0;
      auth.lockUntil = Date.now() + LOCK_MS;
    }
    await storage.put('auth', auth);
    throw fail(401, 'הסיסמה לא נכונה');
  }
  auth.fails = 0;
  return auth;
}

export async function login(storage, password) {
  return issue(storage, await check(storage, password));
}

// החלפת סיסמה מנתקת את כל שאר המכשירים
export async function changePassword(storage, password, newPassword) {
  if (String(newPassword || '').length < MIN_PASSWORD) throw fail(400, `סיסמה של ${MIN_PASSWORD} תווים לפחות`);
  const auth = await check(storage, password);
  auth.hash = await hashPassword(String(newPassword), auth.salt);
  auth.tokens = [];
  return issue(storage, auth);
}

const bearer = (headers) => (headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

export async function authed(storage, headers) {
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

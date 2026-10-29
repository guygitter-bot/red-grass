// Durable Object אחד לכל התקציב: סיסמה, מכשירים מחוברים והרשומות (הוצאות, הכנסות, שינויים לחודש, הגדרות).
// סנכרון: כל רשומה נושאת updatedAt (זמן עריכה במכשיר); העריכה המאוחרת גוברת. מחיקה = deleted: true (נשמרת,
// כדי שתעבור לכל המכשירים). כל שינוי שהתקבל מקבל מספר גרסה (rev) עולה, והמכשיר מבקש "מה השתנה מאז".

const SESSION_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 20;
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
const MAX_RECORDS = 8000;
const MAX_RECORD_CHARS = 4000;
// PBKDF2 ב-Cloudflare Workers מוגבל ל-100,000 סבבים
const ITERATIONS = 100000;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fail = (status, error) => Object.assign(new Error(error), { status });

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSecret(bytes = 24) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// רשומה תקינה? מזהה קצר, זמן עריכה מספרי, לא ענקית. התוכן עצמו נשמר כמו שהוא (האפליקציה יודעת לקרוא אותו)
export function cleanRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (typeof r.id !== 'string' || !r.id || r.id.length > 120) return null;
  const updatedAt = Number(r.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  const { rev, ...rest } = r;
  const out = { ...rest, updatedAt };
  if (JSON.stringify(out).length > MAX_RECORD_CHARS) return null;
  return out;
}

export class Budget {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.now = env.NOW || (() => Date.now());
    this.d = null;
  }

  async load() {
    if (this.d) return this.d;
    const got = await this.storage.get(['meta', 'sessions', 'rev']);
    const recs = new Map();
    for (const [k, v] of await this.storage.list({ prefix: 'r:' })) recs.set(k.slice(2), v);
    this.d = { meta: got.get('meta') || null, sessions: got.get('sessions') || {}, rev: got.get('rev') || 0, recs };
    return this.d;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname.slice(1);
    let body = {};
    try {
      body = await request.json();
    } catch {
      // גוף ריק
    }
    try {
      await this.load();
      if (path === 'status') return json(200, { ready: !!this.d.meta });
      if (path === 'setup') return json(200, await this.setup(body));
      if (path === 'login') return json(200, await this.login(body));
      const session = await this.auth(request);
      if (path === 'sync') return json(200, await this.sync(body));
      if (path === 'password') return json(200, await this.password(body));
      if (path === 'logout') {
        delete this.d.sessions[session];
        await this.storage.put('sessions', this.d.sessions);
        return json(200, { ok: true });
      }
      return json(404, { error: 'לא נמצא' });
    } catch (err) {
      if (!err.status) throw err;
      return json(err.status, { error: err.message });
    }
  }

  async setup({ password }) {
    if (this.d.meta) throw fail(409, 'כבר נקבעה סיסמה');
    if (String(password || '').length < 6) throw fail(400, 'הסיסמה צריכה להיות לפחות 6 תווים');
    const salt = newSecret(16);
    this.d.meta = { salt, hash: await hashPassword(String(password), salt), fails: 0, lockUntil: 0 };
    await this.storage.put('meta', this.d.meta);
    return { token: await this.newSession() };
  }

  async login({ password }) {
    const meta = this.d.meta;
    if (!meta) throw fail(409, 'עדיין לא נקבעה סיסמה');
    if (meta.lockUntil > this.now()) throw fail(429, 'יותר מדי ניסיונות. אפשר לנסות שוב בעוד רבע שעה');
    const ok = safeEqual(await hashPassword(String(password || ''), meta.salt), meta.hash);
    if (!ok) {
      meta.fails = (meta.fails || 0) + 1;
      if (meta.fails >= MAX_FAILS) {
        meta.fails = 0;
        meta.lockUntil = this.now() + LOCK_MS;
      }
      await this.storage.put('meta', meta);
      throw fail(401, 'הסיסמה לא נכונה');
    }
    if (meta.fails) {
      meta.fails = 0;
      await this.storage.put('meta', meta);
    }
    return { token: await this.newSession() };
  }

  async newSession() {
    const token = newSecret();
    const now = this.now();
    const sessions = Object.fromEntries(Object.entries(this.d.sessions).filter(([, exp]) => exp > now).sort((a, b) => b[1] - a[1]).slice(0, MAX_SESSIONS - 1));
    sessions[await sha256(token)] = now + SESSION_MS;
    this.d.sessions = sessions;
    await this.storage.put('sessions', sessions);
    return token;
  }

  // מחזיר את המזהה של החיבור (טביעה של הסוד), או זורק 401
  async auth(request) {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token || !this.d.meta) throw fail(401, 'צריך להיכנס מחדש');
    const key = await sha256(token);
    const exp = this.d.sessions[key];
    const now = this.now();
    if (!exp || exp < now) throw fail(401, 'צריך להיכנס מחדש');
    // חיבור שבשימוש לא פג (מתחדש פעם ביום)
    if (exp - now < SESSION_MS - 24 * 60 * 60 * 1000) {
      this.d.sessions[key] = now + SESSION_MS;
      await this.storage.put('sessions', this.d.sessions);
    }
    return key;
  }

  async password({ password, newPassword }) {
    const meta = this.d.meta;
    if (!safeEqual(await hashPassword(String(password || ''), meta.salt), meta.hash)) throw fail(401, 'הסיסמה הנוכחית לא נכונה');
    if (String(newPassword || '').length < 6) throw fail(400, 'הסיסמה החדשה צריכה להיות לפחות 6 תווים');
    meta.salt = newSecret(16);
    meta.hash = await hashPassword(String(newPassword), meta.salt);
    await this.storage.put('meta', meta);
    this.d.sessions = {};
    return { token: await this.newSession() };
  }

  async sync({ since, changes }) {
    const d = this.d;
    const writes = {};
    for (const raw of Array.isArray(changes) ? changes.slice(0, 2000) : []) {
      const rec = cleanRecord(raw);
      if (!rec) continue;
      const old = d.recs.get(rec.id);
      if (old && old.updatedAt >= rec.updatedAt) continue;
      if (!old && d.recs.size >= MAX_RECORDS) throw fail(413, 'יותר מדי רשומות');
      d.rev += 1;
      const saved = { ...rec, rev: d.rev };
      d.recs.set(rec.id, saved);
      writes[`r:${rec.id}`] = saved;
    }
    const keys = Object.keys(writes);
    // עד 128 מפתחות בכל כתיבה
    for (let i = 0; i < keys.length; i += 100) await this.storage.put(Object.fromEntries(keys.slice(i, i + 100).map((k) => [k, writes[k]])));
    if (keys.length) await this.storage.put('rev', d.rev);
    const from = Number(since) || 0;
    // המכשיר מכיר גרסה מאוחרת ממה שיש בשרת (לא אמור לקרות) – שולחים הכול מחדש
    const all = from > d.rev;
    return { rev: d.rev, changes: [...d.recs.values()].filter((r) => all || r.rev > from) };
  }
}

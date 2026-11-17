// Durable Object אחד לכל הסדרה: שמות השחקנים, המשחקים שנרשמו, וסיסמת המאסטר.
// כולם יכולים לראות (get). רק המאסטר (מי שקבע את הסיסמה) יכול לשנות – עם סוד שמתקבל אחרי סיסמה.
// כל שינוי הוא פעולה קטנה עם מספר המשחק, כך ששני מכשירים שלוחצים יחד לא רושמים משחק פעמיים.

export const TEAMS = ['LAL', 'SAS'];
export const MAX_GAMES = 7;
const MAX_NAME = 20;
const MAX_SESSIONS = 10;
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
// PBKDF2 ב-Cloudflare Workers מוגבל ל-100,000 סבבים
const ITERATIONS = 100000;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(s) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256));
}

function newSecret() {
  return hex(crypto.getRandomValues(new Uint8Array(24)));
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// ניקוד לא חובה: מספר שלם 0-250 או null
function cleanPoints(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 250 ? n : null;
}

export function cleanName(v) {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NAME);
}

export function cleanGame(g) {
  if (!g || !TEAMS.includes(g.winner)) return null;
  return { winner: g.winner, lal: cleanPoints(g.lal), sas: cleanPoints(g.sas), at: Number(g.at) || 0 };
}

export function wins(games) {
  const w = { LAL: 0, SAS: 0 };
  for (const g of games) w[g.winner]++;
  return w;
}

export function over(games) {
  const w = wins(games);
  return w.LAL >= 4 || w.SAS >= 4 || games.length >= MAX_GAMES;
}

export function emptySeries() {
  return { players: { LAL: '', SAS: '' }, games: [], rev: 0 };
}

export class Series {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.now = env.NOW || (() => Date.now());
    this.s = null;
    this.auth = null;
  }

  async load() {
    if (!this.s) this.s = (await this.storage.get('series')) || emptySeries();
    // auth = { salt, hash, fails, lockUntil, sessions: [sha256(סוד)] } – רק בשרת, לא נשלח לאפליקציה
    if (!this.auth) this.auth = (await this.storage.get('auth')) || null;
  }

  async save() {
    this.s.rev++;
    await this.storage.put('series', this.s);
  }

  // מה שהאפליקציה רואה: הסדרה + האם כבר נקבעה סיסמה + האם המכשיר הזה הוא המאסטר
  async view(token) {
    return { ...this.s, locked: !!this.auth, master: await this.isMaster(token) };
  }

  async isMaster(token) {
    if (!this.auth || !token) return false;
    const h = await sha256(token);
    return this.auth.sessions.some((s) => safeEqual(s, h));
  }

  async newSession() {
    const token = newSecret();
    this.auth.sessions = [...this.auth.sessions, await sha256(token)].slice(-MAX_SESSIONS);
    await this.storage.put('auth', this.auth);
    return token;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname.slice(1);
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    await this.load();

    if (path === 'get') return json(200, await this.view(token));

    // פעם ראשונה: מי שקובע סיסמה הוא המאסטר
    if (path === 'setup') {
      if (this.auth) return json(409, { error: 'כבר נקבעה סיסמה – צריך להיכנס איתה' });
      const password = String(body.password || '');
      if (password.length < 4) return json(400, { error: 'הסיסמה צריכה להיות לפחות 4 תווים' });
      const salt = newSecret();
      this.auth = { salt, hash: await hashPassword(password, salt), fails: 0, lockUntil: 0, sessions: [] };
      const t = await this.newSession();
      return json(200, { token: t, ...(await this.view(t)) });
    }

    if (path === 'login') {
      if (!this.auth) return json(409, { error: 'עדיין לא נקבעה סיסמה' });
      if (this.auth.lockUntil > this.now()) return json(429, { error: 'יותר מדי ניסיונות. אפשר לנסות שוב בעוד רבע שעה' });
      const ok = safeEqual(await hashPassword(String(body.password || ''), this.auth.salt), this.auth.hash);
      if (!ok) {
        this.auth.fails = (this.auth.fails || 0) + 1;
        if (this.auth.fails >= MAX_FAILS) {
          this.auth.fails = 0;
          this.auth.lockUntil = this.now() + LOCK_MS;
        }
        await this.storage.put('auth', this.auth);
        return json(401, { error: 'הסיסמה לא נכונה' });
      }
      this.auth.fails = 0;
      const t = await this.newSession();
      return json(200, { token: t, ...(await this.view(t)) });
    }

    // מכאן – רק המאסטר
    if (!(await this.isMaster(token))) return json(403, { error: 'רק המאסטר יכול לשנות תוצאות' });

    if (path === 'logout') {
      const h = await sha256(token);
      this.auth.sessions = this.auth.sessions.filter((s) => !safeEqual(s, h));
      await this.storage.put('auth', this.auth);
      return json(200, await this.view(''));
    }

    if (path === 'game') {
      // n = מספר המשחק שהמכשיר חושב שהוא הבא. אם כבר נרשם (מכשיר אחר הקדים) – לא רושמים שוב
      const g = cleanGame({ ...body, at: this.now() });
      if (g && Number(body.n) === this.s.games.length && !over(this.s.games)) {
        this.s.games.push(g);
        await this.save();
      }
      return json(200, await this.view(token));
    }

    if (path === 'undo') {
      // מוחקים רק אם המשחק האחרון הוא באמת המשחק שהמכשיר ראה
      if (this.s.games.length && Number(body.n) === this.s.games.length) {
        this.s.games.pop();
        await this.save();
      }
      return json(200, await this.view(token));
    }

    if (path === 'players') {
      const LAL = cleanName(body.LAL);
      const SAS = cleanName(body.SAS);
      if (!LAL || !SAS) return json(400, { error: 'צריך שם לכל שחקן' });
      this.s.players = { LAL, SAS };
      await this.save();
      return json(200, await this.view(token));
    }

    if (path === 'reset') {
      this.s.games = [];
      await this.save();
      return json(200, await this.view(token));
    }

    return json(404, { error: 'לא נמצא' });
  }
}

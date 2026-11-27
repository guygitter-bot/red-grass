// Durable Object אחד לכל האפליקציה: הסדרה הנוכחית, היסטוריית הסדרות שהסתיימו, וסיסמת המאסטר.
// כולם יכולים לראות (get). רק המאסטר (מי שקבע את הסיסמה) יכול לשנות – עם סוד שמתקבל אחרי סיסמה.
// כל שינוי הוא פעולה קטנה עם מספר המשחק, כך ששני מכשירים שלוחצים יחד לא רושמים משחק פעמיים.
//
// סדרה: { teams: [קבוצה עם יתרון ביתיות, קבוצה שנייה], era, players: {קוד: שם}, games: [{winner, pts: {קוד: נקודות}, at}], rev }
// היסטוריה: [{ teams, era, players, winner, winnerName, score: {קוד: ניצחונות} | null, endedAt }]

// הקבוצות שאפשר לבחור (השמות והצבעים באפליקציה: web/src/lib/series.js – לשנות בשניהם)
export const TEAM_CODES = ['LAL', 'SAS', 'SAC'];
export const MAX_GAMES = 7;
const MAX_NAME = 20;
const MAX_ERA = 20;
const MAX_HISTORY = 200;
const MAX_SESSIONS = 10;
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
// PBKDF2 ב-Cloudflare Workers מוגבל ל-100,000 סבבים
const ITERATIONS = 100000;
// מעבר חד-פעמי (ראו migrate)
const MIGRATION = 'kings-2026-11';
// מי ניצח בסדרה הקודמת (לפי המשתמש) – נרשם בהיסטוריה במעבר
export const PREVIOUS_WINNER = 'יובל';

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

function cleanEra(v) {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_ERA);
}

// שתי קבוצות שונות מהרשימה
export function validTeams(teams) {
  return Array.isArray(teams) && teams.length === 2 && teams.every((t) => TEAM_CODES.includes(t)) && teams[0] !== teams[1];
}

// משחק תקין בסדרה – המנצח הוא אחת משתי הקבוצות. נקודות: {קוד: n}; גם lal/sas הישנים מתקבלים
export function cleanGame(g, teams) {
  if (!g || !teams.includes(g.winner)) return null;
  const pts = {};
  for (const t of teams) pts[t] = cleanPoints(g.pts?.[t] ?? g[t.toLowerCase()]);
  return { winner: g.winner, pts, at: Number(g.at) || 0 };
}

export function wins(games, teams) {
  const w = Object.fromEntries(teams.map((t) => [t, 0]));
  for (const g of games) if (g.winner in w) w[g.winner]++;
  return w;
}

export function champion(s) {
  const w = wins(s.games, s.teams);
  return s.teams.find((t) => w[t] >= 4) || null;
}

export function over(s) {
  return !!champion(s) || s.games.length >= MAX_GAMES;
}

export function newSeries(teams, era, players = {}) {
  return { teams: [...teams], era: cleanEra(era), players: Object.fromEntries(teams.map((t) => [t, cleanName(players[t])])), games: [], rev: 0 };
}

// סדרה שהסתיימה → שורה בהיסטוריה
export function archive(s, winnerName = '') {
  const ch = champion(s);
  return {
    teams: [...s.teams],
    era: s.era,
    players: { ...s.players },
    winner: ch,
    winnerName: cleanName(winnerName || (ch ? s.players[ch] : '')),
    score: ch ? wins(s.games, s.teams) : null,
    endedAt: Date.now(),
  };
}

// נתונים מהגרסה הראשונה (לייקרס נגד ספרס 2010, בלי teams) → המבנה החדש
export function upgradeV1(old) {
  const teams = ['LAL', 'SAS'];
  return {
    teams,
    era: '2010',
    players: { LAL: cleanName(old?.players?.LAL), SAS: cleanName(old?.players?.SAS) },
    games: (old?.games || []).map((g) => cleanGame(g, teams)).filter(Boolean),
    rev: Number(old?.rev) || 0,
  };
}

// מעבר חד-פעמי לבקשת המשתמש (11.2026): סדרת לייקרס–ספרס 2010 הסתיימה (המנצח: PREVIOUS_WINNER) –
// היא עוברת להיסטוריה, ונפתחת סדרה חדשה: סקרמנטו קינגס (עם יתרון ביתיות) נגד הלייקרס של שנות ה-2000.
export function migrate(stored, history) {
  const old = stored ? (stored.teams ? stored : upgradeV1(stored)) : upgradeV1(null);
  let winnerTeam = champion(old);
  if (!winnerTeam) winnerTeam = old.teams.find((t) => old.players[t] === PREVIOUS_WINNER) || null;
  const entry = { ...archive(old, PREVIOUS_WINNER), winner: winnerTeam };
  const next = newSeries(['SAC', 'LAL'], 'שנות ה-2000');
  next.rev = old.rev + 1;
  return { series: next, history: [...(history || []), entry] };
}

export class Series {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.now = env.NOW || (() => Date.now());
    this.s = null;
    this.history = null;
    this.auth = null;
  }

  async load() {
    if (!this.s) {
      let s = await this.storage.get('series');
      let history = (await this.storage.get('history')) || [];
      if ((await this.storage.get('migration')) !== MIGRATION) {
        ({ series: s, history } = migrate(s, history));
        await this.storage.put('series', s);
        await this.storage.put('history', history);
        await this.storage.put('migration', MIGRATION);
      }
      this.s = s;
      this.history = history;
    }
    // auth = { salt, hash, fails, lockUntil, sessions: [sha256(סוד)] } – רק בשרת, לא נשלח לאפליקציה
    if (!this.auth) this.auth = (await this.storage.get('auth')) || null;
  }

  async save() {
    this.s.rev++;
    await this.storage.put('series', this.s);
  }

  // מה שהאפליקציה רואה: הסדרה + ההיסטוריה + האם כבר נקבעה סיסמה + האם המכשיר הזה הוא המאסטר
  async view(token) {
    return { ...this.s, history: this.history, locked: !!this.auth, master: await this.isMaster(token) };
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
      const g = cleanGame({ ...body, at: this.now() }, this.s.teams);
      if (g && Number(body.n) === this.s.games.length && !over(this.s)) {
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
      // {players: {קוד: שם}, home?: קוד} – יתרון הביתיות אפשר לשנות רק לפני משחק 1
      const src = body.players || body;
      const players = Object.fromEntries(this.s.teams.map((t) => [t, cleanName(src[t])]));
      if (this.s.teams.some((t) => !players[t])) return json(400, { error: 'צריך שם לכל שחקן' });
      this.s.players = players;
      if (body.home && this.s.teams.includes(body.home) && !this.s.games.length) {
        this.s.teams = [body.home, ...this.s.teams.filter((t) => t !== body.home)];
      }
      await this.save();
      return json(200, await this.view(token));
    }

    // סדרה חדשה: {teams: [יתרון ביתיות, שנייה], era, players}. סדרה שהוכרעה נשמרת בהיסטוריה
    if (path === 'new') {
      if (!validTeams(body.teams)) return json(400, { error: 'צריך לבחור שתי קבוצות שונות' });
      if (champion(this.s)) {
        this.history = [...this.history, { ...archive(this.s), endedAt: this.now() }].slice(-MAX_HISTORY);
        await this.storage.put('history', this.history);
      }
      const rev = this.s.rev;
      this.s = newSeries(body.teams, body.era, body.players || {});
      this.s.rev = rev;
      await this.save();
      return json(200, await this.view(token));
    }

    // להתחיל את אותה סדרה מחדש (השמות נשארים)
    if (path === 'reset') {
      this.s.games = [];
      await this.save();
      return json(200, await this.view(token));
    }

    return json(404, { error: 'לא נמצא' });
  }
}

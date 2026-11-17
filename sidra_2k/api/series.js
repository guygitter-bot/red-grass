// Durable Object אחד לכל הסדרה: שמות השחקנים והמשחקים שנרשמו.
// כל שינוי הוא פעולה קטנה (משחק חדש / ביטול האחרון / שמות / סדרה חדשה) עם מספר המשחק,
// כך ששני מכשירים שלוחצים יחד לא דורסים זה את זה: משחק שכבר נרשם לא נרשם פעמיים.

export const TEAMS = ['LAL', 'SAS'];
export const MAX_GAMES = 7;
const MAX_NAME = 20;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

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
  }

  async load() {
    if (!this.s) this.s = (await this.storage.get('series')) || emptySeries();
    return this.s;
  }

  async save() {
    this.s.rev++;
    await this.storage.put('series', this.s);
  }

  async fetch(request) {
    const path = new URL(request.url).pathname.slice(1);
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const s = await this.load();

    if (path === 'get') return json(200, s);

    if (path === 'game') {
      // n = מספר המשחק שהמכשיר חושב שהוא הבא. אם כבר נרשם (מכשיר אחר הקדים) – לא רושמים שוב
      const g = cleanGame({ ...body, at: this.now() });
      if (!g || Number(body.n) !== s.games.length) return json(200, s);
      if (over(s.games)) return json(200, s);
      s.games.push(g);
      await this.save();
      return json(200, s);
    }

    if (path === 'undo') {
      // מוחקים רק אם המשחק האחרון הוא באמת המשחק שהמכשיר ראה
      if (s.games.length && Number(body.n) === s.games.length) {
        s.games.pop();
        await this.save();
      }
      return json(200, s);
    }

    if (path === 'players') {
      const LAL = cleanName(body.LAL);
      const SAS = cleanName(body.SAS);
      if (!LAL || !SAS) return json(400, { error: 'צריך שם לכל שחקן' });
      s.players = { LAL, SAS };
      await this.save();
      return json(200, s);
    }

    if (path === 'reset') {
      s.games = [];
      await this.save();
      return json(200, s);
    }

    return json(404, { error: 'לא נמצא' });
  }
}

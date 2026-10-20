// הנתונים של התלמיד/ה (התקדמות, רשימות, שיחה עם המדריך, מעקב) – כדי שיהיו זהים במחשב ובטלפון.
// כל מפתח נשמר בנפרד עם זמן העדכון שלו; העדכון האחרון לכל מפתח מנצח.
export const SYNC_KEYS = ['done', 'chk', 'tutor', 'niches', 'track', 'trackmeta', 'calc', 'prompt', 'meta'];
const MAX_VALUE_CHARS = 400 * 1024;

// מיזוג שינויים שהגיעו ממכשיר: מחזיר רק את מה שבאמת חדש יותר ממה שבשרת
export function mergeChanges(existing, changes) {
  const out = {};
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
  for (const [k, c] of Object.entries(changes)) {
    if (!SYNC_KEYS.includes(k)) return null;
    if (!c || typeof c.t !== 'number' || !Number.isFinite(c.t) || !('v' in c)) return null;
    if (JSON.stringify(c.v).length > MAX_VALUE_CHARS) return null;
    const cur = existing[k];
    if (!cur || c.t > cur.t) out[k] = { v: c.v, t: c.t };
  }
  return out;
}

export class Vault {
  constructor(state) { this.state = state; }
  async all() {
    const map = await this.state.storage.list({ prefix: 'k:' });
    const data = {};
    for (const [key, val] of map) data[key.slice(2)] = val;
    return data;
  }
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/get') return Response.json({ data: await this.all() });
    if (pathname === '/put') {
      const body = await request.json().catch(() => null);
      const existing = await this.all();
      const fresh = mergeChanges(existing, body && body.changes);
      if (!fresh) return Response.json({ error: 'נתונים לא תקינים' }, { status: 400 });
      const puts = {};
      for (const [k, c] of Object.entries(fresh)) puts['k:' + k] = c;
      if (Object.keys(puts).length) await this.state.storage.put(puts);
      return Response.json({ data: { ...existing, ...fresh } });
    }
    return Response.json({ error: 'לא נמצא' }, { status: 404 });
  }
}

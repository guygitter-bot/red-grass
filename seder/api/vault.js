// הכספת: כל הרשומות (משימות ותחומים) של בעלת האפליקציה, וסנכרון בין מכשירים.
//
// כל רשומה נושאת updatedAt (זמן העריכה במכשיר). כשאותה רשומה נערכה בשני מכשירים – העריכה המאוחרת גוברת.
// מחיקה נשמרת כ"מצבה" (deleted), כדי שמכשיר שהיה כבוי ידע למחוק גם אצלו.
// לכל שינוי מספר רץ (seq): מכשיר שואל "מה השתנה מאז X" ומקבל רק את החדש.
//
// אחסון (key-value של Durable Object):
//   r:<kind>:<id>  -> { kind, id, data, updatedAt, deleted, seq }
//   s:<seq>        -> "r:<kind>:<id>"   (אינדקס לפי סדר השינויים)
//   seq            -> המספר הרץ האחרון
//   fails          -> { count, since }  (ניסיונות כניסה שגויים)

export const KINDS = new Set(['task', 'category']);
const ID_RE = /^[\w-]{1,64}$/;
const MAX_RECORD_BYTES = 64 * 1024;
export const MAX_CHANGES = 2000;
export const PAGE = 1000;
const MAX_FAILS = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

const seqKey = (n) => `s:${String(n).padStart(12, '0')}`;
const recKey = (kind, id) => `r:${kind}:${id}`;

// בדיקת שינוי שהגיע מהמכשיר. מחזיר רשומה נקייה או null
export function cleanChange(c) {
  if (!c || typeof c !== 'object' || !KINDS.has(c.kind) || typeof c.id !== 'string' || !ID_RE.test(c.id)) return null;
  if (typeof c.updatedAt !== 'number' || !Number.isFinite(c.updatedAt) || c.updatedAt < 0) return null;
  if (c.deleted) return { kind: c.kind, id: c.id, updatedAt: c.updatedAt, deleted: true };
  if (!c.data || typeof c.data !== 'object' || Array.isArray(c.data) || c.data.id !== c.id) return null;
  if (JSON.stringify(c.data).length > MAX_RECORD_BYTES) return null;
  return { kind: c.kind, id: c.id, updatedAt: c.updatedAt, deleted: false, data: c.data };
}

// ממזג שינויים ומחזיר את כל מה שהשתנה אחרי since (עמוד אחד)
export async function sync(storage, since, changes) {
  let seq = (await storage.get('seq')) || 0;
  let accepted = 0;
  for (const raw of changes) {
    const c = cleanChange(raw);
    if (!c) continue;
    const key = recKey(c.kind, c.id);
    const old = await storage.get(key);
    // העריכה המאוחרת גוברת (בשוויון – מה שכבר בשרת נשאר)
    if (old && old.updatedAt >= c.updatedAt) continue;
    seq += 1;
    const rec = { ...c, seq };
    if (rec.deleted) delete rec.data;
    if (old) await storage.delete(seqKey(old.seq));
    await storage.put({ [key]: rec, [seqKey(seq)]: key });
    accepted += 1;
  }
  if (accepted) await storage.put('seq', seq);

  const index = await storage.list({ prefix: 's:', start: seqKey(Math.max(0, since) + 1), limit: PAGE + 1 });
  const keys = [...index.values()];
  const more = keys.length > PAGE;
  const page = more ? keys.slice(0, PAGE) : keys;
  const recs = page.length ? await storage.get(page) : new Map();
  const records = page.map((k) => recs.get(k)).filter(Boolean);
  const cursor = more ? records[records.length - 1].seq : seq;
  return { cursor, more, accepted, records };
}

// השוואה בזמן קבוע (לא מסגירה כמה תווים נכונים)
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// אסימון כניסה: חתימה של הסיסמה. החלפת הסיסמה מנתקת את כל המכשירים
export async function sessionToken(password) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('seder-session-v1'));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export class Vault {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

    if (url.pathname === '/login') {
      const now = Date.now();
      let fails = (await this.storage.get('fails')) || { count: 0, since: now };
      if (now - fails.since > FAIL_WINDOW_MS) fails = { count: 0, since: now };
      if (fails.count >= MAX_FAILS) return json(429, { error: 'יותר מדי ניסיונות. נסי שוב בעוד רבע שעה' });
      if (!safeEqual(String(body.password || ''), this.env.SEDER_PASSWORD)) {
        await this.storage.put('fails', { count: fails.count + 1, since: fails.since });
        return json(401, { error: 'סיסמה שגויה' });
      }
      await this.storage.delete('fails');
      return json(200, { token: await sessionToken(this.env.SEDER_PASSWORD) });
    }

    if (url.pathname === '/sync') {
      const since = Number.isInteger(body.since) && body.since >= 0 ? body.since : 0;
      const changes = Array.isArray(body.changes) ? body.changes.slice(0, MAX_CHANGES) : [];
      return json(200, await sync(this.storage, since, changes));
    }
    return json(404, { error: 'לא נמצא' });
  }
}

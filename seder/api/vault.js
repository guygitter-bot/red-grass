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
//   vapid          -> מפתחות ההתראות של השרת (נוצרים פעם אחת)
//   subs           -> { <id>: { endpoint, keys } }  המכשירים שהפעילו התראות
//   tz             -> אזור הזמן של המשתמשת (לחישוב שעות התזכורות)
//   sent           -> { <taskId>: <זמן התזכורת> }  מה כבר נשלח (שינוי שעה = תזכורת חדשה)
//   fm:<id>, fc:<id>:<n> -> קבצים ותמונות שמצורפים למשימות (ראו files.js)
//
// התזכורות: אחרי כל שינוי במשימות מחושבת התזכורת הקרובה, ו-Durable Object alarm "מעיר" את הכספת
// בדיוק בזמן – והיא שולחת התראה לכל המכשירים, גם כשהאפליקציה סגורה.

// setting – הגדרות אישיות שמסתנכרנות (למשל השם לברכה בלוח)
export const KINDS = new Set(['task', 'category', 'setting']);
const ID_RE = /^[\w-]{1,64}$/;
const MAX_RECORD_BYTES = 64 * 1024;
export const MAX_CHANGES = 2000;
export const PAGE = 1000;
const MAX_FAILS = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

import { createVapidKeys, sendPush, validSubscription } from './push.js';
import { reminderTimes, validTimeZone } from './reminders.js';
import { cleanFile, cleanupFiles, getFile, putFile } from './files.js';

// תזכורת שהזמן שלה עבר לפני יותר מזה – כבר לא נשלחת (למשל משימה שנוספה עם תזכורת בעבר)
export const LATE_WINDOW_MS = 2 * 3600 * 1000;
const PUSH_SUBJECT = 'https://seder-tasks.pages.dev';
const MAX_SUBS = 10;

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
      const result = await sync(this.storage, since, changes);
      if (result.accepted) await this.schedule();
      return json(200, result);
    }

    if (url.pathname === '/files/put') {
      const { file, error } = cleanFile(body);
      if (error) return json(400, { error });
      const saved = await putFile(this.storage, file);
      // הזדמנות לנקות קבצים שכבר לא שייכים לאף משימה
      await cleanupFiles(this.storage);
      return json(200, { file: saved });
    }

    if (url.pathname === '/files/get') {
      const file = await getFile(this.storage, body.id);
      return file ? json(200, { file }) : json(404, { error: 'הקובץ לא נמצא' });
    }

    if (url.pathname === '/push/key') return json(200, { publicKey: (await this.vapid()).publicKey });

    if (url.pathname === '/push/subscribe') {
      const sub = body.subscription;
      if (!sub || !validSubscription(sub)) return json(400, { error: 'מכשיר לא נתמך להתראות' });
      const subs = (await this.storage.get('subs')) || {};
      const id = await subId(sub.endpoint);
      subs[id] = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, createdAt: subs[id]?.createdAt || Date.now() };
      // שומרים רק את המכשירים האחרונים
      const keep = Object.entries(subs).sort((a, b) => b[1].createdAt - a[1].createdAt).slice(0, MAX_SUBS);
      await this.storage.put('subs', Object.fromEntries(keep));
      if (validTimeZone(body.tz)) await this.storage.put('tz', body.tz);
      await this.schedule();
      return json(200, { ok: true, devices: keep.length });
    }

    if (url.pathname === '/push/unsubscribe') {
      const subs = (await this.storage.get('subs')) || {};
      if (typeof body.endpoint === 'string') delete subs[await subId(body.endpoint)];
      await this.storage.put('subs', subs);
      return json(200, { ok: true });
    }

    if (url.pathname === '/push/test') {
      const result = await this.pushAll({ id: '', title: '🔔 התראת בדיקה', body: 'מעולה! ככה ייראו התזכורות – גם כשהאפליקציה סגורה.' });
      return json(200, result);
    }

    return json(404, { error: 'לא נמצא' });
  }

  async vapid() {
    let vapid = await this.storage.get('vapid');
    if (!vapid) {
      vapid = await createVapidKeys();
      await this.storage.put('vapid', vapid);
    }
    return vapid;
  }

  async reminders(now = Date.now()) {
    const tz = (await this.storage.get('tz')) || 'Asia/Jerusalem';
    const recs = await this.storage.list({ prefix: 'r:task:' });
    const out = [];
    for (const rec of recs.values()) {
      if (rec.deleted) continue;
      // תזכורת חוזרת: גם הפעם האחרונה שהגיעה וגם הבאה (כל פעם חדשה נשלחת שוב)
      for (const at of reminderTimes(rec.data, tz, now)) out.push({ task: rec.data, at });
    }
    return out;
  }

  // קובע את ה"השכמה" הבאה לפי התזכורת הקרובה שעוד לא נשלחה
  async schedule(now = Date.now()) {
    const subs = (await this.storage.get('subs')) || {};
    if (!Object.keys(subs).length) return null;
    const sent = (await this.storage.get('sent')) || {};
    let next = null;
    for (const { task, at } of await this.reminders(now)) {
      if (sent[task.id] === at || now - at > LATE_WINDOW_MS) continue;
      if (next == null || at < next) next = at;
    }
    if (next == null) {
      await this.storage.deleteAlarm?.();
      return null;
    }
    const when = Math.max(next, now + 1000);
    await this.storage.setAlarm(when);
    return when;
  }

  async alarm() {
    const now = Date.now();
    const sent = (await this.storage.get('sent')) || {};
    const live = new Set();
    for (const { task, at } of await this.reminders(now)) {
      live.add(task.id);
      if (sent[task.id] === at || at > now || now - at > LATE_WINDOW_MS) continue;
      await this.pushAll({ id: task.id, title: `🔔 ${task.title}`, body: task.time ? `היום ב-${task.time}` : 'תזכורת להיום' });
      sent[task.id] = at;
    }
    // ניקוי: משימות שנמחקו
    for (const id of Object.keys(sent)) if (!live.has(id)) delete sent[id];
    await this.storage.put('sent', sent);
    await this.schedule(now);
  }

  async pushAll(payload) {
    const subs = (await this.storage.get('subs')) || {};
    const vapid = await this.vapid();
    let sent = 0;
    let changed = false;
    for (const [id, sub] of Object.entries(subs)) {
      const result = await sendPush(sub, payload, vapid, PUSH_SUBJECT).catch(() => 'error');
      if (result === 'ok') sent += 1;
      if (result === 'gone') {
        delete subs[id];
        changed = true;
      }
    }
    if (changed) await this.storage.put('subs', subs);
    return { sent, devices: Object.keys(subs).length };
  }
}

async function subId(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

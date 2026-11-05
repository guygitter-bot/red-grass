// Durable Object אחד לכל היומן: הרשומות (ארוחות, מדידות, תפריט קבוע, הגדרות, שיחה עם ה-AI).
// בלי סיסמה (המשתמשת ביקשה): כל מי שפותח את האפליקציה רואה ועורך את אותם נתונים. רק מהאתר של האפליקציה (נבדק ב-worker).
// סנכרון: כל רשומה נושאת updatedAt (זמן עריכה במכשיר); העריכה המאוחרת גוברת. מחיקה = deleted: true (נשמרת,
// כדי שתעבור לכל המכשירים). כל שינוי שהתקבל מקבל מספר גרסה (rev) עולה, והמכשיר מבקש "מה השתנה מאז".
import Anthropic from '@anthropic-ai/sdk';
import { advise } from './ai.js';
import { createVapidKeys, sendPush, validSubscription } from './push.js';

const MAX_RECORDS = 30000;
const MAX_RECORD_CHARS = 12000;
// שאלות ל-AI ביום (הגנה מעלויות)
const AI_PER_DAY = 60;
const MAX_CONTEXT_CHARS = 90000;
const MAX_HISTORY = 12;

// תזכורת שבועית: יום ראשון 9:30 שעון ישראל – להוריד מ-CareLink את הקובץ של השבוע ולהעלות ליומן
const TZ = 'Asia/Jerusalem';
const WEEKLY = { day: 0, hour: 9, minute: 30 };
export const WEEKLY_PUSH = { title: '📡 נתוני החיישן של השבוע', body: 'הגיע הזמן להוריד מ-CareLink את הקובץ של השבוע האחרון ולהעלות אותו ליומן (הגדרות ← נתוני החיישן).', url: '#/settings', tag: 'weekly' };

// ההפרש בדקות בין שעון ישראל ל-UTC ברגע מסוים (קיץ/חורף)
function tzOffset(ms, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000;
}

// הפעם הבאה (אחרי now) של יום ראשון 9:30 שעון ישראל, ב-UTC
export function nextWeekly(now, tz = TZ) {
  const local = new Date(now + tzOffset(now, tz) * 60000);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i, WEEKLY.hour, WEEKLY.minute));
    if (d.getUTCDay() !== WEEKLY.day) continue;
    let t = d.getTime() - tzOffset(d.getTime(), tz) * 60000;
    t = d.getTime() - tzOffset(t, tz) * 60000;
    if (t > now) return t;
  }
  return now + 7 * 24 * 3600000;
}

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fail = (status, error) => Object.assign(new Error(error), { status });

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

export class Diary {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.env = env;
    this.now = env.NOW || (() => Date.now());
    this.d = null;
  }

  async load() {
    if (this.d) return this.d;
    const got = await this.storage.get(['rev']);
    const recs = new Map();
    for (const [k, v] of await this.storage.list({ prefix: 'r:' })) recs.set(k.slice(2), v);
    this.d = { rev: got.get('rev') || 0, recs };
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
      if (path === 'sync') return json(200, await this.sync(body));
      if (path === 'ai') return json(200, await this.ai(body));
      if (path === 'push/key') return json(200, { publicKey: (await this.vapid()).publicKey });
      if (path === 'push/subscribe') {
        if (!validSubscription(body.sub)) return json(400, { error: 'ההרשמה להתראות לא תקינה' });
        const subs = ((await this.storage.get('subs')) || []).filter((x) => x.endpoint !== body.sub.endpoint);
        subs.push({ endpoint: body.sub.endpoint, keys: { p256dh: body.sub.keys.p256dh, auth: body.sub.keys.auth } });
        await this.storage.put('subs', subs.slice(-20));
        await this.ensureAlarm();
        return json(200, { ok: true });
      }
      if (path === 'push/unsubscribe') {
        const subs = ((await this.storage.get('subs')) || []).filter((x) => x.endpoint !== String(body.endpoint || ''));
        await this.storage.put('subs', subs);
        return json(200, { ok: true });
      }
      if (path === 'push/test') return json(200, { sent: await this.push({ title: '🔔 ההתראות עובדות!', body: 'בכל יום ראשון ב-9:30 תגיע כאן תזכורת להעלות את נתוני החיישן.', url: '#/settings', tag: 'test' }) });
      return json(404, { error: 'לא נמצא' });
    } catch (err) {
      if (!err.status) throw err;
      return json(err.status, { error: err.message });
    }
  }

  // מפתחות VAPID של השרת (נוצרים פעם אחת)
  async vapid() {
    let vapid = await this.storage.get('vapid');
    if (!vapid) {
      vapid = await createVapidKeys();
      await this.storage.put('vapid', vapid);
    }
    return vapid;
  }

  // שליחה לכל המכשירים שנרשמו; מכשיר שביטל – נמחק
  async push(payload) {
    const subs = (await this.storage.get('subs')) || [];
    if (!subs.length) return 0;
    const vapid = await this.vapid();
    const fetchFn = this.env.PUSH_FETCH || ((...a) => fetch(...a));
    let sent = 0;
    const keep = [];
    for (const sub of subs) {
      try {
        const result = await sendPush(sub, payload, vapid, 'mailto:yoman-sukar@example.com', fetchFn);
        if (result !== 'gone') keep.push(sub);
        if (result === 'ok') sent++;
      } catch (e) {
        keep.push(sub);
        console.log('push failed', e?.message || e);
      }
    }
    if (keep.length !== subs.length) await this.storage.put('subs', keep);
    return sent;
  }

  async ensureAlarm() {
    if (this.storage.getAlarm && !(await this.storage.getAlarm())) await this.storage.setAlarm(nextWeekly(this.now()));
  }

  // התזכורת השבועית (Durable Object alarm) – ומיד קובעים את הבאה
  async alarm() {
    try {
      await this.push(WEEKLY_PUSH);
    } catch (e) {
      console.log('weekly push failed', e?.message || e);
    }
    await this.storage.setAlarm(nextWeekly(this.now() + 60000));
  }

  async write(writes) {
    const keys = Object.keys(writes);
    // עד 128 מפתחות בכל כתיבה
    for (let i = 0; i < keys.length; i += 100) await this.storage.put(Object.fromEntries(keys.slice(i, i + 100).map((k) => [k, writes[k]])));
    if (keys.length) await this.storage.put('rev', this.d.rev);
  }

  async ai({ context, history, question }) {
    context = String(context || '').slice(0, MAX_CONTEXT_CHARS);
    // ההודעות האחרונות בשיחה (כדי שה-AI יבין שאלת המשך)
    history = (Array.isArray(history) ? history : [])
      .slice(-MAX_HISTORY)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text)
      .map((m) => ({ role: m.role, text: String(m.text).slice(0, 4000) }));
    question = String(question || '').trim().slice(0, 2000);
    if (!question) throw fail(400, 'מה לשאול?');
    if (!this.env.AI_CLIENT && !this.env.ANTHROPIC_API_KEY) throw fail(503, 'ה-AI עוד לא הוגדר בשרת');
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const usage = (await this.storage.get('ai-usage')) || {};
    if (usage.day !== day) Object.assign(usage, { day, count: 0 });
    if (usage.count >= AI_PER_DAY) throw fail(429, 'הגעתם למספר השאלות להיום. אפשר לשאול שוב מחר');
    usage.count += 1;
    await this.storage.put('ai-usage', usage);
    const client = this.env.AI_CLIENT || new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
    try {
      return { answer: await advise(client, context, history, question), left: AI_PER_DAY - usage.count };
    } catch (err) {
      console.error('ai failed', err?.status, err?.message);
      throw fail(502, 'ה-AI לא זמין כרגע. נסו שוב בעוד כמה דקות');
    }
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
    await this.write(writes);
    const from = Number(since) || 0;
    // המכשיר מכיר גרסה מאוחרת ממה שיש בשרת (לא אמור לקרות) – שולחים הכול מחדש
    const all = from > d.rev;
    return { rev: d.rev, changes: [...d.recs.values()].filter((r) => all || r.rev > from) };
  }
}

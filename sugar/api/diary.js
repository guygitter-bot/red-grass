// Durable Object אחד לכל היומן: הרשומות (ארוחות, מדידות, תפריט קבוע, הגדרות, שיחה עם ה-AI).
// בלי סיסמה (המשתמשת ביקשה): כל מי שפותח את האפליקציה רואה ועורך את אותם נתונים. רק מהאתר של האפליקציה (נבדק ב-worker).
// סנכרון: כל רשומה נושאת updatedAt (זמן עריכה במכשיר); העריכה המאוחרת גוברת. מחיקה = deleted: true (נשמרת,
// כדי שתעבור לכל המכשירים). כל שינוי שהתקבל מקבל מספר גרסה (rev) עולה, והמכשיר מבקש "מה השתנה מאז".
import Anthropic from '@anthropic-ai/sdk';
import { advise } from './ai.js';

const MAX_RECORDS = 30000;
const MAX_RECORD_CHARS = 12000;
// שאלות ל-AI ביום (הגנה מעלויות)
const AI_PER_DAY = 60;
const MAX_CONTEXT_CHARS = 90000;
const MAX_HISTORY = 12;

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
      return json(404, { error: 'לא נמצא' });
    } catch (err) {
      if (!err.status) throw err;
      return json(err.status, { error: err.message });
    }
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

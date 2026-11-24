// האוסף: כל הסרטונים ששמרתי (Durable Object אחד, "main").
//
// אחסון (key-value של Durable Object):
//   i:<id>   -> סרטון { id, url, note, status, title, summary, codes: [{code, effect, platform}], category, emoji, tags, ... }
//               status: pending (מחכה לקריאה) | working | ready | failed
//               codesEdited = הקודים נערכו ידנית – "לקרוא שוב" לא ידרוס אותם
//   cats     -> { <שם קטגוריה>: { emoji } }
//   day      -> { date, count }  כמה סרטונים נוספו היום (מגבלה יומית – האפליקציה בלי סיסמה)
//
// הוספה שומרת את הסרטון מיד ("קורא...") ו-Durable Object alarm קורא אותו ברקע –
// כך שאפשר לסגור את האפליקציה באמצע, והקריאה ממשיכה.
import Anthropic from '@anthropic-ai/sdk';
import { aiMessage, classify, cleanCodes, temporary } from './ai.js';
import { gatherLink, youtubeId, youtubeSource } from './source.js';
import { isPublicUrl } from './net.js';

const MAX_NOTE = 1000;
// האפליקציה פתוחה בלי סיסמה: מגבלה יומית, כדי שמישהו זר לא יוכל להריץ עלויות של Claude בלי סוף
export const MAX_PER_DAY = 100;
const MAX_ATTEMPTS = 3;
const STUCK_MS = 10 * 60 * 1000;
const PER_ALARM = 5;
const ID_RE = /^[\w-]{6,64}$/;

const itemKey = (id) => `i:${id}`;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const text = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max);

// כתובת אחידה להשוואה (אותו קישור פעמיים)
export function sameUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const p of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|si$|igsh|mibextid|rdid|share_url)/.test(p)) url.searchParams.delete(p);
    return url.toString().replace(/\/$/, '').replace(/^http:/, 'https:').replace('://www.', '://').replace('://m.', '://');
  } catch {
    return u;
  }
}

export class Library {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
  }

  client() {
    return this.env.AI_CLIENT || new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    let body;
    try {
      body = JSON.parse((await request.text()) || '{}');
    } catch {
      return json(400, { error: 'בקשה לא תקינה' });
    }
    if (!body || typeof body !== 'object') return json(400, { error: 'בקשה לא תקינה' });

    if (pathname === '/list') return json(200, await this.list());
    if (pathname === '/add') return this.add(body);
    if (pathname === '/category') return this.renameCategory(body);

    const item = ID_RE.test(String(body.id || '')) ? await this.storage.get(itemKey(body.id)) : null;
    if (!item) return json(404, { error: 'הסרטון לא נמצא' });

    if (pathname === '/update') {
      if (body.title !== undefined) item.title = text(body.title, 200) || item.title;
      if (body.note !== undefined) item.note = text(body.note, MAX_NOTE);
      if (body.codes !== undefined) {
        item.codes = cleanCodes(body.codes);
        item.codesEdited = true;
      }
      if (body.category !== undefined) {
        const category = text(body.category, 40);
        if (!category) return json(400, { error: 'צריך שם לקטגוריה' });
        item.category = category;
        // בחירה ידנית – הקריאה (גם אם עוד רצה) לא תדרוס אותה
        item.categoryLocked = true;
        await this.ensureCategory(category, body.emoji);
      }
      item.updatedAt = Date.now();
      await this.storage.put(itemKey(item.id), item);
      return json(200, { item });
    }
    if (pathname === '/delete') {
      await this.storage.delete(itemKey(item.id));
      return json(200, { ok: true });
    }
    if (pathname === '/retry') {
      Object.assign(item, { status: 'pending', attempts: 0, error: '', retryAt: 0, categoryLocked: false, updatedAt: Date.now() });
      await this.storage.put(itemKey(item.id), item);
      await this.wake();
      return json(200, { item });
    }
    return json(404, { error: 'לא נמצא' });
  }

  async allItems() {
    return [...(await this.storage.list({ prefix: 'i:' })).values()];
  }

  async list() {
    const items = (await this.allItems()).sort((a, b) => b.createdAt - a.createdAt);
    return { items, categories: (await this.storage.get('cats')) || {} };
  }

  async add(body) {
    const now = Date.now();
    const url = text(body.url, 2000);
    if (!isPublicUrl(url)) return json(400, { error: 'הקישור לא תקין' });
    const key = sameUrl(url);
    const existing = (await this.allItems()).find((i) => sameUrl(i.url) === key);
    if (existing) {
      // אותו קישור שוב אחרי שנכשל – מנסים שוב (במקום רק "כבר שמור")
      if (existing.status === 'failed') {
        const retried = await this.save(existing.id, { status: 'pending', attempts: 0, error: '', retryAt: 0 });
        await this.wake();
        return json(200, { item: retried, duplicate: true, retried: true });
      }
      return json(200, { item: existing, duplicate: true });
    }
    let title = url;
    try {
      title = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      // נשאר הקישור
    }
    const item = { id: newId(), url, title, note: text(body.note, MAX_NOTE), codes: [], status: 'pending', attempts: 0, createdAt: now, updatedAt: now };
    // נספר רק מה שבאמת נשמר (קישור כפול לא נספר)
    const date = new Date(now).toISOString().slice(0, 10);
    const day = (await this.storage.get('day')) || {};
    const count = day.date === date ? day.count : 0;
    if (count >= MAX_PER_DAY) return json(429, { error: 'הגעתם למגבלה היומית של הוספות. אפשר להמשיך מחר.' });
    await this.storage.put('day', { date, count: count + 1 });
    await this.storage.put(itemKey(item.id), item);
    await this.wake();
    return json(200, { item });
  }

  async wake(at = Date.now()) {
    const current = await this.storage.getAlarm();
    if (current == null || current > at) await this.storage.setAlarm(at);
  }

  // ---------- הקריאה ברקע ----------
  async alarm() {
    const now = Date.now();
    const waiting = (await this.allItems())
      .filter((i) => (i.status === 'pending' && !(i.retryAt > now)) || (i.status === 'working' && now - i.startedAt > STUCK_MS))
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const item of waiting.slice(0, PER_ALARM)) await this.process(item.id);
    if (waiting.length > PER_ALARM) return this.wake();
    // סרטון שמחכה לניסיון חוזר אחרי עומס
    const later = (await this.allItems()).filter((i) => i.status === 'pending' && i.retryAt > now);
    if (later.length) await this.wake(Math.min(...later.map((i) => i.retryAt)));
  }

  async process(id) {
    let item = await this.storage.get(itemKey(id));
    if (!item) return;
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts > MAX_ATTEMPTS) return this.save(id, { status: 'failed', error: item.error || 'לא הצלחתי לקרוא את הסרטון. נסו שוב.' });
    item = await this.save(id, { status: 'working', startedAt: Date.now(), attempts: item.attempts });

    const categories = await this.categoryNames();
    const fetchFn = this.env.FETCH || fetch;
    let result;
    try {
      // יוטיוב: כותרת, תיאור וכתוביות (שם נאמרים הקודים). אחרת: הכיתוב של הפוסט
      const video = youtubeId(item.url);
      const src = video ? { video: await youtubeSource(video, fetchFn, { maxText: 30000 }) } : await gatherLink(item.url, fetchFn);
      result = await classify(this.client(), item, src, categories);
    } catch (e) {
      if (temporary(e) && item.attempts < MAX_ATTEMPTS) {
        return this.save(id, { status: 'pending', retryAt: Date.now() + 60_000, error: aiMessage(e) });
      }
      return this.save(id, { status: 'failed', error: aiMessage(e) });
    }
    // מה שהמשתמש שינה ידנית בזמן הקריאה (קטגוריה, קודים) נשמר
    const latest = await this.storage.get(itemKey(id));
    if (!latest) return;
    const category = latest.categoryLocked ? latest.category : result.category;
    const codes = latest.codesEdited ? latest.codes : result.codes;
    await this.ensureCategory(category, result.emoji);
    await this.save(id, { ...result, category, codes, status: 'ready', error: '', retryAt: 0 });
  }

  async save(id, patch) {
    const item = await this.storage.get(itemKey(id));
    if (!item) return null;
    const next = { ...item, ...patch, updatedAt: Date.now() };
    await this.storage.put(itemKey(id), next);
    return next;
  }

  // ---------- קטגוריות ----------
  async categoryNames() {
    const cats = (await this.storage.get('cats')) || {};
    const used = new Set(Object.keys(cats));
    for (const i of await this.allItems()) if (i.category) used.add(i.category);
    return [...used];
  }

  async ensureCategory(name, emoji) {
    const cats = (await this.storage.get('cats')) || {};
    if (cats[name]) return;
    cats[name] = { emoji: [...String(emoji || '🎮')].slice(0, 2).join('') };
    await this.storage.put('cats', cats);
  }

  // שינוי שם / איחוד קטגוריות (to קיימת = איחוד) / החלפת סמל
  async renameCategory(body) {
    const from = text(body.from, 40);
    const to = text(body.to, 40) || from;
    if (!from) return json(400, { error: 'בקשה לא תקינה' });
    const cats = (await this.storage.get('cats')) || {};
    const emoji = body.emoji ? [...String(body.emoji)].slice(0, 2).join('') : (cats[to] || cats[from])?.emoji || '🎮';
    delete cats[from];
    cats[to] = { emoji };
    await this.storage.put('cats', cats);
    if (to !== from) {
      for (const item of await this.allItems()) {
        if (item.category === from) await this.storage.put(itemKey(item.id), { ...item, category: to, updatedAt: Date.now() });
      }
    }
    return json(200, await this.list());
  }
}

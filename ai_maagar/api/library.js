// הספרייה: כל החומר של בעלת האפליקציה (Durable Object אחד, "main").
//
// אחסון (key-value של Durable Object):
//   i:<id>       -> פריט { id, kind: 'link'|'file'|'text', url?, file?, text?, note, status, ... }
//                   status: pending (מחכה למיפוי) | working | ready | failed
//   fm:<id>      -> פרטי קובץ { name, type, size, chunks }
//   fc:<id>:<n>  -> חתיכה n של הקובץ (base64; לכל ערך באחסון יש גבול גודל)
//   cats         -> { <שם קטגוריה>: { emoji } }
//   day          -> { date, count }  כמה פריטים נוספו היום (מגבלה יומית – האפליקציה בלי סיסמה)
//
// הוספה שומרת את הפריט מיד ("ממפה...") ו-Durable Object alarm ממפה אותו ברקע –
// כך שאפשר לסגור את האפליקציה באמצע, והמיפוי ממשיך.
import Anthropic from '@anthropic-ai/sdk';
import { aiMessage, classify, fileSource, temporary } from './ai.js';
import { gatherLink } from './source.js';
import { isPublicUrl } from './net.js';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const CHUNK_CHARS = 512 * 1024;
const MAX_TEXT = 20000;
const MAX_NOTE = 1000;
// האפליקציה פתוחה בלי סיסמה: מגבלה יומית, כדי שמישהו זר לא יוכל להריץ עלויות של Claude בלי סוף
export const MAX_PER_DAY = 150;
const MAX_ATTEMPTS = 3;
const STUCK_MS = 10 * 60 * 1000;
const PER_ALARM = 5;
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const ID_RE = /^[\w-]{6,64}$/;

const itemKey = (id) => `i:${id}`;
const fileKey = (id) => `fm:${id}`;
const chunkKey = (id, n) => `fc:${id}:${String(n).padStart(4, '0')}`;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const text = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max);

// כתובת אחידה להשוואה (אותו קישור פעמיים)
export function sameUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const p of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|si$|igsh)/.test(p)) url.searchParams.delete(p);
    return url.toString().replace(/\/$/, '').replace(/^http:/, 'https:').replace('://www.', '://');
  } catch {
    return u;
  }
}

// בדיקת קובץ שהגיע מהמכשיר. מחזיר { file } או { error }
export function cleanFile(f) {
  const { name, type, data } = f || {};
  if (typeof data !== 'string' || !data.length || data.length % 4 !== 0 || !B64_RE.test(data)) return { error: 'הקובץ לא תקין' };
  const size = Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (size > MAX_FILE_BYTES) return { error: 'הקובץ גדול מדי (עד 10MB)' };
  return {
    file: {
      name: text(name, 150).replace(/[\r\n\t]/g, ' ') || 'קובץ',
      type: /^[\w.+-]+\/[\w.+-]+$/.test(String(type || '')) ? String(type).slice(0, 100) : 'application/octet-stream',
      size,
      data,
    },
  };
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
    if (pathname === '/file') {
      const file = await this.getFile(String(body.id || ''));
      return file ? json(200, { file }) : json(404, { error: 'הקובץ לא נמצא' });
    }

    const item = ID_RE.test(String(body.id || '')) ? await this.storage.get(itemKey(body.id)) : null;
    if (pathname === '/category') return this.renameCategory(body);
    if (!item) return json(404, { error: 'הפריט לא נמצא' });

    if (pathname === '/update') {
      if (body.title !== undefined) item.title = text(body.title, 200) || item.title;
      if (body.note !== undefined) item.note = text(body.note, MAX_NOTE);
      if (body.category !== undefined) {
        const category = text(body.category, 40);
        if (!category) return json(400, { error: 'צריך שם לקטגוריה' });
        item.category = category;
        // בחירה ידנית – המיפוי (גם אם עוד רץ) לא ידרוס אותה
        item.categoryLocked = true;
        await this.ensureCategory(category, body.emoji);
      }
      item.updatedAt = Date.now();
      await this.storage.put(itemKey(item.id), item);
      return json(200, { item: item });
    }
    if (pathname === '/delete') {
      await this.storage.delete(itemKey(item.id));
      if (item.kind === 'file') await this.removeFile(item.id);
      return json(200, { ok: true });
    }
    if (pathname === '/retry') {
      Object.assign(item, { status: 'pending', attempts: 0, error: '', retryAt: 0, categoryLocked: false, updatedAt: Date.now() });
      await this.storage.put(itemKey(item.id), item);
      await this.wake();
      return json(200, { item: item });
    }
    return json(404, { error: 'לא נמצא' });
  }

  async list() {
    const items = [...(await this.storage.list({ prefix: 'i:' })).values()].sort((a, b) => b.createdAt - a.createdAt);
    return { items, categories: (await this.storage.get('cats')) || {} };
  }

  async add(body) {
    const now = Date.now();
    const note = text(body.note, MAX_NOTE);
    const item = { id: newId(), kind: body.kind, note, status: 'pending', attempts: 0, createdAt: now, updatedAt: now };
    if (body.kind === 'link') {
      const url = text(body.url, 2000);
      if (!isPublicUrl(url)) return json(400, { error: 'הקישור לא תקין' });
      const key = sameUrl(url);
      const existing = [...(await this.storage.list({ prefix: 'i:' })).values()].find((i) => i.kind === 'link' && sameUrl(i.url) === key);
      if (existing) return json(200, { item: existing, duplicate: true });
      item.url = url;
      try {
        item.title = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        item.title = url;
      }
    } else if (body.kind === 'text') {
      item.text = text(body.text, MAX_TEXT);
      if (!item.text) return json(400, { error: 'אין טקסט' });
      item.title = item.text.split('\n')[0].slice(0, 80);
    } else if (body.kind === 'file') {
      const { file, error } = cleanFile(body.file);
      if (error) return json(400, { error });
      await this.putFile(item.id, file);
      item.file = { name: file.name, type: file.type, size: file.size };
      item.title = file.name;
    } else {
      return json(400, { error: 'בקשה לא תקינה' });
    }
    // נספר רק מה שבאמת נשמר (קישור כפול לא נספר)
    const date = new Date(now).toISOString().slice(0, 10);
    const day = (await this.storage.get('day')) || {};
    const count = day.date === date ? day.count : 0;
    if (count >= MAX_PER_DAY) {
      if (item.kind === 'file') await this.removeFile(item.id);
      return json(429, { error: 'הגעתם למגבלה היומית של הוספות. אפשר להמשיך מחר.' });
    }
    await this.storage.put('day', { date, count: count + 1 });
    await this.storage.put(itemKey(item.id), item);
    await this.wake();
    return json(200, { item: item });
  }

  async wake(at = Date.now()) {
    const current = await this.storage.getAlarm();
    if (current == null || current > at) await this.storage.setAlarm(at);
  }

  // ---------- המיפוי ברקע ----------
  async alarm() {
    const now = Date.now();
    const waiting = [...(await this.storage.list({ prefix: 'i:' })).values()]
      .filter((i) => (i.status === 'pending' && !(i.retryAt > now)) || (i.status === 'working' && now - i.startedAt > STUCK_MS))
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const item of waiting.slice(0, PER_ALARM)) await this.process(item.id);
    if (waiting.length > PER_ALARM) return this.wake();
    // פריט שמחכה לניסיון חוזר אחרי עומס
    const later = [...(await this.storage.list({ prefix: 'i:' })).values()].filter((i) => i.status === 'pending' && i.retryAt > now);
    if (later.length) await this.wake(Math.min(...later.map((i) => i.retryAt)));
  }

  async process(id) {
    let item = await this.storage.get(itemKey(id));
    if (!item) return;
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts > MAX_ATTEMPTS) return this.save(id, { status: 'failed', error: item.error || 'לא הצלחתי למפות. נסו שוב.' });
    item = await this.save(id, { status: 'working', startedAt: Date.now(), attempts: item.attempts });

    const categories = await this.categoryNames();
    let result;
    try {
      let src = null;
      if (item.kind === 'link') src = await gatherLink(item.url, this.env.FETCH || fetch);
      if (item.kind === 'file') {
        const file = await this.getFile(id);
        src = file ? fileSource(file) : null;
      }
      try {
        result = await classify(this.client(), item, src, categories);
      } catch (e) {
        // קובץ שהסוכן לא מצליח לקרוא (PDF פגום / ארוך מדי) – ממפים לפי השם
        if (item.kind !== 'file' || !src || Number(e?.status) !== 400) throw e;
        result = await classify(this.client(), item, null, categories);
      }
    } catch (e) {
      if (temporary(e) && item.attempts < MAX_ATTEMPTS) {
        return this.save(id, { status: 'pending', retryAt: Date.now() + 60_000, error: aiMessage(e) });
      }
      return this.save(id, { status: 'failed', error: aiMessage(e) });
    }
    // הקטגוריה שהמשתמשת בחרה ידנית בזמן המיפוי נשמרת
    const latest = await this.storage.get(itemKey(id));
    if (!latest) return;
    const category = latest.categoryLocked ? latest.category : result.category;
    await this.ensureCategory(category, result.emoji);
    await this.save(id, { ...result, category, status: 'ready', error: '', retryAt: 0 });
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
    for (const i of (await this.storage.list({ prefix: 'i:' })).values()) if (i.category) used.add(i.category);
    return [...used];
  }

  async ensureCategory(name, emoji) {
    const cats = (await this.storage.get('cats')) || {};
    if (cats[name]) return;
    cats[name] = { emoji: [...String(emoji || '📁')].slice(0, 2).join('') };
    await this.storage.put('cats', cats);
  }

  // שינוי שם / איחוד קטגוריות (to קיימת = איחוד) / החלפת סמל
  async renameCategory(body) {
    const from = text(body.from, 40);
    const to = text(body.to, 40) || from;
    if (!from) return json(400, { error: 'בקשה לא תקינה' });
    const cats = (await this.storage.get('cats')) || {};
    const emoji = body.emoji ? [...String(body.emoji)].slice(0, 2).join('') : (cats[to] || cats[from])?.emoji || '📁';
    delete cats[from];
    cats[to] = { emoji };
    await this.storage.put('cats', cats);
    if (to !== from) {
      for (const item of (await this.storage.list({ prefix: 'i:' })).values()) {
        if (item.category === from) await this.storage.put(itemKey(item.id), { ...item, category: to, updatedAt: Date.now() });
      }
    }
    return json(200, await this.list());
  }

  // ---------- קבצים ----------
  async putFile(id, file) {
    const chunks = Math.max(1, Math.ceil(file.data.length / CHUNK_CHARS));
    for (let n = 0; n < chunks; n += 1) await this.storage.put(chunkKey(id, n), file.data.slice(n * CHUNK_CHARS, (n + 1) * CHUNK_CHARS));
    await this.storage.put(fileKey(id), { name: file.name, type: file.type, size: file.size, chunks });
  }

  async getFile(id) {
    if (!ID_RE.test(id)) return null;
    const meta = await this.storage.get(fileKey(id));
    if (!meta) return null;
    const keys = Array.from({ length: meta.chunks }, (_, n) => chunkKey(id, n));
    const parts = await this.storage.get(keys);
    if (keys.some((k) => typeof parts.get(k) !== 'string')) return null;
    return { name: meta.name, type: meta.type, size: meta.size, data: keys.map((k) => parts.get(k)).join('') };
  }

  async removeFile(id) {
    const meta = await this.storage.get(fileKey(id));
    if (!meta) return;
    await this.storage.delete([fileKey(id), ...Array.from({ length: meta.chunks }, (_, n) => chunkKey(id, n))]);
  }
}

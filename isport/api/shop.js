// כל הנתונים של Isport – Durable Object אחד ("main"). השרת בודק הרשאות לכל פעולה.
//
// אחסון:
//   meta          -> { v, fails: { count, until } }   v עולה בכל שינוי בקטלוג
//   sessions      -> { <sha256 של סוד הכניסה>: תוקף }   כניסות של המנהל (סיסמה מהסוד ADMIN_PASSWORD)
//   settings      -> { whatsapp, instagram, announcement }
//   categories    -> [{ id, name, template, active }]   (ראו model.js; בלי – ברירת המחדל)
//   shirt:<id>    -> חולצה (ראו model.js)
//   day           -> { date, ai }   מגבלה יומית על הסוכן (הגנה מעלויות)
//   usage:<YYYY-MM> -> { calls, enrich, images, input, output, cacheRead, cacheWrite, searches }   שימוש בסוכן לפי חודש
//                      (העלות מחושבת באתר לפי המחירון – web/src/lib/cost.js)
// התמונות עצמן בדלי R2 (IMAGES), בשם img-<אקראי>.<סוג>
import Anthropic from '@anthropic-ai/sdk';
import { aiMessage, enrich, findPages } from './ai.js';
import { contentType, download, fromBase64, pageImages } from './images.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, cleanCategories, cleanSettings, cleanShirt, fail, isImageKey, publicShirt } from './model.js';

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 10;
const MAX_FAILS = 6;
const LOCK_MS = 30 * 60 * 1000;
export const MAX_AI_PER_DAY = 300;
export const MAX_SHIRTS = 3000;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSecret(bytes = 24) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export class Shop {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.env = env;
    this.now = env.NOW || (() => Date.now());
    this.fetcher = env.FETCH || ((...a) => fetch(...a));
    this.d = null;
  }

  client() {
    return this.env.AI_CLIENT || new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
  }

  async load() {
    if (this.d) return this.d;
    const got = await this.storage.get(['meta', 'sessions', 'settings', 'categories']);
    const shirts = await this.storage.list({ prefix: 'shirt:' });
    this.d = {
      meta: got.get('meta') || { v: 1, fails: { count: 0, until: 0 } },
      sessions: got.get('sessions') || {},
      settings: { ...DEFAULT_SETTINGS, ...(got.get('settings') || {}) },
      categories: got.get('categories') || DEFAULT_CATEGORIES,
      shirts: new Map([...shirts.values()].map((s) => [s.id, s])),
    };
    return this.d;
  }

  async bump(entries = {}) {
    this.d.meta.v += 1;
    await this.storage.put({ ...entries, meta: this.d.meta });
    return this.d.meta.v;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'בקשה לא תקינה' });
    }
    try {
      await this.load();
      if (path === '/catalog') return json(200, this.catalog());
      if (path === '/login') return json(200, await this.login(body));

      const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!(await this.isAdmin(token))) return json(401, { error: 'צריך להתחבר מחדש' });
      const handler = {
        '/admin/state': () => this.adminState(),
        '/admin/shirt': () => this.saveShirt(body),
        '/admin/shirt-delete': () => this.deleteShirt(body),
        '/admin/publish': () => this.setPublished(body),
        '/admin/enrich': () => this.ai('enrich', body),
        '/admin/find-images': () => this.ai('images', body),
        '/admin/image-import': () => this.importImage(body),
        '/admin/image-upload': () => this.uploadImage(body),
        '/admin/settings': () => this.saveSettings(body),
        '/admin/categories': () => this.saveCategories(body),
        '/logout': () => this.logout(token),
      }[path];
      if (!handler) return json(404, { error: 'לא נמצא' });
      return json(200, await handler());
    } catch (e) {
      if (e.status) return json(e.status, { error: e.message });
      throw e;
    }
  }

  // ---------- כניסה ----------

  async login({ password }) {
    const d = this.d;
    const now = this.now();
    if (!this.env.ADMIN_PASSWORD) throw fail(503, 'סיסמת הניהול עוד לא הוגדרה בשרת');
    if (d.meta.fails.until > now) throw fail(429, 'יותר מדי ניסיונות. נסו שוב בעוד חצי שעה');
    if (!safeEqual(await sha256(String(password || '')), await sha256(this.env.ADMIN_PASSWORD))) {
      d.meta.fails.count += 1;
      if (d.meta.fails.count >= MAX_FAILS) d.meta.fails = { count: 0, until: now + LOCK_MS };
      await this.storage.put('meta', d.meta);
      throw fail(401, 'הסיסמה לא נכונה');
    }
    d.meta.fails = { count: 0, until: 0 };
    const token = newSecret();
    const live = Object.entries(d.sessions).filter(([, exp]) => exp > now).sort((a, b) => b[1] - a[1]);
    d.sessions = Object.fromEntries([[await sha256(token), now + SESSION_MS], ...live.slice(0, MAX_SESSIONS - 1)]);
    await this.storage.put({ meta: d.meta, sessions: d.sessions });
    return { token };
  }

  async isAdmin(token) {
    if (!token || token.length < 20 || token.length > 100) return false;
    return this.d.sessions[await sha256(token)] > this.now();
  }

  async logout(token) {
    delete this.d.sessions[await sha256(token)];
    await this.storage.put('sessions', this.d.sessions);
    return { ok: true };
  }

  // ---------- ללקוחות ----------

  catalog() {
    const now = this.now();
    const categories = this.d.categories.filter((c) => c.active);
    const shirts = [...this.d.shirts.values()]
      .filter((s) => s.published && categories.some((c) => c.id === (s.category || 'football')))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => publicShirt(s, now));
    return { v: this.d.meta.v, shirts, categories, settings: this.d.settings };
  }

  // ---------- ניהול ----------

  async adminState() {
    const month = new Date(this.now()).toISOString().slice(0, 7);
    return {
      v: this.d.meta.v,
      shirts: [...this.d.shirts.values()].sort((a, b) => b.createdAt - a.createdAt),
      settings: this.d.settings,
      categories: this.d.categories,
      usage: (await this.storage.get(`usage:${month}`)) || { calls: 0, input: 0, output: 0 },
      // 12 החודשים האחרונים, החדש ראשון
      usageMonths: [...(await this.storage.list({ prefix: 'usage:' })).entries()]
        .map(([k, v]) => ({ month: k.slice(6), ...v }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12),
      images: Boolean(this.env.IMAGES),
    };
  }

  async saveShirt(body) {
    const d = this.d;
    const old = body?.id ? d.shirts.get(body.id) : null;
    if (body?.id && !old) throw fail(404, 'החולצה לא נמצאה');
    if (!old && d.shirts.size >= MAX_SHIRTS) throw fail(400, 'הגעתם למספר החולצות המרבי');
    const data = cleanShirt(body, d.categories);
    const same = [...d.shirts.values()].find((s) => s.id !== old?.id && s.code.toLowerCase() === data.code.toLowerCase());
    if (same) throw fail(409, `קוד המוצר ${data.code} כבר קיים (${same.team} ${same.type} ${same.year})`);
    const now = this.now();
    const shirt = { ...data, id: old?.id || `sh-${newSecret(9)}`, createdAt: old?.createdAt || now, updatedAt: now };
    d.shirts.set(shirt.id, shirt);
    const v = await this.bump({ [`shirt:${shirt.id}`]: shirt });
    if (old) await this.dropImages(old.images.filter((k) => !shirt.images.includes(k)));
    return { v, shirt };
  }

  async setPublished({ id, published }) {
    const s = this.d.shirts.get(id);
    if (!s) throw fail(404, 'החולצה לא נמצאה');
    if (published === true && !s.flyLink) throw fail(400, 'אי אפשר לפרסם חולצה בלי קישור FlyLinking');
    s.published = published === true;
    s.updatedAt = this.now();
    return { v: await this.bump({ [`shirt:${id}`]: s }), shirt: s };
  }

  async deleteShirt({ id }) {
    const s = this.d.shirts.get(id);
    if (!s) throw fail(404, 'החולצה לא נמצאה');
    this.d.shirts.delete(id);
    await this.storage.delete(`shirt:${id}`);
    const v = await this.bump();
    await this.dropImages(s.images);
    return { v };
  }

  // מוחק מהדלי תמונות שאף חולצה כבר לא משתמשת בהן
  async dropImages(keys) {
    const used = new Set([...this.d.shirts.values()].flatMap((s) => s.images));
    const gone = keys.filter((k) => isImageKey(k) && !used.has(k));
    if (gone.length && this.env.IMAGES) await this.env.IMAGES.delete(gone).catch(() => {});
  }

  async saveSettings(body) {
    this.d.settings = cleanSettings(body);
    return { v: await this.bump({ settings: this.d.settings }), settings: this.d.settings };
  }

  async saveCategories({ categories }) {
    const used = new Set([...this.d.shirts.values()].map((s) => s.category || 'football'));
    this.d.categories = cleanCategories(categories, used);
    return { v: await this.bump({ categories: this.d.categories }), categories: this.d.categories };
  }

  // ---------- הסוכן ----------

  async countAi() {
    const date = new Date(this.now()).toISOString().slice(0, 10);
    let day = (await this.storage.get('day')) || { date };
    if (day.date !== date) day = { date };
    if ((day.ai || 0) >= MAX_AI_PER_DAY) throw fail(429, 'הגעתם למגבלה היומית של ההשלמה האוטומטית. נסו שוב מחר');
    day.ai = (day.ai || 0) + 1;
    await this.storage.put('day', day);
  }

  // kind: enrich (פרטים) / images (חיפוש תמונות). חודשים ישנים: בלי הפירוט – שדה חסר = 0
  async addUsage(u, kind) {
    if (!u) return;
    const key = `usage:${new Date(this.now()).toISOString().slice(0, 7)}`;
    const m = (await this.storage.get(key)) || { calls: 0, input: 0, output: 0 };
    const add = (f, n) => {
      m[f] = (m[f] || 0) + (n || 0);
    };
    add('calls', 1);
    add(kind, 1);
    add('input', u.input_tokens);
    add('output', u.output_tokens);
    add('cacheRead', u.cache_read_input_tokens);
    add('cacheWrite', u.cache_creation_input_tokens);
    add('searches', u.web_search_requests);
    await this.storage.put(key, m);
  }

  async ai(kind, body) {
    const category = this.d.categories.find((c) => c.id === (body?.category || 'football')) || DEFAULT_CATEGORIES[0];
    const basics = { team: body?.team, type: body?.type, year: body?.year, color: body?.color, kind: body?.kind, category };
    if (!String(basics.team || '').trim()) throw fail(400, category.template === 'plain' ? 'כתבו קודם את שם המותג' : 'כתבו קודם את שם הקבוצה / הנבחרת');
    if (!this.env.ANTHROPIC_API_KEY && !this.env.AI_CLIENT) throw fail(503, 'ההשלמה האוטומטית לא מוגדרת בשרת');
    await this.countAi();
    try {
      if (kind === 'enrich') {
        const { details, usage } = await enrich(this.client(), basics);
        await this.addUsage(usage, 'enrich');
        return { details };
      }
      const { pages, usage } = await findPages(this.client(), basics);
      await this.addUsage(usage, 'images');
      const lists = await Promise.all(pages.map((p) => pageImages(this.fetcher, p)));
      const images = [];
      lists.forEach((list, i) => {
        for (const url of list) if (!images.some((x) => x.url === url)) images.push({ url, page: pages[i] });
      });
      return { images: images.slice(0, 12) };
    } catch (e) {
      if (e.status && e.status < 500 && !e.error) throw e;
      console.error('ai failed', kind, e?.status, e?.message);
      throw fail(502, aiMessage(e));
    }
  }

  // ---------- תמונות ----------

  async storeImage({ bytes, ext }) {
    if (!this.env.IMAGES) throw fail(503, 'אחסון התמונות לא מוגדר בשרת');
    const key = `img-${newSecret(12)}.${ext}`;
    await this.env.IMAGES.put(key, bytes, { httpMetadata: { contentType: contentType(ext) } });
    return { key };
  }

  async importImage({ url }) {
    return this.storeImage(await download(this.fetcher, url));
  }

  async uploadImage({ data }) {
    return this.storeImage(fromBase64(data));
  }
}

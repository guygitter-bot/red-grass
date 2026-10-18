// כל הנתונים של הרוכשים – Durable Object אחד ("main"). השרת בודק הרשאות לכל פעולה.
//
// אחסון:
//   meta        -> { v, fails: { count, until } }   v עולה בכל שינוי בקטלוג
//   sessions    -> { <sha256 של סוד הכניסה>: תוקף }   כניסות של המנהל (סיסמה מהסוד ADMIN_PASSWORD)
//   categories, suppliers, offers  (ראו model.js)
//   lead:<id>   -> ליד (כל ליד בנפרד – כולל השיחה עם העוזר)
//   file:<id>   -> { name, type, size, data }   קובץ הצעת מחיר
//   key:<sha256> -> מזהה ספק   הקישור האישי של כל ספק (הסוד עצמו לא נשמר)
//   day         -> { date, chats, leads }   מגבלות יומיות (הגנה מעלויות ומהצפה)
//   usage:<YYYY-MM> -> { calls, input, output, cacheRead, cacheWrite }   שימוש בעוזר החכם לפי חודש
import Anthropic from '@anthropic-ai/sdk';
import { aiMessage, answer, cleanChat, knowledgeText } from './ai.js';
import {
  DEFAULT_CATEGORIES,
  STATUSES,
  cleanCategory,
  cleanFile,
  cleanLead,
  cleanLeadUpdate,
  cleanOffer,
  cleanSupplier,
  fail,
  isId,
  offerVisible,
  publicSupplier,
} from './model.js';

const SESSION_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 20;
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;
export const MAX_CHATS_PER_DAY = 1500;
export const MAX_LEADS_PER_DAY = 400;
// קבצים שנשלחים לעוזר בכל שיחה (הכי חדשים)
const MAX_AI_FILES = 4;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSecret(bytes = 24) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const newId = (prefix) => `${prefix}-${newSecret(9)}`;

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const KEYS = ['meta', 'sessions', 'categories', 'suppliers', 'offers'];

export class Club {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.env = env;
    this.now = env.NOW || (() => Date.now());
    this.d = null;
  }

  client() {
    return this.env.AI_CLIENT || new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
  }

  async load() {
    if (this.d) return this.d;
    const got = await this.storage.get(KEYS);
    this.d = {
      meta: got.get('meta') || { v: 1, fails: { count: 0, until: 0 } },
      sessions: got.get('sessions') || {},
      categories: got.get('categories') || DEFAULT_CATEGORIES,
      suppliers: got.get('suppliers') || [],
      offers: got.get('offers') || [],
    };
    return this.d;
  }

  async save(...keys) {
    this.d.meta.v += 1;
    const entries = {};
    for (const k of new Set(['meta', ...keys])) entries[k] = this.d[k];
    await this.storage.put(entries);
    return { ok: true, v: this.d.meta.v };
  }

  today() {
    return new Date(this.now()).toISOString().slice(0, 10);
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
      const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const open = {
        '/catalog': () => this.catalog(),
        '/file': () => this.publicFile(body),
        '/chat': () => this.chat(body),
        '/lead': () => this.addLead(body),
        '/my': () => this.myLeads(body),
        '/login': () => this.login(body),
      }[path];
      if (open) return json(200, await open());

      const me = await this.who(token);
      if (!me) return json(401, { error: 'צריך להתחבר מחדש' });
      const admin = {
        '/admin/state': () => this.adminState(),
        '/admin/category': () => this.saveCategory(body),
        '/admin/supplier': () => this.saveSupplier(body),
        '/admin/supplier-active': () => this.setSupplierActive(body),
        '/admin/supplier-link': () => this.supplierLink(body),
        '/admin/offer': () => this.saveOffer(body),
        '/admin/offer-remove': () => this.removeOffer(body),
        '/admin/lead': () => this.updateLead(me, body),
        '/admin/file': () => this.anyFile(body),
        '/logout': () => this.logout(token),
      };
      const partner = {
        '/partner/state': () => this.partnerState(me),
        '/partner/lead': () => this.updateLead(me, body),
        '/partner/file': () => this.partnerFile(me, body),
      };
      const handler = (me.role === 'admin' ? admin : partner)[path];
      if (!handler) return json(me.role === 'admin' || !admin[path] ? 404 : 403, { error: admin[path] ? 'רק למנהל' : 'לא נמצא' });
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
    if (!this.env.ADMIN_PASSWORD) throw fail(503, 'סיסמת המנהל עוד לא הוגדרה בשרת');
    if (d.meta.fails.until > now) throw fail(429, 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה');
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

  async logout(token) {
    const hash = await sha256(token);
    delete this.d.sessions[hash];
    await this.storage.put('sessions', this.d.sessions);
    return { ok: true };
  }

  // מי שולח – המנהל, או ספק לפי הקישור האישי שלו (ספק שהורד מהרשימה לא נכנס)
  async who(token) {
    if (!token || token.length < 20 || token.length > 100) return null;
    const hash = await sha256(token);
    if (this.d.sessions[hash] > this.now()) return { role: 'admin' };
    const supplierId = await this.storage.get(`key:${hash}`);
    const s = supplierId && this.d.suppliers.find((x) => x.id === supplierId);
    if (!s || s.keyHash !== hash || !s.active) return null;
    return { role: 'partner', id: s.id, name: s.name };
  }

  // ---------- ללקוחות ----------

  visibleOffers() {
    const today = this.today();
    return this.d.offers.filter((o) => offerVisible(o, this.d.suppliers, today));
  }

  catalog() {
    const d = this.d;
    return {
      v: d.meta.v,
      categories: d.categories.filter((c) => c.active).sort((a, b) => a.order - b.order),
      suppliers: d.suppliers.filter((s) => s.active).map(publicSupplier),
      offers: this.visibleOffers(),
    };
  }

  async publicFile({ id }) {
    if (!this.visibleOffers().some((o) => o.id === id && o.file)) throw fail(404, 'הקובץ לא נמצא');
    return { file: await this.storage.get(`file:${id}`) };
  }

  async countDay(field, max) {
    const date = this.today();
    let day = (await this.storage.get('day')) || { date };
    if (day.date !== date) day = { date };
    if ((day[field] || 0) >= max) throw fail(429, 'הגענו למגבלה היומית. נסו שוב מחר או השאירו פרטים');
    day[field] = (day[field] || 0) + 1;
    await this.storage.put('day', day);
  }

  async chat({ supplierId, chat }) {
    const supplier = this.d.suppliers.find((s) => s.id === supplierId && s.active);
    if (!supplier) throw fail(404, 'הספק לא נמצא');
    const messages = cleanChat(chat);
    if (!messages) throw fail(400, 'השיחה ארוכה מדי. אפשר להשאיר פרטים והספק יחזור אליכם');
    await this.countDay('chats', MAX_CHATS_PER_DAY);

    const offers = this.visibleOffers().filter((o) => o.supplierId === supplier.id);
    const knowledge = knowledgeText(supplier, offers, this.d.categories);
    const withFiles = offers.filter((o) => o.file).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_AI_FILES);
    const files = (await Promise.all(withFiles.map((o) => this.storage.get(`file:${o.id}`)))).filter(Boolean);
    try {
      const res = await answer(this.client(), { knowledge, files, chat: messages });
      await this.addUsage(res.usage);
      return { reply: res.reply, handoff: res.handoff };
    } catch (e) {
      console.error('chat failed', e?.status, e?.message);
      throw fail(502, aiMessage(e));
    }
  }

  async addUsage(u) {
    if (!u) return;
    const key = `usage:${this.today().slice(0, 7)}`;
    const m = (await this.storage.get(key)) || { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    m.calls += 1;
    m.input += u.input_tokens || 0;
    m.output += u.output_tokens || 0;
    m.cacheRead += u.cache_read_input_tokens || 0;
    m.cacheWrite += u.cache_creation_input_tokens || 0;
    await this.storage.put(key, m);
  }

  async addLead(body) {
    const supplier = this.d.suppliers.find((s) => s.id === body?.supplierId && s.active);
    if (!supplier) throw fail(404, 'הספק לא נמצא');
    const data = cleanLead(body);
    const offer = this.visibleOffers().find((o) => o.id === body.offerId && o.supplierId === supplier.id);
    const now = this.now();

    // אותו טלפון לאותו ספק ב-24 השעות האחרונות -> מעדכנים את הליד הקיים במקום ליד כפול
    const digits = data.phone.replace(/\D/g, '');
    const recent = [...(await this.storage.list({ prefix: 'lead:' })).values()].find(
      (l) => l.supplierId === supplier.id && l.phone.replace(/\D/g, '') === digits && now - l.createdAt < 24 * 60 * 60 * 1000,
    );
    const key = newSecret(16);
    if (recent) {
      if (data.summary) recent.summary = data.summary;
      if (data.chat.length) recent.chat = data.chat;
      if (data.note) recent.note = [recent.note, data.note].filter(Boolean).join('\n');
      if (offer && !recent.offerId) recent.offerId = offer.id;
      recent.custKeyHash = await sha256(key);
      recent.updatedAt = now;
      await this.storage.put(`lead:${recent.id}`, recent);
      return { id: recent.id, key, again: true };
    }

    await this.countDay('leads', MAX_LEADS_PER_DAY);
    const lead = {
      id: newId('lead'),
      supplierId: supplier.id,
      offerId: offer?.id || '',
      categoryId: offer?.categoryId || body.categoryId || supplier.categoryIds[0] || '',
      ...data,
      status: 'new',
      amount: 0,
      supplierNote: '',
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, status: 'new', by: 'customer' }],
      custKeyHash: await sha256(key),
    };
    await this.storage.put(`lead:${lead.id}`, lead);
    return { id: lead.id, key };
  }

  // הלקוח רואה את הפניות שלו (המזהה + הסוד נשמרים בטלפון שלו)
  async myLeads({ items }) {
    const list = (Array.isArray(items) ? items : []).slice(0, 50).filter((i) => isId(i?.id) && typeof i.key === 'string');
    const out = [];
    for (const i of list) {
      const l = await this.storage.get(`lead:${i.id}`);
      if (!l || l.custKeyHash !== (await sha256(i.key))) continue;
      const s = this.d.suppliers.find((x) => x.id === l.supplierId);
      const o = this.d.offers.find((x) => x.id === l.offerId);
      out.push({ id: l.id, supplierId: l.supplierId, supplierName: s?.name || '', offerTitle: o?.title || '', status: l.status, createdAt: l.createdAt, updatedAt: l.updatedAt });
    }
    return { leads: out };
  }

  // ---------- מנהל ----------

  async allLeads() {
    return [...(await this.storage.list({ prefix: 'lead:' })).values()].sort((a, b) => b.createdAt - a.createdAt).map(({ custKeyHash, ...l }) => l);
  }

  async adminState() {
    const d = this.d;
    const usage = Object.fromEntries([...(await this.storage.list({ prefix: 'usage:' })).entries()].map(([k, v]) => [k.slice(6), v]));
    return {
      v: d.meta.v,
      categories: [...d.categories].sort((a, b) => a.order - b.order),
      suppliers: d.suppliers.map(({ keyHash, ...s }) => ({ ...s, hasLink: !!keyHash })),
      offers: d.offers,
      leads: await this.allLeads(),
      usage,
    };
  }

  async saveCategory(c) {
    const cat = cleanCategory(c);
    const i = this.d.categories.findIndex((x) => x.id === cat.id);
    if (i >= 0) this.d.categories[i] = cat;
    else this.d.categories.push({ ...cat, order: cat.order || this.d.categories.length });
    return this.save('categories');
  }

  async saveSupplier(s) {
    const clean = cleanSupplier(s, this.d.categories);
    const old = this.d.suppliers.find((x) => x.id === clean.id);
    if (old) Object.assign(old, clean);
    else this.d.suppliers.push({ ...clean, active: true, createdAt: this.now(), removedAt: 0, keyHash: '' });
    return this.save('suppliers');
  }

  // הורדה מהרשימה / החזרה. לא מוחקים כלום: ההצעות והלידים נשארים
  async setSupplierActive({ id, active }) {
    const s = this.d.suppliers.find((x) => x.id === id);
    if (!s) throw fail(404, 'הספק לא נמצא');
    s.active = !!active;
    s.removedAt = s.active ? 0 : this.now();
    return this.save('suppliers');
  }

  // קישור כניסה חדש לספק (הקישור הקודם מפסיק לעבוד)
  async supplierLink({ id }) {
    const s = this.d.suppliers.find((x) => x.id === id);
    if (!s) throw fail(404, 'הספק לא נמצא');
    if (s.keyHash) await this.storage.delete(`key:${s.keyHash}`);
    const token = newSecret();
    s.keyHash = await sha256(token);
    await this.storage.put(`key:${s.keyHash}`, s.id);
    await this.save('suppliers');
    return { token };
  }

  async saveOffer(body) {
    const offer = cleanOffer(body, this.d.suppliers, this.d.categories);
    const old = this.d.offers.find((x) => x.id === offer.id);
    let file = old?.file || null;
    if (body.file === null && file) {
      await this.storage.delete(`file:${offer.id}`);
      file = null;
    } else if (body.file?.data) {
      const f = cleanFile(body.file);
      await this.storage.put(`file:${offer.id}`, f);
      file = { name: f.name, type: f.type, size: f.size };
    }
    if (old) Object.assign(old, offer, { file });
    else this.d.offers.push({ ...offer, file, createdAt: this.now() });
    return this.save('offers');
  }

  async removeOffer({ id }) {
    const i = this.d.offers.findIndex((x) => x.id === id);
    if (i < 0) throw fail(404, 'ההצעה לא נמצאה');
    this.d.offers.splice(i, 1);
    await this.storage.delete(`file:${id}`);
    return this.save('offers');
  }

  async anyFile({ id }) {
    const file = isId(id) && (await this.storage.get(`file:${id}`));
    if (!file) throw fail(404, 'הקובץ לא נמצא');
    return { file };
  }

  // ---------- ספק ----------

  async partnerState(me) {
    const s = this.d.suppliers.find((x) => x.id === me.id);
    const leads = (await this.allLeads()).filter((l) => l.supplierId === me.id);
    return {
      supplier: { id: s.id, name: s.name, categoryIds: s.categoryIds, area: s.area, about: s.about, knowledge: s.knowledge },
      categories: this.d.categories,
      offers: this.d.offers.filter((o) => o.supplierId === me.id),
      leads,
    };
  }

  async partnerFile(me, { id }) {
    if (!this.d.offers.some((o) => o.id === id && o.supplierId === me.id)) throw fail(404, 'הקובץ לא נמצא');
    return this.anyFile({ id });
  }

  // עדכון ליד – מנהל (כל ליד) או ספק (רק שלו)
  async updateLead(me, body) {
    const lead = isId(body?.id) && (await this.storage.get(`lead:${body.id}`));
    if (!lead || (me.role === 'partner' && lead.supplierId !== me.id)) throw fail(404, 'הליד לא נמצא');
    const u = cleanLeadUpdate(body);
    const now = this.now();
    if (u.status && u.status !== lead.status) {
      lead.history = [...(lead.history || []), { at: now, status: u.status, by: me.role === 'admin' ? 'admin' : 'supplier' }].slice(-50);
    }
    Object.assign(lead, u, { updatedAt: now });
    await this.storage.put(`lead:${lead.id}`, lead);
    const { custKeyHash, ...out } = lead;
    return { lead: out };
  }
}

export { STATUSES };

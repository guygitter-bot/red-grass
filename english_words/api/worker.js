// שרת קטן ל"מילים באנגלית": האפליקציה שולחת תוצאות סיבובים, אפליקציית הניהול קוראת אותן (עם סיסמה)
import { summarize, cleanRound, cleanName } from './stats.js';

export const KID_RE = /^[a-z0-9]{8,32}$/;
export const MAX_KIDS = 30;
export const MAX_ROUNDS = 400;
export const SESSION_MS = 90 * 24 * 3600 * 1000;
export const LOCK_AFTER = 10;
export const LOCK_MS = 15 * 60 * 1000;

const ROUTES = ['/round', '/admin/status', '/admin/setup', '/admin/login', '/admin/overview', '/admin/delete'];

export function originAllowed(origin, list) {
  return (list || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .some((pattern) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`).test(origin));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const headers = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (originAllowed(origin, env.ALLOWED_ORIGINS)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/health') return reply(200, { ok: true });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'לא נמצא' });
    if (!env.TRACKER) return reply(503, { error: 'השרת לא מוגדר' });
    const text = await request.text();
    if (text.length > 20_000) return reply(413, { error: 'גדול מדי' });
    const stub = env.TRACKER.get(env.TRACKER.idFromName('main'));
    const res = await stub.fetch(new Request(`https://tracker${pathname}`, { method: 'POST', body: text }));
    return new Response(res.body, { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};

// ---- סיסמה: PBKDF2, לא נשמרת כטקסט ----
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return hex(a);
}
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256);
  return hex(bits);
}
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export class Tracker {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.now = env.NOW || (() => Date.now());
  }

  async fetch(request) {
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    const path = new URL(request.url).pathname;
    let body;
    try { body = JSON.parse((await request.text()) || '{}'); } catch { return reply(400, { error: 'בקשה לא תקינה' }); }
    if (!body || typeof body !== 'object') return reply(400, { error: 'בקשה לא תקינה' });
    try {
      if (path === '/round') return await this.round(body, reply);
      if (path === '/admin/status') return reply(200, { hasPassword: !!(await this.storage.get('admin')) });
      if (path === '/admin/setup') return await this.setup(body, reply);
      if (path === '/admin/login') return await this.login(body, reply);
      if (!(await this.session(body.token))) return reply(401, { error: 'צריך להיכנס מחדש' });
      if (path === '/admin/overview') return await this.overview(reply);
      if (path === '/admin/delete') return await this.deleteKid(body, reply);
    } catch (e) {
      return reply(500, { error: 'תקלה בשרת' });
    }
    return reply(404, { error: 'לא נמצא' });
  }

  // סיבוב שהסתיים באפליקציה של הילד
  async round(body, reply) {
    const kid = body.kid || {};
    if (!KID_RE.test(kid.id || '')) return reply(400, { error: 'מזהה לא תקין' });
    const now = this.now();
    const rounds = (Array.isArray(body.rounds) ? body.rounds : [body.round]).slice(0, 50)
      .map((r) => cleanRound(r, now)).filter(Boolean);
    const kids = (await this.storage.get('kids')) || [];
    if (!kids.includes(kid.id)) {
      if (kids.length >= MAX_KIDS) return reply(429, { error: 'יותר מדי ילדים' });
      kids.push(kid.id);
      await this.storage.put('kids', kids);
    }
    const info = (await this.storage.get(`kid:${kid.id}`)) || { id: kid.id, created: now };
    info.name = cleanName(kid.name);
    info.lastSeen = now;
    await this.storage.put(`kid:${kid.id}`, info);
    if (rounds.length) {
      const all = [...((await this.storage.get(`rounds:${kid.id}`)) || []), ...rounds].slice(-MAX_ROUNDS);
      await this.storage.put(`rounds:${kid.id}`, all);
    }
    return reply(200, { ok: true, saved: rounds.length });
  }

  // הכניסה הראשונה לניהול קובעת את הסיסמה
  async setup(body, reply) {
    if (await this.storage.get('admin')) return reply(409, { error: 'כבר נקבעה סיסמה' });
    const password = String(body.password || '');
    if (password.length < 6 || password.length > 100) return reply(400, { error: 'הסיסמה צריכה להיות לפחות 6 תווים' });
    const salt = randomHex(16);
    await this.storage.put('admin', { salt, hash: await hashPassword(password, salt) });
    return reply(200, { token: await this.newSession() });
  }

  async login(body, reply) {
    const admin = await this.storage.get('admin');
    if (!admin) return reply(409, { error: 'עוד לא נקבעה סיסמה' });
    const now = this.now();
    const lock = (await this.storage.get('lock')) || { fails: 0, until: 0 };
    if (lock.until > now) return reply(429, { error: 'יותר מדי ניסיונות. לנסות שוב בעוד רבע שעה' });
    const ok = sameText(await hashPassword(String(body.password || '').slice(0, 100), admin.salt), admin.hash);
    if (!ok) {
      lock.fails += 1;
      if (lock.fails >= LOCK_AFTER) { lock.fails = 0; lock.until = now + LOCK_MS; }
      await this.storage.put('lock', lock);
      return reply(401, { error: 'סיסמה שגויה' });
    }
    await this.storage.put('lock', { fails: 0, until: 0 });
    return reply(200, { token: await this.newSession() });
  }

  async newSession() {
    const token = randomHex(24);
    const sessions = ((await this.storage.get('sessions')) || []).filter((s) => s.exp > this.now()).slice(-9);
    sessions.push({ token, exp: this.now() + SESSION_MS });
    await this.storage.put('sessions', sessions);
    return token;
  }

  async session(token) {
    if (typeof token !== 'string' || !token) return false;
    const sessions = (await this.storage.get('sessions')) || [];
    return sessions.some((s) => s.exp > this.now() && sameText(s.token, token));
  }

  async overview(reply) {
    const kids = (await this.storage.get('kids')) || [];
    const list = [];
    for (const id of kids) {
      const info = await this.storage.get(`kid:${id}`);
      const rounds = (await this.storage.get(`rounds:${id}`)) || [];
      list.push({ ...info, summary: summarize(rounds), rounds: rounds.slice(-60).reverse() });
    }
    list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    return reply(200, { kids: list });
  }

  async deleteKid(body, reply) {
    const kids = (await this.storage.get('kids')) || [];
    if (!kids.includes(body.id)) return reply(404, { error: 'לא נמצא' });
    await this.storage.put('kids', kids.filter((k) => k !== body.id));
    await this.storage.delete([`kid:${body.id}`, `rounds:${body.id}`]);
    return reply(200, { ok: true });
  }
}

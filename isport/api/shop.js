// כל הנתונים של Isport – Durable Object אחד ("main"). השרת בודק הרשאות לכל פעולה.
//
// אחסון:
//   meta          -> { v, settingsAt, categoriesAt }   v עולה בכל שינוי בקטלוג; *At – מתי נשמרו ההגדרות / הקטגוריות
//                    (נשלחים חזרה בשמירה כ-base – אם השתנו בינתיים: 409, כמו updatedAt של חולצה)
//   fails         -> { ips: { <כתובת>: { count, first, until } }, all: { count, first, until } }   ניסיונות כניסה שנכשלו
//   sessions      -> { <sha256 של סוד הכניסה>: { exp, role } }   כניסות (ישן: מספר = תוקף, מפתח)
//                    role: dev – מי שבנה את האתר (סיסמה מהסוד ADMIN_PASSWORD), client – בעל החנות (סיסמה שהמפתח קובע)
//   clientPass    -> { salt, hash, iter }   הסיסמה של בעל החנות (PBKDF2; הסיסמה עצמה לא נשמרת)
//   trash         -> { <שם תמונה>: מתי הוסרה }   תמונות שהוסרו נמחקות מהדלי רק אחרי 31 יום (כדי שגיבוי ישן יעבוד)
//   settings      -> { whatsapp, instagram, announcement }
//   categories    -> [{ id, name, template, active }]   (ראו model.js; בלי – ברירת המחדל)
//   shirt:<id>    -> חולצה (ראו model.js)
//   day           -> { date, ai }   מגבלה יומית על הסוכן (הגנה מעלויות)
//   usage:<YYYY-MM> -> { calls, enrich, images, input, output, cacheRead, cacheWrite, searches }   שימוש בסוכן לפי חודש
//                      (העלות מחושבת באתר לפי המחירון – web/src/lib/cost.js)
// התמונות עצמן בדלי R2 (IMAGES), בשם img-<אקראי>.<סוג>
// גיבויים באותו דלי: backups/<YYYY-MM-DD>.json (לילי, 30 יום) ו-backups/<YYYY-MM-DD>T<HH-MM>.json (ידני / לפני שחזור)
import Anthropic from '@anthropic-ai/sdk';
import { aiMessage, enrich, findPages } from './ai.js';
import { contentType, download, fromBase64, pageImages } from './images.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, cleanCategories, cleanSettings, cleanShirt, fail, isImageKey, publicShirt } from './model.js';

// שמירה ממסך שנפתח לפני שינוי במכשיר אחר – לא דורסים
const CONFLICT = 'זה שונה בינתיים (במכשיר או בחלון אחר). רעננו את הדף ונסו שוב';

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 10;
const MAX_FAILS = 6;
// הגנה נוספת: הרבה טעויות מהרבה כתובות שונות – נועלים לכולם (גבוה מספיק שאדם אחד לא יגיע אליו)
const MAX_FAILS_ALL = 60;
const MAX_FAIL_IPS = 500;
const LOCK_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_DAYS = 30;
const TRASH_DAYS = 31;
const PBKDF2_ITER = 100000;
const BACKUP_KEY = /^backups\/\d{4}-\d{2}-\d{2}(T\d{2}-\d{2}(-[a-z]+)?)?\.json$/;
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

// סיסמה -> hash (PBKDF2-SHA256)
async function pbkdf2(password, salt, iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: iter }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// התאריך בישראל (YYYY-MM-DD) – למגבלה היומית ולעלויות לפי חודש
export const israelDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ms));

const sessionOf = (v) => (typeof v === 'number' ? { exp: v, role: 'dev' } : v || { exp: 0, role: 'dev' });

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
    const got = await this.storage.get(['meta', 'sessions', 'settings', 'categories', 'fails']);
    const shirts = await this.storage.list({ prefix: 'shirt:' });
    this.d = {
      meta: got.get('meta') || { v: 1 },
      fails: got.get('fails') || { ips: {}, all: {} },
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'בקשה לא תקינה' });
    try {
      await this.load();
      if (path === '/catalog') return json(200, this.catalog());
      if (path === '/login') return json(200, await this.login(body || {}, request.headers.get('x-client-ip') || 'unknown'));
      // רק מתוך השרת עצמו (הגיבוי הלילי); ה-Worker לא מעביר את הכתובת הזאת מבחוץ
      if (path === '/internal/nightly') return json(200, await this.nightly());

      const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const me = await this.who(token);
      if (!me) return json(401, { error: 'צריך להתחבר מחדש' });
      // רק למי שבנה את האתר
      const devOnly = {
        '/admin/restore': () => this.restore(body),
        '/admin/client-password': () => this.setClientPassword(body),
      }[path];
      if (devOnly) {
        if (me.role !== 'dev') return json(403, { error: 'רק למנהל הטכני של האתר' });
        return json(200, await devOnly());
      }
      const handler = {
        '/admin/backups': () => this.listBackups(),
        '/admin/backup-now': () => this.backup('manual'),
        '/admin/state': () => this.adminState(me),
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

  // ניסיון כניסה נרשם כטעות *לפני* בדיקת הסיסמה (בלי await באמצע), כדי שבקשות במקביל לא יעקפו את הנעילה.
  // הצלחה מבטלת אותו. נעילה לפי כתובת – כך שמישהו אחר לא יכול לנעול את בעל החנות בחוץ.
  async login({ password } = {}, ip = 'unknown') {
    const d = this.d;
    const now = this.now();
    if (!this.env.ADMIN_PASSWORD) throw fail(503, 'סיסמת הניהול עוד לא הוגדרה בשרת');
    const fresh = (c) => (c && c.until <= now && now - (c.first || 0) < LOCK_MS ? c : { count: 0, first: now, until: 0 });
    const mine = d.fails.ips[ip];
    if ((mine && mine.until > now) || (d.fails.all.until || 0) > now) throw fail(429, 'יותר מדי ניסיונות. נסו שוב בעוד חצי שעה');
    const byIp = fresh(mine);
    const all = fresh(d.fails.all);
    byIp.count += 1;
    all.count += 1;
    if (byIp.count >= MAX_FAILS) byIp.until = now + LOCK_MS;
    if (all.count >= MAX_FAILS_ALL) all.until = now + LOCK_MS;
    d.fails.ips[ip] = byIp;
    d.fails.all = all;

    const pw = String(password || '');
    let role = null;
    if (safeEqual(await sha256(pw), await sha256(this.env.ADMIN_PASSWORD))) role = 'dev';
    else {
      const cp = await this.storage.get('clientPass');
      if (cp && pw && safeEqual(await pbkdf2(pw, cp.salt, cp.iter), cp.hash)) role = 'client';
    }
    if (!role) {
      // רק כתובות שעדיין רלוונטיות, ולא יותר מדי
      const live = Object.entries(d.fails.ips).filter(([, c]) => c.until > now || now - c.first < LOCK_MS);
      d.fails.ips = Object.fromEntries(live.slice(-MAX_FAIL_IPS));
      await this.storage.put('fails', d.fails);
      throw fail(401, 'הסיסמה לא נכונה');
    }
    // הצלחה: הניסיון לא נחשב טעות
    delete d.fails.ips[ip];
    d.fails.all.count = Math.max(0, d.fails.all.count - 1);
    const token = newSecret();
    // עד MAX_SESSIONS לכל תפקיד (כניסות של בעל החנות לא מנתקות את המפתח)
    const live = Object.entries(d.sessions)
      .map(([h, v]) => [h, sessionOf(v)])
      .filter(([, v]) => v.exp > now)
      .sort((a, b) => b[1].exp - a[1].exp);
    const keep = [...live.filter(([, v]) => v.role === role).slice(0, MAX_SESSIONS - 1), ...live.filter(([, v]) => v.role !== role).slice(0, MAX_SESSIONS)];
    // כניסת מפתח קשורה לסיסמה: כשמחליפים את ADMIN_PASSWORD – כל כניסות המפתח הישנות מתבטלות
    const session = { exp: now + SESSION_MS, role, ...(role === 'dev' ? { pw: await this.devMark() } : {}) };
    d.sessions = Object.fromEntries([[await sha256(token), session], ...keep]);
    await this.storage.put({ fails: d.fails, sessions: d.sessions });
    return { token, role };
  }

  // מי מחובר: { role: dev | client } או null
  async who(token) {
    if (!token || token.length < 20 || token.length > 100) return null;
    const v = sessionOf(this.d.sessions[await sha256(token)]);
    if (!(v.exp > this.now())) return null;
    // (כניסות ישנות בלי pw – עדיין עובדות)
    if (v.role === 'dev' && v.pw && v.pw !== (await this.devMark())) return null;
    return { role: v.role };
  }

  // סימן קצר של סיסמת המפתח (לא הסיסמה עצמה)
  async devMark() {
    return (await sha256(`isport-dev:${this.env.ADMIN_PASSWORD || ''}`)).slice(0, 16);
  }

  // הסיסמה של בעל החנות (רק המפתח קובע). ריק = לבטל. בכל שינוי – כל החיבורים של בעל החנות מתנתקים
  async setClientPassword({ password }) {
    const pw = String(password ?? '');
    if (pw && pw.length < 8) throw fail(400, 'סיסמה של 8 תווים לפחות');
    if (pw && safeEqual(pw, this.env.ADMIN_PASSWORD || '')) throw fail(400, 'זו הסיסמה שלך – בחרו סיסמה אחרת ללקוח');
    if (pw) {
      const salt = newSecret(16);
      await this.storage.put('clientPass', { salt, iter: PBKDF2_ITER, hash: await pbkdf2(pw, salt) });
    } else await this.storage.delete('clientPass');
    this.d.sessions = Object.fromEntries(Object.entries(this.d.sessions).filter(([, v]) => sessionOf(v).role !== 'client'));
    await this.storage.put('sessions', this.d.sessions);
    return { ok: true, clientPassSet: Boolean(pw) };
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

  async adminState(me = { role: 'dev' }) {
    const month = israelDate(this.now()).slice(0, 7);
    return {
      v: this.d.meta.v,
      shirts: [...this.d.shirts.values()].sort((a, b) => b.createdAt - a.createdAt),
      settings: this.d.settings,
      categories: this.d.categories,
      settingsAt: this.d.meta.settingsAt || 0,
      categoriesAt: this.d.meta.categoriesAt || 0,
      usage: (await this.storage.get(`usage:${month}`)) || { calls: 0, input: 0, output: 0 },
      // 12 החודשים האחרונים, החדש ראשון
      usageMonths: [...(await this.storage.list({ prefix: 'usage:' })).entries()]
        .map(([k, v]) => ({ month: k.slice(6), ...v }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12),
      images: Boolean(this.env.IMAGES),
      role: me.role,
      clientPassSet: Boolean(await this.storage.get('clientPass')),
    };
  }

  async saveShirt(body) {
    const d = this.d;
    const old = body?.id ? d.shirts.get(body.id) : null;
    if (body?.id && !old) throw fail(404, 'החולצה לא נמצאה');
    // base = updatedAt של החולצה כשהעורך נפתח (גרסאות ישנות של האתר לא שולחות)
    if (old && body.base !== undefined && body.base !== old.updatedAt) throw fail(409, CONFLICT);
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

  // תמונות שאף חולצה כבר לא משתמשת בהן -> לפח (נמחקות מהדלי אחרי 31 יום, בגיבוי הלילי)
  async dropImages(keys) {
    const used = new Set([...this.d.shirts.values()].flatMap((s) => s.images));
    const gone = keys.filter((k) => isImageKey(k) && !used.has(k));
    if (!gone.length) return;
    const trash = (await this.storage.get('trash')) || {};
    for (const k of gone) trash[k] = this.now();
    await this.storage.put('trash', trash);
  }

  async saveSettings(body) {
    if (body?.base !== undefined && body.base !== (this.d.meta.settingsAt || 0)) throw fail(409, CONFLICT);
    this.d.settings = cleanSettings(body);
    this.d.meta.settingsAt = Math.max(this.now(), (this.d.meta.settingsAt || 0) + 1);
    return { v: await this.bump({ settings: this.d.settings }), settings: this.d.settings, settingsAt: this.d.meta.settingsAt };
  }

  async saveCategories({ categories, base }) {
    if (base !== undefined && base !== (this.d.meta.categoriesAt || 0)) throw fail(409, CONFLICT);
    const used = new Set([...this.d.shirts.values()].map((s) => s.category || 'football'));
    this.d.categories = cleanCategories(categories, used);
    this.d.meta.categoriesAt = Math.max(this.now(), (this.d.meta.categoriesAt || 0) + 1);
    return { v: await this.bump({ categories: this.d.categories }), categories: this.d.categories, categoriesAt: this.d.meta.categoriesAt };
  }

  // ---------- גיבוי ----------

  async snapshot() {
    const usage = Object.fromEntries([...(await this.storage.list({ prefix: 'usage:' })).entries()].map(([k, v]) => [k.slice(6), v]));
    return {
      format: 1,
      at: new Date(this.now()).toISOString(),
      shirts: [...this.d.shirts.values()],
      categories: this.d.categories,
      settings: this.d.settings,
      usage,
    };
  }

  // kind: nightly (שם לפי התאריך, נדרס באותו יום) / manual / restore (המצב לפני שחזור)
  async backup(kind = 'nightly') {
    if (!this.env.IMAGES) throw fail(503, 'אחסון הגיבויים לא מוגדר בשרת');
    const iso = new Date(this.now()).toISOString();
    const stamp = kind === 'nightly' ? iso.slice(0, 10) : `${iso.slice(0, 10)}T${iso.slice(11, 16).replace(':', '-')}${kind === 'manual' ? '' : `-${kind.replace(/[^a-z]/g, '')}`}`;
    const key = `backups/${stamp}.json`;
    const snap = await this.snapshot();
    await this.env.IMAGES.put(key, JSON.stringify(snap), { httpMetadata: { contentType: 'application/json' } });
    return { key, shirts: snap.shirts.length };
  }

  async listBackups() {
    if (!this.env.IMAGES) return { backups: [] };
    const out = [];
    let cursor;
    do {
      const page = await this.env.IMAGES.list({ prefix: 'backups/', cursor });
      out.push(...page.objects.filter((o) => BACKUP_KEY.test(o.key)).map((o) => ({ key: o.key, size: o.size, at: new Date(o.uploaded).getTime() })));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return { backups: out.sort((a, b) => b.at - a.at) };
  }

  // שחזור: מחליף את המוצרים, הקטגוריות וההגדרות במה שבגיבוי. לפני כן – גיבוי של המצב הנוכחי
  async restore({ key }) {
    if (typeof key !== 'string' || !BACKUP_KEY.test(key)) throw fail(400, 'גיבוי לא תקין');
    if (!this.env.IMAGES) throw fail(503, 'אחסון הגיבויים לא מוגדר בשרת');
    const obj = await this.env.IMAGES.get(key);
    if (!obj) throw fail(404, 'הגיבוי לא נמצא');
    let snap;
    try {
      snap = JSON.parse(await new Response(obj.body).text());
    } catch {
      throw fail(400, 'קובץ הגיבוי פגום');
    }
    if (snap?.format !== 1 || !Array.isArray(snap.shirts)) throw fail(400, 'קובץ הגיבוי פגום');
    const safety = await this.backup('restore');

    // הגיבוי עובר את אותן בדיקות כמו שמירה רגילה (קובץ גיבוי יכול להיות ישן או ערוך)
    let categories;
    try {
      categories = cleanCategories(snap.categories);
    } catch {
      categories = this.d.categories;
    }
    categories = [...categories];
    for (const s of snap.shirts) {
      // קטגוריה שהמוצרים צריכים וחסרה – חוזרת (מוצגת)
      const id = (s && s.category) || 'football';
      if (typeof id === 'string' && !categories.some((c) => c.id === id)) {
        const def = DEFAULT_CATEGORIES.find((c) => c.id === id);
        if (def) categories.push({ ...def, active: true });
      }
    }
    const shirts = [];
    for (const s of snap.shirts) {
      if (!s || typeof s.id !== 'string' || !/^sh-[A-Za-z0-9_-]{6,24}$/.test(s.id) || shirts.some((x) => x.id === s.id)) continue;
      let data;
      try {
        data = cleanShirt(s, categories);
      } catch {
        try {
          data = cleanShirt({ ...s, published: false, flyLink: '' }, categories);
        } catch {
          continue;
        }
      }
      if (shirts.some((x) => x.code.toLowerCase() === data.code.toLowerCase())) continue;
      if (shirts.length >= MAX_SHIRTS) break;
      const at = (n) => (Number.isFinite(n) ? n : this.now());
      shirts.push({ ...data, id: s.id, createdAt: at(s.createdAt), updatedAt: at(s.updatedAt) });
    }
    // מחיקה בקבוצות – Cloudflare מוחק עד 128 מפתחות בפעם אחת
    const old = [...(await this.storage.list({ prefix: 'shirt:' })).keys()];
    for (let i = 0; i < old.length; i += 100) await this.storage.delete(old.slice(i, i + 100));
    this.d.shirts = new Map(shirts.map((s) => [s.id, s]));
    for (let i = 0; i < shirts.length; i += 100) {
      await this.storage.put(Object.fromEntries(shirts.slice(i, i + 100).map((s) => [`shirt:${s.id}`, s])));
    }
    this.d.categories = categories;
    if (snap.settings && typeof snap.settings === 'object') {
      try {
        this.d.settings = cleanSettings(snap.settings);
      } catch {
        this.d.settings = cleanSettings({ ...snap.settings, whatsapp: '', instagram: '' });
      }
    }
    this.d.meta.settingsAt = this.d.meta.categoriesAt = this.now();
    // תמונות שחזרו לשימוש – יוצאות מהפח
    const used = new Set(shirts.flatMap((s) => s.images || []));
    const trash = (await this.storage.get('trash')) || {};
    for (const k of Object.keys(trash)) if (used.has(k)) delete trash[k];
    const v = await this.bump({ categories: this.d.categories, settings: this.d.settings, trash });
    return { v, shirts: shirts.length, safety: safety.key };
  }

  // כל לילה: גיבוי, מחיקת גיבויים ישנים (30 יום), ריקון הפח (תמונות שהוסרו לפני יותר מ-31 יום)
  async nightly() {
    const done = await this.backup('nightly');
    const now = this.now();
    const { backups } = await this.listBackups();
    const old = backups.filter((b) => b.at < now - BACKUP_DAYS * DAY_MS).map((b) => b.key);
    if (old.length) await this.env.IMAGES.delete(old);
    const trash = (await this.storage.get('trash')) || {};
    const used = new Set([...this.d.shirts.values()].flatMap((s) => s.images));
    const purge = Object.entries(trash).filter(([k, at]) => at < now - TRASH_DAYS * DAY_MS || used.has(k)).map(([k]) => k);
    const remove = purge.filter((k) => !used.has(k));
    if (remove.length) await this.env.IMAGES.delete(remove).catch(() => {});
    for (const k of purge) delete trash[k];
    await this.storage.put('trash', trash);
    return { ...done, removedBackups: old.length, removedImages: remove.length };
  }

  // ---------- הסוכן ----------

  async countAi() {
    const date = israelDate(this.now());
    let day = (await this.storage.get('day')) || { date };
    if (day.date !== date) day = { date };
    if ((day.ai || 0) >= MAX_AI_PER_DAY) throw fail(429, 'הגעתם למגבלה היומית של ההשלמה האוטומטית. נסו שוב מחר');
    day.ai = (day.ai || 0) + 1;
    await this.storage.put('day', day);
  }

  // kind: enrich (פרטים) / images (חיפוש תמונות). חודשים ישנים: בלי הפירוט – שדה חסר = 0
  async addUsage(u, kind) {
    if (!u) return;
    const key = `usage:${israelDate(this.now()).slice(0, 7)}`;
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
    const basics = { team: body?.team, type: body?.type, year: body?.year, color: body?.color, kind: ['club', 'national'].includes(body?.kind) ? body.kind : '', category };
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
      // גם ריצה שנכשלה עלתה כסף – נרשמת בעלויות
      if (e.usage) await this.addUsage(e.usage, kind === 'enrich' ? 'enrich' : 'images');
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
    // תמונה חדשה נכנסת לפח מיד: אם אף מוצר לא ישתמש בה (הועלתה ולא נשמרה) – תימחק בניקוי הלילי אחרי 31 יום.
    // תמונה שמוצר משתמש בה יוצאת מהפח בניקוי הלילי ולא נמחקת
    const trash = (await this.storage.get('trash')) || {};
    trash[key] = this.now();
    await this.storage.put('trash', trash);
    return { key };
  }

  async importImage({ url }) {
    return this.storeImage(await download(this.fetcher, url));
  }

  async uploadImage({ data }) {
    return this.storeImage(fromBase64(data));
  }
}

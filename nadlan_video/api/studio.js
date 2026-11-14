// הסטודיו (Durable Object אחד, "main"): הסיסמה של האפליקציה + המונה היומי של קריאות ה-AI.
//   pass               -> { hash, salt } (נקבעת בכניסה הראשונה; מי שנכנס ראשון קובע אותה)
//   day:<YYYY-MM-DD>   -> { plans, stills, clips }
//   fails              -> { n, until } (נעילה קצרה אחרי הרבה ניסיונות שגויים)
export const MIN_PASSWORD = 6;
const LIMITS = { plans: 'DAILY_PLANS', stills: 'DAILY_STILLS', clips: 'DAILY_CLIPS' };
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export class Studio {
  constructor(ctx, env) {
    this.storage = ctx.storage;
    this.env = env;
  }

  // בדיקת סיסמה. בפעם הראשונה (create) היא נקבעת. מחזיר { ok } או { ok: false, code }
  async check(password, create) {
    const pass = await this.storage.get('pass');
    if (typeof password !== 'string' || !password) return { ok: false, code: pass ? 'bad_password' : 'no_password' };
    if (!pass) {
      if (!create) return { ok: false, code: 'no_password' };
      if (password.length < MIN_PASSWORD || password.length > 200) return { ok: false, code: 'short_password' };
      const salt = crypto.randomUUID();
      await this.storage.put('pass', { salt, hash: await sha(salt + password) });
      return { ok: true, created: true };
    }
    const fails = (await this.storage.get('fails')) || { n: 0, until: 0 };
    if (fails.until > Date.now()) return { ok: false, code: 'locked' };
    if ((await sha(pass.salt + password.slice(0, 200))) === pass.hash) {
      if (fails.n) await this.storage.delete('fails');
      return { ok: true };
    }
    const n = fails.n + 1;
    await this.storage.put('fails', n >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_MS } : { n, until: 0 });
    return { ok: false, code: 'bad_password' };
  }

  // מונה יומי: true אם עוד מותר (וסופר את הקריאה), false אם עברו את התקרה
  async spend(kind) {
    if (!LIMITS[kind]) return false;
    const limit = Number(this.env?.[LIMITS[kind]]) || 0;
    const key = `day:${today()}`;
    const day = (await this.storage.get(key)) || {};
    if (limit && (day[kind] || 0) >= limit) return false;
    await this.storage.put(key, { ...day, [kind]: (day[kind] || 0) + 1 });
    return true;
  }

  // קריאה שנכשלה לא נספרת
  async refund(kind) {
    const key = `day:${today()}`;
    const day = (await this.storage.get(key)) || {};
    if (day[kind] > 0) await this.storage.put(key, { ...day, [kind]: day[kind] - 1 });
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const reply = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    if (pathname === '/state') return reply({ hasPassword: Boolean(await this.storage.get('pass')) });
    if (pathname === '/check') return reply(await this.check(body.password, body.create === true));
    if (pathname === '/spend') return reply({ ok: await this.spend(body.kind) });
    if (pathname === '/refund') { await this.refund(body.kind); return reply({ ok: true }); }
    return new Response('{}', { status: 404 });
  }
}

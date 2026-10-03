// משתמשים שהוזמנו: קישורי הזמנה, הרשמה, כניסה ומכסת המתכונים החינמיים.
// Durable Object אחד שמחזיק את הכל. לכל משתמש יש ספר מתכונים נפרד (RecipeBook בשם user:<id>).
//
// מפתחות באחסון:
//   invite:<token>   {token, name, createdAt, userId|null}
//   user:<id>        {id, name, email, salt, hash, google?, plan, added, createdAt, invite}  (בגוגל: בלי סיסמה)
//   email:<email>    <id>
//   session:<sha256> {userId, createdAt}  או  {owner: true, createdAt} – מכשיר של בעל האפליקציה (כשהספר נעול)
//   owner-attempts   {count, since} – הגבלת ניסיונות לסיסמת הבעלים

export const PBKDF2_ITERATIONS = 20000;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const err = (status, error) => json({ error }, status);

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const randomToken = (n = 24) =>
  b64(crypto.getRandomValues(new Uint8Array(n))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function sha256(text) {
  return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return b64(bits);
}

function sameText(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

// מה שהאפליקציה רואה על המשתמש (בלי הסיסמה)
export const publicUser = (u, freeLimit) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  plan: u.plan,
  added: u.added,
  freeLimit,
  createdAt: u.createdAt,
});

export class Accounts {
  constructor(state, env) {
    this.storage = state.storage;
    this.freeLimit = Number(env?.FREE_RECIPES ?? 10);
  }

  async newSession(userId) {
    const token = randomToken(32);
    await this.storage.put(`session:${await sha256(token)}`, { userId, createdAt: new Date().toISOString() });
    return token;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = ['POST', 'PUT', 'DELETE'].includes(request.method) ? await request.json().catch(() => ({})) : {};
    const path = url.pathname;
    const now = new Date().toISOString();

    // ---- בעל האפליקציה: הזמנות ומשתמשים ----
    if (path === '/invites' && request.method === 'POST') {
      const invite = { token: randomToken(18), name: String(body.name || '').trim().slice(0, 80), createdAt: now, userId: null };
      await this.storage.put(`invite:${invite.token}`, invite);
      return json({ invite });
    }
    if (path === '/invites' && request.method === 'GET') {
      const invites = [...(await this.storage.list({ prefix: 'invite:' })).values()];
      const users = [...(await this.storage.list({ prefix: 'user:' })).values()].map((u) => publicUser(u, this.freeLimit));
      const byId = Object.fromEntries(users.map((u) => [u.id, u]));
      const list = invites
        .map((i) => ({ ...i, user: i.userId ? byId[i.userId] || null : null }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ invites: list, freeLimit: this.freeLimit });
    }
    if (path === '/invites' && request.method === 'DELETE') {
      const invite = await this.storage.get(`invite:${body.token}`);
      if (!invite) return err(404, 'ההזמנה לא נמצאה');
      if (invite.userId) await this.deleteUser(invite.userId);
      await this.storage.delete(`invite:${body.token}`);
      return json({ ok: true, deletedUserId: invite.userId });
    }
    if (path === '/users/plan' && request.method === 'POST') {
      const user = await this.storage.get(`user:${body.userId}`);
      if (!user) return err(404, 'המשתמש לא נמצא');
      user.plan = body.plan === 'paid' ? 'paid' : 'free';
      await this.storage.put(`user:${user.id}`, user);
      return json({ user: publicUser(user, this.freeLimit) });
    }

    // ---- הזמנה, הרשמה וכניסה ----
    if (path === '/invite/check' && request.method === 'POST') {
      const invite = await this.storage.get(`invite:${body.token}`);
      if (!invite) return err(404, 'קישור ההזמנה לא תקף');
      return json({ name: invite.name, used: Boolean(invite.userId), freeLimit: this.freeLimit });
    }
    if (path === '/register' && request.method === 'POST') {
      const invite = await this.storage.get(`invite:${body.token}`);
      if (!invite) return err(404, 'קישור ההזמנה לא תקף');
      if (invite.userId) return err(409, 'כבר נרשמו עם הקישור הזה. אפשר להיכנס עם האימייל והסיסמה.');
      const name = String(body.name || '').trim().slice(0, 80);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      if (!name) return err(400, 'נא למלא שם');
      if (!validEmail(email)) return err(400, 'כתובת האימייל לא תקינה');
      if (password.length < 6 || password.length > 200) return err(400, 'הסיסמה צריכה להיות לפחות 6 תווים');
      if (await this.storage.get(`email:${email}`)) return err(409, 'האימייל הזה כבר רשום. אפשר להיכנס איתו.');
      const salt = randomToken(16);
      const user = {
        id: crypto.randomUUID(), name, email, salt, hash: await hashPassword(password, salt),
        plan: 'free', added: 0, createdAt: now, invite: invite.token,
      };
      invite.userId = user.id;
      await this.storage.put({ [`user:${user.id}`]: user, [`email:${email}`]: user.id, [`invite:${invite.token}`]: invite });
      return json({ session: await this.newSession(user.id), user: publicUser(user, this.freeLimit) });
    }
    if (path === '/login' && request.method === 'POST') {
      const id = await this.storage.get(`email:${normalizeEmail(body.email)}`);
      const user = id && (await this.storage.get(`user:${id}`));
      const hash = await hashPassword(String(body.password || ''), user?.salt || 'none');
      if (user && !user.hash) return err(401, 'נרשמתם עם גוגל. היכנסו עם הכפתור "המשך עם Google".');
      if (!user || !sameText(hash, user.hash)) return err(401, 'האימייל או הסיסמה שגויים');
      return json({ session: await this.newSession(user.id), user: publicUser(user, this.freeLimit) });
    }
    // כניסה עם גוגל (הטוקן כבר אומת בשרת): משתמש קיים לפי האימייל נכנס; חדש נרשם רק עם קישור הזמנה
    if (path === '/google' && request.method === 'POST') {
      const email = normalizeEmail(body.email);
      if (!validEmail(email) || !body.sub) return err(400, 'חשבון הגוגל לא תקין');
      const id = await this.storage.get(`email:${email}`);
      let user = id && (await this.storage.get(`user:${id}`));
      if (user) {
        if (!user.google) {
          user.google = String(body.sub);
          await this.storage.put(`user:${user.id}`, user);
        } else if (user.google !== String(body.sub)) return err(401, 'חשבון הגוגל לא תואם למשתמש');
        return json({ session: await this.newSession(user.id), user: publicUser(user, this.freeLimit) });
      }
      const invite = body.token && (await this.storage.get(`invite:${body.token}`));
      if (!invite) return err(404, 'אין עדיין משתמש עם החשבון הזה. כדי להירשם צריך קישור הזמנה.');
      if (invite.userId) return err(409, 'כבר נרשמו עם הקישור הזה. אפשר להיכנס עם החשבון שנרשם.');
      user = {
        id: crypto.randomUUID(), name: String(body.name || '').trim().slice(0, 80) || email.split('@')[0], email,
        salt: null, hash: null, google: String(body.sub), plan: 'free', added: 0, createdAt: now, invite: invite.token,
      };
      invite.userId = user.id;
      await this.storage.put({ [`user:${user.id}`]: user, [`email:${email}`]: user.id, [`invite:${invite.token}`]: invite });
      return json({ session: await this.newSession(user.id), user: publicUser(user, this.freeLimit) });
    }
    if (path === '/logout' && request.method === 'POST') {
      await this.storage.delete(`session:${await sha256(String(body.session || ''))}`);
      return json({ ok: true });
    }

    // ---- בעל האפליקציה: מכשיר שנכנס, והגבלת ניסיונות סיסמה (10 ברבע שעה) ----
    if (path === '/owner-session' && request.method === 'POST') {
      const token = randomToken(32);
      await this.storage.put(`session:${await sha256(token)}`, { owner: true, createdAt: now });
      await this.storage.delete('owner-attempts');
      return json({ session: token, user: null, owner: true });
    }
    if (path === '/owner-attempt' && request.method === 'POST') {
      const windowMs = 15 * 60 * 1000;
      let a = (await this.storage.get('owner-attempts')) || { count: 0, since: now };
      if (Date.now() - Date.parse(a.since) > windowMs) a = { count: 0, since: now };
      if (a.count >= 10) return err(429, 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.');
      if (body.failed) await this.storage.put('owner-attempts', { ...a, count: a.count + 1 });
      return json({ ok: true });
    }

    // ---- פנימי: זיהוי משתמש ומכסה ----
    if (path === '/auth' && request.method === 'POST') {
      const session = await this.storage.get(`session:${await sha256(String(body.session || ''))}`);
      if (session?.owner) return json({ user: null, owner: true });
      const user = session && (await this.storage.get(`user:${session.userId}`));
      if (!user) return err(401, 'צריך להיכנס מחדש');
      return json({ user: publicUser(user, this.freeLimit) });
    }
    if (path === '/count' && request.method === 'POST') {
      const user = await this.storage.get(`user:${body.userId}`);
      if (!user) return err(404, 'המשתמש לא נמצא');
      user.added += 1;
      await this.storage.put(`user:${user.id}`, user);
      return json({ user: publicUser(user, this.freeLimit) });
    }

    return err(404, 'Not found');
  }

  async deleteUser(userId) {
    const user = await this.storage.get(`user:${userId}`);
    if (!user) return;
    const sessions = await this.storage.list({ prefix: 'session:' });
    const keys = [...sessions].filter(([, s]) => s.userId === userId).map(([k]) => k);
    await this.storage.delete([...keys, `user:${userId}`, `email:${user.email}`]);
  }
}

// האם המשתמש יכול להוסיף עוד מתכון (בעל האפליקציה תמיד יכול)
export const canAdd = (user) => !user || user.plan === 'paid' || user.added < user.freeLimit;

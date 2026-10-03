// משתמשים שהוזמנו: קישורי הזמנה, הרשמה, כניסה ומכסת המתכונים החינמיים.
// Durable Object אחד שמחזיק את הכל. לכל משתמש יש ספר מתכונים נפרד (RecipeBook בשם user:<id>).
//
// מפתחות באחסון:
//   invite:<token>   {token, name, createdAt, userId|null}
//   user:<id>        {id, name, email, salt, hash, google?, plan, added, createdAt, invite}  (בגוגל: בלי סיסמה)
//   email:<email>    <id>
//   join:<token>     {token, bookId, createdAt, expiresAt, usedBy|null} – הצטרפות לספר משותף (בן/בת משפחה)
//
// ספר משותף: user.bookId הוא הספר שהמשתמש עובד עליו – המזהה של בעל הספר, או 'owner' לספר של בעל האפליקציה.
// בלי bookId זה הספר של המשתמש עצמו. המכסה והמנוי שייכים לבעל הספר ומשותפים לכל החברים בו.
//   session:<sha256> {userId, createdAt}  או  {owner: true, createdAt} – מכשיר של בעל האפליקציה (כשהספר נעול)
//   owner-attempts   {count, since} – הגבלת ניסיונות לסיסמת הבעלים

export const PBKDF2_ITERATIONS = 20000;
export const MAX_MEMBERS = 5; // כולל בעל הספר
const JOIN_DAYS = 7;
export const OWNER_BOOK = 'owner';

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
  ...(u.bookId ? { bookId: u.bookId } : {}),
});

export class Accounts {
  constructor(state, env) {
    this.storage = state.storage;
    this.freeLimit = Number(env?.FREE_RECIPES ?? 10);
  }

  // המשתמש כמו שהשרת עובד איתו: חבר בספר משותף מקבל את המנוי והמכסה של בעל הספר
  async effectiveUser(user) {
    const base = publicUser(user, this.freeLimit);
    if (!user.bookId) return { ...base, role: 'holder' };
    if (user.bookId === OWNER_BOOK) return { ...base, role: 'member', plan: 'paid', ownerBook: true, bookName: 'בעל האפליקציה' };
    const holder = await this.storage.get(`user:${user.bookId}`);
    if (!holder) return null;
    return { ...base, role: 'member', plan: holder.plan, added: holder.added, bookName: holder.name };
  }

  async membersOf(bookId) {
    const users = [...(await this.storage.list({ prefix: 'user:' })).values()];
    return users.filter((u) => u.bookId === bookId);
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
      const all = [...(await this.storage.list({ prefix: 'user:' })).values()];
      const members = (id) => all.filter((u) => u.bookId === id).length;
      const list = invites
        .map((i) => ({ ...i, user: i.userId && byId[i.userId] ? { ...byId[i.userId], members: members(i.userId) } : null }))
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
      const claim = await this.claim(body);
      if (claim.error) return err(claim.status, claim.error);
      const name = String(body.name || '').trim().slice(0, 80);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      if (!name) return err(400, 'נא למלא שם');
      if (!validEmail(email)) return err(400, 'כתובת האימייל לא תקינה');
      if (password.length < 6 || password.length > 200) return err(400, 'הסיסמה צריכה להיות לפחות 6 תווים');
      if (await this.storage.get(`email:${email}`)) return err(409, 'האימייל הזה כבר רשום. אפשר להיכנס איתו.');
      const salt = randomToken(16);
      return this.createUser({ name, email, salt, hash: await hashPassword(password, salt) }, claim);
    }
    if (path === '/login' && request.method === 'POST') {
      const id = await this.storage.get(`email:${normalizeEmail(body.email)}`);
      const user = id && (await this.storage.get(`user:${id}`));
      const hash = await hashPassword(String(body.password || ''), user?.salt || 'none');
      if (user && !user.hash) return err(401, 'נרשמתם עם גוגל. היכנסו עם הכפתור "המשך עם Google".');
      if (!user || !sameText(hash, user.hash)) return err(401, 'האימייל או הסיסמה שגויים');
      return this.signedIn(user);
    }
    // ---- ספר משותף: קישורי הצטרפות וחברים ----
    if (path === '/join/check' && request.method === 'POST') {
      const join = await this.validJoin(body.join);
      if (join.error) return err(join.status, join.error);
      return json({ bookName: join.bookName, freeLimit: this.freeLimit });
    }
    if (path === '/members' && request.method === 'POST') {
      // {bookId} -> בעל הספר והחברים בו
      const bookId = String(body.bookId || '');
      const members = (await this.membersOf(bookId)).map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }));
      const holder = bookId === OWNER_BOOK ? null : await this.storage.get(`user:${bookId}`);
      const joins = [...(await this.storage.list({ prefix: 'join:' })).values()]
        .filter((j) => j.bookId === bookId && !j.usedBy && Date.parse(j.expiresAt) > Date.now());
      return json({
        holder: holder ? { id: holder.id, name: holder.name, email: holder.email } : null,
        members,
        pending: joins.map((j) => ({ token: j.token, expiresAt: j.expiresAt })),
        max: MAX_MEMBERS,
      });
    }
    if (path === '/members/invite' && request.method === 'POST') {
      const bookId = String(body.bookId || '');
      if (bookId !== OWNER_BOOK && !(await this.storage.get(`user:${bookId}`))) return err(404, 'הספר לא נמצא');
      if (bookId !== OWNER_BOOK && (await this.membersOf(bookId)).length + 1 >= MAX_MEMBERS) {
        return err(400, `אפשר עד ${MAX_MEMBERS} אנשים בספר`);
      }
      const join = {
        token: randomToken(18), bookId, createdAt: now,
        expiresAt: new Date(Date.now() + JOIN_DAYS * 86400000).toISOString(), usedBy: null,
      };
      await this.storage.put(`join:${join.token}`, join);
      return json({ join });
    }
    if (path === '/members/remove' && request.method === 'POST') {
      const member = await this.storage.get(`user:${body.userId}`);
      if (!member || member.bookId !== String(body.bookId || '')) return err(404, 'החבר לא נמצא בספר');
      await this.deleteUser(member.id);
      return json({ ok: true });
    }
    if (path === '/members/cancel' && request.method === 'POST') {
      const join = await this.storage.get(`join:${body.token}`);
      if (!join || join.bookId !== String(body.bookId || '')) return err(404, 'הקישור לא נמצא');
      await this.storage.delete(`join:${join.token}`);
      return json({ ok: true });
    }

    // כניסה עם גוגל (הטוקן כבר אומת בשרת): משתמש קיים לפי האימייל נכנס; חדש נרשם רק עם קישור הזמנה
    if (path === '/google' && request.method === 'POST') {
      const email = normalizeEmail(body.email);
      if (!validEmail(email) || !body.sub) return err(400, 'חשבון הגוגל לא תקין');
      const id = await this.storage.get(`email:${email}`);
      let user = id && (await this.storage.get(`user:${id}`));
      if (user && body.join) {
        const join = await this.storage.get(`join:${body.join}`);
        if (join && user.bookId !== join.bookId) return err(409, 'כבר יש חשבון עם האימייל הזה. כדי להצטרף לספר צריך להירשם עם אימייל אחר.');
      }
      if (user) {
        if (!user.google) {
          user.google = String(body.sub);
          await this.storage.put(`user:${user.id}`, user);
        } else if (user.google !== String(body.sub)) return err(401, 'חשבון הגוגל לא תואם למשתמש');
        return this.signedIn(user);
      }
      const claim = await this.claim(body);
      if (claim.error) {
        return err(claim.status, claim.missing ? 'אין עדיין משתמש עם החשבון הזה. כדי להירשם צריך קישור הזמנה.' : claim.error);
      }
      return this.createUser({
        name: String(body.name || '').trim().slice(0, 80) || email.split('@')[0], email, salt: null, hash: null, google: String(body.sub),
      }, claim);
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
      const stored = session && (await this.storage.get(`user:${session.userId}`));
      const user = stored && (await this.effectiveUser(stored));
      if (!user) return err(401, 'צריך להיכנס מחדש');
      return json({ user });
    }
    if (path === '/count' && request.method === 'POST') {
      const member = await this.storage.get(`user:${body.userId}`);
      if (!member) return err(404, 'המשתמש לא נמצא');
      // המכסה של ספר משותף נספרת אצל בעל הספר (בספר של בעל האפליקציה אין מכסה)
      if (member.bookId !== OWNER_BOOK) {
        const holder = member.bookId ? await this.storage.get(`user:${member.bookId}`) : member;
        if (holder) {
          holder.added += 1;
          await this.storage.put(`user:${holder.id}`, holder);
        }
      }
      return json({ user: await this.effectiveUser(await this.storage.get(`user:${member.id}`)) });
    }

    return err(404, 'Not found');
  }

  // הרשמה מקישור הזמנה (ספר חדש) או מקישור הצטרפות (ספר משותף)
  async claim(body) {
    if (body.join) {
      const join = await this.validJoin(body.join);
      return join.error ? join : { join: join.join };
    }
    const invite = body.token && (await this.storage.get(`invite:${body.token}`));
    if (!invite) return { status: 404, error: 'קישור ההזמנה לא תקף', missing: !body.token };
    if (invite.userId) return { status: 409, error: 'כבר נרשמו עם הקישור הזה. אפשר להיכנס עם החשבון שנרשמתם בו.' };
    return { invite };
  }

  async validJoin(token) {
    const join = token && (await this.storage.get(`join:${token}`));
    if (!join) return { status: 404, error: 'קישור ההצטרפות לא תקף' };
    if (join.usedBy) return { status: 409, error: 'כבר הצטרפו עם הקישור הזה. אפשר להיכנס עם החשבון שנרשמתם בו.' };
    if (Date.parse(join.expiresAt) < Date.now()) return { status: 410, error: 'קישור ההצטרפות פג. בקשו קישור חדש.' };
    let bookName = 'בעל האפליקציה';
    if (join.bookId !== OWNER_BOOK) {
      const holder = await this.storage.get(`user:${join.bookId}`);
      if (!holder) return { status: 404, error: 'הספר לא קיים יותר' };
      if ((await this.membersOf(join.bookId)).length + 1 >= MAX_MEMBERS) return { status: 400, error: `בספר הזה כבר ${MAX_MEMBERS} אנשים` };
      bookName = holder.name;
    }
    return { join, bookName };
  }

  async createUser(fields, { invite, join }) {
    const user = {
      id: crypto.randomUUID(), ...fields, plan: 'free', added: 0, createdAt: new Date().toISOString(),
      invite: invite?.token || null, ...(join ? { bookId: join.bookId } : {}),
    };
    const puts = { [`user:${user.id}`]: user, [`email:${user.email}`]: user.id };
    if (invite) puts[`invite:${invite.token}`] = { ...invite, userId: user.id };
    if (join) puts[`join:${join.token}`] = { ...join, usedBy: user.id };
    await this.storage.put(puts);
    return this.signedIn(user);
  }

  async signedIn(user) {
    const view = await this.effectiveUser(user);
    if (!view) return err(401, 'הספר שלכם לא קיים יותר');
    return json({ session: await this.newSession(user.id), user: view });
  }

  // מחיקת משתמש: גם החיבורים שלו, ואם הוא בעל ספר – גם החברים בספר וקישורי ההצטרפות
  async deleteUser(userId) {
    const user = await this.storage.get(`user:${userId}`);
    if (!user) return;
    const members = user.bookId ? [] : await this.membersOf(userId);
    const ids = new Set([userId, ...members.map((m) => m.id)]);
    const sessions = await this.storage.list({ prefix: 'session:' });
    const joins = await this.storage.list({ prefix: 'join:' });
    const keys = [
      ...[...sessions].filter(([, s]) => ids.has(s.userId)).map(([k]) => k),
      ...(user.bookId ? [] : [...joins].filter(([, j]) => j.bookId === userId).map(([k]) => k)),
      ...[user, ...members].flatMap((u) => [`user:${u.id}`, `email:${u.email}`]),
    ];
    await this.storage.delete(keys);
  }
}

// האם המשתמש יכול להוסיף עוד מתכון (בעל האפליקציה תמיד יכול)
export const canAdd = (user) => !user || user.plan === 'paid' || user.added < user.freeLimit;

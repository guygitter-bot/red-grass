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

export const PBKDF2_ITERATIONS = 100000; // המקסימום ב-Workers. סיסמאות ישנות (20000, בלי iter) משודרגות בכניסה הבאה
const OLD_ITERATIONS = 20000;
export const MAX_MEMBERS = 5; // כולל בעל הספר
const SESSION_DAYS = 180;
const INVITE_DAYS = 30;
// הזמנה שלא נוצלה תוך 30 יום פגה (הזמנות ישנות בלי תאריך – בלי תפוגה)
const inviteExpired = (invite) => !invite.userId && invite.expiresAt && Date.parse(invite.expiresAt) < Date.now();
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

export async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations },
    key,
    256,
  );
  return b64(bits);
}

// בדיקת סיסמה של משתמש (לפי מספר הסבבים שבו נשמרה)
async function passwordMatches(user, password) {
  if (!user?.hash) return false;
  return sameText(await hashPassword(password, user.salt, user.iter || OLD_ITERATIONS), user.hash);
}

async function newPassword(password) {
  const salt = randomToken(16);
  return { salt, hash: await hashPassword(password, salt), iter: PBKDF2_ITERATIONS };
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
  google: Boolean(u.google),
  password: Boolean(u.hash),
});

export class Accounts {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env || {};
    this.freeLimit = Number(env?.FREE_RECIPES ?? 10);
  }

  // ניקוי יומי: מוני הגבלת קצב ישנים, חיבורים שפגו וקישורי הצטרפות שפגו
  async alarm() {
    const now = Date.now();
    const drop = [];
    for (const [k, v] of await this.storage.list({ prefix: 'rate:' })) if (now - v.since > 86400000) drop.push(k);
    for (const [k, v] of await this.storage.list({ prefix: 'session:' })) if (now - Date.parse(v.createdAt) > SESSION_DAYS * 86400000) drop.push(k);
    for (const [k, v] of await this.storage.list({ prefix: 'join:' })) if (!v.usedBy && Date.parse(v.expiresAt) < now) drop.push(k);
    for (const [k, v] of await this.storage.list({ prefix: 'device:' })) if (now - v.at > SESSION_DAYS * 86400000) drop.push(k);
    for (let i = 0; i < drop.length; i += 128) await this.storage.delete(drop.slice(i, i + 128));
    await this.storage.setAlarm?.(now + 86400000);
  }

  async ensureCleanup() {
    if (this.cleanupChecked || !this.storage.getAlarm) return;
    this.cleanupChecked = true;
    if (!(await this.storage.getAlarm())) await this.storage.setAlarm(Date.now() + 3600000);
  }

  // גרסת הסוד של בעל האפליקציה: החלפת הסיסמה מנתקת את כל מכשירי הבעלים
  async ownerVersion() {
    return (await sha256(`${this.env.OWNER_PASSWORD || ''}|${this.env.OWNER_EMAIL || ''}`)).slice(0, 16);
  }

  // הגבלת קצב: עד limit פעולות בחלון של windowSec לכל מפתח. מחזיר true אם מותר (וסופר את הפעולה)
  // מכשיר מוכר: מזהה אקראי שהאפליקציה שומרת במכשיר, נשמר (מגובב) אחרי כניסה מוצלחת
  async rememberDevice(scope, device) {
    if (typeof device !== 'string' || device.length < 16 || device.length > 100) return;
    await this.storage.put(`device:${scope}:${await sha256(device)}`, { at: Date.now() });
  }

  async knownDevice(scope, device) {
    if (typeof scope !== 'string' || typeof device !== 'string' || device.length < 16 || device.length > 100) return false;
    const key = scope.startsWith('e:') ? `e:${normalizeEmail(scope.slice(2))}` : scope;
    return Boolean(await this.storage.get(`device:${key}:${await sha256(device)}`));
  }

  async allow(key, limit, windowSec) {
    const now = Date.now();
    let a = (await this.storage.get(`rate:${key}`)) || { count: 0, since: now };
    if (now - a.since > windowSec * 1000) a = { count: 0, since: now };
    if (a.count >= limit) return false;
    await this.storage.put(`rate:${key}`, { ...a, count: a.count + 1 });
    return true;
  }

  // המשתמש כמו שהשרת עובד איתו: חבר בספר משותף מקבל את המנוי והמכסה של בעל הספר
  async effectiveUser(user) {
    if (user.removed) return null;
    const base = publicUser(user, this.freeLimit);
    if (!user.bookId) return { ...base, role: 'holder' };
    if (user.bookId === OWNER_BOOK) return { ...base, role: 'member', plan: 'paid', ownerBook: true, bookName: 'בעל האפליקציה' };
    const holder = await this.storage.get(`user:${user.bookId}`);
    if (!holder) return null;
    return { ...base, role: 'member', plan: holder.plan, added: holder.added, bookName: holder.name };
  }

  async membersOf(bookId) {
    const users = [...(await this.storage.list({ prefix: 'user:' })).values()];
    return users.filter((u) => u.bookId === bookId && !u.removed);
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
    await this.ensureCleanup();

    // ---- בעל האפליקציה: הזמנות ומשתמשים ----
    if (path === '/invites' && request.method === 'POST') {
      const invite = {
        token: randomToken(18), name: String(body.name || '').trim().slice(0, 80), createdAt: now, userId: null,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString(),
      };
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
      if (!invite || (inviteExpired(invite) && !invite.userId)) return err(404, 'קישור ההזמנה לא תקף');
      return json({ name: invite.name, used: Boolean(invite.userId), freeLimit: this.freeLimit });
    }
    if (path === '/register' && request.method === 'POST') {
      const name = String(body.name || '').trim().slice(0, 80);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      if (!name) return err(400, 'נא למלא שם');
      if (!validEmail(email)) return err(400, 'כתובת האימייל לא תקינה');
      if (password.length < 8 || password.length > 200) return err(400, 'הסיסמה צריכה להיות לפחות 8 תווים');
      // קודם בודקים שהקישור תקף (בלי קישור תקף לא מגלים אם אימייל רשום)
      const peek = await this.peekClaim(body);
      if (peek) return err(peek.status, peek.error);
      const existingId = await this.storage.get(`email:${email}`);
      if (existingId) {
        const existing = await this.storage.get(`user:${existingId}`);
        // מי שהוסר מספר משותף מצטרף שוב רק אם הוכיח שזה הוא (הסיסמה הקיימת) – בלי לשנות את פרטי הכניסה
        if (existing?.removed && body.join && (await passwordMatches(existing, password))) {
          return this.rejoin(existing, body.join, {});
        }
        return err(409, 'האימייל הזה כבר רשום. אפשר להיכנס איתו.');
      }
      const id = crypto.randomUUID();
      const claim = await this.claim(body, id);
      if (claim.error) return err(claim.status, claim.error);
      return this.createUser(id, { name, email, ...(await newPassword(password)) }, claim);
    }
    if (path === '/login' && request.method === 'POST') {
      const id = await this.storage.get(`email:${normalizeEmail(body.email)}`);
      const user = id && (await this.storage.get(`user:${id}`));
      // אותה הודעה לכל כישלון (גם לחשבון גוגל), כדי שאי אפשר לבדוק אילו אימיילים רשומים
      const ok = user?.hash ? await passwordMatches(user, String(body.password || '')) : await hashPassword(String(body.password || ''), 'none').then(() => false);
      if (!ok) return err(401, 'האימייל או הסיסמה שגויים. נרשמתם עם גוגל? היכנסו עם הכפתור "המשך עם Google".');
      if ((user.iter || OLD_ITERATIONS) < PBKDF2_ITERATIONS) {
        Object.assign(user, await newPassword(String(body.password)));
        await this.storage.put(`user:${user.id}`, user);
      }
      await this.rememberDevice(`e:${user.email}`, body.device);
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
      if ((await this.membersOf(bookId)).length + 1 >= MAX_MEMBERS) {
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
      if (!member || member.removed || member.bookId !== String(body.bookId || '')) return err(404, 'החבר לא נמצא בספר');
      // החבר מנותק מהספר (וממכשיריו) אבל החשבון נשאר: בכניסה הוא יקבל הסבר, ויוכל להצטרף שוב בקישור חדש
      const sessions = await this.storage.list({ prefix: 'session:' });
      const keys = [...sessions].filter(([, x]) => x.userId === member.id).map(([k]) => k);
      for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
      await this.storage.put(`user:${member.id}`, { ...member, removed: true });
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
        // הצטרפות חוזרת עם גוגל – רק לחשבון שכבר מחובר לאותו חשבון גוגל
        if (user.removed) {
          if (user.google !== String(body.sub)) return err(409, 'האימייל הזה כבר רשום. היכנסו עם הדרך שנרשמתם בה.');
          return this.rejoin(user, body.join, {});
        }
        const join = await this.storage.get(`join:${body.join}`);
        if (join && user.bookId !== join.bookId) return err(409, 'כבר יש חשבון עם האימייל הזה. כדי להצטרף לספר צריך להירשם עם אימייל אחר.');
      }
      if (user) {
        // חשבון שנרשם עם סיסמה לא מתחבר לגוגל אוטומטית: אולי מישהו אחר רשם את האימייל הזה (בלי אימות),
        // ואז כניסה עם גוגל הייתה מכניסה את בעל האימייל האמיתי לחשבון (ולספר) של מי שרשם אותו.
        // מחברים את גוגל רק מתוך החשבון, אחרי כניסה עם הסיסמה (הגדרות ← חיבור גוגל).
        if (!user.google) {
          return err(409, 'יש כבר חשבון עם האימייל הזה שנרשם עם סיסמה. היכנסו עם האימייל והסיסמה, ובהגדרות אפשר לחבר את גוגל.');
        }
        if (user.google !== String(body.sub)) return err(401, 'חשבון הגוגל לא תואם למשתמש');
        return this.signedIn(user);
      }
      const newId = crypto.randomUUID();
      const claim = await this.claim(body, newId);
      if (claim.error) {
        return err(claim.status, claim.missing ? 'אין עדיין משתמש עם החשבון הזה. כדי להירשם צריך קישור הזמנה.' : claim.error);
      }
      return this.createUser(newId, {
        name: String(body.name || '').trim().slice(0, 80) || email.split('@')[0], email, salt: null, hash: null, google: String(body.sub),
      }, claim);
    }

    // חיבור גוגל לחשבון קיים (מתוך החשבון, אחרי כניסה): האימייל בגוגל חייב להיות זהה
    if (path === '/google/link' && request.method === 'POST') {
      const user = await this.storage.get(`user:${body.userId}`);
      if (!user) return err(404, 'המשתמש לא נמצא');
      if (normalizeEmail(body.email) !== user.email) return err(400, 'חשבון הגוגל הוא עם אימייל אחר');
      if (user.google && user.google !== String(body.sub)) return err(409, 'החשבון כבר מחובר לחשבון גוגל אחר');
      user.google = String(body.sub);
      await this.storage.put(`user:${user.id}`, user);
      return json({ user: await this.effectiveUser(user) });
    }

    if (path === '/logout' && request.method === 'POST') {
      await this.storage.delete(`session:${await sha256(String(body.session || ''))}`);
      return json({ ok: true });
    }

    // ---- בעל האפליקציה: מכשיר שנכנס, והגבלת ניסיונות סיסמה (10 ברבע שעה) ----
    if (path === '/owner-session' && request.method === 'POST') {
      await this.rememberDevice('owner', body.device);
      const token = randomToken(32);
      await this.storage.put(`session:${await sha256(token)}`, { owner: true, v: await this.ownerVersion(), createdAt: now });
      return json({ session: token, user: null, owner: true });
    }
    // הגבלת קצב כללית (ניסיונות כניסה, הרשמה...): {checks: [{key, limit, window}]} – כולם חייבים לעבור
    // מכשיר שכבר נכנס בהצלחה לאותו חשבון (body.trust = {scope, device}) לא נחסם בתקרה הכללית (global) –
    // כך זר שמנסה סיסמאות מהרבה כתובות לא יכול לנעול את בעל החשבון
    if (path === '/rate' && request.method === 'POST') {
      const trusted = await this.knownDevice(body.trust?.scope, body.trust?.device);
      for (const c of Array.isArray(body.checks) ? body.checks : []) {
        if (c.global && trusted) continue;
        if (!(await this.allow(String(c.key).slice(0, 200), Number(c.limit) || 10, Number(c.window) || 900))) {
          return err(429, body.message || 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.');
        }
      }
      return json({ ok: true });
    }
    // יציאה מכל המכשירים
    if (path === '/logout-all' && request.method === 'POST') {
      const current = await this.storage.get(`session:${await sha256(String(body.session || ''))}`);
      if (!current) return err(401, 'צריך להיכנס מחדש');
      const sessions = await this.storage.list({ prefix: 'session:' });
      const keys = [...sessions].filter(([, x]) => (current.owner ? x.owner : x.userId === current.userId)).map(([k]) => k);
      for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
      return json({ ok: true, count: keys.length });
    }
    // החלפת סיסמה: צריך את הסיסמה הנוכחית; כל שאר החיבורים של המשתמש מנותקים (החיבור הנוכחי נשאר)
    if (path === '/account/password' && request.method === 'POST') {
      const user = await this.storage.get(`user:${body.userId}`);
      if (!user) return err(404, 'המשתמש לא נמצא');
      const next = String(body.next || '');
      if (next.length < 8 || next.length > 200) return err(400, 'הסיסמה החדשה צריכה להיות לפחות 8 תווים');
      // חשבון גוגל בלי סיסמה יכול להוסיף סיסמה (הוא כבר מחובר דרך גוגל)
      if (user.hash && !(await passwordMatches(user, String(body.current || '')))) return err(401, 'הסיסמה הנוכחית שגויה');
      Object.assign(user, await newPassword(next));
      await this.storage.put(`user:${user.id}`, user);
      const keep = `session:${await sha256(String(body.session || ''))}`;
      const sessions = await this.storage.list({ prefix: 'session:' });
      const keys = [...sessions].filter(([k, x]) => x.userId === user.id && k !== keep).map(([k]) => k);
      for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
      return json({ ok: true, user: publicUser(user, this.freeLimit) });
    }
    // מחיקת חשבון עצמית: חבר בספר משותף – רק הוא; בעל ספר – גם החברים בספר וההזמנה שלו
    if (path === '/account/delete' && request.method === 'POST') {
      const user = await this.storage.get(`user:${body.userId}`);
      if (!user) return err(404, 'המשתמש לא נמצא');
      await this.deleteUser(user.id);
      if (!user.bookId && user.invite) await this.storage.delete(`invite:${user.invite}`);
      return json({ ok: true, deletedBook: !user.bookId });
    }

    // ---- תקלות אחרונות (למסך הניהול) ----
    // תקלות שרת ותקלות מהאפליקציה נשמרות ברשימות נפרדות (כך שדיווחים מבחוץ לא דוחקים תקלות שרת)
    if (path === '/errors/add' && request.method === 'POST') {
      const key = body.list === 'client' ? 'client-errors' : 'errors';
      const list = (await this.storage.get(key)) || [];
      list.unshift({ at: now, where: String(body.where || '').slice(0, 80), message: String(body.message || '').slice(0, 300), status: body.status ?? null, user: String(body.user || '').slice(0, 120) });
      await this.storage.put(key, list.slice(0, 50));
      return json({ ok: true });
    }
    if (path === '/errors' && request.method === 'GET') {
      return json({ errors: (await this.storage.get('errors')) || [], clientErrors: (await this.storage.get('client-errors')) || [] });
    }
    // ספרים (בעלי ספר שנרשמו מהזמנה) – למסך הניהול
    if (path === '/books' && request.method === 'GET') {
      const users = [...(await this.storage.list({ prefix: 'user:' })).values()];
      const holders = users.filter((u) => !u.bookId && !u.removed);
      return json({
        books: holders.map((u) => ({ ...publicUser(u, this.freeLimit), members: users.filter((m) => m.bookId === u.id && !m.removed).length })),
        ownerMembers: users.filter((m) => m.bookId === OWNER_BOOK && !m.removed).length,
      });
    }

    // ---- פנימי: זיהוי משתמש ומכסה ----
    if (path === '/auth' && request.method === 'POST') {
      const key = `session:${await sha256(String(body.session || ''))}`;
      const session = await this.storage.get(key);
      // חיבור פג אחרי 180 יום, וחיבור בעלים – גם כשסיסמת הבעלים הוחלפה
      const expired = session && (Date.now() - Date.parse(session.createdAt) > SESSION_DAYS * 86400000
        || (session.owner && session.v !== (await this.ownerVersion())));
      if (expired) {
        await this.storage.delete(key);
        return err(401, 'צריך להיכנס מחדש');
      }
      if (session?.owner) return json({ user: null, owner: true });
      const stored = session && (await this.storage.get(`user:${session.userId}`));
      const user = stored && (await this.effectiveUser(stored));
      if (!user) return err(401, 'צריך להיכנס מחדש');
      return json({ user });
    }
    // מכסת המתכונים החינמיים נלקחת לפני העבודה (כדי ששתי בקשות במקביל לא יעברו את המכסה),
    // ומוחזרת אם העבודה נכשלה או שלא נוסף מתכון חדש. נספרת אצל בעל הספר.
    if ((path === '/quota/take' || path === '/quota/give') && request.method === 'POST') {
      const member = await this.storage.get(`user:${body.userId}`);
      if (!member) return err(404, 'המשתמש לא נמצא');
      const holder = member.bookId === OWNER_BOOK ? null : member.bookId ? await this.storage.get(`user:${member.bookId}`) : member;
      if (holder) {
        if (path === '/quota/take') {
          if (holder.plan !== 'paid' && holder.added >= this.freeLimit) {
            return err(402, `נגמרו ${this.freeLimit} המתכונים החינמיים`);
          }
          holder.added += 1;
        } else holder.added = Math.max(0, holder.added - 1);
        await this.storage.put(`user:${holder.id}`, holder);
      }
      return json({ user: await this.effectiveUser(await this.storage.get(`user:${member.id}`)) });
    }

    return err(404, 'Not found');
  }

  // הרשמה מקישור הזמנה (ספר חדש) או מקישור הצטרפות (ספר משותף)
  // בדיקה בלבד (בלי לתפוס): האם הקישור בבקשה תקף. מחזיר שגיאה או null
  async peekClaim(body) {
    if (body.join) {
      const join = await this.validJoin(body.join);
      return join.error ? join : null;
    }
    const invite = body.token && (await this.storage.get(`invite:${body.token}`));
    if (!invite || inviteExpired(invite)) return { status: 404, error: 'קישור ההזמנה לא תקף' };
    if (invite.userId) return { status: 409, error: 'כבר נרשמו עם הקישור הזה. אפשר להיכנס עם החשבון שנרשמתם בו.' };
    return null;
  }

  // הרשמה מקישור הזמנה (ספר חדש) או מקישור הצטרפות (ספר משותף).
  // הקישור "נתפס" מיד (באותו צעד של הבדיקה), כדי ששתי הרשמות במקביל לא ינצלו אותו פעמיים
  async claim(body, userId) {
    if (body.join) {
      const join = await this.validJoin(body.join);
      if (join.error) return join;
      await this.storage.put(`join:${join.join.token}`, { ...join.join, usedBy: userId });
      return { join: join.join };
    }
    const invite = body.token && (await this.storage.get(`invite:${body.token}`));
    if (!invite || inviteExpired(invite)) return { status: 404, error: 'קישור ההזמנה לא תקף', missing: !body.token };
    if (invite.userId) return { status: 409, error: 'כבר נרשמו עם הקישור הזה. אפשר להיכנס עם החשבון שנרשמתם בו.' };
    await this.storage.put(`invite:${invite.token}`, { ...invite, userId });
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
      bookName = holder.name;
    }
    if ((await this.membersOf(join.bookId)).length + 1 >= MAX_MEMBERS) return { status: 400, error: `בספר הזה כבר ${MAX_MEMBERS} אנשים` };
    return { join, bookName };
  }

  async createUser(id, fields, { invite, join }) {
    const user = {
      id, ...fields, plan: 'free', added: 0, createdAt: new Date().toISOString(),
      invite: invite?.token || null, ...(join ? { bookId: join.bookId } : {}),
    };
    const puts = { [`user:${user.id}`]: user, [`email:${user.email}`]: user.id };
    if (invite) puts[`invite:${invite.token}`] = { ...invite, userId: user.id };
    if (join) puts[`join:${join.token}`] = { ...join, usedBy: user.id };
    await this.storage.put(puts);
    return this.signedIn(user);
  }

  // מי שהוסר מספר משותף מצטרף שוב (לאותו ספר או לספר אחר) עם קישור הצטרפות חדש
  async rejoin(user, token, fields) {
    const join = await this.validJoin(token);
    if (join.error) return err(join.status, join.error);
    const { removed, ...rest } = user;
    const next = { ...rest, ...fields, bookId: join.join.bookId };
    await this.storage.put({ [`user:${user.id}`]: next, [`join:${join.join.token}`]: { ...join.join, usedBy: user.id } });
    return this.signedIn(next);
  }

  async signedIn(user) {
    if (user.removed) return err(403, 'הוסרתם מהספר המשותף. כדי לחזור, בקשו מבעל הספר קישור הצטרפות חדש.');
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
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128)); // מגבלת Cloudflare: 128 מפתחות בפעם
  }
}

// האם המשתמש יכול להוסיף עוד מתכון (בעל האפליקציה תמיד יכול)
export const canAdd = (user) => !user || user.plan === 'paid' || user.added < user.freeLimit;

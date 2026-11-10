// הרשמה וכניסה: הזמנות, סיסמה, בעל האפליקציה וחשבון גוגל.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { openSignupAllowed, internal, verifyGoogle, sameSecret, bearer } from '../lib/http.js';

// הרשמה, כניסה ויציאה עם אימייל וסיסמה (עם הגבלת קצב)
export async function handleSignup(ctx) {
  const { request, env, fail, pass, parts, accounts, readJson, ip, country, rate } = ctx;
  // ---- הרשמה וכניסה (בלי זיהוי) ----
  if (request.method === 'POST' && ['invite', 'join', 'register', 'login', 'logout', 'logout-all'].includes(parts[0]) && parts.length === 1) {
    const { body, error } = await readJson();
    if (error) return error;
    if (parts[0] === 'logout' || parts[0] === 'logout-all') body.session = bearer(request);
    if (parts[0] === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      body.country = country;
      const limited = await rate([
        { key: `login-ip:${ip}`, limit: 30, window: 900 },
        { key: `login:${email}:${ip}`, limit: 10, window: 900 },
        { key: `login-all:${email}`, limit: 100, window: 3600, global: true },
      ], 'יותר מדי ניסיונות כניסה. נסו שוב בעוד רבע שעה.', { scope: `e:${email}`, device: body.device });
      if (limited) return limited;
    }
    if (['register', 'invite', 'join'].includes(parts[0])) {
      const limited = await rate([{ key: `signup-ip:${ip}`, limit: 30, window: 3600 }]);
      if (limited) return limited;
    }
    // הרשמה בלי קישור הזמנה: רק כשמותר, ועם מגבלה נוספת לכל כתובת
    const openSignup = parts[0] === 'register' && body.open === true && !body.token && !body.join;
    delete body.open;
    if (openSignup) {
      if (!openSignupAllowed(request, env)) return fail(403, 'כדי להירשם צריך קישור הזמנה');
      // הרשמה פתוחה עם אימייל וסיסמה – בלי אימות שהאימייל אמיתי, וכל סקריפט יכול לזייף שהוא "האפליקציה".
      // לכן הרשמה חדשה בלי הזמנה רק עם חשבון גוגל (אימייל מאומת), אלא אם הותר במפורש
      if (env.OPEN_SIGNUP_PASSWORD !== 'true') return fail(403, 'הרשמה חדשה – עם חשבון גוגל (הכפתור למעלה)');
      const limited = await rate([{ key: `open-ip:${ip}`, limit: 5, window: 3600 }], 'יותר מדי הרשמות. נסו שוב מאוחר יותר.');
      if (limited) return limited;
      body.open = true;
    }
    // הצטרפות חוזרת עם סיסמה היא ניסיון סיסמה – אותן מגבלות כמו בכניסה
    if (parts[0] === 'register' && body.join) {
      const email = String(body.email || '').trim().toLowerCase();
      const limited = await rate([
        { key: `login:${email}:${ip}`, limit: 10, window: 900 },
        { key: `login-all:${email}`, limit: 100, window: 3600 },
      ], 'יותר מדי ניסיונות כניסה. נסו שוב בעוד רבע שעה.');
      if (limited) return limited;
    }
    const path = { invite: '/invite/check', join: '/join/check' }[parts[0]] || `/${parts[0]}`;
    return pass(await internal(accounts, 'POST', path, body));
  }
  return null;
}

// הגדרות הכניסה לאפליקציה, כניסת בעלים, וכניסה/הרשמה עם גוגל
export async function handleOwnerAndGoogle(ctx) {
  const { request, env, reply, fail, pass, url, accounts, readJson, ip, country, rate, googleClientId, ownerPassword, ownerEmail, ownerLocked } = ctx;
  if (url.pathname === '/auth-config' && request.method === 'GET') {
    return reply(200, {
      googleClientId, ownerLocked, ownerPassword: Boolean(ownerPassword),
      openSignup: openSignupAllowed(request, env), freeLimit: Number(env.FREE_RECIPES ?? 10),
    });
  }
  if (url.pathname === '/owner-login' && request.method === 'POST') {
    if (!ownerPassword) return fail(400, 'כניסת בעלים לא מוגדרת');
    const { body, error } = await readJson();
    if (error) return error;
    // כל ניסיון נספר מראש (גם ניסיונות במקביל), לפי כתובת – וגם תקרה כללית נגד ניחוש מפוזר
    const limited = await rate([
      { key: `owner-ip:${ip}`, limit: 10, window: 900 },
      { key: 'owner-all', limit: 300, window: 900, global: true },
    ], 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.', { scope: 'owner', device: body.device });
    if (limited) return limited;
    if (!(await sameSecret(String(body.password || ''), ownerPassword))) {
      await internal(accounts, 'POST', '/admin/security/event', { type: 'ownerFail', detail: country });
      return fail(401, 'הסיסמה שגויה');
    }
    return pass(await internal(accounts, 'POST', '/owner-session', { device: body.device, country }));
  }

  // ---- כניסה והרשמה עם חשבון גוגל ----
  if (url.pathname === '/google' && request.method === 'POST') {
    if (!googleClientId) return fail(400, 'כניסה עם גוגל לא מוגדרת');
    const { body, error } = await readJson();
    if (error) return error;
    const limited = await rate([{ key: `google-ip:${ip}`, limit: 30, window: 900 }]);
    if (limited) return limited;
    const profile = await verifyGoogle(String(body.credential || ''), googleClientId);
    if (!profile) return fail(401, 'לא הצלחתי לאמת את חשבון הגוגל. נסו שוב.');
    // מתוך חשבון מחובר: חיבור גוגל לחשבון הקיים (ולא כניסה)
    if (body.link) {
      const auth = await internal(accounts, 'POST', '/auth', { session: bearer(request) });
      const me = auth.ok ? (await auth.json()).user : null;
      if (!me) return fail(401, 'צריך להיכנס מחדש');
      return pass(await internal(accounts, 'POST', '/google/link', { userId: me.id, ...profile }));
    }
    if (ownerEmail && profile.email.toLowerCase() === ownerEmail) return pass(await internal(accounts, 'POST', '/owner-session', { country }));
    // הרשמה בלי קישור הזמנה עם גוגל (רק כשמותר; משתמש קיים פשוט נכנס)
    const open = body.open === true && !body.token && !body.join && openSignupAllowed(request, env);
    return pass(await internal(accounts, 'POST', '/google', { ...profile, token: body.token || '', join: body.join || '', open }));
  }
  return null;
}

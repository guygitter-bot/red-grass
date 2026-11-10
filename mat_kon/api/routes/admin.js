// אפליקציית הניהול (רק לבעל האפליקציה): סקירה, עלויות, תקלות, אבטחה, תוכן והגדרות.
// כל פונקציה מקבלת את ההקשר של הבקשה (ctx – ראו context.js) ומחזירה תשובה, או null כשהבקשה לא שלה.
import { backupStatus } from '../backup.js';
import { cleanShots, fixAction, fixConfigured, fixStatus, getShot, saveShots, sendFix } from '../fixes.js';
import { MAX_SMALL_BYTES, MAX_PHOTO_BYTES, internal } from '../lib/http.js';

// כל הכתובות שמתחילות ב-/admin
export async function handleAdmin(ctx) {
  const { request, env, cors, reply, fail, pass, url, parts, accounts, bookOf, readJson, user, month } = ctx;
  // ---- ניהול: עלויות ותקלות (רק בעל האפליקציה) ----
  if (parts[0] === 'admin') {
    if (user) return fail(403, 'רק לבעל האפליקציה');
    // עלויות AI לחודש, לכל ספר
    const price = { in: Number(env.AI_PRICE_IN || 5), out: Number(env.AI_PRICE_OUT || 25), search: Number(env.AI_PRICE_SEARCH || 0.01) };
    const usage = async (m) => {
      const { books, ownerMembers } = await (await internal(accounts, 'GET', '/books')).json();
      const withCost = async (row, stub) => {
        const c = await (await internal(stub, 'GET', `/costs/${m}`)).json();
        const usd = (c.input * price.in + c.output * price.out) / 1e6 + c.searches * price.search;
        return { ...row, ...c, usd: Math.round(usd * 100) / 100 };
      };
      return Promise.all([
        withCost({ id: 'owner', name: 'הספר שלי', plan: 'owner', members: ownerMembers }, bookOf(null)),
        ...books.map((b) => withCost({ id: b.id, name: b.name, email: b.email, plan: b.plan, added: b.added, members: b.members }, bookOf(b.id))),
      ]);
    };
    if (url.pathname === '/admin/usage' && request.method === 'GET') {
      const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : month();
      return reply(200, { month: m, price, rows: await usage(m) });
    }
    // ---- אפליקציית הניהול: סקירה אחת של הכול ----
    if (url.pathname === '/admin/overview' && request.method === 'GET') {
      const now = new Date();
      const months = [0, 1, 2].map((i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
      const [stats, costs, community, backups, issues, settings, reports, talk] = await Promise.all([
        internal(accounts, 'GET', '/admin/stats').then((r) => r.json()),
        Promise.all(months.map(async (m) => {
          const rows = await usage(m);
          const usd = Math.round(rows.reduce((n, r) => n + r.usd, 0) * 100) / 100;
          // לפי סוג פעולה, מכל הספרים: כמה פעמים, כמה עלה בסך הכול, ובממוצע לפעולה
          const kinds = {};
          for (const r of rows) {
            for (const [k, v] of Object.entries(r.byKind || {})) {
              const t = kinds[k] || (kinds[k] = { kind: k, ops: 0, usd: 0, searches: 0 });
              t.ops += v.ops;
              t.searches += v.searches;
              t.usd += (v.input * price.in + v.output * price.out) / 1e6 + v.searches * price.search;
            }
          }
          const byKind = Object.values(kinds).map((t) => ({ ...t, usd: Math.round(t.usd * 100) / 100, avg: t.ops ? Math.round((t.usd / t.ops) * 1000) / 1000 : null })).sort((a, b) => b.usd - a.usd);
          return { month: m, usd, byKind, top: rows.filter((r) => r.usd > 0).sort((a, b) => b.usd - a.usd).slice(0, 5).map((r) => ({ name: r.name, email: r.email, usd: r.usd })) };
        })),
        internal(env.BOOK.get(env.BOOK.idFromName('community')), 'POST', '/community/stats', {}).then((r) => r.json()),
        backupStatus(env).catch(() => null),
        internal(accounts, 'GET', '/admin/issues').then((r) => r.json()),
        internal(accounts, 'GET', '/admin/settings').then((r) => r.json()),
        internal(env.BOOK.get(env.BOOK.idFromName('community')), 'POST', '/community/reports', {}).then((r) => r.json()),
        internal(env.BOOK.get(env.BOOK.idFromName('community')), 'POST', '/community/talk/flagged', {}).then((r) => r.json()),
      ]);
      const open = issues.issues.filter((i) => i.status !== 'fixed');
      const alerts = [];
      const today = await (await internal(accounts, 'POST', '/spend/check', {})).json();
      const speed = await (await internal(accounts, 'GET', '/metrics')).json();
      if (today.stopped) alerts.push({ level: 'serious', text: `ה-AI נעצר למשתמשים להיום: ההוצאה ($${today.usd.toFixed(2)}) הגיעה לתקרה היומית ($${today.cap}). אפשר להעלות אותה במסך "כסף".` });
      const spend = settings.settings.spendAlert;
      if (spend && costs[0].usd >= spend) alerts.push({ level: 'serious', text: `ההוצאה על AI החודש ($${costs[0].usd}) עברה את הסף שקבעת ($${spend})` });
      if (open.some((i) => i.status === 'new')) alerts.push({ level: 'warning', text: `${open.filter((i) => i.status === 'new').length} תקלות חדשות שעוד לא טופלו` });
      const hidden = reports.items.filter((r) => r.hidden).length;
      if (talk.items.length) alerts.push({ level: talk.items.some((t) => t.hidden) ? 'serious' : 'warning', text: `${talk.items.length} תגובות בקהילה מחכות לבדיקה שלך` });
      if (reports.items.length) alerts.push({ level: hidden ? 'serious' : 'warning', text: `${reports.items.length} מתכונים בקהילה מחכים לבדיקה שלך${hidden ? ` (${hidden} מוסתרים אחרי דיווחים)` : ''}` });
              if (stats.today >= 50) alerts.push({ level: 'warning', text: `${stats.today} הרשמות היום – הרבה יותר מהרגיל` });
      const lastBackup = backups?.days?.at(-1);
      if (backups?.enabled && (!lastBackup || Date.now() - Date.parse(`${lastBackup}T00:00:00Z`) > 2 * 86400000)) alerts.push({ level: 'serious', text: 'הגיבוי הלילי לא רץ ביומיים האחרונים' });
      return reply(200, {
        stats, costs, community, backups: backups?.enabled ? { last: lastBackup || null, count: backups.days.length, ok: Boolean(backups.last) } : null,
        issues: { open: open.length, new: open.filter((i) => i.status === 'new').length, fixed: issues.issues.length - open.length },
        settings: settings.settings, spendToday: { usd: Math.round(today.usd * 100) / 100, cap: today.cap }, speed, alerts, reports: { pending: reports.items.length + talk.items.length, hidden },
      });
    }
    if (url.pathname === '/admin/issues' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/issues'));
    if (parts[1] === 'issues' && parts.length === 3 && request.method === 'POST') {
      const { body, error } = await readJson();
      if (error) return error;
      return pass(await internal(accounts, 'POST', '/admin/issues/update', { sig: parts[2], status: body.status, note: body.note }));
    }
    // "שלח ל-Claude לטיפול": התקלה נפתחת ב-GitHub (בלי פרטי משתמשים) ו-Claude מכין תיקון לאישור
    if (parts[1] === 'issues' && parts.length === 4 && parts[3] === 'fix' && request.method === 'POST') {
      if (!fixConfigured(env)) return fail(503, 'השליחה ל-Claude לא מוגדרת בשרת');
      const { body, error } = await readJson(MAX_PHOTO_BYTES);
      if (error) return error;
      const shots = cleanShots(body.images);
      if (shots.length && !env.BACKUPS) return fail(503, 'שמירת צילומי מסך לא מוגדרת בשרת');
      const { issues } = await (await internal(accounts, 'GET', '/admin/issues')).json();
      const issue = issues.find((i) => i.sig === parts[2]);
      if (!issue) return fail(404, 'התקלה לא נמצאה');
      if (issue.fix) {
        const current = await fixStatus(env, issue.fix).catch(() => null);
        if (current && !['done', 'rejected', 'closed'].includes(current.status)) return fail(409, 'Claude כבר מטפל בתקלה הזו');
      }
      let number;
      try {
        number = await sendFix(env, issue, typeof body.note === 'string' ? body.note : '', await saveShots(env, shots));
      } catch (e) {
        return fail(502, `לא הצלחתי לשלוח ל-Claude (${e.message})`);
      }
      return pass(await internal(accounts, 'POST', '/admin/issues/update', { sig: issue.sig, status: 'working', fix: number }));
    }
    // צילום מסך שצורף לבקשה ל-Claude (רק לבעלים – התהליך ב-GitHub נכנס עם סיסמת הבעלים)
    if (parts[1] === 'fix-shot' && parts.length === 3 && request.method === 'GET') {
      const obj = await getShot(env, parts[2]);
      if (!obj) return fail(404, 'הצילום לא נמצא');
      return new Response(await obj.arrayBuffer(), { headers: { ...cors, 'content-type': 'image/jpeg', 'cache-control': 'private, no-store' } });
    }
    if (parts[1] === 'fix' && /^\d+$/.test(parts[2] || '') && fixConfigured(env)) {
      const number = Number(parts[2]);
      // רק בקשות ששלחנו מתקלה (לא כל issue במאגר)
      const { issues } = await (await internal(accounts, 'GET', '/admin/issues')).json();
      const issue = issues.find((i) => i.fix === number);
      if (!issue) return fail(404, 'הבקשה לא נמצאה');
      try {
        if (parts.length === 3 && request.method === 'GET') return reply(200, await fixStatus(env, number));
        const action = parts.length === 4 && request.method === 'POST' && ['approve', 'reject', 'retry', 'reply'].includes(parts[3]) ? parts[3] : '';
        if (!action) return fail(404, 'Not found');
        const { body, error } = await readJson(action === 'reply' ? MAX_PHOTO_BYTES : MAX_SMALL_BYTES);
        if (error) return error;
        const shots = action === 'reply' ? cleanShots(body.images) : [];
        if (shots.length && !env.BACKUPS) return fail(503, 'שמירת צילומי מסך לא מוגדרת בשרת');
        const out = await fixAction(env, number, action, body.text, await saveShots(env, shots));
        if (out.status === 200 && action === 'approve') await internal(accounts, 'POST', '/admin/issues/update', { sig: issue.sig, status: 'fixed' });
        if (out.status === 200 && action === 'reject') await internal(accounts, 'POST', '/admin/issues/update', { sig: issue.sig, status: 'new', fix: null });
        return reply(out.status, out.data);
      } catch (e) {
        return fail(502, `שגיאה מול GitHub (${e.message})`);
      }
    }
    if (url.pathname === '/admin/security' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/security'));
    // תכונות למשתמש מסוים (ניקוד ביס בדף המתכון)
    if (url.pathname === '/admin/features' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/users/features'));
    if (url.pathname === '/admin/features' && request.method === 'POST') {
      const { body, error } = await readJson();
      if (error) return error;
      return pass(await internal(accounts, 'POST', '/users/feature', { email: String(body.email || '').slice(0, 200), feature: body.feature, on: Boolean(body.on) }));
    }
    // התראות לטלפון של בעל האפליקציה
    if (parts[1] === 'push' && parts.length === 3) {
      if (parts[2] === 'key' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/push/key'));
      if (parts[2] === 'status' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/admin/push/status'));
      if (parts[2] === 'test' && request.method === 'POST') return pass(await internal(accounts, 'POST', '/admin/push/test', {}));
      if (parts[2] === 'subscribe' && request.method === 'POST') {
        const { body, error } = await readJson();
        if (error) return error;
        return pass(await internal(accounts, 'POST', '/admin/push/subscribe', { subscription: body.subscription }));
      }
    }
    // דיווחים ומתכונים שבדיקת ה-AI לא הייתה בטוחה לגביהם: אישור / הסרה / חסימת המפרסם
    const community = env.BOOK.get(env.BOOK.idFromName('community'));
    if (url.pathname === '/admin/reports' && request.method === 'GET') return pass(await internal(community, 'POST', '/community/reports', {}));
    if (parts[1] === 'reports' && parts.length === 3 && request.method === 'POST') {
      const { body, error } = await readJson();
      if (error) return error;
      if (body.action === 'view') return pass(await internal(community, 'POST', '/community/get', { key: parts[2], admin: true }));
      const res = await internal(community, 'POST', '/community/moderate', { key: parts[2], action: body.action === 'approve' ? 'approve' : 'remove' });
      const data = await res.json();
      if (res.ok && body.action === 'block' && data.authorId && data.authorId !== 'owner') {
        await internal(accounts, 'POST', '/admin/block', { userId: data.authorId });
        await internal(community, 'POST', '/community/remove-author', { authorId: data.authorId });
      }
      return reply(res.status, data);
    }
    // תגובות בקהילה שדווחו / שה-AI לא היה בטוח לגביהן
    if (url.pathname === '/admin/talk' && request.method === 'GET') return pass(await internal(community, 'POST', '/community/talk/flagged', {}));
    if (parts[1] === 'talk' && parts.length === 4 && request.method === 'POST') {
      const { body, error } = await readJson();
      if (error) return error;
      const res = await internal(community, 'POST', '/community/talk/moderate', { key: parts[2], id: parts[3], action: body.action === 'approve' ? 'approve' : 'remove' });
      const data = await res.json();
      if (res.ok && body.action === 'block' && data.authorId && data.authorId !== 'owner') {
        await internal(accounts, 'POST', '/admin/block', { userId: data.authorId });
        await internal(community, 'POST', '/community/remove-author', { authorId: data.authorId });
      }
      return reply(res.status, data);
    }
    if (url.pathname === '/admin/settings' && request.method === 'PUT') {
      const { body, error } = await readJson();
      if (error) return error;
      return pass(await internal(accounts, 'POST', '/admin/settings', Object.fromEntries(['spendAlert', 'spendStop', 'testStart'].filter((k) => k in body).map((k) => [k, body[k]]))));
    }
    if (url.pathname === '/admin/errors' && request.method === 'GET') return pass(await internal(accounts, 'GET', '/errors'));
    return fail(404, 'Not found');
  }
  return null;
}

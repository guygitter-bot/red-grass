// השרת של mat-kon (Cloudflare Worker): מחזיק את מפתח ה-API של Anthropic ואת ספרי המתכונים.
// האפליקציה שולחת קישור, השרת קורא אותו (גם סרטונים), הסוכן מסדר מתכון בעברית עם קטגוריה,
// והמתכון נשמר בספר.
//
// שני סוגי שימוש:
//   - בעל האפליקציה: פתוח, בלי הרשמה ובלי הגבלה. ספר המתכונים "book" וניהול ההזמנות.
//   - משתמש שהוזמן (Authorization: Bearer <session>): נרשם מקישור הזמנה, מקבל ספר ריק משלו
//     (user:<id>), ו-FREE_RECIPES מתכונים בחינם. אחר כך צריך מנוי (plan=paid).
//
// מבנה הקוד:
//   worker.js        – נקודת הכניסה: הזיהוי, וסדר הבדיקה של הכתובות
//   context.js       – ההקשר של בקשה (תשובות, הגבלת קצב, המשתמש, תקציב AI)
//   routes/*.js      – הכתובות לפי תחום (מתכונים, קהילה, רשימות, ניהול…)
//   lib/*.js         – כלים משותפים: CORS וזיהוי (http.js), בדיקת קלט (recipe-input.js)
//   store.js / accounts.js – ה-Durable Objects (הספרים והחשבונות)
import { deps } from './deps.js';
import { RecipeBook } from './store.js';
import { Accounts } from './accounts.js';
import { runBackup } from './backup.js';
import { pruneShots } from './fixes.js';
import { bearer, corsHeaders, internal } from './lib/http.js';
import { createContext, withUser } from './context.js';
import { handleSignup, handleOwnerAndGoogle } from './routes/auth.js';
import { handleImages, handleSharePreview } from './routes/public.js';
import { handleTelemetry } from './routes/telemetry.js';
import { handleMeAndCategories } from './routes/categories.js';
import { handleSearch } from './routes/search.js';
import { handleCommunity } from './routes/community.js';
import { handleShares } from './routes/shares.js';
import { handleAccount } from './routes/account.js';
import { handleOwnerTools } from './routes/owner.js';
import { handleLists } from './routes/lists.js';
import { handleAdmin } from './routes/admin.js';
import { handleRecipes } from './routes/recipes.js';

export { RecipeBook, Accounts };

// נקודות הזרקה לבדיקות
export { deps };

// הכתובות שפתוחות לפני הזיהוי (הרשמה, תמונות, תצוגה מקדימה של שיתוף, כניסת בעלים / גוגל), לפי הסדר
const PUBLIC_ROUTES = [handleSignup, handleImages, handleSharePreview, handleOwnerAndGoogle];
// הכתובות אחרי הזיהוי, לפי הסדר. הספר (handleRecipes) אחרון: מה שלא נמצא בו מחזיר 404
const PRIVATE_ROUTES = [handleTelemetry, handleMeAndCategories, handleSearch, handleCommunity, handleShares, handleAccount, handleOwnerTools, handleLists, handleAdmin, handleRecipes];

// מריץ את הכתובות לפי הסדר עד שאחת מהן מחזירה תשובה
async function route(handlers, ctx) {
  for (const handle of handlers) {
    const res = await handle(ctx);
    if (res) return res;
  }
  return null;
}

export default {
  // גיבוי לילי ל-R2 (ראו backup.js ו-[triggers] ב-wrangler.toml). תקלה נרשמת במסך "עלויות ותקלות"
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pruneShots(env).catch((e) => console.error('fix shots', e)));
    ctx.waitUntil(runBackup(env).catch((e) => {
      console.error('backup', e);
      return internal(env.ACCOUNTS.get(env.ACCOUNTS.idFromName('accounts')), 'POST', '/errors/add', { where: 'backup', message: String(e?.message || e).slice(0, 300), user: 'owner' }).catch(() => {});
    }));
  },

  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.ANTHROPIC_API_KEY || !env.BOOK || !env.ACCOUNTS) {
      return new Response(JSON.stringify({ error: 'השרת לא מוגדר' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } });
    }
    const ctx = createContext(request, env);
    const { accounts, fail, pass, ownerLocked } = ctx;

    const open = await route(PUBLIC_ROUTES, ctx);
    if (open) return open;

    // ---- מי שולח: בעל האפליקציה (בלי טוקן, או טוקן של בעלים) או משתמש שהוזמן ----
    let user = null;
    let signedIn = false;
    const session = bearer(request);
    if (session) {
      const res = await internal(accounts, 'POST', '/auth', { session });
      if (!res.ok) return pass(res);
      user = (await res.json()).user;
      signedIn = true;
    }
    withUser(ctx, { user, signedIn, session });

    // ספר נעול: בלי כניסה אין גישה לספר של בעל האפליקציה
    if (ownerLocked && !signedIn) return fail(401, 'צריך להיכנס', { login: true });

    return route(PRIVATE_ROUTES, ctx);
  },
};

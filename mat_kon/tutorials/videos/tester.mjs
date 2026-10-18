// מדריך למי שקיבלו את קישור הבדיקה הסגורה של Google Play: להפוך לבודק, להתקין, ולהירשם באפליקציה.
// דפי Google Play הם דמויות פשוטות להמחשה בלבד (אי אפשר לטעון את הדפים האמיתיים בהקלטה).
import { record, mockApi } from '../kit.mjs';

const API = 'https://mat-kon-api.guygitter.workers.dev';

// שורת כתובת של דפדפן, משותפת לדפי ההדגמה
const BAR = (url) => `<div class="bar"><span class="lock">🔒</span><span dir="ltr">${url}</span></div>`;
const BASE_CSS = `
*{box-sizing:border-box}body{margin:0;font-family:Roboto,Rubik,Arial,sans-serif;background:#fff;color:#202124}
.bar{background:#f1f3f4;padding:10px 14px;font-size:14px;color:#3c4043;display:flex;gap:8px;align-items:center;border-bottom:1px solid #dadce0}
.bar span[dir]{background:#fff;border-radius:99px;padding:6px 14px;flex:1}
.hdr{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #eee;font-size:20px;color:#5f6368}
.hdr b{color:#202124;font-weight:500}
.app{display:flex;gap:14px;align-items:center;padding:20px 18px}
.app img{width:64px;height:64px;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.app h2{margin:0;font-size:18px;font-weight:500;line-height:1.3}
.btn{display:block;width:calc(100% - 36px);margin:14px 18px;padding:14px;border-radius:8px;border:0;font-size:17px;font-weight:500;cursor:pointer}
`;
const page = (url, body, extra = '', dir = 'ltr') => `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_CSS}${extra}</style></head><body>${BAR(url)}${body}</body></html>`;

const HDR = '<div class="hdr">▶ <b>Google Play</b></div>';
const APP_EN = '<div class="app"><img src="/icon.svg" alt=""><div><h2 dir="rtl">mat-kon – ספר המתכונים שלי</h2><div style="color:#5f6368;font-size:14px;margin-top:2px">Closed testing</div></div></div>';

const OPTIN = page('play.google.com/apps/testing/app.matkon', `${HDR}${APP_EN}
<div style="padding:0 18px;line-height:1.6;font-size:16px;color:#3c4043">
<p style="margin-top:0">You've been invited to test this app. Become a tester to get early access and help improve it before it's released to everyone.</p>
<p>As a tester you'll be able to install the app from Google Play and send feedback to the developer.</p></div>
<button class="btn" id="join" style="background:#1a73e8;color:#fff;margin-top:26px;padding:16px;font-size:18px" onclick="location.href='/mock/joined.html'">Become a tester</button>`);

const JOINED = page('play.google.com/apps/testing/app.matkon', `${HDR}${APP_EN}
<div style="margin:6px 18px 18px"><span style="display:inline-block;background:#e6f4ea;color:#137333;padding:8px 14px;border-radius:99px;font-weight:500">✔ You are a tester.</span></div>
<p style="padding:0 18px;line-height:1.7;font-size:16px;color:#3c4043;margin:0">If you don't have the app installed, <a id="dl" href="/mock/store.html" style="color:#1a73e8;text-decoration:none">download it on Google Play</a>.</p>
<p style="padding:0 18px;margin:36px 0 0;font-size:13px;color:#5f6368">You can stop testing at any time.</p>
<button class="btn" style="background:#fff;color:#1a73e8;border:1px solid #dadce0;margin-top:8px;width:auto;padding:10px 22px">Leave the program</button>`);

const STORE = page('play.google.com/store/apps/details?id=app.matkon', `
<div style="padding:16px 18px;color:#5f6368;display:flex;justify-content:space-between;font-size:18px"><span>←</span><span>🔍 ⋮</span></div>
<div class="app" style="padding-top:6px"><img src="/icon.svg" alt=""><div><h2>mat-kon – ספר המתכונים שלי</h2><div style="color:#01875f;font-size:14px;margin-top:4px">mat-kon</div><div style="color:#5f6368;font-size:13px;margin-top:2px">גישה מוקדמת (בטא)</div></div></div>
<button class="btn" id="install" style="background:#01875f;color:#fff;margin-top:18px">התקנה</button>
<div style="padding:8px 18px;color:#5f6368;font-size:14px;line-height:1.6">ספר מתכונים אישי: שומרים מתכונים מקישורים, מתמונות ומוואטסאפ, ומסדרים הכול במקום אחד.</div>
<script>
const b=document.getElementById('install');
b.onclick=()=>{b.textContent='מתקין…';b.style.background='#80c3af';setTimeout(()=>{b.textContent='פתיחה';b.style.background='#01875f';b.dataset.done='1'},2200)};
</script>`, '', 'rtl');

await record('tester', async ({ page: pg, say, tap, type, wait, card, uncard, hideDot, point }) => {
  // דפי ההדגמה מוגשים מאותו שרת כמו האפליקציה
  const pages = { optin: OPTIN, joined: JOINED, store: STORE };
  await pg.route('**/mock/*.html', (r) => {
    const name = new URL(r.request().url()).pathname.split('/').pop().replace('.html', '');
    return r.fulfill({ body: pages[name], contentType: 'text/html; charset=utf-8' });
  });
  // התחברות/הרשמה מדומות: המשתמש עוד לא מחובר
  await pg.route(`${API}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const h = { 'access-control-allow-origin': '*' };
    const user = { name: 'דנה', email: 'dana@example.com', plan: 'free', added: 0, freeLimit: 30 };
    if (p === '/auth-config') return route.fulfill({ json: { googleClientId: 'demo.apps.googleusercontent.com', openSignup: true, freeLimit: 30, ownerLocked: false }, headers: h });
    if (p === '/register') return route.fulfill({ json: { session: 'demo-session', user }, headers: h });
    if (p === '/me') return route.fulfill({ json: { user, categories: [], paymentUrl: '' }, headers: h });
    return route.fallback();
  });
  const origin = new URL(pg.url()).origin;

  await card('📲', 'מדריך', 'איך מצטרפים לבדיקה', 'מהקישור ועד ההרשמה – בדקה', 3000);
  await pg.goto(`${origin}/mock/optin.html`);
  await pg.waitForLoadState('load');
  await uncard();
  await say('פותחים בטלפון את הקישור שקיבלתם, כשאתם מחוברים לאותו ג׳ימייל ששלחתם לי', 4200);
  await say('לוחצים על <b>הכפתור הכחול הגדול</b> – להפוך לבודק', 2500);
  await tap(pg.locator('#join'), { after: 1500 });
  await say('מעולה, אתם בפנים! עכשיו לוחצים על <b>הקישור הכחול</b> להורדה מגוגל פליי', 4200);
  await tap(pg.locator('#dl'), { after: 1500 });
  await say('בחנות לוחצים <b>התקנה</b>', 1800);
  await tap(pg.locator('#install'), { after: 500 });
  await hideDot();
  await pg.locator('#install[data-done]').waitFor();
  await say('כשההתקנה מסתיימת לוחצים <b>פתיחה</b>', 2400);
  await tap(pg.locator('#install'), { after: 300 });
  await hideDot();

  await pg.goto(`${origin}/`);
  await pg.waitForLoadState('networkidle').catch(() => {});
  await wait(800);
  await say('באפליקציה לוחצים <b>אין לכם חשבון? הרשמה</b>', 2400, true);
  await tap(pg.getByRole('button', { name: /אין לכם חשבון/ }), { after: 900 });
  await say('הכי פשוט: לוחצים <b>הרשמה עם Google</b> ובוחרים את החשבון שלכם', 1200, true);
  await point(pg.getByRole('button', { name: /Google/ }), 2600);
  await hideDot();
  await say('או כותבים שם, אימייל וסיסמה של לפחות 8 תווים', 3200, true);
  await type(pg.locator('input[autocomplete="name"]'), 'דנה');
  await type(pg.locator('input[type="email"]'), 'dana@example.com');
  await type(pg.locator('input[type="password"]'), 'mypassword1');
  await say('ולוחצים <b>הרשמה</b>', 1500, true);
  await tap(pg.getByRole('button', { name: 'הרשמה', exact: true }), { after: 1500 });
  await hideDot();
  await say('וזהו, נכנסתם לספר המתכונים שלכם', 2800);
  await unsayIfNeeded();
  await card('💡', 'זהו!', 'חשוב להישאר בבדיקה 14 יום', 'ולפתוח את האפליקציה מדי פעם. תודה!', 4500);

  async function unsayIfNeeded() { await pg.evaluate(() => window.__tut.say('')); }
}, {
  start: '',
  storage: { matkon_guest: true },
  mock: { recipes: [] },
  init: "window.androidBridge = { postMessage() {} }; window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} };",
});

// השרת של "סרטון נדל"ן" (Cloudflare Worker + Durable Object קטן לסיסמה ולתקרה היומית; התמונות והסרטונים נשמרים רק במכשיר):
//   GET  /health                                   -> { ok, director, google, hasPassword }
//   POST /login       { password }                 -> { ok, created? }  (הכניסה הראשונה קובעת את הסיסמה)
//   POST /plan        { brief, photo?, plan? }     -> { summary, shots: [{ title, why, source, still, motion }] }   (Claude)
//   POST /still       { image, instruction, brief, source } -> { image: {media_type, data}, model }                  (Google)
//   POST /clip        { image, motion, aspect, quality }    -> { op }   (מתחיל עבודה ברקע; op = מזהה העבודה)        (Google Omni)
//   POST /clip/status { op }                       -> { done, resolution?, error?, detail? }
//   POST /clip/file   { op }                       -> הקובץ (video/mp4)
// כל הפעולות (חוץ מ-/health ו-/login) דורשות authorization: Bearer <הסיסמה, מקודדת ב-encodeURIComponent>.
// בשגיאה: { error (עברית), detail? (מה ש-Google / Anthropic ענו, לאבחון), code? }
import { cleanBrief, ASPECTS, QUALITIES } from './brief.js';
import { planFilm } from './director.js';
import { makeStill } from './still.js';

export { Studio } from './studio.js';

const MAX_BODY = 15 * 1024 * 1024; // עד שתי תמונות (צילום + שרטוט)
const MAX_IMAGE_B64 = 7 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// מזהה עבודה של סרטון (נוצר כאן, אקראי)
export const OP_RE = /^[a-f0-9]{32}$/;
const POSTS = ['/login', '/plan', '/still', '/clip', '/clip/status', '/clip/file'];

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (origin && env.ALLOWED_ORIGIN_RE && new RegExp(env.ALLOWED_ORIGIN_RE).test(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

// תמונה: סוג מותר ו-base64 בגודל סביר. null = לא תקין
export function cleanImage(im) {
  if (!im || !IMAGE_TYPES.includes(im.media_type) || typeof im.data !== 'string') return null;
  if (!im.data || im.data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/]+=*$/.test(im.data)) return null;
  return { media_type: im.media_type, data: im.data };
}

const cleanText = (s, max = 2500) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

// הסיסמה מהכותרת authorization: Bearer <encodeURIComponent(סיסמה)>
function bearer(request) {
  const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '');
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch { return ''; }
}

const PASSWORD_ERRORS = {
  no_password: 'צריך להיכנס עם סיסמה.',
  bad_password: 'הסיסמה לא נכונה.',
  short_password: 'הסיסמה קצרה מדי (לפחות 6 תווים).',
  locked: 'יותר מדי ניסיונות. נסו שוב בעוד 10 דקות.',
};
const LIMIT_ERRORS = {
  plans: 'הגענו לתקרה היומית של תכנון סרטונים. נסו שוב מחר.',
  stills: 'הגענו לתקרה היומית של פריימים. נסו שוב מחר.',
  clips: 'הגענו לתקרה היומית של סרטונים. נסו שוב מחר.',
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    if (!env.STUDIO) return reply(503, { error: 'השרת לא מוגדר' });
    const studio = env.STUDIO.get(env.STUDIO.idFromName('main'));
    // כל סרטון הוא עבודה במופע משלו (רץ ברקע, ראו studio.js)
    const jobOf = (op) => env.STUDIO.get(env.STUDIO.idFromName(`job:${op}`));
    const ask = async (path, body = {}) => (await studio.fetch(new Request(`https://studio${path}`, { method: 'POST', body: JSON.stringify(body) }))).json().catch(() => ({}));

    if (pathname === '/' || pathname === '/health') {
      const { hasPassword } = await ask('/state');
      return reply(200, { ok: true, director: Boolean(env.ANTHROPIC_API_KEY), google: Boolean(env.GEMINI_API_KEY), hasPassword: Boolean(hasPassword) });
    }
    if (request.method !== 'POST' || !POSTS.includes(pathname)) return reply(404, { error: 'לא נמצא' });

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { error: 'התמונה גדולה מדי' });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: 'בקשה לא תקינה' }); }

    // סיסמה: /login קובע אותה בפעם הראשונה; בשאר הפעולות היא מגיעה בכותרת
    const login = pathname === '/login';
    // (בכותרת היא מקודדת, כי כותרת לא יכולה להכיל עברית)
    const password = login ? body?.password : bearer(request);
    const auth = await ask('/check', { password, create: login });
    if (!auth.ok) return reply(auth.code === 'short_password' ? 400 : 401, { error: PASSWORD_ERRORS[auth.code] || PASSWORD_ERRORS.bad_password, code: auth.code });
    if (login) return reply(200, { ok: true, created: Boolean(auth.created) });

    const noKey = (who) => reply(503, { error: `${who} עוד לא מחובר (חסר מפתח בשרת).`, code: 'no_key' });
    // התקרה היומית: פעולה שנכשלה לא נספרת
    const metered = async (kind, work) => {
      if ((await ask('/spend', { kind })).ok !== true) return reply(429, { error: LIMIT_ERRORS[kind], code: 'daily_limit' });
      try {
        return reply(200, await work());
      } catch (e) {
        await ask('/refund', { kind });
        throw e;
      }
    };

    try {
      if (pathname === '/clip/status' || pathname === '/clip/file') {
        if (!OP_RE.test(body?.op || '')) return reply(400, { error: 'בקשה לא תקינה' });
        const job = jobOf(body.op);
        if (pathname === '/clip/status') return reply(200, await (await job.fetch(new Request('https://studio/job/state', { method: 'POST', body: '{}' }))).json());
        const file = await job.fetch(new Request('https://studio/job/file', { method: 'POST', body: '{}' }));
        if (!file.ok) return reply(file.status, await file.json().catch(() => ({ error: 'לא הצלחנו להוריד את הסרטון. נסו שוב.' })));
        const length = file.headers.get('content-length');
        return new Response(file.body, { status: 200, headers: { ...cors, 'content-type': file.headers.get('content-type') || 'video/mp4', ...(length ? { 'content-length': length } : {}), 'cache-control': 'no-store' } });
      }

      if (pathname === '/plan') {
        const images = { photo: cleanImage(body?.photo), plan: cleanImage(body?.plan) };
        if (!images.photo && !images.plan) return reply(400, { error: 'צריך להעלות צילום או שרטוט' });
        if (!env.ANTHROPIC_API_KEY) return noKey('הבמאי');
        return await metered('plans', () => planFilm(env, cleanBrief(body.brief), images));
      }

      const image = cleanImage(body?.image);
      if (!image) return reply(400, { error: 'חסרה תמונה תקינה' });
      if (!env.GEMINI_API_KEY) return noKey('מחולל הווידאו');

      if (pathname === '/still') {
        const instruction = cleanText(body.instruction);
        if (!instruction) return reply(400, { error: 'חסרה הוראה לפריים' });
        return await metered('stills', async () => {
          const { model, ...out } = await makeStill(env, image, instruction, cleanBrief(body.brief), body.source === 'plan' ? 'plan' : 'photo');
          return { image: out, model };
        });
      }

      // /clip
      const motion = cleanText(body.motion);
      if (!motion) return reply(400, { error: 'חסרה הוראה לתנועת המצלמה' });
      const aspect = ASPECTS.includes(body.aspect) ? body.aspect : '16:9';
      const quality = QUALITIES.includes(body.quality) ? body.quality : 'max';
      return await metered('clips', async () => {
        const op = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('');
        await jobOf(op).fetch(new Request('https://studio/job/start', { method: 'POST', body: JSON.stringify({ image, motion, aspect, quality }) }));
        return { op };
      });
    } catch (e) {
      return reply(502, { error: e?.message || 'משהו השתבש. נסו שוב.', detail: e?.detail || '' });
    }
  },
};

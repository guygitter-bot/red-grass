// 📱 סושיאל: חיבור לעמוד הפייסבוק ולחשבון האינסטגרם העסקי של הבעלים, ופרסום פוסטים ורילס – רק באישור.
//
// החיבור (פעם אחת, מההגדרות): הבעלים יוצר אפליקציה ב-Meta ומזין App ID + App Secret (נשמרים כאן, הסוד לא חוזר
// לאפליקציה), ואז "התחברות עם פייסבוק" -> Meta שואלת אותו אילו עמודים לאשר -> /meta/callback מקבל קוד, מחליף
// לטוקן ארוך ושומר טוקן לכל עמוד (טוקן עמוד שנגזר מטוקן ארוך לא פג). שום סיסמה לא עוברת דרכנו.
//
// פרסום: הבוט רק מציע (propose_post) – כרטיס עם הטקסט, המדיה, היעדים והשעה. רק "לאשר" מפרסם (מיד, או בשעה
// שנקבעה – ה-alarm של Team מריץ את runSocial). ריל באינסטגרם עובר עיבוד אצל Meta – בודקים כל חצי דקה עד שמוכן.
//
//   meta:app   -> { appId, secret, configId }   (configId = "Configuration" של Facebook Login for Business, אם יש)
//   meta:conn  -> { pages: [{ id, name, token, ig: { id, username } | null }], at }
//   meta:state -> { nonce, exp }               (התחברות שבדרך)
//   sp:<id>    -> { id, key, text, kind: post|reel|text, file, targets: [instagram|facebook], page, when, origin,
//                   status: proposed|scheduled|publishing|done|failed|cancelled, results: { <target>: {...} }, at }
//   social:q   -> [מזהים של פוסטים מתוזמנים / בפרסום]
import { fail } from './auth.js';
import { fileUrl } from './app.js';

const GRAPH = 'https://graph.facebook.com';
const DIALOG = 'https://www.facebook.com/dialog/oauth';
export const SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish', 'business_management'];
const MAX_TEXT = 2200; // תקרת הכיתוב באינסטגרם
const IG_POLL_MS = 30_000;
const IG_TIMEOUT_MS = 30 * 60 * 1000;
const STATE_TTL = 15 * 60 * 1000;
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export const callbackUrl = (origin) => `${origin}/meta/callback`;

// ---------- Graph ----------
async function graph(env, method, path, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  const init = { method };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  } else {
    init.headers = { 'content-type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  }
  const res = await (env.FETCH || fetch)(url.toString(), init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw Object.assign(new Error(data.error?.message || `Meta ${res.status}`), { meta: true });
  return data;
}

// ---------- הגדרות וחיבור ----------
export async function metaStatus(t, origin) {
  const app = (await t.storage.get('meta:app')) || {};
  const conn = await t.storage.get('meta:conn');
  return {
    appId: app.appId || '',
    configId: app.configId || '',
    configured: Boolean(app.appId && app.secret),
    redirect: callbackUrl(origin),
    pages: (conn?.pages || []).map((p) => ({ id: p.id, name: p.name, ig: p.ig ? { username: p.ig.username } : null })),
    connectedAt: conn?.at || 0,
  };
}

export async function saveMetaApp(t, body) {
  const appId = String(body.appId || '').trim();
  const prev = (await t.storage.get('meta:app')) || {};
  const secret = String(body.secret || '').trim() || prev.secret || '';
  if (!/^\d{6,20}$/.test(appId)) throw fail(400, 'App ID צריך להיות מספר (מההגדרות של האפליקציה ב-Meta)');
  if (!/^[a-f0-9]{32}$/i.test(secret)) throw fail(400, 'App Secret צריך להיות 32 תווים (אותיות ומספרים)');
  const configId = String(body.configId || '').trim();
  if (configId && !/^\d{6,20}$/.test(configId)) throw fail(400, 'Configuration ID צריך להיות מספר');
  await t.storage.put('meta:app', { appId, secret, configId });
  return { ok: true };
}

export async function startMeta(t, origin) {
  const app = await t.storage.get('meta:app');
  if (!app?.appId) throw fail(400, 'קודם להזין App ID ו-App Secret');
  const nonce = newId() + newId();
  await t.storage.put('meta:state', { nonce, exp: Date.now() + STATE_TTL });
  const url = new URL(DIALOG);
  url.searchParams.set('client_id', app.appId);
  url.searchParams.set('redirect_uri', callbackUrl(origin));
  url.searchParams.set('state', nonce);
  // Facebook Login for Business: ההרשאות מוגדרות ב-Configuration (config_id); אחרת – רשימת ההרשאות
  if (app.configId) url.searchParams.set('config_id', app.configId);
  else url.searchParams.set('scope', SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  return { url: url.toString() };
}

// Meta מחזירה לכאן אחרי האישור. מחזיר רק { ok, pages } או זורק – בלי להחזיר טוקנים
export async function finishMeta(t, { code, state, origin }) {
  const { storage, env } = t;
  const saved = await storage.get('meta:state');
  await storage.delete('meta:state');
  if (!saved || !state || saved.nonce !== state || saved.exp < Date.now()) throw fail(400, 'ההתחברות פגה או לא התחילה מהאפליקציה. אפשר לנסות שוב מההגדרות.');
  const app = await storage.get('meta:app');
  if (!app?.secret) throw fail(400, 'חסרים פרטי האפליקציה של Meta');
  const short = await graph(env, 'GET', '/oauth/access_token', { client_id: app.appId, client_secret: app.secret, redirect_uri: callbackUrl(origin), code });
  const long = await graph(env, 'GET', '/oauth/access_token', { grant_type: 'fb_exchange_token', client_id: app.appId, client_secret: app.secret, fb_exchange_token: short.access_token });
  const accounts = await graph(env, 'GET', '/me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: 50, access_token: long.access_token });
  const pages = (accounts.data || []).map((p) => ({
    id: String(p.id), name: String(p.name || ''), token: p.access_token,
    ig: p.instagram_business_account ? { id: String(p.instagram_business_account.id), username: String(p.instagram_business_account.username || '') } : null,
  }));
  if (!pages.length) throw fail(400, 'לא נבחר אף עמוד פייסבוק. אפשר לנסות שוב ולסמן את העמוד.');
  await storage.put('meta:conn', { pages, at: Date.now() });
  return { ok: true, pages: pages.length };
}

export async function disconnectMeta(t) {
  await t.storage.delete('meta:conn');
  return { ok: true };
}

// ---------- הכלים (agents.js) ----------
export const SOCIAL_TOOLS = [
  {
    name: 'social_accounts',
    description: "List the owner's connected Facebook pages and Instagram business accounts (what you can publish to).",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'propose_post',
    description: 'Propose a post or reel for the owner\'s Instagram and/or Facebook page. The owner sees a preview card with an "approve" button; nothing is published without it. Optionally schedule it (Israel time). Instagram needs an image or a video; a reel is a vertical video.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The caption / post text exactly as it should appear (Hebrew, with hashtags at the end if any)' },
        targets: { type: 'array', items: { type: 'string', enum: ['instagram', 'facebook'] }, description: 'Where to publish' },
        kind: { type: 'string', enum: ['post', 'reel'], description: 'post = image (or text on Facebook); reel = video' },
        file: { type: 'string', description: 'The id of the image or video in the conversation ([file <id>: ...]) – required for Instagram and for a reel' },
        page: { type: 'string', description: 'The page id from social_accounts (omit when there is only one)' },
        when: { type: 'string', description: 'Optional schedule in Israel time, "YYYY-MM-DD HH:MM". Omit to publish right after approval' },
      },
      required: ['text', 'targets', 'kind'],
    },
  },
];

// "YYYY-MM-DD HH:MM" בשעון ישראל -> זמן
export function israelTime(s) {
  const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // ההפרש של שעון ישראל באותו רגע (חורף +2, קיץ +3)
  const local = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const utc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }));
  return guess - (local - utc);
}

export async function socialAccounts(t) {
  const conn = await t.storage.get('meta:conn');
  if (!conn?.pages?.length) return 'Not connected yet. Tell the owner to connect Facebook and Instagram in the app settings (הגדרות ← פייסבוק ואינסטגרם). Until then write the post ready to copy.';
  return JSON.stringify(conn.pages.map((p) => ({ page: p.id, facebook: p.name, instagram: p.ig ? `@${p.ig.username}` : null })));
}

export async function proposePost(t, job, input, started) {
  const { storage } = t;
  const conn = await storage.get('meta:conn');
  if (!conn?.pages?.length) return 'Facebook / Instagram are not connected yet. Tell the owner to connect them in the app settings (הגדרות ← פייסבוק ואינסטגרם); meanwhile give the text ready to copy.';
  const page = input.page ? conn.pages.find((p) => p.id === String(input.page)) : conn.pages.length === 1 ? conn.pages[0] : null;
  if (!page) return `Which page? Call social_accounts and pass page (one of: ${conn.pages.map((p) => p.id).join(', ')}).`;
  const targets = [...new Set((Array.isArray(input.targets) ? input.targets : []).filter((x) => ['instagram', 'facebook'].includes(x)))];
  if (!targets.length) return 'targets must include instagram and/or facebook.';
  if (targets.includes('instagram') && !page.ig) return 'This page has no connected Instagram business account. Publish to facebook only, or ask the owner to link Instagram to the page.';
  const text = String(input.text || '').trim().slice(0, MAX_TEXT);
  const kind = input.kind === 'reel' ? 'reel' : 'post';
  let file = null;
  if (input.file) {
    file = await storage.get(`f:${String(input.file)}`);
    if (!file || !['image', 'video'].includes(file.kind)) return 'file must be the id of an image or a video in the conversation.';
  }
  if (kind === 'reel' && file?.kind !== 'video') return 'A reel needs a video file.';
  if (kind === 'post' && file?.kind === 'video') return 'For a video use kind "reel".';
  if (targets.includes('instagram') && !file) return 'Instagram needs an image or a video (file).';
  if (!text && !file) return 'Nothing to publish.';
  let when = null;
  if (input.when) {
    when = israelTime(input.when);
    if (!when) return 'when must be "YYYY-MM-DD HH:MM" (Israel time).';
    if (when < Date.now() + 60_000) return 'when is in the past. Pick a future time, or omit it to publish right after approval.';
    if (when > Date.now() + 75 * 24 * 3600_000) return 'Schedule at most 75 days ahead.';
  }
  const rec = { id: newId(), key: t.jobKey(job), text, kind, file: file?.id || null, targets, page: page.id, when, status: 'proposed', results: {}, at: Date.now() };
  await storage.put(`sp:${rec.id}`, rec);
  started.push(rec.id);
  return `The post proposal is shown to the owner as a preview card with an "approve" button${when ? ' (scheduled)' : ''}. Nothing is published until they approve. Tell them briefly; do not propose the same post again.`;
}

// מה שהכרטיס בשיחה מציג
export async function postView(t, id, origin, fileView) {
  const p = await t.storage.get(`sp:${String(id || '')}`);
  if (!p) return null;
  const conn = await t.storage.get('meta:conn');
  const page = conn?.pages?.find((x) => x.id === p.page);
  const f = p.file ? await t.storage.get(`f:${p.file}`) : null;
  return {
    id: p.id, text: p.text, kind: p.kind, targets: p.targets, when: p.when, status: p.status, at: p.at,
    page: page ? { name: page.name, ig: page.ig?.username || '' } : null,
    file: f ? await fileView(t.storage, origin, f) : null,
    jpeg: !f || f.kind !== 'image' || f.type === 'image/jpeg',
    results: Object.fromEntries(Object.entries(p.results || {}).map(([k, r]) => [k, { url: r.url || '', error: r.error || '', done: Boolean(r.done) }])),
  };
}

// ---------- אישור / ביטול ----------
export async function approvePost(t, body, origin) {
  const { storage } = t;
  const p = await storage.get(`sp:${String(body.id || '')}`);
  if (!p) throw fail(404, 'ההצעה לא נמצאה');
  if (!['proposed', 'failed'].includes(p.status)) throw fail(409, 'ההצעה הזאת כבר טופלה');
  if (!(await storage.get('meta:conn'))) throw fail(400, 'פייסבוק ואינסטגרם לא מחוברים (הגדרות)');
  let file = p.file;
  // אינסטגרם מקבל רק JPEG: האפליקציה ממירה תמונה אחרת ומעלה אותה כ-JPEG לפני האישור
  if (p.targets.includes('instagram') && file) {
    const f = await storage.get(`f:${file}`);
    if (f?.kind === 'image' && f.type !== 'image/jpeg') {
      const j = body.jpeg ? await storage.get(`f:${String(body.jpeg)}`) : null;
      if (j?.type !== 'image/jpeg') throw fail(400, 'needs-jpeg');
      file = j.id;
    }
  }
  const scheduled = p.when && p.when > Date.now() + 30_000;
  const done = Object.fromEntries(Object.entries(p.results || {}).filter(([, r]) => r.done));
  await storage.put(`sp:${p.id}`, { ...p, file, origin, results: done, status: scheduled ? 'scheduled' : 'publishing', approvedAt: Date.now() });
  const q = (await storage.get('social:q')) || [];
  if (!q.includes(p.id)) await storage.put('social:q', [...q, p.id]);
  await storage.setAlarm(scheduled ? Math.min(p.when, (await storage.getAlarm()) || Infinity) : Date.now());
  return { ok: true };
}

export async function cancelPost(t, id) {
  const { storage } = t;
  const p = await storage.get(`sp:${String(id || '')}`);
  if (!p) throw fail(404, 'ההצעה לא נמצאה');
  if (!['proposed', 'scheduled', 'failed'].includes(p.status)) throw fail(409, 'כבר פורסם או בפרסום');
  await storage.put(`sp:${p.id}`, { ...p, status: 'cancelled' });
  await storage.put('social:q', ((await storage.get('social:q')) || []).filter((x) => x !== p.id));
  return { ok: true };
}

// ---------- פרסום (מתוך ה-alarm) ----------
// מחזיר מתי לבדוק שוב (או null)
export async function runSocial(t) {
  const { storage } = t;
  const q = (await storage.get('social:q')) || [];
  if (!q.length) return null;
  let next = null;
  const keep = [];
  for (const id of q) {
    const p = await storage.get(`sp:${id}`);
    if (!p || !['scheduled', 'publishing'].includes(p.status)) continue;
    if (p.status === 'scheduled' && p.when > Date.now()) {
      keep.push(id);
      next = Math.min(next ?? Infinity, p.when);
      continue;
    }
    const after = await publishStep(t, { ...p, status: 'publishing' });
    await storage.put(`sp:${id}`, after);
    if (after.status === 'publishing') {
      keep.push(id);
      next = Math.min(next ?? Infinity, Date.now() + IG_POLL_MS);
    }
  }
  await storage.put('social:q', keep);
  return next;
}

// צעד אחד לכל יעד שעוד לא הסתיים. ריל באינסטגרם: יצירה -> המתנה לעיבוד -> פרסום
async function publishStep(t, p) {
  const { storage, env } = t;
  const conn = await storage.get('meta:conn');
  const page = conn?.pages?.find((x) => x.id === p.page);
  const results = { ...(p.results || {}) };
  if (!page) {
    for (const k of p.targets) if (!results[k]?.done) results[k] = { error: 'העמוד כבר לא מחובר' };
    return { ...p, results, status: 'failed' };
  }
  const f = p.file ? await storage.get(`f:${p.file}`) : null;
  const media = f ? await fileUrl(storage, p.origin, f.id) : null;
  for (const target of p.targets) {
    const r = results[target] || {};
    if (r.done || r.error) continue;
    try {
      results[target] = target === 'facebook' ? await publishFacebook(env, page, p, f, media) : await publishInstagram(env, page, p, f, media, r);
    } catch (e) {
      results[target] = { error: e.meta ? `Meta: ${e.message}` : 'הפרסום נכשל' };
    }
  }
  const all = p.targets.map((k) => results[k] || {});
  const status = all.every((r) => r.done) ? 'done' : all.some((r) => !r.done && !r.error) ? 'publishing' : 'failed';
  return { ...p, results, status, ...(status === 'done' ? { doneAt: Date.now() } : {}) };
}

async function publishFacebook(env, page, p, f, media) {
  const token = page.token;
  if (f?.kind === 'video') {
    const r = await graph(env, 'POST', `/${page.id}/videos`, { file_url: media, description: p.text, access_token: token });
    return { done: true, id: r.id, url: `https://www.facebook.com/${page.id}/videos/${r.id}` };
  }
  if (f?.kind === 'image') {
    const r = await graph(env, 'POST', `/${page.id}/photos`, { url: media, message: p.text, access_token: token });
    return { done: true, id: r.post_id || r.id, url: `https://www.facebook.com/${r.post_id || r.id}` };
  }
  const r = await graph(env, 'POST', `/${page.id}/feed`, { message: p.text, access_token: token });
  return { done: true, id: r.id, url: `https://www.facebook.com/${r.id}` };
}

async function publishInstagram(env, page, p, f, media, r) {
  const token = page.token;
  let container = r.container;
  if (!container) {
    const params = f.kind === 'video'
      ? { media_type: 'REELS', video_url: media, caption: p.text, share_to_feed: true, access_token: token }
      : { image_url: media, caption: p.text, access_token: token };
    container = (await graph(env, 'POST', `/${page.ig.id}/media`, params)).id;
    r = { container, since: Date.now() };
  }
  const st = await graph(env, 'GET', `/${container}`, { fields: 'status_code', access_token: token });
  if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') return { error: 'אינסטגרם לא הצליח לעבד את הקובץ (אולי פורמט או אורך לא נתמכים)' };
  if (st.status_code !== 'FINISHED') {
    if (Date.now() - (r.since || Date.now()) > IG_TIMEOUT_MS) return { error: 'העיבוד באינסטגרם לקח יותר מדי זמן' };
    return { container, since: r.since };
  }
  const pub = await graph(env, 'POST', `/${page.ig.id}/media_publish`, { creation_id: container, access_token: token });
  const link = await graph(env, 'GET', `/${pub.id}`, { fields: 'permalink', access_token: token }).catch(() => ({}));
  return { done: true, id: pub.id, url: link.permalink || `https://www.instagram.com/${page.ig.username}/` };
}

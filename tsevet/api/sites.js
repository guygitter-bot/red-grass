// פרסום דף נחיתה / מיני-סייט לאתר משלו ב-Cloudflare Pages: https://<שם>.pages.dev (רק 🎨 קריאייטיב ו-👨‍💻 המתכנת):
//   publish_page – הבוט מציע לפרסם דף HTML שיצר (make_file). זה פומבי, ולכן רק הצעה: כרטיס עם "לפרסם",
//                  ושום דבר לא עולה לאוויר בלי אישור הבעלים. אותו שם = עדכון של אותו אתר (שוב באישור).
//   אחרי האישור נשלח אות ל-GitHub (repository_dispatch "tsevet-site") – .github/workflows/tsevet-site.yml מוריד
//   את הדף ואת התמונות שבו ({{file:<id>}}) ומעלה אותם לפרויקט Pages בשם הזה. **לעולם לא דורס פרויקט קיים**
//   שהצוות לא יצר (למשל אפליקציה אחרת של הבעלים) – במקרה כזה העבודה נכשלת עם "השם תפוס".
//   "להוריד מהאוויר" מוחק את הפרויקט (רק פרויקט שהצוות יצר).
//
//   pp:<id>  -> { id, key, file, slug, title, status: proposed|publishing|live|removing|replaced|removed|cancelled|failed,
//                 url, error, at, liveAt }
//   sites    -> { <slug>: { pp, file, title, url, at } }   האתרים שהצוות יצר ושבאוויר
import { fail } from './auth.js';

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,26}[a-z0-9])$/;
const MAX_SITES = 50;
const STALE_MS = 20 * 60 * 1000;
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

// הכתובת הצפויה (Cloudflare עלול להוסיף סיומת אם השם תפוס אצל מישהו אחר – הכתובת האמיתית חוזרת מה-workflow)
export const pagesUrl = (slug) => `https://${slug}.pages.dev`;

// ---------- הכלי (agents.js) ----------
export const SITE_TOOLS = [
  {
    name: 'publish_page',
    description: 'Propose publishing an HTML page you made with make_file as its own website at https://<slug>.pages.dev (a landing page / mini-site anyone can open). The owner sees it with a "publish" button; nothing goes live without their approval. Using the same slug again updates that site (also after approval). The slug must not be the name of one of the owner\'s existing apps – for a page about an app use e.g. "<app>-landing".',
    input_schema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'The id of the html file (from make_file) to publish' },
        slug: { type: 'string', description: 'The site name: 3-28 lowercase English letters, digits and dashes, e.g. "promptika-landing" or "summer-sale"' },
        title: { type: 'string', description: 'Short Hebrew title of the site for the owner' },
      },
      required: ['file', 'slug'],
    },
  },
];

export async function proposeSite(t, job, input, started) {
  const { storage, env } = t;
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return 'Publishing is not connected yet (the owner has to finish the one-time setup). Tell the owner.';
  const slug = String(input.slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return 'slug must be 3-28 lowercase English letters, digits or dashes (not starting or ending with a dash). Choose another.';
  const f = await storage.get(`f:${String(input.file || '')}`);
  if (!f || f.kind !== 'doc' || !String(f.type || '').startsWith('text/html')) return 'file must be the id of an html page you made with make_file.';
  const sites = (await storage.get('sites')) || {};
  if (!sites[slug] && Object.keys(sites).length >= MAX_SITES) return `There are already ${MAX_SITES} sites. Ask the owner to remove one first.`;
  const rec = { id: newId(), key: t.jobKey(job), file: f.id, slug, title: String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 80), status: 'proposed', at: Date.now() };
  await storage.put(`pp:${rec.id}`, rec);
  started.push(rec.id);
  const update = sites[slug] ? ` This site is already live (${sites[slug].url}) – approving will replace its page.` : '';
  return `The publish proposal is shown to the owner with a "publish" button; the address will be about ${pagesUrl(slug)}.${update} Nothing is public until they approve; publishing takes a minute or two. Tell them briefly.`;
}

// מה שהכרטיס בשיחה מציג
export async function siteView(t, id) {
  const p = await t.storage.get(`pp:${String(id || '')}`);
  if (!p) return null;
  const out = { id: p.id, slug: p.slug, title: p.title || '', status: p.status, url: p.url || pagesUrl(p.slug), at: p.at };
  if (['publishing', 'removing'].includes(p.status) && Date.now() - (p.startedAt || p.at) > STALE_MS) {
    return { ...out, status: p.status === 'publishing' ? 'failed' : 'live', error: 'זה לקח יותר מדי זמן. אפשר לנסות שוב.' };
  }
  if (p.error) out.error = p.error;
  return out;
}

// אות ל-GitHub שמתחיל את ה-workflow
async function dispatch(env, id) {
  const res = await (env.FETCH || fetch)(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'tsevet', 'content-type': 'application/json' },
    body: JSON.stringify({ event_type: 'tsevet-site', client_payload: { id } }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

// ---------- אישור / הורדה / ביטול (מהכרטיס) ----------
export async function approveSite(t, id) {
  const { storage, env } = t;
  const p = await storage.get(`pp:${String(id || '')}`);
  if (!p) throw fail(404, 'ההצעה לא נמצאה');
  if (!['proposed', 'failed'].includes(p.status)) throw fail(409, 'ההצעה הזאת כבר טופלה');
  if (!(await storage.get(`f:${p.file}`))) throw fail(410, 'הדף כבר לא קיים');
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) throw fail(503, 'הפרסום עוד לא מחובר');
  const sites = (await storage.get('sites')) || {};
  if (!sites[p.slug] && Object.keys(sites).length >= MAX_SITES) throw fail(429, `יש כבר ${MAX_SITES} אתרים. אפשר להוריד אחד קודם.`);
  await storage.put(`pp:${p.id}`, { ...p, status: 'publishing', error: '', startedAt: Date.now() });
  if (!(await dispatch(env, p.id))) {
    await storage.put(`pp:${p.id}`, { ...p, status: 'failed', error: 'לא הצלחנו להתחיל את הפרסום. אפשר לנסות שוב.' });
    throw fail(502, 'לא הצלחנו להתחיל את הפרסום. אפשר לנסות שוב.');
  }
  return { ok: true };
}

export async function removeSite(t, id) {
  const { storage, env } = t;
  const p = await storage.get(`pp:${String(id || '')}`);
  if (!p) throw fail(404, 'האתר לא נמצא');
  if (p.status !== 'live') throw fail(409, 'האתר הזה לא באוויר');
  await storage.put(`pp:${p.id}`, { ...p, status: 'removing', error: '', startedAt: Date.now() });
  if (!(await dispatch(env, p.id))) {
    await storage.put(`pp:${p.id}`, p);
    throw fail(502, 'לא הצלחנו להוריד את האתר. אפשר לנסות שוב.');
  }
  return { ok: true };
}

export async function cancelSite(storage, id) {
  const p = await storage.get(`pp:${String(id || '')}`);
  if (!p) throw fail(404, 'ההצעה לא נמצאה');
  if (!['proposed', 'failed'].includes(p.status)) throw fail(409, 'ההצעה הזאת כבר טופלה');
  await storage.put(`pp:${p.id}`, { ...p, status: 'cancelled' });
  return { ok: true };
}

// ---------- מה שה-workflow מבקש (worker.js -> /site/<...>, עם הטוקן של GitHub) ----------
async function working(storage, id) {
  const p = await storage.get(`pp:${String(id || '')}`);
  if (!p || !['publishing', 'removing'].includes(p.status)) throw fail(404, 'no such job');
  return p;
}

// מה לעשות: להעלות (עם הדף והתמונות) או להוריד. ours = הפרויקט נוצר על ידי הצוות (מותר לעדכן / למחוק)
export async function siteJob(storage, id) {
  const p = await working(storage, id);
  const ours = Boolean(((await storage.get('sites')) || {})[p.slug]);
  if (p.status === 'removing') return { id: p.id, action: 'remove', slug: p.slug, ours };
  const f = await storage.get(`f:${p.file}`);
  if (!f) throw fail(404, 'page is gone');
  const images = [];
  for (const fid of f.links || []) {
    const img = await storage.get(`f:${fid}`);
    if (img) images.push({ id: img.id, type: img.type });
  }
  return { id: p.id, action: 'deploy', slug: p.slug, ours, page: f.id, images };
}

// איזה קובץ ב-R2 להחזיר: הדף עצמו או תמונה שהוא משתמש בה
export async function siteInput(storage, id, fid) {
  const p = await working(storage, id);
  const page = await storage.get(`f:${p.file}`);
  if (!page || (String(fid) !== page.id && !(page.links || []).includes(String(fid)))) throw fail(404, 'no such input');
  const f = await storage.get(`f:${String(fid)}`);
  if (!f) throw fail(404, 'no such input');
  return { key: `files/${f.id}`, type: f.type };
}

const SITE_URL_RE = /^https:\/\/[a-z0-9-]+\.pages\.dev\/?$/;
export async function siteDone(storage, id, url) {
  const p = await working(storage, id);
  const sites = (await storage.get('sites')) || {};
  if (p.status === 'removing') {
    if (sites[p.slug]?.pp === p.id || sites[p.slug]) delete sites[p.slug];
    await storage.put('sites', sites);
    await storage.put(`pp:${p.id}`, { ...p, status: 'removed' });
    return { ok: true };
  }
  const live = SITE_URL_RE.test(String(url || '')) ? String(url).replace(/\/$/, '') : pagesUrl(p.slug);
  const prev = sites[p.slug];
  if (prev?.pp && prev.pp !== p.id) {
    const old = await storage.get(`pp:${prev.pp}`);
    if (old) await storage.put(`pp:${old.id}`, { ...old, status: 'replaced' });
  }
  sites[p.slug] = { pp: p.id, file: p.file, title: p.title, url: live, at: Date.now() };
  await storage.put('sites', sites);
  await storage.put(`pp:${p.id}`, { ...p, status: 'live', url: live, error: '', liveAt: Date.now() });
  return { ok: true };
}

const REASONS = {
  taken: 'השם הזה כבר תפוס (אולי אפליקציה אחרת שלך). אפשר לבקש מהבוט שם אחר.',
  failed: 'הפרסום לא הצליח. אפשר לנסות שוב.',
};
export async function siteFail(storage, id, reason) {
  const p = await working(storage, id);
  const error = REASONS[reason] || REASONS.failed;
  await storage.put(`pp:${p.id}`, { ...p, status: p.status === 'removing' ? 'live' : 'failed', error });
  return { ok: true };
}

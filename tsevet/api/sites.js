// פרסום דף נחיתה / מיני-סייט לכתובת קבועה וציבורית (רק 🎨 קריאייטיב ו-👨‍💻 המתכנת):
//   publish_page – הבוט מציע לפרסם דף HTML שיצר (make_file) בכתובת /p/<שם>. זה פומבי, ולכן רק הצעה:
//                  כרטיס עם "לפרסם", ושום דבר לא עולה לאוויר בלי אישור הבעלים. אותו שם = עדכון של אותו אתר.
//   הדף מוגש מהשרת עם CSP של sandbox (כמו כל קובץ שהצוות יוצר), והתמונות שבתוכו ({{file:<id>}}) מוגשות
//   בכתובת ציבורית של האתר – רק התמונות שהדף עצמו משתמש בהן.
//
//   pp:<id>  -> { id, key, file, slug, title, status: proposed|live|replaced|removed|cancelled, at, liveAt }
//   sites    -> { <slug>: { pp, file, title, at } }   האתרים שבאוויר
import { fail } from './auth.js';

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = ['app', 'admin', 'api', 'file', 'files', 'render', 'dev', 'setup', 'tg', 'img'];
const MAX_SITES = 50;
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export const siteUrl = (origin, slug) => `${origin}/p/${slug}`;

// ---------- הכלי (agents.js) ----------
export const SITE_TOOLS = [
  {
    name: 'publish_page',
    description: 'Propose publishing an HTML page you made with make_file at a permanent public web address (a landing page / mini-site anyone can open). The owner sees it with a "publish" button; nothing goes live without their approval. Using the same address again updates that site (also after approval).',
    input_schema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'The id of the html file (from make_file) to publish' },
        slug: { type: 'string', description: 'The web address name: 3-40 lowercase English letters, digits and dashes, e.g. "mat-kon" or "summer-sale"' },
        title: { type: 'string', description: 'Short Hebrew title of the site for the owner' },
      },
      required: ['file', 'slug'],
    },
  },
];

export async function proposeSite(t, job, input, started) {
  const { storage } = t;
  const slug = String(input.slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED.includes(slug)) return 'slug must be 3-40 lowercase English letters, digits or dashes (not starting or ending with a dash). Choose another.';
  const f = await storage.get(`f:${String(input.file || '')}`);
  if (!f || f.kind !== 'doc' || !String(f.type || '').startsWith('text/html')) return 'file must be the id of an html page you made with make_file.';
  const sites = (await storage.get('sites')) || {};
  if (!sites[slug] && Object.keys(sites).length >= MAX_SITES) return `There are already ${MAX_SITES} sites. Ask the owner to remove one first.`;
  const rec = { id: newId(), key: t.jobKey(job), file: f.id, slug, title: String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 80), status: 'proposed', at: Date.now() };
  await storage.put(`pp:${rec.id}`, rec);
  started.push(rec.id);
  const update = sites[slug] ? ' This address is already live – approving will replace the current page.' : '';
  return `The publish proposal is shown to the owner with a "publish" button and the full address (ending in /p/${slug}).${update} Nothing is public until they approve. Tell them briefly.`;
}

// מה שהכרטיס בשיחה מציג
export async function siteView(t, id, origin) {
  const p = await t.storage.get(`pp:${String(id || '')}`);
  if (!p) return null;
  const f = await t.storage.get(`f:${p.file}`);
  return { id: p.id, slug: p.slug, title: p.title || '', status: p.status, url: siteUrl(origin, p.slug), fileName: f?.name || '', at: p.at };
}

// ---------- אישור / הורדה / ביטול (מהכרטיס) ----------
export async function approveSite(t, id) {
  const { storage } = t;
  const p = await storage.get(`pp:${String(id || '')}`);
  if (!p) throw fail(404, 'ההצעה לא נמצאה');
  if (p.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  if (!(await storage.get(`f:${p.file}`))) throw fail(410, 'הדף כבר לא קיים');
  const sites = (await storage.get('sites')) || {};
  const prev = sites[p.slug];
  if (!prev && Object.keys(sites).length >= MAX_SITES) throw fail(429, `יש כבר ${MAX_SITES} אתרים. אפשר להוריד אחד קודם.`);
  if (prev?.pp) {
    const old = await storage.get(`pp:${prev.pp}`);
    if (old) await storage.put(`pp:${old.id}`, { ...old, status: 'replaced' });
  }
  sites[p.slug] = { pp: p.id, file: p.file, title: p.title, at: Date.now() };
  await storage.put('sites', sites);
  await storage.put(`pp:${p.id}`, { ...p, status: 'live', liveAt: Date.now() });
  return { ok: true };
}

export async function removeSite(t, id) {
  const { storage } = t;
  const p = await storage.get(`pp:${String(id || '')}`);
  if (!p) throw fail(404, 'האתר לא נמצא');
  if (p.status !== 'live') throw fail(409, 'האתר הזה לא באוויר');
  const sites = (await storage.get('sites')) || {};
  if (sites[p.slug]?.pp === p.id) {
    delete sites[p.slug];
    await storage.put('sites', sites);
  }
  await storage.put(`pp:${p.id}`, { ...p, status: 'removed' });
  return { ok: true };
}

export async function cancelSite(storage, id) {
  const p = await storage.get(`pp:${String(id || '')}`);
  if (!p) throw fail(404, 'ההצעה לא נמצאה');
  if (p.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  await storage.put(`pp:${p.id}`, { ...p, status: 'cancelled' });
  return { ok: true };
}

// ---------- הגשה ציבורית (worker.js -> /internal/site-*) ----------
// הדף: איזה קובץ, ולאן מצביעות התמונות שבתוכו
export async function sitePage(storage, slug, origin) {
  const s = ((await storage.get('sites')) || {})[String(slug || '')];
  if (!s) throw fail(404, 'not found');
  const f = await storage.get(`f:${s.file}`);
  if (!f) throw fail(404, 'not found');
  const links = {};
  for (const id of f.links || []) links[id] = `${siteUrl(origin, slug)}/img/${id}`;
  return { file: f.id, type: f.type, links };
}

// תמונה מתוך הדף – רק קובץ שהדף עצמו משתמש בו
export async function siteImage(storage, slug, id) {
  const s = ((await storage.get('sites')) || {})[String(slug || '')];
  const page = s ? await storage.get(`f:${s.file}`) : null;
  if (!page || !(page.links || []).includes(String(id))) throw fail(404, 'not found');
  const f = await storage.get(`f:${id}`);
  if (!f) throw fail(404, 'not found');
  return { key: `files/${f.id}`, type: f.type };
}

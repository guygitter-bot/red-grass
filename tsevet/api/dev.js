// 👨‍💻 המתכנת: מכיר את כל האפליקציות שבמאגר (קורא את הקוד ב-GitHub), ומבצע תיקונים ותוספות – רק באישור של הבעלים.
//   1. קריאה: code_apps / code_tree / code_read / code_search – דרך ה-API של GitHub, רק במאגר שלנו (GITHUB_REPO)
//   2. הצעה: code_change -> נשמרת בקשה (d:<id>, status: proposed) ומוצג כרטיס עם "לאשר ולהתחיל" / "לא עכשיו"
//   3. אישור (/app/dev/approve) -> אות ל-GitHub (repository_dispatch "tsevet-dev"); .github/workflows/tsevet-dev.yml
//      מריץ את Claude Code על ענף tsevet-dev/<id>, מריץ את הבדיקות של האפליקציה ופותח PR (status: working -> ready)
//   4. הבעלים בודק את הסיכום ולוחץ "למזג ולהעלות" (/app/dev/merge) – רק כשהבדיקות ב-GitHub ירוקות. אחרי המיזוג
//      ה-workflow של האפליקציה מעלה אותה לאוויר כרגיל. "לבטל" סוגר את ה-PR.
// המאגר ציבורי: הבקשה לא מודפסת בלוג של ה-workflow (נקראת מהשרת עם הטוקן).
//
//   d:<id>        -> { id, key, app, title, request, summary, status, pr, url, result, question, error, at, startedAt }
//   devs:<תאריך>  -> כמה עבודות התחילו היום (תקרה: DAILY_DEV)
//   apps          -> { at, list: [{ dir, name, about }] } – רשימת האפליקציות מ-CLAUDE.md (מתעדכנת פעם ביום)
import { fail } from './auth.js';
import { israelDate, newId } from './app.js';

const API = 'https://api.github.com';
const MAX_READ = 24_000;
const MAX_LIST = 200;
const STALE_MS = 75 * 60 * 1000;
const APPS_TTL = 24 * 3600 * 1000;
const STATUSES = ['proposed', 'working', 'ready', 'question', 'failed', 'merged', 'cancelled', 'discarded'];

export const devReady = (env) => Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO);
export const dailyDevLimit = (env) => Number(env.DAILY_DEV) || 6;

async function gh(env, path, { method = 'GET', body, raw = false } = {}) {
  const res = await (env.FETCH || fetch)(`${API}${path}`, {
    method,
    headers: {
      accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'user-agent': 'tsevet',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`github ${res.status}`), { status: res.status, text });
  }
  if (res.status === 204) return null;
  return raw ? res.text() : res.json();
}

// נתיב בתוך המאגר: בלי "..", בלי סודות של git
export function cleanPath(p) {
  const s = String(p || '').trim().replace(/^\/+|\/+$/g, '');
  if (s.split('/').some((part) => part === '..' || part === '.git')) return null;
  return s;
}

// ---------- רשימת האפליקציות (מ-CLAUDE.md: "### שם (`תיקייה/`)") ----------
export function parseApps(md) {
  const out = [];
  const lines = String(md || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{2,3}\s+(.+?)\s*\(`([a-z0-9_]+)\/`\)/i);
    if (!m) continue;
    // שורת התיאור הראשונה שאחרי הכותרת
    const next = lines.slice(i + 1, i + 4).find((l) => l.trim() && !l.startsWith('#')) || '';
    const about = next.replace(/^[-\s]*/, '').replace(/^תיאור:\s*`[^`]+`\.\s*/, '').replace(/\*\*/g, '').slice(0, 220);
    if (!out.some((a) => a.dir === m[2])) out.push({ dir: m[2], name: m[1].replace(/["*]/g, '').trim(), about });
  }
  return out;
}

export async function appsOf(t) {
  const cached = await t.storage.get('apps');
  if (cached && Date.now() - cached.at < APPS_TTL) return cached.list;
  try {
    const list = parseApps(await gh(t.env, `/repos/${t.env.GITHUB_REPO}/contents/CLAUDE.md`, { raw: true }));
    if (list.length) await t.storage.put('apps', { at: Date.now(), list });
    return list;
  } catch {
    return cached?.list || [];
  }
}

// רשימת האפליקציות להנחיות של המתכנת
export const appsText = (list) => (list.length ? list.map((a) => `- ${a.dir}/ – ${a.name}${a.about ? `: ${a.about}` : ''}`).join('\n') : '(the list is not available right now – use code_apps)');

// ---------- כלי הקריאה ----------
export const codeTools = (t) => ({
  code_apps: async () => appsText(await appsOf(t)),
  code_tree: async ({ path }) => {
    const p = cleanPath(path);
    if (p === null) return 'Bad path.';
    try {
      const items = await gh(t.env, `/repos/${t.env.GITHUB_REPO}/contents/${encodeURI(p)}`);
      if (!Array.isArray(items)) return `${p} is a file – use code_read.`;
      return items.slice(0, MAX_LIST).map((it) => `${it.type === 'dir' ? '📁' : '📄'} ${it.path}${it.type === 'file' ? ` (${it.size} bytes)` : ''}`).join('\n') || '(empty)';
    } catch (e) {
      return e.status === 404 ? `Not found: ${p}` : 'GitHub did not answer. Try again.';
    }
  },
  code_read: async ({ path, from_line }) => {
    const p = cleanPath(path);
    if (!p) return 'Bad path.';
    try {
      const text = await gh(t.env, `/repos/${t.env.GITHUB_REPO}/contents/${encodeURI(p)}`, { raw: true });
      const lines = String(text).split('\n');
      const start = Math.max(Number(from_line) || 1, 1);
      let out = '';
      let n = start;
      for (; n <= lines.length && out.length < MAX_READ; n++) out += `${n}\t${lines[n - 1]}\n`;
      return `${p} (lines ${start}-${n - 1} of ${lines.length})\n${out}${n <= lines.length ? `…[more – call again with from_line: ${n}]` : ''}`;
    } catch (e) {
      return e.status === 404 ? `Not found: ${p}` : 'GitHub did not answer. Try again.';
    }
  },
  code_search: async ({ query, path }) => {
    const q = String(query || '').replace(/["\\]/g, ' ').trim().slice(0, 120);
    if (!q) return 'Give words to search for.';
    const p = cleanPath(path);
    try {
      const r = await gh(t.env, `/search/code?per_page=30&q=${encodeURIComponent(`${q} repo:${t.env.GITHUB_REPO}${p ? ` path:${p}` : ''}`)}`);
      const items = (r.items || []).map((it) => it.path);
      return items.length ? `Files that match (main branch):\n${items.join('\n')}` : 'Nothing found. Try other words, or browse with code_tree.';
    } catch {
      return 'Code search is not available right now – browse with code_tree / code_read.';
    }
  },
});

export const CODE_TOOLS = [
  { name: 'code_apps', description: "List all the owner's apps in the repository (folder, name, what it is).", input_schema: { type: 'object', properties: {} } },
  { name: 'code_tree', description: 'List a folder in the repository (main branch), e.g. "mat_kon/web/src".', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'code_read', description: 'Read a file from the repository (main branch), with line numbers. Long files come in parts (from_line).', input_schema: { type: 'object', properties: { path: { type: 'string' }, from_line: { type: 'number' } }, required: ['path'] } },
  { name: 'code_search', description: 'Search the code of the repository for words (optionally inside a folder).', input_schema: { type: 'object', properties: { query: { type: 'string' }, path: { type: 'string', description: 'Folder to search in, e.g. "budget"' } }, required: ['query'] } },
  {
    name: 'code_change',
    description: 'Propose a fix or a new feature in one app. The owner sees it with an approve button; only after approval does the developer pipeline run (Claude Code in GitHub Actions: change, tests, pull request). Nothing changes before that.',
    input_schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'The app folder, e.g. "mat_kon"' },
        title: { type: 'string', description: 'Short Hebrew title' },
        summary: { type: 'string', description: 'One or two Hebrew sentences for the owner: what will change, for the user' },
        request: { type: 'string', description: 'The full, precise task for the developer (English is fine): what to change, where (files you found), expected behavior, edge cases, what not to touch' },
      },
      required: ['app', 'title', 'summary', 'request'],
    },
  },
];

// ---------- ההצעה (הכלי code_change) ----------
export async function proposeChange(t, job, input, started) {
  const { storage, env } = t;
  if (!devReady(env)) return 'The developer pipeline is not connected (no GitHub token). Tell the owner.';
  const app = cleanPath(input.app);
  const list = await appsOf(t);
  if (!app || app.includes('/') || (list.length && !list.some((a) => a.dir === app))) return `Unknown app folder "${input.app}". Use code_apps.`;
  const title = String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const summary = String(input.summary || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const request = String(input.request || '').trim().slice(0, 6000);
  if (!title || !summary || request.length < 30) return 'title, summary and a detailed request are required.';
  const rec = { id: newId(12), key: t.jobKey(job), app, title, summary, request, status: 'proposed', at: Date.now() };
  await storage.put(`d:${rec.id}`, rec);
  started.push(rec.id);
  return 'The change is shown to the owner with an approve button. Nothing changes until they approve. Tell them briefly what will change and that it waits for their approval; do not propose it again.';
}

// מה שהאפליקציה מציגה בכרטיס
export async function devView(t, id) {
  const d = await t.storage.get(`d:${id}`);
  if (!d) return null;
  const out = { id: d.id, app: d.app, title: d.title, summary: d.summary, status: STATUSES.includes(d.status) ? d.status : 'failed', at: d.at };
  if (d.status === 'working' && Date.now() - (d.startedAt || d.at) > STALE_MS) return { ...out, status: 'failed', error: 'העבודה לקחה יותר מדי זמן. אפשר לבקש שוב.' };
  if (d.pr) Object.assign(out, { pr: d.pr, url: d.url });
  if (d.result) out.result = d.result;
  if (d.question) out.question = d.question;
  if (d.status === 'failed') out.error = d.error || 'העבודה לא הצליחה. אפשר לבקש שוב.';
  return out;
}

// ---------- אישור / ביטול / מיזוג (מהאפליקציה) ----------
async function load(storage, id) {
  const d = await storage.get(`d:${String(id || '')}`);
  if (!d) throw fail(404, 'הבקשה לא נמצאה');
  return d;
}

export async function approveDev(t, id) {
  const { storage, env } = t;
  const d = await load(storage, id);
  if (d.status !== 'proposed') throw fail(409, 'הבקשה הזאת כבר טופלה');
  if (!devReady(env)) throw fail(503, 'החיבור ל-GitHub עוד לא מוכן');
  const dayKey = `devs:${israelDate()}`;
  const today = (await storage.get(dayKey)) || 0;
  if (today >= dailyDevLimit(env)) throw fail(429, `הגעת לתקרה של ${dailyDevLimit(env)} עבודות תכנות ליום. אפשר להמשיך מחר.`);
  try {
    await gh(env, `/repos/${env.GITHUB_REPO}/dispatches`, { method: 'POST', body: { event_type: 'tsevet-dev', client_payload: { id: d.id } } });
  } catch {
    throw fail(502, 'GitHub לא ענה. נסו שוב בעוד דקה.');
  }
  await storage.put(dayKey, today + 1);
  await storage.put(`d:${d.id}`, { ...d, status: 'working', startedAt: Date.now() });
  return { ok: true };
}

export async function cancelDev(storage, id) {
  const d = await load(storage, id);
  if (d.status !== 'proposed') throw fail(409, 'הבקשה הזאת כבר טופלה');
  await storage.put(`d:${d.id}`, { ...d, status: 'cancelled' });
  return { ok: true };
}

// מיזוג: רק PR שלנו (ענף tsevet-dev/<id>), פתוח, ושכל הבדיקות שלו עברו
export async function mergeDev(t, id) {
  const { storage, env } = t;
  const d = await load(storage, id);
  if (d.status !== 'ready' || !d.pr) throw fail(409, 'אין עדיין שינוי מוכן למיזוג');
  const repo = env.GITHUB_REPO;
  const pr = await gh(env, `/repos/${repo}/pulls/${d.pr}`).catch(() => null);
  if (!pr) throw fail(502, 'GitHub לא ענה. נסו שוב בעוד דקה.');
  if (pr.head?.ref !== `tsevet-dev/${d.id}`) throw fail(409, 'ה-PR לא שייך לבקשה הזאת');
  if (pr.merged) {
    await storage.put(`d:${d.id}`, { ...d, status: 'merged' });
    return { ok: true };
  }
  if (pr.state !== 'open') throw fail(409, 'ה-PR נסגר');
  const runs = await gh(env, `/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`).catch(() => null);
  const checks = runs?.check_runs || [];
  if (checks.some((c) => c.status !== 'completed')) throw fail(409, 'הבדיקות ב-GitHub עוד רצות. נסו שוב בעוד כמה דקות.');
  if (checks.some((c) => !['success', 'skipped', 'neutral'].includes(c.conclusion))) throw fail(409, 'הבדיקות ב-GitHub נכשלו – אפשר לבקש מהמתכנת לתקן.');
  try {
    await gh(env, `/repos/${repo}/pulls/${d.pr}/merge`, { method: 'PUT', body: { merge_method: 'squash', sha: pr.head.sha } });
  } catch (e) {
    throw fail(409, e.status === 405 ? 'GitHub לא מאפשר למזג כרגע (התנגשות או בדיקות). אפשר לבקש מהמתכנת לעדכן.' : 'המיזוג לא הצליח. נסו שוב.');
  }
  await storage.put(`d:${d.id}`, { ...d, status: 'merged', mergedAt: Date.now() });
  return { ok: true };
}

export async function discardDev(t, id) {
  const { storage, env } = t;
  const d = await load(storage, id);
  if (!['ready', 'question', 'failed'].includes(d.status)) throw fail(409, 'אי אפשר לבטל בשלב הזה');
  if (d.pr) await gh(env, `/repos/${env.GITHUB_REPO}/pulls/${d.pr}`, { method: 'PATCH', body: { state: 'closed' } }).catch(() => null);
  await storage.put(`d:${d.id}`, { ...d, status: 'discarded' });
  return { ok: true };
}

// ---------- מה שה-workflow מבקש (דרך worker.js, אחרי בדיקת הטוקן) ----------
async function working(storage, id) {
  const d = await storage.get(`d:${String(id || '')}`);
  if (!d || d.status !== 'working') throw fail(404, 'no such job');
  return d;
}

export async function devJob(storage, id) {
  const d = await working(storage, id);
  return { id: d.id, app: d.app, title: d.title, request: d.request };
}

// הודעה קצרה בשיחה (מהמתכנת), כדי שיהיה ברור שהעבודה התקדמה
async function note(t, d, text) {
  await t.pushHistory(d.key, { who: 'coder', text, devs: [d.id], at: Date.now() });
}

export async function devDone(t, id, body) {
  const d = await working(t.storage, id);
  const pr = Number(body.pr) || 0;
  const result = String(body.summary || '').trim().slice(0, 3000);
  if (!pr) throw fail(400, 'pr is required');
  const rec = { ...d, status: 'ready', pr, url: `https://github.com/${t.env.GITHUB_REPO}/pull/${pr}`, result, doneAt: Date.now() };
  await t.storage.put(`d:${d.id}`, rec);
  await note(t, rec, `✅ השינוי "${d.title}" מוכן. ${result ? `\n\n${result}\n\n` : ''}כשהבדיקות ב-GitHub יסתיימו – "למזג ולהעלות" בכרטיס.`);
  return { ok: true };
}

export async function devQuestion(t, id, body) {
  const d = await working(t.storage, id);
  const question = String(body.question || '').trim().slice(0, 2000);
  await t.storage.put(`d:${d.id}`, { ...d, status: 'question', question });
  await note(t, d, `❓ לפני שאני משנה את "${d.title}" – צריך הבהרה:\n\n${question}\n\nאפשר לענות כאן, ואכין בקשה מעודכנת.`);
  return { ok: true };
}

export async function devFail(t, id, body) {
  const d = await working(t.storage, id);
  const error = String(body.error || '').trim().slice(0, 300);
  await t.storage.put(`d:${d.id}`, { ...d, status: 'failed', error });
  await note(t, d, `⚠️ העבודה על "${d.title}" לא הצליחה${error ? ` (${error})` : ''}. אפשר לבקש שוב, אולי עם יותר פרטים.`);
  return { ok: true };
}

// עריכת וידאו ברקע. השרת עצמו לא יכול להריץ ffmpeg, ולכן:
//   1. הבוט 🎬 קורא ל-edit_video -> נשמרת עבודה (r:<id>) ונשלח אות ל-GitHub (repository_dispatch "tsevet-render")
//   2. .github/workflows/tsevet-render.yml מוריד את הקבצים, מריץ את כלי העריכה (.claude/skills) ומעלה את התוצאה
//   3. התוצאה נשמרת כקובץ, והכרטיס בשיחה הופך לסרטון
// ה-workflow מזדהה עם אותו טוקן של GitHub שיש גם לשרת (GITHUB_TOKEN). המאגר ציבורי: בלוג לא מודפס שום תוכן.
//
//   r:<id> -> { id, key, op, params, inputs: [file id], music, status: 'queued' | 'done' | 'failed', error, file, at }
//
// עריכה חכמה (smart_edit): Claude Code עורך את הסרטון עם הסקילים ghost-editor / Claude Shorts / ffmpeg-skill
// (.github/workflows/tsevet-smartedit.yml). עולה כמה דולרים, ולכן רק הצעה: status 'proposed' עד שהבעלים לוחץ
// "לערוך" (approveRender), עם תקרה יומית (DAILY_SMART). העלות האמיתית חוזרת מה-workflow ונרשמת במסך העלויות.
import { fail } from './auth.js';
import { addFile, fileView, israelDate, newId } from './app.js';

const STALE_MS = 40 * 60 * 1000;
const SMART_STALE_MS = 100 * 60 * 1000;
// תקרת הוצאה לעריכה חכמה אחת (דולר) ומספר עריכות ביום
export const SMART_MAX_USD = 12;
export const dailySmart = (env) => Number(env.DAILY_SMART) || 3;
export const SMART_TOOLS = { auto: 'הכי מתאים', 'ghost-editor': 'Ghost Editor', shorts: 'Claude Shorts', ffmpeg: 'FFmpeg' };
const OPS = {
  color_grade: { min: 1, max: 1, kinds: ['video'] },
  before_after: { min: 1, max: 2, kinds: ['video'] },
  hand_drawn: { min: 1, max: 1, kinds: ['video', 'image'] },
  motion_graphics: { min: 0, max: 6, kinds: ['video'] },
  beats_and_cuts: { min: 1, max: 8, kinds: ['video'], music: true },
  smart_edit: { min: 1, max: 8, kinds: ['video', 'image'], smart: true },
};
export const OP_LABELS = {
  color_grade: 'צבעוניות קולנועית',
  before_after: 'לפני / אחרי',
  hand_drawn: 'סגנון מצויר',
  motion_graphics: 'כותרות מונפשות',
  beats_and_cuts: 'חיתוך לפי הקצב',
  smart_edit: 'עריכה חכמה',
};

const EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/aac': 'aac' };
const extOf = (f) => EXT[f.type] || { video: 'mp4', image: 'jpg', audio: 'mp3' }[f.kind];
// שורה אחת, ולא מתחילה ב-"-" (שלא תיקרא כאפשרות בשורת הפקודה של כלי העריכה)
const text = (v, max) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().replace(/^-+\s*/, '').slice(0, max);

// רק מה שהכלים מכירים (שום דבר מהבוט לא מגיע לשורת הפקודה בלי בדיקה)
function cleanParams(input) {
  const p = {};
  if (['cinematic', 'warm', 'clean', 'bw'].includes(input.preset)) p.preset = input.preset;
  if (Number(input.strength)) p.strength = Math.min(Math.max(Number(input.strength), 0.3), 1.6);
  if (text(input.title, 80)) p.title = text(input.title, 80);
  if (Array.isArray(input.lines)) p.lines = input.lines.map((l) => text(l, 80)).filter(Boolean).slice(0, 8);
  if (['9:16', '16:9', '1:1'].includes(input.format)) p.format = input.format;
  if (Number(input.seconds)) p.seconds = Math.min(Math.max(Math.round(Number(input.seconds)), 2), 60);
  if (input.op === 'smart_edit') {
    p.tool = SMART_TOOLS[input.tool] ? input.tool : 'auto';
    // הבריף נכתב לקובץ שה-workflow קורא (לא לשורת הפקודה), ולכן מותרות כמה שורות
    p.brief = String(input.brief ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, 2000);
    if (Number(input.seconds)) p.seconds = Math.min(Math.max(Math.round(Number(input.seconds)), 5), 180);
  }
  return p;
}

// הכלי edit_video. מחזיר טקסט לבוט (באנגלית), ומוסיף את מזהה העבודה ל-started (כדי שההודעה שלו תציג אותה)
export async function startRender(t, job, input, started) {
  const { storage, env } = t;
  const spec = OPS[input.op];
  if (!spec) return 'Unknown op';
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.FILES) return 'Video rendering is not connected yet (the owner has to finish the one-time setup). Tell the owner; do not pretend it started.';

  const inputs = [];
  for (const id of Array.isArray(input.files) ? input.files : []) {
    const f = await storage.get(`f:${String(id)}`);
    if (!f) return `No such file: ${id}. Use the ids that appear in the conversation as [file <id>: ...].`;
    if (!spec.kinds.includes(f.kind)) return `File ${id} is ${f.kind}; ${input.op} needs ${spec.kinds.join(' or ')}.`;
    inputs.push(f.id);
  }
  if (inputs.length < spec.min) return `${input.op} needs at least ${spec.min} file(s). Ask the owner to upload.`;
  if (inputs.length > spec.max) return `${input.op} takes at most ${spec.max} file(s).`;
  let music = null;
  if (input.music) {
    const m = await storage.get(`f:${String(input.music)}`);
    if (m?.kind !== 'audio') return 'music must be the id of an uploaded audio file.';
    music = m.id;
  }
  if (spec.music && !music) return 'beats_and_cuts needs a song: ask the owner to upload an audio file.';
  const params = cleanParams(input);
  if (input.op === 'motion_graphics' && !params.lines?.length) return 'motion_graphics needs lines (one per scene).';
  if (spec.smart && !params.brief) return 'smart_edit needs a brief: what the finished video should be.';

  const rec = { id: newId(16), key: t.jobKey(job), op: input.op, params, inputs, music, status: spec.smart ? 'proposed' : 'queued', at: Date.now() };
  await storage.put(`r:${rec.id}`, rec);
  if (spec.smart) {
    started.push(rec.id);
    return `The smart edit proposal is shown to the owner with an approve button and its cost (a few dollars, at most $${SMART_MAX_USD}). Nothing runs or is charged until they approve; then it takes 10-40 minutes and the video appears in the chat by itself. Say briefly what you planned; do not propose the same edit again.`;
  }
  return dispatch(t, rec, 'tsevet-render', started);
}

// אות ל-GitHub שמתחיל את ה-workflow
async function dispatch(t, rec, event, started) {
  const { storage, env } = t;
  try {
    const res = await (env.FETCH || fetch)(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'tsevet', 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: event, client_payload: { id: rec.id } }),
    });
    if (!res.ok) throw new Error(`github ${res.status}`);
  } catch (e) {
    console.error('render dispatch', e.message);
    await storage.put(`r:${rec.id}`, { ...rec, status: 'failed', error: 'לא הצלחנו להתחיל את העריכה' });
    return 'Could not start the render (the render service did not answer). Tell the owner to try again later.';
  }
  if (started) started.push(rec.id);
  return 'Render started. It takes a few minutes and the finished video appears in the chat by itself. Tell the owner briefly what you chose; do not promise an exact time.';
}

// מה שהאפליקציה מציגה בכרטיס העריכה
export async function renderView(t, id, origin) {
  const r = await t.storage.get(`r:${id}`);
  if (!r) return null;
  const out = { id: r.id, op: r.op, label: OP_LABELS[r.op] || r.op, status: r.status, at: r.at };
  if (r.op === 'smart_edit') Object.assign(out, { tool: SMART_TOOLS[r.params?.tool] || SMART_TOOLS.auto, brief: r.params?.brief || '', files: r.inputs.length, maxUsd: SMART_MAX_USD, usd: r.usd || 0 });
  if (r.status === 'queued' && Date.now() - r.at > (r.op === 'smart_edit' ? SMART_STALE_MS : STALE_MS)) return { ...out, status: 'failed', error: 'העריכה לקחה יותר מדי זמן. אפשר לבקש שוב.' };
  if (r.status === 'failed') out.error = r.error || 'העריכה לא הצליחה. אפשר לבקש שוב.';
  if (r.status === 'done' && r.file) out.file = await fileView(t.storage, origin, await t.storage.get(`f:${r.file}`));
  return out;
}

// ---------- מה שה-workflow מבקש (דרך worker.js, אחרי בדיקת הטוקן) ----------
async function queued(storage, id) {
  const r = await storage.get(`r:${String(id || '')}`);
  if (!r || r.status !== 'queued') throw fail(404, 'no such render');
  return r;
}

export async function renderJob(storage, id) {
  const r = await queued(storage, id);
  const inputs = [];
  for (let n = 0; n < r.inputs.length; n++) {
    const f = await storage.get(`f:${r.inputs[n]}`);
    if (!f) throw fail(404, 'input is gone');
    inputs.push({ n, kind: f.kind, name: `in${n}.${extOf(f)}` });
  }
  const m = r.music ? await storage.get(`f:${r.music}`) : null;
  return { id: r.id, op: r.op, params: r.params, inputs, music: m ? { name: `music.${extOf(m)}` } : null };
}

// איזה קובץ ב-R2 להחזיר (n = מספר, או "music")
export async function renderInput(storage, id, n) {
  const r = await queued(storage, id);
  const fid = n === 'music' ? r.music : r.inputs[Number(n)];
  const f = fid ? await storage.get(`f:${fid}`) : null;
  if (!f) throw fail(404, 'no such input');
  return { key: `files/${f.id}`, type: f.type };
}

// usd = מה שעלתה עריכה חכמה (Claude Code), נרשם במסך העלויות של עורך הווידאו
const costOf = (usd) => Math.min(Math.max(Number(usd) || 0, 0), 100);

export async function renderDone(t, id, file, usd) {
  const { storage } = t;
  const r = await queued(storage, id);
  const rec = await addFile(storage, { id: file.id, kind: 'video', name: `${r.op}.mp4`, type: 'video/mp4', size: file.size, conv: 'render' });
  await storage.put(`r:${r.id}`, { ...r, status: 'done', file: rec.id, doneAt: Date.now(), usd: costOf(usd) });
  if (r.op === 'smart_edit') await t.addUsd(costOf(usd), 'editor', { smartEdits: 1, smartUsd: costOf(usd) });
  return { ok: true };
}

export async function renderFail(t, id, usd) {
  const { storage } = t;
  const r = await queued(storage, id);
  await storage.put(`r:${r.id}`, { ...r, status: 'failed', usd: costOf(usd) });
  if (r.op === 'smart_edit' && costOf(usd)) await t.addUsd(costOf(usd), 'editor', { smartUsd: costOf(usd) });
  return { ok: true };
}

// ---------- אישור / ביטול של עריכה חכמה (מהכרטיס בשיחה) ----------
export async function approveRender(t, id) {
  const { storage, env } = t;
  const r = await storage.get(`r:${String(id || '')}`);
  if (!r) throw fail(404, 'ההצעה לא נמצאה');
  if (r.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.FILES) throw fail(503, 'עריכת הווידאו עוד לא מחוברת');
  const dayKey = `smart:${israelDate()}`;
  const today = (await storage.get(dayKey)) || 0;
  if (today >= dailySmart(env)) throw fail(429, `הגעת לתקרה של ${dailySmart(env)} עריכות חכמות ליום. אפשר להמשיך מחר.`);
  await storage.put(dayKey, today + 1);
  const rec = { ...r, status: 'queued', at: Date.now() };
  await storage.put(`r:${r.id}`, rec);
  const msg = await dispatch(t, rec, 'tsevet-smartedit', null);
  if (msg.startsWith('Could not')) {
    await storage.put(dayKey, today);
    throw fail(502, 'לא הצלחנו להתחיל את העריכה. אפשר לנסות שוב.');
  }
  return { ok: true };
}

export async function cancelRender(storage, id) {
  const r = await storage.get(`r:${String(id || '')}`);
  if (!r) throw fail(404, 'ההצעה לא נמצאה');
  if (r.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  await storage.put(`r:${r.id}`, { ...r, status: 'cancelled' });
  return { ok: true };
}

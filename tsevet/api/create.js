// יצירות של הצוות כקבצים בשיחה (רק 🎨 קריאייטיב ו-👨‍💻 המתכנת):
//   make_file  – דף נחיתה (HTML), SVG, מסמך (Markdown), טבלה (CSV), JSON או טקסט. בחינם (רק הטקסט של הבוט), נשמר מיד
//                כקובץ בשיחה. בתוך HTML / SVG / Markdown אפשר לשים תמונה מהשיחה עם {{file:<id>}} – בזמן הפתיחה זה הופך
//                לקישור חתום ועדכני (קישורים חתומים פגים, ולכן לא שומרים אותם בקובץ).
//   make_image – תמונה ממחולל התמונות של Google. עולה כסף, ולכן רק הצעה: כרטיס עם "ליצור תמונה", ותקרה יומית (DAILY_IMAGES).
// דף HTML / SVG מוגש עם CSP של sandbox (worker.js), כך שקוד בתוכו לא יכול לגעת באפליקציה או בשרת.
//
//   im:<id>       -> { id, key, prompt, summary, aspect, image, status: proposed|working|done|failed|cancelled, file, error, at }
//   images:<תאריך> -> כמה תמונות נוצרו היום
import { fail } from './auth.js';
import { addFile, israelDate, newId } from './app.js';

export const CREATORS = ['creative', 'coder'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_DOC = 400_000;
const IMAGE_USD = 0.04;
const ASPECTS = ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3'];

export const DOC_TYPES = {
  html: { type: 'text/html; charset=utf-8', label: 'דף' },
  svg: { type: 'image/svg+xml', label: 'איור' },
  md: { type: 'text/markdown; charset=utf-8', label: 'מסמך' },
  csv: { type: 'text/csv; charset=utf-8', label: 'טבלה' },
  json: { type: 'application/json; charset=utf-8', label: 'נתונים' },
  txt: { type: 'text/plain; charset=utf-8', label: 'טקסט' },
};
export const LINKABLE = ['html', 'svg', 'md'];
const LINK_RE = /\{\{file:([a-z0-9]{8,32})\}\}/g;

export const imagesReady = (env) => Boolean(env.GEMINI_API_KEY && env.FILES);
export const dailyImages = (env) => Number(env.DAILY_IMAGES) || 30;

// שם קובץ נקי עם הסיומת הנכונה
export function fileName(name, ext) {
  const base = String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || 'קובץ';
  return `${base}.${ext}`;
}

// ---------- make_file ----------
export async function makeFile(t, input, made) {
  const { storage, env } = t;
  if (!env.FILES) return 'File storage is not connected. Give the content as text instead.';
  const ext = String(input.kind || '').toLowerCase();
  const spec = DOC_TYPES[ext];
  if (!spec) return `kind must be one of: ${Object.keys(DOC_TYPES).join(', ')}`;
  const content = String(input.content || '');
  if (content.trim().length < 10) return 'content is empty.';
  if (content.length > MAX_DOC) return `content is too long (max ${MAX_DOC} characters). Split it or simplify.`;
  // תמונות שמשולבות בקובץ – רק קבצים שקיימים
  const links = LINKABLE.includes(ext) ? [...new Set([...content.matchAll(LINK_RE)].map((m) => m[1]))] : [];
  for (const id of links) {
    const f = await storage.get(`f:${id}`);
    if (!f) return `No such file: ${id}. Use ids that appear in the conversation as [file <id>: ...].`;
  }
  const id = newId(16);
  const body = new TextEncoder().encode(content);
  await env.FILES.put(`files/${id}`, body, { httpMetadata: { contentType: spec.type } });
  const rec = await addFile(storage, { id, kind: 'doc', name: fileName(input.name, ext), type: spec.type, size: body.length, conv: 'made' });
  if (links.length) await storage.put(`f:${id}`, { ...rec, links });
  made.push({ id, kind: 'doc', name: rec.name, size: rec.size });
  return `Saved as [file ${id}: doc "${rec.name}"] – it appears in the chat as a file the owner can open and download. Tell them in one line what it is; don't paste the content again.`;
}

// ---------- make_image (הצעה) ----------
export async function proposeImage(t, job, input, started) {
  const { storage, env } = t;
  if (!imagesReady(env)) return 'The image generator is not connected yet. Tell the owner; describe the image in words instead.';
  const prompt = String(input.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 2500);
  const summary = String(input.summary || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (prompt.length < 20) return 'prompt is too short: describe the subject, composition, style, colors and light.';
  if (!summary) return 'summary (one Hebrew sentence for the owner) is required.';
  let image = null;
  if (input.image) {
    const f = await storage.get(`f:${String(input.image)}`);
    if (f?.kind !== 'image') return 'image must be the id of an image in the conversation ([file <id>: photo ...]).';
    image = f.id;
  }
  const rec = { id: newId(16), key: t.jobKey(job), prompt, summary, image, aspect: ASPECTS.includes(input.aspect) ? input.aspect : '1:1', status: 'proposed', at: Date.now() };
  await storage.put(`im:${rec.id}`, rec);
  started.push(rec.id);
  return 'The image proposal is shown to the owner with a "create" button. Nothing is generated (or charged) until they approve. Say briefly what it will show; do not propose the same image again.';
}

export async function imageView(t, id, origin, fileView) {
  const g = await t.storage.get(`im:${id}`);
  if (!g) return null;
  const out = { id: g.id, status: g.status, summary: g.summary, prompt: g.prompt, aspect: g.aspect, hasImage: Boolean(g.image), at: g.at };
  if (g.status === 'working' && Date.now() - (g.startedAt || g.at) > 5 * 60 * 1000) return { ...out, status: 'failed', error: 'יצירת התמונה לקחה יותר מדי זמן. אפשר לבקש שוב.' };
  if (g.status === 'failed') out.error = g.error || 'התמונה לא נוצרה. אפשר לבקש שוב.';
  if (g.status === 'done' && g.file) out.file = await fileView(t.storage, origin, await t.storage.get(`f:${g.file}`));
  return out;
}

// ---------- אישור / ביטול ----------
export async function approveImage(t, id) {
  const { storage, env } = t;
  const g = await storage.get(`im:${String(id || '')}`);
  if (!g) throw fail(404, 'ההצעה לא נמצאה');
  if (g.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  if (!imagesReady(env)) throw fail(503, 'מחולל התמונות עוד לא מחובר');
  const dayKey = `images:${israelDate()}`;
  const today = (await storage.get(dayKey)) || 0;
  if (today >= dailyImages(env)) throw fail(429, `הגעת לתקרה של ${dailyImages(env)} תמונות ליום. אפשר להמשיך מחר.`);
  await storage.put(dayKey, today + 1);
  await storage.put(`im:${g.id}`, { ...g, status: 'working', startedAt: Date.now() });
  let source = null;
  if (g.image) {
    const f = await storage.get(`f:${g.image}`);
    const obj = f ? await env.FILES.get(`files/${f.id}`) : null;
    if (obj) source = { media_type: f.type || 'image/jpeg', data: toBase64(new Uint8Array(await obj.arrayBuffer())) };
  }
  try {
    const img = await generateImage(env, g.prompt, g.aspect, source);
    const fileId = newId(16);
    const bytes = fromBase64(img.data);
    await env.FILES.put(`files/${fileId}`, bytes, { httpMetadata: { contentType: img.media_type } });
    const rec = await addFile(storage, { id: fileId, kind: 'image', name: fileName(g.summary, img.media_type.split('/')[1] || 'png'), type: img.media_type, size: bytes.length, conv: 'made' });
    await storage.put(`im:${g.id}`, { ...g, status: 'done', file: rec.id, doneAt: Date.now() });
    // ההודעה שהציעה את התמונה מקבלת את הקובץ – כך הבוטים רואים אותו (ואפשר לשלב אותו בדף נחיתה)
    const history = (await storage.get(g.key)) || [];
    const entry = history.find((h) => (h.images || []).includes(g.id));
    if (entry) {
      entry.made = [...(entry.made || []), { id: rec.id, kind: 'image', name: rec.name }];
      await storage.put(g.key, history);
    }
    await t.addUsd(IMAGE_USD, 'images', { images: 1 });
    return { ok: true };
  } catch (e) {
    await storage.put(`im:${g.id}`, { ...g, status: 'failed', error: e.message || 'התמונה לא נוצרה' });
    return { ok: false, error: e.message };
  }
}

export async function cancelImage(storage, id) {
  const g = await storage.get(`im:${String(id || '')}`);
  if (!g) throw fail(404, 'ההצעה לא נמצאה');
  if (g.status !== 'proposed') throw fail(409, 'ההצעה הזאת כבר טופלה');
  await storage.put(`im:${g.id}`, { ...g, status: 'cancelled' });
  return { ok: true };
}

// ---------- Google (כמו ב-home_design/api/render.js) ----------
const KNOWN = ['gemini-nano-banana-2.1', 'gemini-2.5-flash-image'];
let found = null;

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function readImage(data) {
  for (const c of data?.candidates || []) {
    for (const p of c?.content?.parts || []) {
      const im = p.inlineData || p.inline_data;
      if (im?.data) return { media_type: im.mimeType || im.mime_type || 'image/png', data: im.data };
    }
  }
  return null;
}

export function imageMessage(status, text) {
  const s = String(text || '').toLowerCase();
  if (status === 400 && /api key|api_key/.test(s)) return 'מפתח Google לא תקין. צריך לעדכן את GEMINI_API_KEY בסודות של GitHub.';
  if (status === 402 || /credits are depleted|prepay/.test(s)) return 'נגמר הקרדיט בחשבון Google. צריך לטעון קרדיט ב-AI Studio ואז לנסות שוב.';
  if (status === 401 || status === 403) return 'מפתח Google לא תקין או שאין לו הרשאה ליצירת תמונות.';
  if (status === 429 || status >= 500) return 'יש עומס אצל מחולל התמונות. נסו שוב בעוד דקה.';
  if (/safety|policy|blocked|prohibited/.test(s)) return 'מחולל התמונות סירב לבקשה הזאת. נסו לנסח אחרת.';
  return 'לא הצלחנו ליצור את התמונה. נסו שוב.';
}

async function generateImage(env, prompt, aspect, source) {
  const queue = [...new Set([found, env.IMAGE_MODEL, ...KNOWN].filter(Boolean))];
  const text = `${prompt}\n\nAspect ratio ${aspect}. No watermarks. Any text in the image must be spelled exactly as given (Hebrew right-to-left).`;
  let res, raw;
  for (const model of queue) {
    res = await (env.FETCH || fetch)(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [...(source ? [{ inlineData: { mimeType: source.media_type, data: source.data } }] : []), { text }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect } },
      }),
    });
    raw = await res.text();
    if (res.ok) {
      found = model;
      break;
    }
    if (!(res.status === 404 || (res.status === 400 && /model|not found|not supported|modalit/i.test(raw)))) break;
  }
  if (!res?.ok) throw new Error(imageMessage(res?.status || 0, raw));
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('לא הצלחנו ליצור את התמונה. נסו שוב.');
  }
  const out = readImage(data);
  if (!out) throw new Error(/SAFETY|PROHIBITED|BLOCK/i.test(JSON.stringify(data?.promptFeedback || data?.candidates?.[0]?.finishReason || '')) ? 'מחולל התמונות סירב לבקשה הזאת. נסו לנסח אחרת.' : 'מחולל התמונות לא החזיר תמונה. נסו שוב.');
  return out;
}

// ---------- הכלים (agents.js) ----------
export const CREATE_TOOLS = (images) => [
  {
    name: 'make_file',
    description: 'Create a file the owner gets in the chat: a landing page (html – one complete self-contained HTML file with inline CSS, RTL Hebrew, mobile-first), an illustration (svg), a document (md), a table (csv), json or txt. To place an image from the conversation inside html/svg/md use {{file:<id>}} as its src (e.g. <img src="{{file:abc123}}">). Free – only your text.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: Object.keys(DOC_TYPES) },
        name: { type: 'string', description: 'Short file name in Hebrew or English, without extension' },
        content: { type: 'string', description: 'The full file content' },
      },
      required: ['kind', 'name', 'content'],
    },
  },
  ...(images
    ? [{
      name: 'make_image',
      description: "Propose a new image from Google's image generator (about $0.04). The owner sees it with a \"create\" button; it is generated only after approval, then appears in the chat as [file <id>: image] and can be placed in a landing page. Optionally start from a photo in the conversation (image: its id) to edit it.",
      input_schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed English prompt: subject, composition, style, colors, light; exact text if any' },
          summary: { type: 'string', description: 'One Hebrew sentence for the owner: what the image shows' },
          aspect: { type: 'string', enum: ASPECTS },
          image: { type: 'string', description: 'Optional: id of a photo in the conversation to start from' },
        },
        required: ['prompt', 'summary'],
      },
    }]
    : []),
];

// ---------- הגשה: קישורים חתומים לתמונות שבתוך הקובץ ----------
export function fillLinks(text, urls) {
  return text.replace(LINK_RE, (all, id) => urls[id] || '');
}

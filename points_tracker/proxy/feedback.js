// "שלח תיקון": בקשת תיקון מהאפליקציה נפתחת כ-issue ב-GitHub עם התווית bis-fix,
// צילום המסך לא נכנס ל-issue (המאגר ציבורי): הוא נשמר כאן, ורק התהליך ב-GitHub
// (עם קוד המנהל) יכול להוריד אותו.

const MAX_TEXT = 3000;
const MAX_IMAGE_CHARS = 1_500_000; // JPEG מוקטן ב-base64
const MAX_PER_DAY = 20;
const KEEP_SHOTS_MS = 30 * 24 * 60 * 60 * 1000;
export const LABEL = 'bis-fix';

const reply = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function readJson(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}

// נקרא מתוך ה-Durable Object: מכסה יומית ושמירת צילומי מסך.
export async function handleFeedback(storage, path, request) {
  const now = Date.now();

  if (path === '/feedback/quota') {
    const key = `quota:${new Date(now).toISOString().slice(0, 10)}`;
    const used = (await storage.get(key)) || 0;
    if (used >= MAX_PER_DAY) return reply(429, { error: 'Too many requests today' });
    await storage.put(key, used + 1);
    return reply(200, { ok: true });
  }

  if (path === '/feedback/shot' && request.method === 'POST') {
    const { id, data } = await readJson(request);
    if (typeof id !== 'string' || typeof data !== 'string') return reply(400, { error: 'Bad request' });
    const old = await storage.list({ prefix: 'shot:' });
    for (const [key, shot] of old) if (now - shot.created > KEEP_SHOTS_MS) await storage.delete(key);
    await storage.put(`shot:${id}`, { data, created: now });
    return reply(201, { ok: true });
  }

  if (path === '/feedback/shot' && request.method === 'GET') {
    const id = new URL(request.url).searchParams.get('id') || '';
    const shot = await storage.get(`shot:${id}`);
    return shot ? reply(200, { data: shot.data }) : reply(404, { error: 'Not found' });
  }

  return reply(404, { error: 'Not found' });
}

// מנקה את הבקשה מהאפליקציה. מחזיר null אם אין טקסט.
export function cleanFeedback(body) {
  // בלי הערות HTML: השורה של צילום המסך ב-issue נכתבת רק כאן
  const text = typeof body?.text === 'string' ? body.text.replace(/<!--|-->/g, '').trim().slice(0, MAX_TEXT) : '';
  if (!text) return null;
  const match = typeof body.image === 'string' && body.image.match(/^data:image\/(jpeg);base64,([A-Za-z0-9+/=]+)$/);
  const image = match && match[2].length <= MAX_IMAGE_CHARS ? { type: match[1], data: match[2] } : null;
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  const short = (v, n = 200) => (typeof v === 'string' ? v.replace(/[\r\n`<>]/g, ' ').slice(0, n) : '');
  return { text, image, context: { env: short(ctx.env, 20), view: short(ctx.view, 40), device: short(ctx.device) } };
}

export function issueTitle(text) {
  const line = text.split('\n')[0].trim();
  return `תיקון מהאפליקציה: ${line.length > 60 ? `${line.slice(0, 60)}…` : line}`;
}

export function issueBody(feedback, from, shotUrl) {
  const { context } = feedback;
  const details = [
    `- נשלח מ: ${from || 'לא ידוע'}`,
    context.env && `- סביבה: ${context.env}`,
    context.view && `- מסך: ${context.view}`,
    context.device && `- מכשיר: ${context.device}`,
    shotUrl ? '- צורף צילום מסך (שמור בשרת של האפליקציה, לא ציבורי)' : '- בלי צילום מסך',
    shotUrl && `<!-- bis-fix-screenshot: ${shotUrl} -->`,
  ].filter(Boolean);
  return `${feedback.text}\n\n---\n${details.join('\n')}`;
}

export async function createIssue(env, title, body) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'bis-api',
    },
    body: JSON.stringify({ title, body, labels: [LABEL] }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const issue = await res.json();
  return { number: issue.number };
}

// "שלח תיקון": בקשה מהאפליקציה נפתחת כ-issue ב-GitHub עם התווית bis-fix. התהליך
// .github/workflows/bis-fix.yml מפעיל את Claude, ומכין PR לאישור (ענף bis-fix/<מספר>).
// הכול מתוך האפליקציה, בלי GitHub: רואים את המצב, עונים לשאלות של Claude, ומאשרים או דוחים.
// צילום המסך לא נכנס ל-issue (המאגר ציבורי): הוא נשמר כאן, ורק התהליך ב-GitHub
// (עם קוד המנהל) יכול להוריד אותו.

const MAX_TEXT = 3000;
const MAX_IMAGE_CHARS = 1_500_000; // JPEG מוקטן ב-base64
const MAX_PER_DAY = 20;
const LIST_LIMIT = 10;
const KEEP_SHOTS_MS = 30 * 24 * 60 * 60 * 1000;
const BOT = 'github-actions[bot]';
export const LABEL = 'bis-fix';

// מצב הבקשה לפי התוויות שהתהליך שם
const STATUS_LABELS = [
  ['bis-done', 'done'],
  ['bis-rejected', 'rejected'],
  ['bis-ready', 'ready'],
  ['bis-question', 'question'],
  ['bis-failed', 'failed'],
  ['bis-working', 'working'],
];

const reply = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function readJson(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}

// ---------- בתוך ה-Durable Object: מכסה יומית, צילומי מסך, ואיזה מכשיר שלח איזו בקשה ----------

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

  if (path === '/feedback/req') {
    const { number, device } = await readJson(request);
    await storage.put(`req:${String(number).padStart(8, '0')}`, { number, device, created: now });
    return reply(201, { ok: true });
  }

  // הבקשות של המכשיר (בעל האפליקציה רואה את כולן), מהחדשה לישנה
  if (path === '/feedback/mine') {
    const { device } = await readJson(request);
    const all = [...(await storage.list({ prefix: 'req:' })).values()];
    const mine = all.filter((r) => device === 'owner' || r.device === device);
    return reply(200, { numbers: mine.map((r) => r.number).sort((a, b) => b - a).slice(0, LIST_LIMIT) });
  }

  if (path === '/feedback/owns') {
    const { number, device } = await readJson(request);
    const req = await storage.get(`req:${String(number).padStart(8, '0')}`);
    return req && (device === 'owner' || req.device === device) ? reply(200, { ok: true }) : reply(403, { error: 'Not yours' });
  }

  return reply(404, { error: 'Not found' });
}

// ---------- בקשה חדשה ----------

// מנקה את הבקשה מהאפליקציה. מחזיר null אם אין טקסט.
export function cleanFeedback(body) {
  const text = cleanText(body?.text);
  if (!text) return null;
  const match = typeof body.image === 'string' && body.image.match(/^data:image\/(jpeg);base64,([A-Za-z0-9+/=]+)$/);
  const image = match && match[2].length <= MAX_IMAGE_CHARS ? { type: match[1], data: match[2] } : null;
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  const short = (v, n = 200) => (typeof v === 'string' ? v.replace(/[\r\n`<>]/g, ' ').slice(0, n) : '');
  return { text, image, context: { env: short(ctx.env, 20), view: short(ctx.view, 40), device: short(ctx.device) } };
}

// בלי הערות HTML: השורה של צילום המסך ב-issue נכתבת רק כאן
const cleanText = (t) => (typeof t === 'string' ? t.replace(/<!--|-->/g, '').trim().slice(0, MAX_TEXT) : '');

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

// ---------- GitHub ----------

async function github(env, path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'bis-api',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}`), { status: res.status });
  return res.status === 204 ? null : res.json();
}

export function statusOf(issue) {
  const names = new Set((issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name)));
  const found = STATUS_LABELS.find(([label]) => names.has(label));
  if (found) return found[1];
  return issue.state === 'closed' ? 'closed' : 'received';
}

// ההודעה האחרונה של Claude (התהליך ב-GitHub), בלי הערות HTML ובלי שורת העלות
export function lastBotMessage(comments) {
  const last = [...comments].reverse().find((c) => c.user?.login === BOT);
  if (!last) return '';
  return last.body.replace(/<!--[\s\S]*?-->/g, '').replace(/\s*\(עלות משוערת: [^)]*\)\s*$/, '').trim();
}

const branchOf = (number) => `bis-fix/${number}`;

async function openPr(env, number) {
  const owner = env.GITHUB_REPO.split('/')[0];
  const prs = await github(env, `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branchOf(number)}`)}`);
  return prs[0] || null;
}

async function setLabels(env, number, status) {
  await github(env, `/issues/${number}/labels`, { method: 'PUT', body: { labels: [LABEL, status] } });
}

async function listRequests(env, numbers) {
  return Promise.all(
    numbers.map(async (number) => {
      try {
        const issue = await github(env, `/issues/${number}`);
        const status = statusOf(issue);
        const comments = status === 'received' ? [] : await github(env, `/issues/${number}/comments?per_page=100`);
        return {
          number,
          title: issue.title.replace(/^תיקון מהאפליקציה: /, ''),
          status,
          message: lastBotMessage(comments),
          created: issue.created_at,
        };
      } catch {
        return { number, title: '', status: 'unknown', message: '' };
      }
    }),
  );
}

// ---------- הנתיבים של /feedback (אחרי שה-worker בדק שהמכשיר מחובר) ----------

export async function feedbackRoute({ request, url, env, internal, device, from }) {
  if (!env.FOODS || !env.GITHUB_TOKEN || !env.GITHUB_REPO) return reply(500, { error: 'Feedback is not configured' });
  const body = request.method === 'POST' ? await request.text() : '';
  if (body.length > 2 * 1024 * 1024) return reply(413, { error: 'Request too large' });
  let data = {};
  try {
    data = body ? JSON.parse(body) || {} : {};
  } catch {
    data = {};
  }

  // בקשה חדשה
  if (url.pathname === '/feedback' && request.method === 'POST') {
    const feedback = cleanFeedback(data);
    if (!feedback) return reply(400, { error: 'Empty request' });
    if (!(await internal('/feedback/quota', 'POST', {})).ok) return reply(429, { error: 'Too many requests today' });
    let shotUrl = '';
    if (feedback.image) {
      const id = randomId();
      await internal('/feedback/shot', 'POST', { id, data: feedback.image.data });
      shotUrl = `${url.origin}/feedback/image?id=${id}`;
    }
    try {
      const issue = await github(env, '/issues', {
        method: 'POST',
        body: { title: issueTitle(feedback.text), body: issueBody(feedback, from, shotUrl), labels: [LABEL] },
      });
      await internal('/feedback/req', 'POST', { number: issue.number, device });
      return reply(201, { number: issue.number });
    } catch (err) {
      return reply(502, { error: `Could not open the request (${err.message})` });
    }
  }

  // הבקשות שלי ומצבן
  if (url.pathname === '/feedback' && request.method === 'GET') {
    const { numbers } = await (await internal('/feedback/mine', 'POST', { device })).json();
    return reply(200, { requests: await listRequests(env, numbers) });
  }

  // פעולות על בקשה: אישור, דחייה, ניסיון חוזר, תשובה ל-Claude
  const action = url.pathname.match(/^\/feedback\/(approve|reject|retry|reply)$/)?.[1];
  if (!action || request.method !== 'POST') return reply(404, { error: 'Not found' });
  const number = Number(data.number);
  if (!Number.isInteger(number) || number <= 0) return reply(400, { error: 'Bad request' });
  if (!(await internal('/feedback/owns', 'POST', { number, device })).ok) return reply(403, { error: 'Not yours' });

  try {
    const issue = await github(env, `/issues/${number}`);
    if (issue.state !== 'open') return reply(409, { error: 'הבקשה כבר סגורה' });
    const status = statusOf(issue);

    if (action === 'reply') {
      const text = cleanText(data.text);
      if (!text) return reply(400, { error: 'Empty reply' });
      // תגובה בשם בעל המאגר מפעילה את Claude שוב עם כל השיחה
      await github(env, `/issues/${number}/comments`, { method: 'POST', body: { body: text } });
      return reply(200, { ok: true });
    }

    if (action === 'retry') {
      if (status === 'working') return reply(409, { error: 'Claude כבר עובד על הבקשה' });
      await github(env, `/issues/${number}/labels`, { method: 'POST', body: { labels: ['bis-retry'] } });
      return reply(200, { ok: true });
    }

    const pr = await openPr(env, number);

    if (action === 'approve') {
      if (status !== 'ready' || !pr) return reply(409, { error: 'אין שינוי מוכן לאישור' });
      try {
        await github(env, `/pulls/${pr.number}/merge`, { method: 'PUT', body: { merge_method: 'merge' } });
      } catch {
        return reply(409, { error: 'לא הצלחתי להעלות את השינוי. לחצו "לנסות שוב" ו-Claude יכין אותו מחדש.' });
      }
      await setLabels(env, number, 'bis-done');
      await github(env, `/issues/${number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
      await github(env, `/git/refs/heads/${branchOf(number)}`, { method: 'DELETE' }).catch(() => {});
      // גם סביבת הבדיקות מקבלת את השינוי
      await github(env, '/merges', { method: 'POST', body: { base: 'staging', head: 'main' } }).catch(() => {});
      return reply(200, { ok: true });
    }

    // reject
    if (pr) {
      await github(env, `/pulls/${pr.number}`, { method: 'PATCH', body: { state: 'closed' } });
      await github(env, `/git/refs/heads/${branchOf(number)}`, { method: 'DELETE' }).catch(() => {});
    }
    await setLabels(env, number, 'bis-rejected');
    await github(env, `/issues/${number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'not_planned' } });
    return reply(200, { ok: true });
  } catch (err) {
    return reply(502, { error: `GitHub error (${err.message})` });
  }
}

function randomId() {
  const raw = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

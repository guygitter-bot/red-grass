// "בקשת שינוי" מתוך האפליקציה (כמו "שלח תיקון" באפליקציית ביס): הבקשה נפתחת כ-issue ב-GitHub עם התווית
// budget-fix. התהליך .github/workflows/budget-fix.yml מפעיל את Claude, ומכין PR לאישור (ענף budget-fix/<מספר>).
// הכול מתוך האפליקציה: רואים את המצב, עונים לשאלות של Claude, ומאשרים ("לאשר ולהעלות" ממזג) או דוחים.
// המאגר ציבורי: צילום המסך (יכול להכיל נתונים כספיים) לא נכנס ל-issue. הוא נשמר כאן, ורק התהליך ב-GitHub
// מוריד אותו – עם אותו טוקן GitHub שיש לשרת (POINTS_GITHUB_TOKEN).

const MAX_TEXT = 3000;
const MAX_IMAGE_CHARS = 1_500_000; // JPEG מוקטן ב-base64
const MAX_PER_DAY = 10;
const LIST_LIMIT = 15;
const KEEP_SHOTS_MS = 30 * 24 * 60 * 60 * 1000;
const BOT = 'github-actions[bot]';
export const LABEL = 'budget-fix';

// מצב הבקשה לפי התוויות שהתהליך שם
const STATUS_LABELS = [
  ['budget-done', 'done'],
  ['budget-rejected', 'rejected'],
  ['budget-ready', 'ready'],
  ['budget-question', 'question'],
  ['budget-failed', 'failed'],
  ['budget-working', 'working'],
];

const fail = (status, error) => Object.assign(new Error(error), { status });

// בלי הערות HTML: השורה של צילום המסך ב-issue נכתבת רק כאן
const cleanText = (t) => (typeof t === 'string' ? t.replace(/<!--|-->/g, '').trim().slice(0, MAX_TEXT) : '');

export function cleanRequest(body) {
  const text = cleanText(body?.text);
  if (!text) return null;
  const match = typeof body.image === 'string' && body.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  const image = match && match[1].length <= MAX_IMAGE_CHARS ? match[1] : null;
  const short = (v, n) => (typeof v === 'string' ? v.replace(/[\r\n`<>]/g, ' ').slice(0, n) : '');
  return { text, image, view: short(body.view, 40), device: short(body.device, 200) };
}

export function issueTitle(text) {
  const line = text.split('\n')[0].trim();
  return `תקציב הבית – שינוי מהאפליקציה: ${line.length > 60 ? `${line.slice(0, 60)}…` : line}`;
}

export function issueBody(req, shotUrl) {
  const details = [
    req.view && `- מסך: ${req.view}`,
    req.device && `- מכשיר: ${req.device}`,
    shotUrl ? '- צורף צילום מסך (שמור בשרת של האפליקציה, לא ציבורי)' : '- בלי צילום מסך',
    shotUrl && `<!-- budget-fix-screenshot: ${shotUrl} -->`,
  ].filter(Boolean);
  return `${req.text}\n\n---\n${details.join('\n')}`;
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

const branchOf = (number) => `budget-fix/${number}`;

function randomId() {
  const raw = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// הכול רץ בתוך ה-Durable Object (אחרי שנבדקה הכניסה בסיסמה)
export class Fixes {
  constructor({ storage, env, now, origin }) {
    this.storage = storage;
    this.env = env;
    this.now = now;
    this.origin = origin;
    this.fetch = env.FETCH || ((...a) => fetch(...a));
  }

  get ready() {
    return !!(this.env.GITHUB_TOKEN && this.env.GITHUB_REPO);
  }

  async github(path, { method = 'GET', body } = {}) {
    const res = await this.fetch(`https://api.github.com/repos/${this.env.GITHUB_REPO}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'bayit-budget-api',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}`), { status: res.status });
    return res.status === 204 ? null : res.json();
  }

  async numbers() {
    return (await this.storage.get('fix-numbers')) || [];
  }

  async send(body) {
    if (!this.ready) throw fail(503, 'בקשות שינוי עוד לא הופעלו בשרת');
    const req = cleanRequest(body);
    if (!req) throw fail(400, 'מה לשנות?');
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const quota = (await this.storage.get('fix-quota')) || {};
    if (quota.day !== day) Object.assign(quota, { day, count: 0 });
    if (quota.count >= MAX_PER_DAY) throw fail(429, 'נשלחו היום הרבה בקשות. אפשר לשלוח שוב מחר');
    quota.count += 1;
    await this.storage.put('fix-quota', quota);

    let shotUrl = '';
    if (req.image) {
      // צילומים ישנים נמחקים
      for (const [key, shot] of await this.storage.list({ prefix: 'shot:' })) {
        if (this.now() - shot.created > KEEP_SHOTS_MS) await this.storage.delete(key);
      }
      const id = randomId();
      await this.storage.put(`shot:${id}`, { data: req.image, created: this.now() });
      shotUrl = `${this.origin}/fix/image?id=${id}`;
    }
    let issue;
    try {
      issue = await this.github('/issues', { method: 'POST', body: { title: issueTitle(req.text), body: issueBody(req, shotUrl), labels: [LABEL] } });
    } catch (err) {
      throw fail(502, `לא הצלחתי לשלוח את הבקשה (${err.message})`);
    }
    await this.storage.put('fix-numbers', [issue.number, ...(await this.numbers())].slice(0, 100));
    return { number: issue.number };
  }

  async list() {
    if (!this.ready) return { enabled: false, requests: [] };
    const numbers = (await this.numbers()).slice(0, LIST_LIMIT);
    const requests = await Promise.all(
      numbers.map(async (number) => {
        try {
          const issue = await this.github(`/issues/${number}`);
          const status = statusOf(issue);
          const comments = status === 'received' ? [] : await this.github(`/issues/${number}/comments?per_page=100`);
          return { number, title: issue.title.replace(/^.*?שינוי מהאפליקציה: /, ''), status, message: lastBotMessage(comments), created: issue.created_at };
        } catch {
          return { number, title: '', status: 'unknown', message: '' };
        }
      }),
    );
    return { enabled: true, requests };
  }

  // approve | reject | retry | reply
  async act(action, { number, text }) {
    if (!this.ready) throw fail(503, 'בקשות שינוי עוד לא הופעלו בשרת');
    number = Number(number);
    // רק בקשות שנשלחו מכאן
    if (!Number.isInteger(number) || !(await this.numbers()).includes(number)) throw fail(403, 'הבקשה לא נמצאה');
    try {
      const issue = await this.github(`/issues/${number}`);
      if (issue.state !== 'open') throw fail(409, 'הבקשה כבר סגורה');
      const status = statusOf(issue);
      const labels = (s) => this.github(`/issues/${number}/labels`, { method: 'PUT', body: { labels: [LABEL, s] } });
      const close = (reason) => this.github(`/issues/${number}`, { method: 'PATCH', body: { state: 'closed', state_reason: reason } });
      const dropBranch = () => this.github(`/git/refs/heads/${branchOf(number)}`, { method: 'DELETE' }).catch(() => {});

      if (action === 'reply') {
        const reply = cleanText(text);
        if (!reply) throw fail(400, 'מה לכתוב?');
        // תגובה בשם בעל המאגר מפעילה את Claude שוב עם כל השיחה
        await this.github(`/issues/${number}/comments`, { method: 'POST', body: { body: reply } });
        return { ok: true };
      }
      if (action === 'retry') {
        if (status === 'working') throw fail(409, 'Claude כבר עובד על הבקשה');
        await this.github(`/issues/${number}/labels`, { method: 'POST', body: { labels: ['budget-retry'] } });
        return { ok: true };
      }
      const owner = this.env.GITHUB_REPO.split('/')[0];
      const prs = await this.github(`/pulls?state=open&head=${encodeURIComponent(`${owner}:${branchOf(number)}`)}`);
      const pr = prs[0];
      if (action === 'approve') {
        if (status !== 'ready' || !pr) throw fail(409, 'אין שינוי מוכן לאישור');
        try {
          await this.github(`/pulls/${pr.number}/merge`, { method: 'PUT', body: { merge_method: 'squash' } });
        } catch {
          throw fail(409, 'לא הצלחתי להעלות את השינוי. לחצו "לנסות שוב" ו-Claude יכין אותו מחדש.');
        }
        await labels('budget-done');
        await close('completed');
        await dropBranch();
        return { ok: true };
      }
      if (action === 'reject') {
        if (pr) {
          await this.github(`/pulls/${pr.number}`, { method: 'PATCH', body: { state: 'closed' } });
          await dropBranch();
        }
        await labels('budget-rejected');
        await close('not_planned');
        return { ok: true };
      }
      throw fail(404, 'לא נמצא');
    } catch (err) {
      if (err.status && err.message && !/^GitHub /.test(err.message)) throw err;
      throw fail(502, `תקלה מול GitHub (${err.message})`);
    }
  }

  // צילום המסך – רק לתהליך ב-GitHub (מזדהה עם אותו טוקן)
  async image(id) {
    const shot = await this.storage.get(`shot:${id}`);
    return shot ? shot.data : null;
  }
}

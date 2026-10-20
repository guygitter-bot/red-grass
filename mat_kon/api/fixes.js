// "שלח ל-Claude לטיפול" באפליקציית הניהול: תקלה נפתחת כ-issue ב-GitHub עם התווית matkon-fix. התהליך
// .github/workflows/mat-kon-fix.yml מפעיל את Claude, שחוקר ומכין PR לאישור (ענף matkon-fix/<מספר>).
// הכול מתוך אפליקציית הניהול: רואים את המצב וההסבר, עונים לשאלות, ומאשרים ("לאשר ולהעלות" ממזג) או דוחים.
// המאגר ציבורי: ב-issue אין אימיילים של משתמשים, וקישורים מקוצרים לשם האתר בלבד.
import { deps } from './deps.js';

export const LABEL = 'matkon-fix';
const BOT = 'github-actions[bot]';
const MAX_NOTE = 2000;
// מצב הבקשה לפי התוויות שהתהליך שם
const STATUS_LABELS = [
  ['matkon-done', 'done'],
  ['matkon-rejected', 'rejected'],
  ['matkon-ready', 'ready'],
  ['matkon-question', 'question'],
  ['matkon-nobug', 'nobug'],
  ['matkon-failed', 'failed'],
  ['matkon-working', 'working'],
];

// בלי קישורים מלאים (רק שם האתר), בלי אימיילים, בלי הערות HTML
export function redact(text) {
  return String(text || '')
    .replace(/<!--|-->/g, '')
    .replace(/https?:\/\/([^/\s"'<>]+)[^\s"'<>]*/g, (_, host) => `[קישור ל-${host.replace(/^(www|m|web)\./, '')}]`)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[אימייל]');
}

const WHERE = { client: 'באפליקציה (מסך משהו השתבש)', server: 'בשרת' };
export function fixTitle(issue) {
  const line = redact(issue.message).split('\n')[0].trim();
  return `mat-kon: ${line.length > 70 ? `${line.slice(0, 70)}…` : line}`;
}
export function fixBody(issue, note) {
  const details = [
    `- איפה: ${WHERE[issue.list] || issue.list} · \`${redact(issue.where)}\``,
    issue.group && `- קבוצה: \`${redact(issue.group)}\``,
    `- כמה פעמים: ${issue.count} (ראשונה ${String(issue.firstAt).slice(0, 10)}, אחרונה ${String(issue.lastAt).slice(0, 10)})`,
    `- משתמשים שנפגעו: ${(issue.users || []).length}`,
    issue.reopened && '- התקלה חזרה אחרי שסומנה כמתוקנת',
  ].filter(Boolean);
  const extra = redact(note).trim().slice(0, MAX_NOTE);
  return `התקלה כפי שנרשמה:\n\n\`\`\`\n${redact(issue.message).slice(0, 1000)}\n\`\`\`\n\n${details.join('\n')}${extra ? `\n\nהערה של בעל האפליקציה:\n${extra}` : ''}`;
}

// ---------- GitHub ----------
async function github(env, path, { method = 'GET', body } = {}) {
  const res = await deps.fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.FIX_GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'mat-kon-api',
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

const branchOf = (number) => `matkon-fix/${number}`;
async function openPr(env, number) {
  const owner = env.GITHUB_REPO.split('/')[0];
  const prs = await github(env, `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branchOf(number)}`)}`);
  return prs[0] || null;
}
async function setLabels(env, number, status) {
  await github(env, `/issues/${number}/labels`, { method: 'PUT', body: { labels: [LABEL, status] } });
}

export const fixConfigured = (env) => Boolean(env.FIX_GITHUB_TOKEN && env.FIX_GITHUB_TOKEN !== 'none' && env.GITHUB_REPO);

// שליחת תקלה ל-Claude: מחזיר את מספר ה-issue
export async function sendFix(env, issue, note) {
  const created = await github(env, '/issues', { method: 'POST', body: { title: fixTitle(issue), body: fixBody(issue, note), labels: [LABEL] } });
  return created.number;
}

// מצב הטיפול: מצב, ההודעה האחרונה של Claude, והאם יש שינוי מוכן
export async function fixStatus(env, number) {
  const issue = await github(env, `/issues/${number}`);
  const status = statusOf(issue);
  const comments = status === 'received' ? [] : await github(env, `/issues/${number}/comments?per_page=100`);
  return { number, status, message: lastBotMessage(comments), url: issue.html_url };
}

// פעולות: אישור (מיזוג), דחייה, ניסיון חוזר, תשובה ל-Claude. מחזיר { status, data }
export async function fixAction(env, number, action, text) {
  const issue = await github(env, `/issues/${number}`);
  const names = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  if (!names.includes(LABEL)) return { status: 404, data: { error: 'הבקשה לא נמצאה' } };
  if (issue.state !== 'open') return { status: 409, data: { error: 'הבקשה כבר סגורה' } };
  const status = statusOf(issue);
  if (action === 'reply') {
    const clean = redact(text).trim().slice(0, MAX_NOTE);
    if (!clean) return { status: 400, data: { error: 'כתבו תשובה' } };
    // תגובה בשם בעל המאגר מפעילה את Claude שוב עם כל השיחה
    await github(env, `/issues/${number}/comments`, { method: 'POST', body: { body: clean } });
    return { status: 200, data: { ok: true } };
  }
  if (action === 'retry') {
    if (status === 'working') return { status: 409, data: { error: 'Claude כבר עובד על זה' } };
    await github(env, `/issues/${number}/labels`, { method: 'POST', body: { labels: ['matkon-retry'] } });
    return { status: 200, data: { ok: true } };
  }
  const pr = await openPr(env, number);
  if (action === 'approve') {
    if (status !== 'ready' || !pr) return { status: 409, data: { error: 'אין שינוי מוכן לאישור' } };
    try {
      await github(env, `/pulls/${pr.number}/merge`, { method: 'PUT', body: { merge_method: 'squash' } });
    } catch {
      return { status: 409, data: { error: 'לא הצלחתי להעלות את השינוי. לחצו "לנסות שוב" ו-Claude יכין אותו מחדש.' } };
    }
    await setLabels(env, number, 'matkon-done');
    await github(env, `/issues/${number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
    await github(env, `/git/refs/heads/${branchOf(number)}`, { method: 'DELETE' }).catch(() => {});
    return { status: 200, data: { ok: true, merged: true } };
  }
  // reject
  if (pr) {
    await github(env, `/pulls/${pr.number}`, { method: 'PATCH', body: { state: 'closed' } });
    await github(env, `/git/refs/heads/${branchOf(number)}`, { method: 'DELETE' }).catch(() => {});
  }
  await setLabels(env, number, 'matkon-rejected');
  await github(env, `/issues/${number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'not_planned' } });
  return { status: 200, data: { ok: true } };
}

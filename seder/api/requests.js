// בקשות לשינוי מתוך האפליקציה: כל בקשה נפתחת כ-issue ב-GitHub עם התווית seder-request.
// הפעולה .github/workflows/seder-requests.yml מפעילה את Claude על הבקשה ופותחת PR לאישור.
// המצב של כל בקשה נקרא מ-GitHub: תוויות (seder-working / seder-ready / seder-failed), PR פתוח, וסגירה.
// האישור נעשה מתוך האפליקציה: השרת ממזג את ה-PR (או סוגר אותו) – בלי להיכנס ל-GitHub.
// לפני הביצוע: הערכת מחיר (seder-estimating -> seder-quote), ו-Claude מתחיל רק אחרי "לבצע" (התווית seder-go).
import { balanceOf, parseCosts, parseEstimate, totalCost } from './costs.js';

export const LABEL = 'seder-request';
const MAX_TEXT = 4000;

async function gh(env, path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.SEDER_GITHUB_TOKEN}`,
      'user-agent': 'seder-app',
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const err = new Error(res.status === 401 || res.status === 403 ? 'אין הרשאה ל-GitHub (בדקי את SEDER_GITHUB_TOKEN)' : `GitHub החזיר שגיאה ${res.status}`);
    err.status = 502;
    err.githubStatus = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export function titleOf(text) {
  const first = text.split('\n').map((l) => l.trim()).find(Boolean) || 'בקשה';
  return first.length > 70 ? `${first.slice(0, 67)}...` : first;
}

export async function createRequest(env, text, context) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (clean.length < 3) throw Object.assign(new Error('צריך לכתוב מה לשנות'), { status: 400 });
  if (clean.length > MAX_TEXT) throw Object.assign(new Error('הבקשה ארוכה מדי'), { status: 400 });
  const ctx = typeof context === 'string' ? context.slice(0, 300) : '';
  const issue = await gh(env, '/issues', {
    method: 'POST',
    body: JSON.stringify({
      title: `סדר: ${titleOf(clean)}`,
      body: `${clean}\n\n---\nנשלח מתוך אפליקציית סדר${ctx ? ` · ${ctx}` : ''}`,
      labels: [LABEL],
    }),
  });
  return { number: issue.number, title: issue.title, status: 'received', createdAt: issue.created_at, url: issue.html_url };
}

const labelsOf = (issue) => (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));

// received -> estimating -> quote (מחכה לאישור המחיר) -> working -> ready (PR לאישור) -> done; או failed / rejected
export function statusOf(issue, pr) {
  const labels = labelsOf(issue);
  if (issue.state === 'closed') return issue.state_reason === 'not_planned' ? 'rejected' : 'done';
  if (labels.includes('seder-failed')) return 'failed';
  if (pr || labels.includes('seder-ready')) return 'ready';
  if (labels.includes('seder-working') || labels.includes('seder-go')) return 'working';
  if (labels.includes('seder-quote')) return 'quote';
  if (labels.includes('seder-estimating')) return 'estimating';
  return 'received';
}

export async function listRequests(env) {
  const [issues, pulls] = await Promise.all([
    gh(env, `/issues?labels=${LABEL}&state=all&per_page=30&sort=created&direction=desc`),
    gh(env, '/pulls?state=open&per_page=50'),
  ]);
  const prFor = new Map(pulls.filter((p) => /^seder\/request-\d+$/.test(p.head?.ref || '')).map((p) => [Number(p.head.ref.split('-').pop()), p]));
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => {
      const pr = prFor.get(i.number);
      return {
        number: i.number,
        title: i.title.replace(/^סדר:\s*/, ''),
        text: (i.body || '').split(/\n+---\n/)[0].trim(),
        status: statusOf(i, pr),
        createdAt: i.created_at,
        url: i.html_url,
        prUrl: pr?.html_url || null,
        // ההסבר של Claude (מה השתנה ומה לבדוק) – מוצג באפליקציה ליד כפתור האישור
        summary: pr ? (pr.body || '').split(/\n+---\n/)[0].trim().slice(0, 3000) : '',
        // הערכת המחיר לפני הביצוע, וכמה הבקשה עלתה בפועל עד עכשיו
        estimate: parseEstimate(i.body),
        cost: totalCost(parseCosts(i.body)),
      };
    });
}

// היתרה בחשבון הקרדיטים: הסכום שהוקלד פחות מה שהוצא מאז (בקשות שהשתנו מאז – כדי לא לפספס ישנות)
export async function creditsOf(env, credits) {
  if (!credits) return null;
  const issues = await gh(env, `/issues?labels=${LABEL}&state=all&per_page=100&since=${encodeURIComponent(credits.setAt)}`);
  return balanceOf(credits, issues.filter((i) => !i.pull_request));
}

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// הבקשה וה-PR הפתוח שלה – רק בקשות מהאפליקציה, ורק PR מהענף שה-workflow יצר במאגר הזה
async function requestWithPr(env, number) {
  if (!Number.isInteger(number) || number < 1) throw fail('בקשה לא קיימת');
  const issue = await gh(env, `/issues/${number}`).catch(() => null);
  const labels = (issue?.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  if (!issue || issue.pull_request || !labels.includes(LABEL)) throw fail('בקשה לא קיימת', 404);
  const [owner] = env.GITHUB_REPO.split('/');
  const pulls = await gh(env, `/pulls?state=open&head=${encodeURIComponent(`${owner}:seder/request-${number}`)}`);
  const pr = pulls.find((p) => p.head?.ref === `seder/request-${number}` && p.head?.repo?.full_name === env.GITHUB_REPO);
  return { issue, pr };
}

// אישור: מיזוג ה-PR (ה-issue נסגר לבד בזכות "Closes #N"), והשינוי עולה לאפליקציה
export async function approveRequest(env, number) {
  const { pr } = await requestWithPr(env, number);
  if (!pr) throw fail('אין שינוי שמחכה לאישור בבקשה הזו', 409);
  try {
    await gh(env, `/pulls/${pr.number}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'squash', commit_title: `${pr.title} (#${pr.number})` }) });
  } catch (e) {
    if (e.githubStatus === 405 || e.githubStatus === 409) throw fail('אי אפשר לאשר את השינוי הזה כרגע (הוא מתנגש בשינוי אחר). נסי "לנסות שוב".', 409);
    throw e;
  }
  await gh(env, `/git/refs/heads/seder/request-${number}`, { method: 'DELETE' }).catch(() => {});
  return { number, status: 'done' };
}

// לא מתאים: סוגרים את ה-PR ואת הבקשה, בלי לשנות את האפליקציה
export async function rejectRequest(env, number) {
  const { issue, pr } = await requestWithPr(env, number);
  if (pr) await gh(env, `/pulls/${pr.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
  if (issue.state === 'open') await gh(env, `/issues/${number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) });
  return { number, status: 'rejected' };
}

// לבצע אחרי שראו את המחיר: התווית seder-go מפעילה את Claude
export async function startRequest(env, number) {
  const { issue } = await requestWithPr(env, number);
  if (issue.state !== 'open') throw fail('הבקשה כבר סגורה', 409);
  if (statusOf(issue) !== 'quote') throw fail('הבקשה הזו לא מחכה לאישור מחיר', 409);
  await gh(env, `/issues/${number}/labels`, { method: 'POST', body: JSON.stringify({ labels: ['seder-go'] }) });
  await gh(env, `/issues/${number}/labels/seder-quote`, { method: 'DELETE' }).catch(() => {});
  return { number, status: 'working' };
}

// לנסות שוב: התווית seder-retry מפעילה שוב את Claude על הבקשה
export async function retryRequest(env, number) {
  const { issue } = await requestWithPr(env, number);
  if (issue.state !== 'open') throw fail('הבקשה כבר סגורה', 409);
  await gh(env, `/issues/${number}/labels`, { method: 'POST', body: JSON.stringify({ labels: ['seder-retry'] }) });
  return { number, status: 'working' };
}

// בקשות לשינוי מתוך האפליקציה: כל בקשה נפתחת כ-issue ב-GitHub עם התווית seder-request.
// הפעולה .github/workflows/seder-requests.yml מפעילה את Claude על הבקשה ופותחת PR לאישור.
// המצב של כל בקשה נקרא מ-GitHub: תוויות (seder-working / seder-ready / seder-failed), PR פתוח, וסגירה.
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
    throw err;
  }
  return res.json();
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

// received -> working -> ready (PR לאישור) -> done; או failed / rejected
export function statusOf(issue, pr) {
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  if (issue.state === 'closed') return issue.state_reason === 'not_planned' ? 'rejected' : 'done';
  if (labels.includes('seder-failed')) return 'failed';
  if (pr || labels.includes('seder-ready')) return 'ready';
  if (labels.includes('seder-working')) return 'working';
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
      };
    });
}

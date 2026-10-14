// רץ מתוך .github/workflows/seder-requests.yml (Node 22, בלי תלויות):
//   node request-costs.mjs estimate        -> הערכת מחיר לבקשה (Haiku), נשמרת ב-issue ומחכה לאישור באפליקציה
//   node request-costs.mjs record <file>   -> העלות בפועל של הרצת Claude (מתוך קובץ הפלט של claude-code-action)
// משתנים: N (מספר הבקשה), GH_TOKEN, GITHUB_REPOSITORY, ANTHROPIC_API_KEY (רק להערכה), README (נתיב ל-seder/README.md)
import { readFileSync } from 'node:fs';
import { SIZES, haikuCost, historyOf, marker, priceFor } from './costs.js';

const { N, GH_TOKEN, GITHUB_REPOSITORY, ANTHROPIC_API_KEY } = process.env;

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${GH_TOKEN}`, 'user-agent': 'seder-requests', ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}`);
  return res.status === 204 ? null : res.json();
}

// מוסיפים הערות נסתרות לסוף הבקשה (קוראים מחדש רגע לפני, כדי לא לדרוס שינוי אחר)
async function appendToIssue(lines) {
  const issue = await gh(`/issues/${N}`);
  await gh(`/issues/${N}`, { method: 'PATCH', body: JSON.stringify({ body: `${issue.body || ''}\n${lines.join('\n')}` }) });
}

const PROMPT = `את/ה מעריך/ה כמה עבודה תדרוש בקשה לשינוי באפליקציית המשימות "סדר" (React + Cloudflare Worker).
את השינוי יבצע סוכן קוד אוטומטי. סווגו את הבקשה לפי גודל:
- small: טקסט, צבע, כפתור, הזזה או הסתרה של משהו, באג ממוקד – קובץ אחד או שניים.
- medium: מסך או חלק חדש, שדה חדש במשימה, שינוי בכמה קבצים.
- large: יכולת חדשה גדולה, שינוי בשרת / בסנכרון / בהתראות, או כמה בקשות שונות ביחד.
ענו רק ב-JSON בשורה אחת: {"size":"small|medium|large","note":"משפט קצר בעברית פשוטה: מה צריך לעשות"}`;

async function estimate() {
  const issue = await gh(`/issues/${N}`);
  const request = (issue.body || '').split(/\n+---\n/)[0].trim();
  let size = null;
  let note = '';
  let usd = 0;
  try {
    const readme = readFileSync(process.env.README || 'seder/README.md', 'utf8').slice(0, 30000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: `${PROMPT}\n\nתיאור האפליקציה:\n${readme}`,
        messages: [{ role: 'user', content: `הבקשה:\n${request}` }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Anthropic ${res.status}`);
    usd = haikuCost(data.usage);
    const answer = JSON.parse((data.content?.[0]?.text || '').match(/\{[\s\S]*\}/)?.[0] || '{}');
    if (SIZES.includes(answer.size)) size = answer.size;
    if (typeof answer.note === 'string') note = answer.note.slice(0, 200);
  } catch (e) {
    console.log(`::warning::estimate failed: ${e.message}`);
  }
  // המחיר לפי מה ששינויים באותו גודל עלו בפועל
  const past = size ? historyOf((await gh('/issues?labels=seder-request&state=all&per_page=100')).filter((i) => i.number !== Number(N))) : [];
  const price = size ? priceFor(size, past) : null;
  console.log(`size=${size} price=${price} estimate cost=${usd}`);
  const lines = [marker('estimate', { size, usd: price, note })];
  if (usd > 0) lines.push(marker('cost', { kind: 'estimate', usd, at: new Date().toISOString() }));
  await appendToIssue(lines);
}

// העלות מתוך קובץ הפלט של claude-code-action (ההודעה האחרונה מסוג result)
async function record(file) {
  let usd = 0;
  try {
    const out = JSON.parse(readFileSync(file, 'utf8'));
    const result = [out].flat().reverse().find((m) => m?.type === 'result');
    usd = Number(result?.total_cost_usd) || 0;
  } catch (e) {
    console.log(`::warning::no cost found: ${e.message}`);
  }
  console.log(`cost=${usd}`);
  if (usd > 0) await appendToIssue([marker('cost', { kind: 'work', usd: Math.round(usd * 10000) / 10000, at: new Date().toISOString() })]);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'estimate') await estimate();
else if (cmd === 'record') await record(arg);
else throw new Error('usage: estimate | record <file>');

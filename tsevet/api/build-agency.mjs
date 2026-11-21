// בונה את api/agency.js – האינדקס של ספריית המומחים Agency Agents (msitarzewski/agency-agents, רישיון MIT).
// הרצה (פעם אחת, כשמעדכנים גרסה בכוונה):
//   git clone https://github.com/msitarzewski/agency-agents /tmp/aa && git -C /tmp/aa checkout <SHA>
//   node api/build-agency.mjs /tmp/aa
// באינדקס רק שם, תיאור ונתיב; הטקסט המלא של מומחה נטען בזמן אמת מאותה גרסה קבועה (SHA) – agency.js.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: node api/build-agency.mjs <agency-agents clone>');
const sha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim();
// התיקיות של המומחים (לא דוגמאות, סקריפטים או אינטגרציות)
const SKIP = new Set(['examples', 'scripts', 'integrations', '.git', '.github']);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP.has(name)) walk(p);
    } else if (name.endsWith('.md') && dir !== root) files.push(p);
  }
};
walk(root);

// כותרת ה-frontmatter: name / description / emoji
const field = (text, key) => (text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1] || '').trim().replace(/^["']|["']$/g, '');
const experts = [];
for (const p of files.sort()) {
  const text = readFileSync(p, 'utf8');
  if (!text.startsWith('---')) continue;
  const head = text.split('\n---')[0];
  const title = field(head, 'name');
  const desc = field(head, 'description');
  if (!title || !desc) continue;
  const path = relative(root, p).split('\\').join('/');
  experts.push({
    name: path.split('/').pop().replace(/\.md$/, ''),
    title,
    emoji: field(head, 'emoji'),
    division: path.split('/')[0],
    desc: desc.slice(0, 220),
    path,
  });
}

const out = `// נבנה אוטומטית ע"י api/build-agency.mjs – לא לערוך ביד.
// ספריית המומחים Agency Agents (https://github.com/msitarzewski/agency-agents, רישיון MIT), בגרסה קבועה.
export const AGENCY_REPO = 'msitarzewski/agency-agents';
export const AGENCY_SHA = '${sha}';
export const EXPERTS = ${JSON.stringify(experts, null, 0).replace(/},{/g, '},\n{')};
`;
writeFileSync(new URL('./agencyindex.js', import.meta.url), out);
console.log(`${experts.length} experts @ ${sha}`);

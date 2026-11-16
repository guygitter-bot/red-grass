// החיבור ל"מאגר AI" (ai_maagar): כל החומר שהבעלים אסף על AI – כתבות, סרטונים, כלים, ובאזור "לימוד וסקילים"
// גם סקילים, פרומפטים, צעדים ולקחים. הבוטים מחפשים וקוראים שם, והספרן 📚 הופך את מה שנמצא ל"סקיל של הצוות".
//
// הפנייה דרך service binding (MAAGAR ב-wrangler.toml) – Worker אחד לא יכול לפנות לאחר בכתובת workers.dev.
//   skills (ב-Durable Object) -> [{ name, title, when, body, agents: [<agent>], source, at }]  מה שהצוות למד
const MAX_RESULTS = 12;
const MAX_READ = 14_000;
export const MAX_SKILLS = 40;
export const MAX_SKILL_BODY = 6000;

async function call(env, path, body = {}) {
  if (!env.MAAGAR) throw new Error('not connected');
  const res = await env.MAAGAR.fetch(`https://maagar${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `maagar ${res.status}`);
  return data;
}

export const listItems = async (env) => ((await call(env, '/list')).items || []).filter((i) => i && i.id);

const isLearn = (i) => i.mode === 'learn';
const arr = (v) => (Array.isArray(v) ? v : []);

// כל הטקסט של פריט, לחיפוש
function haystack(i) {
  return [
    i.title, i.summary, i.category, i.type, i.note, i.url, ...arr(i.tags), ...arr(i.points), ...arr(i.lessons),
    ...arr(i.steps).map((s) => `${s.title} ${s.detail}`),
    ...arr(i.prompts).map((p) => `${p.title} ${p.purpose} ${p.tool}`),
    ...arr(i.skills).map((s) => `${s.name} ${s.title} ${s.description}`),
  ].filter(Boolean).join(' ').toLowerCase();
}

function line(i) {
  const extra = isLearn(i)
    ? ` | learned: ${arr(i.skills).length} skills, ${arr(i.prompts).length} prompts, ${arr(i.steps).length} steps`
    : ` | ${i.category || 'בלי קטגוריה'}${i.type ? ` · ${i.type}` : ''}`;
  const state = i.status && i.status !== 'ready' ? ` | status: ${i.status}` : '';
  return `- [${i.id}] ${i.title || i.url || '(בלי כותרת)'}${extra}${state}\n  ${String(i.summary || '').replace(/\s+/g, ' ').slice(0, 220)}`;
}

// חיפוש פשוט לפי מילים (בלי AI). area: all | learn (רק "לימוד וסקילים") | library
export function search(items, query, area = 'all') {
  const words = String(query || '').toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1);
  const pool = items.filter((i) => (area === 'learn' ? isLearn(i) : area === 'library' ? !isLearn(i) : true));
  const scored = pool
    .map((i) => {
      const text = haystack(i);
      const title = String(i.title || '').toLowerCase();
      let score = 0;
      for (const w of words) score += (text.includes(w) ? 1 : 0) + (title.includes(w) ? 2 : 0);
      // פריט לימוד שווה יותר: יש בו סקילים ופרומפטים מוכנים
      return { i, score: score ? score + (isLearn(i) ? 1 : 0) : 0 };
    })
    .filter((s) => (words.length ? s.score > 0 : true))
    .sort((a, b) => b.score - a.score || (b.i.createdAt || 0) - (a.i.createdAt || 0));
  if (!scored.length) {
    const cats = [...new Set(items.filter((i) => !isLearn(i) && i.category).map((i) => i.category))];
    return `Nothing matched "${query}". The repository has ${items.length} items (${items.filter(isLearn).length} learned). Categories: ${cats.join(', ') || '-'}. Try other words (Hebrew and English).`;
  }
  return `${scored.length} matches (showing ${Math.min(scored.length, MAX_RESULTS)}). Read one with maagar_read:\n${scored.slice(0, MAX_RESULTS).map((s) => line(s.i)).join('\n')}`;
}

// פריט מלא, כטקסט לבוט
export function read(items, id) {
  const i = items.find((x) => x.id === String(id || '').trim());
  if (!i) return 'No such item. Use an id from maagar_search.';
  const out = [`# ${i.title || '(בלי כותרת)'}`, i.url ? `Source: ${i.url}` : '', isLearn(i) ? 'Area: לימוד וסקילים' : `Category: ${i.category || '-'}`, i.note ? `Owner's note: ${i.note}` : '', i.summary || ''];
  if (i.status && i.status !== 'ready') out.push(`(status: ${i.status}${i.error ? ` – ${i.error}` : ''})`);
  if (i.coverage_note) out.push(`Coverage: ${i.coverage_note}`);
  if (arr(i.points).length) out.push(`## Key points\n${i.points.map((p) => `- ${p}`).join('\n')}`);
  if (arr(i.lessons).length) out.push(`## Lessons\n${i.lessons.map((p) => `- ${p}`).join('\n')}`);
  if (arr(i.steps).length) out.push(`## Steps\n${i.steps.map((s, n) => `${n + 1}. ${s.title}: ${s.detail}`).join('\n')}`);
  if (arr(i.prompts).length) out.push(`## Prompts\n${i.prompts.map((p) => `### ${p.title} (${p.tool})\n${p.purpose}\n${p.prompt}`).join('\n\n')}`);
  if (arr(i.skills).length) out.push(`## Skills\n${i.skills.map((s) => `### ${s.name} – ${s.title}\n${s.description}\n\n${s.instructions}`).join('\n\n')}`);
  if (!isLearn(i) && !arr(i.lessons).length) out.push('(This item was only summarized. For the full method, prompts and skills use maagar_learn on it.)');
  if (i.kind === 'text' && i.text) out.push(`## Text\n${i.text}`);
  const text = out.filter(Boolean).join('\n\n');
  return text.length > MAX_READ ? `${text.slice(0, MAX_READ)}\n\n[cut – the item is longer]` : text;
}

// "ללמוד מזה": המאגר לומד מהפריט ברקע (דקה-שתיים) ובונה סקילים, פרומפטים וצעדים
export async function learnFrom(env, id) {
  const r = await call(env, '/learn-from', { id: String(id || '') });
  return r.item?.id || '';
}

// ---------- הסקילים של הצוות ----------
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// שמירת סקיל (או עדכון של סקיל באותו שם). מחזיר { skills, saved } או { error }
export function addSkill(skills, input, agentKeys) {
  const name = clean(input.name, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const body = String(input.body || '').trim().slice(0, MAX_SKILL_BODY);
  const title = clean(input.title, 80);
  const when = clean(input.when, 240);
  if (!name || !title || !when || body.length < 40) return { error: 'A skill needs name (kebab-case English), title, when, and a full body.' };
  const agents = [...new Set(arr(input.agents).filter((k) => agentKeys.includes(k)))];
  if (!agents.length) return { error: `agents must list who learns it: ${agentKeys.join(', ')}.` };
  const saved = { name, title, when, body, agents, source: clean(input.source, 160), at: Date.now() };
  const rest = skills.filter((s) => s.name !== name);
  if (rest.length >= MAX_SKILLS) return { error: `The team already has ${MAX_SKILLS} skills. Remove one first (unteach).` };
  return { skills: [...rest, saved], saved };
}

export const skillsOf = (skills, agent) => skills.filter((s) => arr(s.agents).includes(agent));

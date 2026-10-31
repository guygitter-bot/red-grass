// "לימוד וסקילים": הסוכן לומד מסרטון / מדריך / קובץ ובונה ממנו דברים שאפשר להשתמש בהם מיד –
// סקילים ל-Claude (קובץ SKILL.md), פרומפטים מוכנים להעתקה, וצעדים מעשיים.
// בסרטון הוא קורא את התמליל (הכתוביות) – הוא לא רואה את התמונה ולא שומע את הקול עצמו.
import { MODEL } from './ai.js';

const MAX_STEPS = 8;

const WEB_TOOLS = [
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
];

export const COVERAGE = ['full', 'partial', 'little'];

export const LEARN_TOOL = {
  name: 'submit_learning',
  description: 'Submit everything learned from the material, in the structure below.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short Hebrew title of what this material teaches' },
      summary: { type: 'string', description: '2-4 Hebrew sentences: what it teaches and what you can do with it' },
      coverage: { type: 'string', enum: COVERAGE, description: 'full = you read the whole content (transcript / full text); partial = only part of it; little = only a title/description' },
      coverage_note: { type: 'string', description: 'One Hebrew sentence: what you actually read (e.g. "קראתי את התמליל המלא של הסרטון")' },
      lessons: { type: 'array', items: { type: 'string' }, description: 'The key lessons / insights, Hebrew, up to 10' },
      steps: {
        type: 'array',
        description: 'A practical step-by-step guide to do what the material teaches (empty if not relevant)',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, detail: { type: 'string' } },
          required: ['title', 'detail'],
          additionalProperties: false,
        },
      },
      prompts: {
        type: 'array',
        description: 'Ready-to-paste prompts (empty if the material is not about prompting / generating)',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Hebrew name of the prompt' },
            purpose: { type: 'string', description: 'Hebrew: what it is for and how to use it (which blanks to fill)' },
            tool: { type: 'string', description: 'The tool it is for, e.g. "Midjourney", "Runway", "Veo", "Kling", "ChatGPT", "Claude", or "כללי"' },
            prompt: { type: 'string', description: 'The full prompt text, in the language that works best for that tool (usually English). Use [brackets] for blanks.' },
            from_source: { type: 'boolean', description: 'true if the prompt appears in the material itself; false if you wrote it following the method taught' },
          },
          required: ['title', 'purpose', 'tool', 'prompt', 'from_source'],
          additionalProperties: false,
        },
      },
      skills: {
        type: 'array',
        description: 'Claude skills (empty if the material does not teach a repeatable process/method)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'kebab-case English name, e.g. "video-script-writer"' },
            title: { type: 'string', description: 'Hebrew name for the user' },
            description: { type: 'string', description: 'English: what the skill does AND when Claude should use it (include the Hebrew trigger words too). Max ~400 chars.' },
            instructions: { type: 'string', description: 'The SKILL.md body in Markdown, in Hebrew: goal, when to use, step-by-step method, rules, examples / templates. Complete and self-contained.' },
          },
          required: ['name', 'title', 'description', 'instructions'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'summary', 'coverage', 'coverage_note', 'lessons', 'steps', 'prompts', 'skills'],
    additionalProperties: false,
  },
};

export const LEARN_SYSTEM = `You are a learning assistant for a Hebrew-speaking user who collects AI tutorials, videos, \
guides and posts. Your job is NOT to summarize only — it is to extract the knowledge and turn it into things the user \
can use right away.

From the material, build:
1. lessons – the key insights.
2. steps – a practical how-to, in order, when the material teaches how to do something.
3. prompts – when the material shows or discusses prompts (for image/video generation, editing, writing, coding, \
agents...), write them out complete and ready to paste. Copy prompts that appear in the material faithfully \
(from_source=true). When the material explains a method or structure for prompts without giving full text, write \
2-5 strong prompts that follow that method (from_source=false), with [blanks] for what the user fills in.
4. skills – when the material teaches a repeatable process, workflow or method (or literally shows a Claude skill / \
custom instructions / agent setup), write a Claude skill for it: a clear English description of what it does and \
when to use it, and complete Hebrew instructions (goal, step-by-step method, rules, templates, examples) so Claude \
can follow the method without the original material. One skill per distinct method; usually 0-2.

Rules:
- Explanations in natural Israeli Hebrew. Keep names of tools, models and companies as they are.
- Be faithful: what the material says is the base. You may complete gaps with well-known best practice, but never \
invent facts about tools or features.
- For a video you get the title, description and transcript (what was said). You cannot see the picture. If there is \
no transcript, use web_fetch / web_search to find the content (the video page, the author's post, a linked guide or \
GitHub repo). If the material points to resources (repo, doc, prompt list), fetch them when they matter.
- Leave steps / prompts / skills empty when they do not fit the material. Do not pad.
- Report honestly in coverage how much of the material you actually read.
- Always finish by calling submit_learning.`;

// החומר לסוכן (תוכן ההודעה)
export function learnMaterial(item, src) {
  const note = item.note ? `\n\nThe user's note: ${item.note}` : '';
  const ask = `${note}\n\nLearn from this and call submit_learning.`;
  if (item.kind === 'link' && src?.video) {
    const v = src.video;
    return [
      `Video: ${item.url}`,
      v.title && `Title: ${v.title}`,
      v.author && `Channel: ${v.author}`,
      v.minutes && `Length: ~${v.minutes} minutes`,
      v.description && `Description:\n${v.description}`,
      v.transcript ? `Transcript:\n${v.transcript}` : 'No transcript was available.',
    ].filter(Boolean).join('\n') + ask;
  }
  if (item.kind === 'link') {
    return [
      `Link: ${item.url}`,
      src?.title && `Page title: ${src.title}`,
      src?.description && `Description: ${src.description}`,
      src?.text ? `Page text:\n${src.text}` : 'The page text could not be downloaded – read it with web_fetch.',
    ].filter(Boolean).join('\n') + ask;
  }
  if (item.kind === 'text') return `Material:\n${item.text}${ask}`;
  const intro = `Uploaded file: ${item.file.name} (${item.file.type})${ask}`;
  if (!src) return `${intro}\n(Only the file name is available.)`;
  if (src.text != null) return `File content:\n${src.text}\n\n${intro}`;
  return [src.block, { type: 'text', text: intro }];
}

export async function learn(client, item, src) {
  const messages = [{ role: 'user', content: learnMaterial(item, src) }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 24000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: LEARN_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [...WEB_TOOLS, LEARN_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('המודל סירב לטפל בחומר הזה.');
    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === LEARN_TOOL.name);
    if (submit) return cleanLearning(submit.input);
    if (response.stop_reason === 'max_tokens') throw new Error('החומר ארוך מדי ללימוד בבת אחת.');
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: 'Call submit_learning now with what you have.' });
  }
  throw new Error('לא הצלחתי ללמוד מהחומר. נסו שוב.');
}

const clean = (s, max) => String(s ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const list = (a, max) => (Array.isArray(a) ? a.slice(0, max) : []);

export function skillName(s) {
  const name = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return name || 'my-skill';
}

// קובץ SKILL.md מלא (פורמט הסקילים של Claude)
export function skillFile({ name, description, instructions }) {
  const desc = description.replace(/\s+/g, ' ').trim();
  return `---\nname: ${name}\ndescription: ${JSON.stringify(desc)}\n---\n\n${instructions.trim()}\n`;
}

export function cleanLearning(r) {
  const used = new Set();
  const skills = list(r.skills, 5)
    .map((s) => {
      let name = skillName(s.name);
      while (used.has(name)) name = `${name.slice(0, 60)}-${used.size + 1}`;
      used.add(name);
      const skill = {
        name,
        title: clean(s.title, 120) || name,
        description: clean(s.description, 1000),
        instructions: String(s.instructions ?? '').trim().slice(0, 40000),
      };
      return { ...skill, file: skillFile(skill) };
    })
    .filter((s) => s.description && s.instructions);
  return {
    title: clean(r.title, 200),
    summary: clean(r.summary, 2000),
    learn: {
      coverage: COVERAGE.includes(r.coverage) ? r.coverage : 'partial',
      coverageNote: clean(r.coverage_note, 300),
      lessons: list(r.lessons, 10).map((l) => clean(l, 600)).filter(Boolean),
      steps: list(r.steps, 20).map((s) => ({ title: clean(s.title, 200), detail: String(s.detail ?? '').trim().slice(0, 2000) })).filter((s) => s.title),
      prompts: list(r.prompts, 20)
        .map((p) => ({
          title: clean(p.title, 200),
          purpose: clean(p.purpose, 1000),
          tool: clean(p.tool, 60) || 'כללי',
          prompt: String(p.prompt ?? '').trim().slice(0, 8000),
          fromSource: Boolean(p.from_source),
        }))
        .filter((p) => p.prompt),
      skills,
    },
  };
}

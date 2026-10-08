// תיקון שגיאות כתיב בסוף סיבוב (ילדים קטנים כותבים "ארייה" במקום "אריה").
// רק תשובות שמתחילות באות הנכונה, והתיקון חייב להתחיל באותה אות – אחרת נשארת התשובה כפי שנכתבה.
// הסוכן לא מחליט אם התשובה נכונה (את זה עושים השחקנים עם 👎) – רק מתקן כתיב.
import { CATEGORIES, cleanAnswer, normalize, startsWithLetter } from './game.js';

export const MODEL = 'claude-sonnet-5-5';
const LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

export const FIX_TOOL = {
  name: 'fix_answers',
  description: 'Return the spelling-corrected answer for every numbered answer.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      fixes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer', description: 'The number of the answer' },
            fixed: { type: 'string', description: 'The answer in correct Hebrew spelling (or unchanged)' },
          },
          required: ['i', 'fixed'],
          additionalProperties: false,
        },
      },
    },
    required: ['fixes'],
    additionalProperties: false,
  },
};

export const SYSTEM = `You fix spelling in the Hebrew word game "ארץ עיר" (Eretz Ir). Players, many of them young \
children, write one answer per category (country, city, animal, plant, object, boy's name, girl's name, profession) \
starting with the round's letter. Children spell phonetically and make mistakes.

For each answer, return the word the player most likely meant, in correct standard Hebrew spelling \
(e.g. "ארייה" -> "אריה", "גירף" -> "ג'ירפה", "תפוך" -> "תפוח", "אמרכה" -> "אמריקה", "שולכן" -> "שולחן").
Rules:
- Only fix spelling. Do not replace the answer with a different word, and do not judge whether it fits the category.
- The fixed answer must start with the same letter as the original. Keep spaces between words.
- If the answer is already correct, or you cannot tell what was meant, return it exactly as written.
- Always call fix_answers with every number.`;

// אילו תשובות לשלוח: {key: '<קטגוריה>|<שחקן>', category, text}. אותה תשובה פעם אחת בלבד
export function spellJobs(round) {
  const jobs = [];
  const seen = new Set();
  for (const [pid, answers] of Object.entries(round.answers || {})) {
    for (const [category, raw] of Object.entries(answers || {})) {
      const text = cleanAnswer(raw);
      if (!LABELS[category] || !startsWithLetter(text, round.letter)) continue;
      const id = `${category}|${normalize(text)}`;
      if (!seen.has(id)) {
        seen.add(id);
        jobs.push({ category, text });
      }
    }
  }
  return jobs;
}

// מחזיר {'<קטגוריה>|<תשובה מנורמלת>': תיקון} – רק מה שבאמת השתנה
export async function fixSpelling(client, round) {
  const jobs = spellJobs(round);
  if (!jobs.length) return {};
  const list = jobs.map((j, i) => `${i + 1}. [${LABELS[j.category]}] ${j.text}`).join('\n');
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: [FIX_TOOL],
    messages: [{ role: 'user', content: `The letter: ${round.letter}\n\n${list}` }],
  });
  const call = response.content.find((b) => b.type === 'tool_use' && b.name === FIX_TOOL.name);
  const out = {};
  for (const f of call?.input?.fixes || []) {
    const job = jobs[Number(f.i) - 1];
    const fixed = cleanAnswer(f.fixed);
    if (!job || !fixed || !startsWithLetter(fixed, round.letter)) continue;
    if (normalize(fixed) === normalize(job.text)) continue;
    out[`${job.category}|${normalize(job.text)}`] = fixed;
  }
  return out;
}

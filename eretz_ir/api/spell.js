// בדיקת התשובות בסוף סיבוב (Claude):
//   1. תיקון שגיאות כתיב (ילדים קטנים כותבים "ארייה" במקום "אריה"). התיקון חייב להתחיל באותה אות –
//      אחרת נשארת התשובה כפי שנכתבה.
//   2. האם התשובה באמת מתאימה לקטגוריה ("בורר" במקצוע – כן; "היי" במקצוע – לא). תשובה לא מתאימה = 0 נקודות,
//      אלא אם רוב השחקנים האחרים מאשרים אותה (👍).
// רק תשובות שמתחילות באות הנכונה ויש בהן לפחות שתי אותיות נשלחות לבדיקה.
import { CATEGORIES, cleanAnswer, longEnough, normalize, startsWithLetter } from './game.js';

export const MODEL = 'claude-sonnet-5-5';
const LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

export const FIX_TOOL = {
  name: 'fix_answers',
  description: 'Return, for every numbered answer, the spelling-corrected answer and whether it fits its category.',
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
            ok: { type: 'boolean', description: 'true if the (corrected) answer is a real example of its category' },
          },
          required: ['i', 'fixed', 'ok'],
          additionalProperties: false,
        },
      },
    },
    required: ['fixes'],
    additionalProperties: false,
  },
};

export const SYSTEM = `You are the judge of the Hebrew word game "ארץ עיר" (Eretz Ir). Players, many of them young \
children, write one answer per category starting with the round's letter. Children spell phonetically and make mistakes.

For each answer:
1. fixed: the word the player most likely meant, in correct standard Hebrew spelling \
(e.g. "ארייה" -> "אריה", "גירף" -> "ג'ירפה", "תפוך" -> "תפוח", "אמרכה" -> "אמריקה", "שולכן" -> "שולחן"). \
Only fix spelling: do not replace it with a different word. It must start with the same letter as the original. \
If it is already correct, or you cannot tell what was meant, return it exactly as written.
2. ok: is the (fixed) answer a real example of its category?
- ארץ: a country (current or well known, e.g. "אנגליה", "הולנד").
- עיר: a city or town anywhere in the world, including Israeli towns, kibbutzim and moshavim.
- חי: any animal (mammals, birds, fish, insects, reptiles...).
- צומח: any plant – trees, flowers, fruits, vegetables, herbs, grains.
- דומם: any inanimate object or thing (furniture, tools, toys, materials...).
- מאכל: any food, dish or drink (e.g. "פלאפל", "מרק", "פיצה"; fruits and vegetables are fine too).
- ילד: a first name used for boys (unisex names are fine). ילדה: a first name used for girls (unisex names are fine).
- מקצוע: an occupation or profession (e.g. "בורר", "הנדסאי", "חייל", "זמר").
ok=false for words that are not real, greetings and other words that do not fit (e.g. "היי" as a profession), \
a different category (e.g. a city written as a country), or a lone letter. When in doubt about a real, \
reasonable answer – be generous (these are children), ok=true.
Always call fix_answers with every number.`;

// אילו תשובות לשלוח: {key: '<קטגוריה>|<שחקן>', category, text}. אותה תשובה פעם אחת בלבד
export function spellJobs(round) {
  const jobs = [];
  const seen = new Set();
  for (const [pid, answers] of Object.entries(round.answers || {})) {
    for (const [category, raw] of Object.entries(answers || {})) {
      const text = cleanAnswer(raw);
      if (!LABELS[category] || !startsWithLetter(text, round.letter) || !longEnough(text)) continue;
      const id = `${category}|${normalize(text)}`;
      if (!seen.has(id)) {
        seen.add(id);
        jobs.push({ category, text });
      }
    }
  }
  return jobs;
}

// מחזיר { fixed: {'<קטגוריה>|<תשובה מנורמלת>': תיקון} (רק מה שבאמת השתנה),
//          wrong: ['<קטגוריה>|<תשובה מנורמלת>', ...] (תשובות שלא מתאימות לקטגוריה) }
export async function checkAnswers(client, round) {
  const jobs = spellJobs(round);
  if (!jobs.length) return { fixed: {}, wrong: [] };
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
  if (!call) throw new Error('no answer from the judge');
  const fixed = {};
  const wrong = [];
  for (const f of call.input?.fixes || []) {
    const job = jobs[Number(f.i) - 1];
    if (!job) continue;
    const key = `${job.category}|${normalize(job.text)}`;
    if (f.ok === false) wrong.push(key);
    const fix = cleanAnswer(f.fixed);
    if (!fix || !startsWithLetter(fix, round.letter) || normalize(fix) === normalize(job.text)) continue;
    fixed[key] = fix;
  }
  return { fixed, wrong };
}

// בדיקת התשובות בסוף סיבוב (Claude):
//   1. תיקון שגיאות כתיב (ילדים קטנים כותבים "ארייה" במקום "אריה"). התיקון חייב להתחיל באותה אות –
//      אחרת נשארת התשובה כפי שנכתבה.
//   2. האם התשובה באמת מתאימה לקטגוריה ("בורר" במקצוע – כן; "היי" במקצוע – לא). תשובה לא מתאימה = 0 נקודות,
//      אלא אם רוב השחקנים האחרים מאשרים אותה (👍).
// שלושה שלבים, כדי שתשובה נכונה לא תיפסל בטעות (קרה עם "לוב" בארץ ו"וירוס" בחי):
//   א. בודק ראשון – תיקון כתיב + נכון/לא נכון לכל התשובות.
//   ב. ארץ שנמצאת ברשימה הקבועה (countries.js) – תמיד נכונה.
//   ג. בודק שני ("סוכן") עובר שוב על כל תשובה שנפסלה, יכול לחפש ברשת, ופוסל רק כשהוא בטוח. גם כותב למה.
// רק תשובות שמתחילות באות הנכונה ויש בהן לפחות שתי אותיות נשלחות לבדיקה.
import { CATEGORIES, cleanAnswer, longEnough, normalize, startsWithLetter } from './game.js';
import { isKnownCountry } from './countries.js';

export const MODEL = 'claude-opus-5-5';
const BASE = { model: MODEL, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
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
- ארץ: a country (current or well known, e.g. "אנגליה", "הולנד", "לוב" = Libya, "טוגו", "צ'אד").
- עיר: a city or town anywhere in the world, including Israeli towns, kibbutzim and moshavim.
- חי: any living creature – mammals, birds, fish, insects, reptiles, worms, and also microorganisms such as \
"וירוס" or "חיידק" (children accept them).
- צומח: any plant – trees, flowers, fruits, vegetables, herbs, grains.
- דומם: any inanimate object or thing (furniture, tools, toys, materials...).
- מאכל: any food, dish or drink (e.g. "פלאפל", "מרק", "פיצה"; fruits and vegetables are fine too).
- ילד: a first name used for boys (unisex names are fine). ילדה: a first name used for girls (unisex names are fine).
- מקצוע: an occupation or profession (e.g. "בורר", "הנדסאי", "חייל", "זמר").
ok=false only for words that are not real, greetings and other words that clearly do not fit (e.g. "היי" as a \
profession), or a clearly different category (e.g. a city written as a country). Remember that many real names are \
short or unusual (countries like "לוב", "פרו", "צ'אד", small towns, rare animals, foreign first names). When in doubt \
about a real, reasonable answer – be generous (these are children), ok=true.
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

// הבודק השני: מקבל רק את מה שנפסל, ובודק כל אחד שוב לעומק (מותר לו לחפש ברשת)
export const VERDICT_TOOL = {
  name: 'final_verdicts',
  description: 'Return the final verdict for every numbered answer.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer', description: 'The number of the answer' },
            ok: { type: 'boolean', description: 'true unless you are sure it is not a real example of its category' },
            why: { type: 'string', description: 'When ok=false: a very short reason in simple Hebrew for a child (up to 8 words)' },
          },
          required: ['i', 'ok', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['verdicts'],
    additionalProperties: false,
  },
};

export const REVIEW_SYSTEM = `You are the second, final judge of the Hebrew word game "ארץ עיר". A first judge rejected \
the answers below as not fitting their category. That judge often makes mistakes, and a wrong rejection takes points \
from a child, so check every answer carefully:
- Think about all meanings and spellings of the word in Hebrew, including transliterations of foreign names.
- If you are not completely sure, search the web (Hebrew Wikipedia is a good source) before deciding.
- ארץ = any country, current or well known (e.g. "לוב" is Libya). עיר = any city, town, kibbutz or moshav anywhere. \
חי = any living creature, including microorganisms like "וירוס" and "חיידק". צומח = any plant, fruit, vegetable, flower, \
tree or herb. דומם = any inanimate object or thing. מאכל = any food, dish or drink. ילד / ילדה = any first name used for \
boys / girls (unisex and foreign names are fine). מקצוע = any occupation or profession.
- ok=false only when you are sure: not a real word, a greeting or filler (e.g. "היי" as a profession), or clearly \
something else (e.g. a city written as a country). Otherwise ok=true.
- When ok=false, why = a very short, kind reason in simple Hebrew (e.g. "זו עיר, לא ארץ", "זו לא מילה בעברית").
Finish by calling final_verdicts with every number.`;

const WEB_SEARCH = { type: 'web_search_20260209', name: 'web_search', max_uses: 5 };

async function review(client, letter, items) {
  const list = items.map((it, n) => `${n + 1}. [${LABELS[it.category]}] ${it.text}`).join('\n');
  const messages = [{ role: 'user', content: `The letter: ${letter}\n\nRejected by the first judge:\n${list}` }];
  for (let step = 0; step < 5; step++) {
    const response = await client.beta.messages.create({
      ...BASE,
      max_tokens: 8000,
      output_config: { effort: 'high' },
      system: [{ type: 'text', text: REVIEW_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [WEB_SEARCH, VERDICT_TOOL],
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('review refused');
    const call = response.content.find((b) => b.type === 'tool_use' && b.name === VERDICT_TOOL.name);
    if (call) return call.input?.verdicts || [];
    messages.push({ role: 'assistant', content: response.content });
    // החיפוש ברשת עצר באמצע – ממשיכים מאותה נקודה
    if (response.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: 'Call final_verdicts now with every number.' });
  }
  throw new Error('no verdicts from the review');
}

// מחזיר { fixed: {'<קטגוריה>|<תשובה מנורמלת>': תיקון} (רק מה שבאמת השתנה),
//          wrong: ['<קטגוריה>|<תשובה מנורמלת>', ...] (תשובות שלא מתאימות לקטגוריה),
//          why: {'<אותו מפתח>': 'למה נפסל'} }
// המפתח הוא תמיד לפי מה שהשחקן כתב (לפני התיקון)
export async function checkAnswers(client, round) {
  const jobs = spellJobs(round);
  if (!jobs.length) return { fixed: {}, wrong: [], why: {} };
  const list = jobs.map((j, i) => `${i + 1}. [${LABELS[j.category]}] ${j.text}`).join('\n');
  const response = await client.beta.messages.create({
    ...BASE,
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: [FIX_TOOL],
    messages: [{ role: 'user', content: `The letter: ${round.letter}\n\n${list}` }],
  });
  const call = response.content.find((b) => b.type === 'tool_use' && b.name === FIX_TOOL.name);
  if (!call) throw new Error('no answer from the judge');
  const fixed = {};
  const rejected = [];
  for (const f of call.input?.fixes || []) {
    const job = jobs[Number(f.i) - 1];
    if (!job) continue;
    const key = `${job.category}|${normalize(job.text)}`;
    const fix = cleanAnswer(f.fixed);
    if (fix && startsWithLetter(fix, round.letter) && normalize(fix) !== normalize(job.text)) fixed[key] = fix;
    const text = fixed[key] || job.text;
    // ארץ מהרשימה הקבועה – נכונה, גם אם הבודק חשב אחרת
    if (job.category === 'country' && (isKnownCountry(text) || isKnownCountry(job.text))) continue;
    if (f.ok === false) rejected.push({ key, category: job.category, text });
  }
  if (!rejected.length) return { fixed, wrong: [], why: {} };

  // הבודק השני עובר על כל מה שנפסל. אם הוא נכשל – נשארים עם ההחלטה של הראשון
  const wrong = [];
  const why = {};
  let verdicts = null;
  try {
    verdicts = await review(client, round.letter, rejected);
  } catch (e) {
    console.log('review failed', e?.status || '', e?.message || e);
  }
  rejected.forEach((item, n) => {
    const v = verdicts?.find((x) => Number(x.i) === n + 1);
    if (verdicts && (!v || v.ok !== false)) return;
    wrong.push(item.key);
    const reason = String(v?.why || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (reason) why[item.key] = reason;
  });
  return { fixed, wrong, why };
}

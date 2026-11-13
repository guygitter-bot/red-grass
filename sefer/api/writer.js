// הסופר: Claude בונה את מתווה הספר (שם, הקדשה, פרקים, כריכה) ואחר כך כותב פרק אחרי פרק.
// כל הטקסט לקורא בעברית; ההוראות למאייר באנגלית.
import { callTool } from './ai.js';
import { LENGTHS, briefText, isKid, isRomance } from './brief.js';

export const MAX_CHAPTERS = 16;

export const OUTLINE_TOOL = {
  name: 'plan_book',
  description: 'Give the plan for the personal gift book: title, dedication, chapters and the cover illustration.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Hebrew book title, 2-7 words, specific to this person (not generic)' },
      subtitle: { type: 'string', description: 'Hebrew subtitle, one short line' },
      dedication: { type: 'string', description: 'Hebrew dedication page, 2-4 sentences, signed by the giver if known' },
      chapters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Hebrew chapter title, 2-6 words' },
            summary: { type: 'string', description: 'Hebrew, 1-2 sentences: what this chapter tells and which of the giver’s details it uses' },
          },
          required: ['title', 'summary'],
          additionalProperties: false,
        },
      },
      look: {
        type: 'string',
        description: 'English, 2-3 sentences for the illustrator: how the main character(s) look (age, build, hair, typical clothes) and the visual world of the book, so every illustration shows the same people',
      },
      cover: { type: 'string', description: 'English: the scene for the cover illustration. One clear image, no text or letters in it' },
    },
    required: ['title', 'subtitle', 'dedication', 'chapters', 'look', 'cover'],
    additionalProperties: false,
  },
};

export const CHAPTER_TOOL = {
  name: 'write_chapter',
  description: 'Give the finished chapter and the scene to illustrate.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The chapter in Hebrew: plain prose, paragraphs separated by a blank line, no title and no markdown' },
      scene: { type: 'string', description: 'English: one concrete moment from this chapter to illustrate (who, where, doing what, mood). No text or letters in the image' },
    },
    required: ['text', 'scene'],
    additionalProperties: false,
  },
};

const VOICE = `Write natural, simple, living Israeli Hebrew - the way a good Israeli author writes, not a translation. \
Keep Hebrew grammatical gender correct for every person, all the way through. Use only the facts the giver supplied: \
you may dramatize, connect and imagine small scenes around them, but never invent biographical facts (jobs, dates, \
places, family members, illnesses) that were not given. Nothing hurtful: humor is always from love. No religious or \
political assumptions about the person. No emojis, no markdown, no headings inside the text.`;

// רומן למבוגרים: מותר לדמיין הכול (הדמויות בדויות), אבל חושני ומרומז בלבד, ורק דמויות בגירות.
// REFUSED = הסימן שהסופר מחזיר כשהחומר מבקש משהו שלא כותבים (קטינים, אנשים אמיתיים, כפייה)
export const REFUSED = 'REFUSED';
export const REFUSED_MESSAGE = 'אי אפשר לכתוב את הסיפור הזה. בקטגוריה הזאת כל הדמויות חייבות להיות בדויות ובגירות, והקשר ביניהן בהסכמה.';

const ROMANCE_VOICE = `Write natural, living Israeli Hebrew - the way a good Israeli novelist writes, not a translation. \
Keep Hebrew grammatical gender correct for every character. The characters are fictional: build their world, history \
and voices freely from what the reader described. No emojis, no markdown, no headings inside the text.

This is a sensual romance for adult readers, in the tradition of well-written romantic fiction: longing, tension, \
glances, touch, atmosphere, what is said and what is held back. Desire is on the page; the sex itself is not. Intimate \
scenes are implied: build the moment, then close the door or cut to afterwards. Never describe sex acts or genitals, and \
use no crude or graphic language. These limits hold whatever the reader's notes ask for.

Hard limits: every character in a romantic or intimate role is clearly an adult (18 or older) and everything between \
them is wanted by both. The characters are invented people, never real, named public figures. If the reader's material \
asks for anyone under 18 (or described as a child, pupil or teenager) in a romantic or intimate role, for coercion, or \
for a real public figure, do not write it: `;

const romanceOutlineSystem = (brief) => `You are a novelist who writes sensual romance for adult readers in Hebrew. A \
reader gives you a frame story and describes the characters, and you turn it into a short novel written for them.

Plan the novel: a title, a subtitle, a short dedication or epigraph page, and exactly ${LENGTHS[brief.length]} chapters \
that build one arc: a meeting or a spark, growing tension and obstacles, closeness, a turn, and an ending that fits \
what the reader asked for. Give each chapter its own scene and its own step in the relationship.

For "look" and "cover" (instructions to an illustrator): the characters are drawn, invented adults; describe only \
suggestive, tasteful images - a gaze, hands, a silhouette, light and place - with everyone clothed.

If the reader wrote their own dedication, use it word for word. ${ROMANCE_VOICE}call plan_book with the title \
"${REFUSED}" and an empty chapters list.

Always finish by calling plan_book.`;

const romanceChapterSystem = () => `You are a novelist writing one chapter of a sensual romance for adult readers in \
Hebrew. You get the reader's frame story and characters, the plan of the whole novel, and which chapter to write now.

Write only this chapter, 450-650 words, in scenes: place, dialogue, small physical details, what each of them wants \
and does not say. It must continue naturally from the previous chapter and must not repeat what other chapters cover. \
Do not write the chapter title - it is printed separately.

For "scene" (an instruction to an illustrator): one suggestive, tasteful moment from the chapter with everyone \
clothed - closeness, a look, hands, a silhouette, the place and its light.

${ROMANCE_VOICE}call write_chapter with the text "${REFUSED}".

Always finish by calling write_chapter.`;

export const outlineSystem = (brief) => (isRomance(brief) ? romanceOutlineSystem(brief) : giftOutlineSystem(brief));
export const chapterSystem = (brief) => (isRomance(brief) ? romanceChapterSystem(brief) : giftChapterSystem(brief));

const giftOutlineSystem = (brief) => `You are an author who writes personal gift books in Hebrew. Someone tells you \
about a person they love, and you turn it into a whole book written just for that person.

Plan the book: a title that could only belong to this person, a subtitle, a dedication page, and exactly \
${LENGTHS[brief.length]} chapters that build one arc (an opening that pulls in, the middle that uses the giver's stories \
and details, and a closing chapter that lands the feeling). Spread the giver's details across the chapters so each \
chapter has real material of its own.${isKid(brief)
    ? " This is a children's picture book: one adventure story with a beginning, a problem, and a happy ending, where the child is the hero and their real loves and friends appear in it."
    : ''}

If the giver wrote their own dedication, use it word for word. ${VOICE}

Always finish by calling plan_book.`;

const giftChapterSystem = (brief) => `You are an author writing one chapter of a personal gift book in Hebrew. You \
get what the giver told about the person, the plan of the whole book, and which chapter to write now.

Write only this chapter, ${isKid(brief)
    ? "as a page of a children's picture book: 110-170 words, short sentences a child enjoys hearing read aloud, with rhythm and a little humor"
    : '380-520 words, with concrete scenes and details rather than general praise'}. \
It must continue naturally from the previous chapter and must not repeat what other chapters cover. Do not write the \
chapter title - it is printed separately. ${VOICE}

Always finish by calling write_chapter.`;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cleanProse = (s) => String(s ?? '')
  .replace(/\r/g, '')
  .split(/\n\s*\n/)
  .map((p) => p.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n\n');

// הקלט של הכלי -> מתווה נקי, או null אם אין בו פרקים
export function readOutline(input) {
  if (!input || !Array.isArray(input.chapters)) return null;
  const chapters = input.chapters
    .map((c) => ({ title: clean(c?.title), summary: clean(c?.summary) }))
    .filter((c) => c.title)
    .slice(0, MAX_CHAPTERS);
  const title = clean(input.title);
  if (!chapters.length || !title) return null;
  return { title, subtitle: clean(input.subtitle), dedication: cleanProse(input.dedication), chapters, look: clean(input.look), cover: clean(input.cover) };
}

export function readChapter(input) {
  const text = cleanProse(input?.text);
  return text ? { text, scene: clean(input.scene) } : null;
}

// מתווה שהגיע חזרה מהדפדפן (אחרי שהמשתמש אולי ערך אותו) -> נקי, או null
export function cleanOutline(o) {
  const cut = (s, max) => clean(s).slice(0, max);
  if (!o || !Array.isArray(o.chapters)) return null;
  const chapters = o.chapters.map((c) => ({ title: cut(c?.title, 120), summary: cut(c?.summary, 500) })).filter((c) => c.title).slice(0, MAX_CHAPTERS);
  const title = cut(o.title, 120);
  return chapters.length && title ? { title, subtitle: cut(o.subtitle, 200), chapters } : null;
}

export async function planBook(env, brief) {
  const input = await callTool(env, {
    system: outlineSystem(brief),
    tool: OUTLINE_TOOL,
    content: [{ type: 'text', text: briefText(brief) }],
    maxTokens: 6000,
  });
  if (String(input?.title || '').trim() === REFUSED) throw new Error(REFUSED_MESSAGE);
  const out = readOutline(input);
  if (!out) throw new Error('הסופר לא החזיר מתווה לספר. נסו שוב.');
  return out;
}

// index = איזה פרק לכתוב. before = סוף הפרק הקודם (להמשכיות). note = בקשה של המשתמש לכתיבה מחדש
export function chapterRequest(brief, outline, index, before, note) {
  const plan = outline.chapters.map((c, i) => `${i + 1}. ${c.title}${c.summary ? ` - ${c.summary}` : ''}`).join('\n');
  return [
    briefText(brief),
    `The book: "${outline.title}"${outline.subtitle ? ` - ${outline.subtitle}` : ''}\n\nAll chapters:\n${plan}`,
    before ? `The previous chapter ended like this:\n"""\n${before}\n"""` : index === 0 ? 'This is the opening chapter of the book.' : '',
    index === outline.chapters.length - 1 ? 'This is the closing chapter: end the book here, warmly.' : '',
    `Write chapter ${index + 1} now: "${outline.chapters[index].title}".`,
    note ? `The giver asked for this in the chapter (follow it): ${note}` : '',
  ].filter(Boolean).join('\n\n');
}

export async function writeChapter(env, brief, outline, index, before, note) {
  const input = await callTool(env, {
    system: chapterSystem(brief),
    tool: CHAPTER_TOOL,
    content: [{ type: 'text', text: chapterRequest(brief, outline, index, before, note) }],
    maxTokens: 5000,
  });
  if (String(input?.text || '').trim() === REFUSED) throw new Error(REFUSED_MESSAGE);
  const out = readChapter(input);
  if (!out) throw new Error('הסופר לא החזיר את הפרק. נסו שוב.');
  return out;
}

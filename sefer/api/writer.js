// הסופר: Claude בונה את מתווה הספר (שם, הקדשה, פרקים, כריכה) ואחר כך כותב פרק אחרי פרק.
// כל הטקסט לקורא בעברית; ההוראות למאייר באנגלית.
import { callTool } from './ai.js';
import { LENGTHS, briefText, isKid } from './brief.js';

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

export const outlineSystem = (brief) => `You are an author who writes personal gift books in Hebrew. Someone tells you \
about a person they love, and you turn it into a whole book written just for that person.

Plan the book: a title that could only belong to this person, a subtitle, a dedication page, and exactly \
${LENGTHS[brief.length]} chapters that build one arc (an opening that pulls in, the middle that uses the giver's stories \
and details, and a closing chapter that lands the feeling). Spread the giver's details across the chapters so each \
chapter has real material of its own.${isKid(brief)
    ? " This is a children's picture book: one adventure story with a beginning, a problem, and a happy ending, where the child is the hero and their real loves and friends appear in it."
    : ''}

If the giver wrote their own dedication, use it word for word. ${VOICE}

Always finish by calling plan_book.`;

export const chapterSystem = (brief) => `You are an author writing one chapter of a personal gift book in Hebrew. You \
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
  const out = readChapter(input);
  if (!out) throw new Error('הסופר לא החזיר את הפרק. נסו שוב.');
  return out;
}

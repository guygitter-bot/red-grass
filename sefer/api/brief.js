// "הבריף": מה שהמשתמש סיפר על מי שהספר נכתב עליו. כאן מנקים אותו ומתרגמים את הבחירות להוראות ל-AI.
// המזהים (אירוע, טון, סגנון איור, אורך) כפולים ב-web/src/lib/brief.js – לשנות בשניהם (בדיקה מוודאת).
export const OCCASIONS = {
  birthday: 'a birthday gift',
  anniversary: 'a wedding-anniversary gift about the couple and their years together',
  wedding: 'a wedding gift about the couple and how they got here',
  romantic: 'a romantic gesture: why this love is special',
  funny: 'a funny roast-style book among close friends: teasing with love, and warm at the end',
  kid: "an illustrated children's story in which the child is the hero of an adventure",
  just: 'a gift for no special occasion, just to say how much they mean',
  romance: 'a sensual romance novel for adult readers, about fictional adult characters',
  other: 'a personal gift book',
};

export const TONES = {
  moving: 'warm and moving',
  funny: 'funny and light, with affectionate teasing',
  mixed: 'a mix: mostly funny, with a few moving moments',
  adventure: 'an adventure story with imagination',
};

export const STYLES = {
  watercolor: 'soft watercolor illustration, warm light, gentle textures',
  storybook: "classic children's storybook illustration, rounded friendly shapes, rich colors",
  comic: 'bold comic-book illustration, clean ink lines, flat vivid colors',
  pencil: 'delicate colored-pencil drawing on paper, light and airy',
  real: 'cinematic semi-realistic digital painting, soft depth of field',
};

// כמה פרקים בספר
export const LENGTHS = { short: 6, medium: 10, long: 14 };

export const MAX_ANSWERS = 12;
const MAX_FIELD = 80;
const MAX_ANSWER = 1500;

const line = (s, max = MAX_FIELD) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const para = (s, max = MAX_ANSWER) => (typeof s === 'string' ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '');
const pick = (map, v, fallback) => (Object.hasOwn(map, v) ? v : fallback);

// מה שהגיע מהדפדפן -> בריף נקי, או null אם חסר שם
export function cleanBrief(b) {
  const name = line(b?.name);
  if (!name) return null;
  const occasion = pick(OCCASIONS, b.occasion, 'other');
  const answers = (Array.isArray(b.answers) ? b.answers : [])
    .map((x) => ({ q: line(x?.q, 200), a: para(x?.a) }))
    .filter((x) => x.q && x.a)
    .slice(0, MAX_ANSWERS);
  return {
    occasion,
    name,
    gender: b.gender === 'f' ? 'f' : 'm',
    relation: line(b.relation),
    age: line(b.age, 20),
    from: line(b.from),
    tone: pick(TONES, b.tone, occasion === 'kid' ? 'adventure' : 'mixed'),
    style: pick(STYLES, b.style, occasion === 'kid' ? 'storybook' : 'watercolor'),
    length: pick(LENGTHS, b.length, 'medium'),
    dedication: para(b.dedication, 600),
    // רומן למבוגרים: המשתמש אישר שהוא מעל 18 (בלי האישור השרת לא כותב)
    adult: b.adult === true,
    answers,
  };
}

export const isKid = (brief) => brief.occasion === 'kid';
// רומן רומנטי-חושני למבוגרים: דמויות בדויות ובגירות, בלי תיאור מפורש, בלי תמונות של אנשים
export const isRomance = (brief) => brief.occasion === 'romance';

// הבריף כטקסט ל-Claude (התשובות בעברית, כמו שנכתבו)
export function briefText(brief) {
  if (isRomance(brief)) {
    const told = brief.answers.map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n\n');
    return [
      `Genre: ${OCCASIONS.romance}`,
      `Main characters (fictional adults): ${brief.name}`,
      brief.dedication && `The reader wrote this dedication themselves (keep it word for word): ${brief.dedication}`,
      `\nThe frame story and the characters, as the reader described them:\n\n${told || '(nothing more - invent a setting and a story that fit the characters)'}`,
    ].filter(Boolean).join('\n');
  }
  const rows = [
    `Occasion: ${OCCASIONS[brief.occasion]}`,
    `The book is about: ${brief.name} (${brief.gender === 'f' ? 'female - write about her in Hebrew feminine forms' : 'male - write about him in Hebrew masculine forms'})`,
    brief.age && `Age: ${brief.age}`,
    brief.relation && `Who they are to the giver: ${brief.relation}`,
    brief.from && `The book is given by: ${brief.from}`,
    `Tone: ${TONES[brief.tone]}`,
    brief.dedication && `The giver wrote this dedication themselves (keep it word for word): ${brief.dedication}`,
  ].filter(Boolean);
  const answers = brief.answers.map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n\n');
  return `${rows.join('\n')}\n\nWhat the giver told us:\n\n${answers || '(nothing more - stay general and warm, and do not invent specific facts)'}`;
}

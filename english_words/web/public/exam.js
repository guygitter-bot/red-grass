// כל סוגי השאלות של המבחן (פונקציות טהורות – נבדקות בלי דפדפן).
// כל שאלה: מה מציגים (text / pic / speak), השאלה (ask), התשובות (options) והתשובה הנכונה (answer)
import { WORDS } from './words.js';
import { SENTENCES, PIC_SENTENCES } from './sentences.js';
import { choicesFor, sentenceChoicesFor, nextOrder, shuffle } from './match.js';

// הסעיפים לפי הסדר שבדף המבחן
export const SECTIONS = [
  { mode: 'listen', icon: '🎧', title: 'שומעים ובוחרים', note: 'שומעים מילה ובוחרים אותה מתוך שתיים' },
  { mode: 'letters', icon: '🔠', title: 'אותיות גדולות וקטנות', note: 'למשל: A ו-a' },
  { mode: 'opening', icon: '🅰️', title: 'אות פותחת', note: 'באיזו אות מתחילה התמונה?' },
  { mode: 'picture', icon: '🖼️', title: 'תמונה ומילה', note: 'בוחרים את המילה שמתאימה לתמונה' },
  { mode: 'bank', icon: '📦', title: 'מחסן מילים', note: 'מתאימים מילה מהמחסן לכל תמונה' },
  { mode: 'picsent', icon: '🧩', title: 'משפט ותמונה', note: 'קוראים משפט ובוחרים תמונה' },
];

// מילים שאפשר לצייר בבירור (בלי tall / small / jump)
export const PIC_WORDS = WORDS.filter((w) => !['tall', 'small', 'jump'].includes(w.en));
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

// אותיות שקל להתבלבל ביניהן – כדי שהתשובות השגויות יהיו "אמיתיות"
const LOOKALIKE = {
  a: 'eo', b: 'dph', c: 'oe', d: 'bqp', e: 'ac', f: 't', g: 'qj', h: 'nb', i: 'jl', j: 'ig', k: 'hx', l: 'it', m: 'nw',
  n: 'mhu', o: 'ca', p: 'qbd', q: 'pdg', r: 'n', s: 'z', t: 'f', u: 'nv', v: 'uwy', w: 'mv', x: 'k', y: 'v', z: 's',
};

export function letterOptions(letter, rand = Math.random) {
  const near = shuffle(LOOKALIKE[letter].split(''), rand).slice(0, 2);
  const rest = shuffle(LETTERS.filter((l) => l !== letter && !near.includes(l)), rand);
  return shuffle([letter, ...near, ...rest].slice(0, 4), rand);
}

// כמה שינויים צריך כדי להפוך מילה אחת לשנייה
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// מילה שנשמעת דומה (bag / bed) – לסעיף ההאזנה
export function soundAlike(word, list = WORDS, rand = Math.random) {
  const others = list.filter((w) => w.en !== word.en);
  const min = Math.min(...others.map((w) => distance(word.en, w.en)));
  return shuffle(others.filter((w) => distance(word.en, w.en) === min), rand)[0];
}

const pick = (list, n, rand) => shuffle(list, rand).slice(0, n);
const firstLetter = (w) => w.en[0];

export function build(mode, { learned = {}, rand = Math.random, count } = {}) {
  switch (mode) {
    case 'words':
      return (count ? pick(WORDS, count, rand) : nextOrder(WORDS, learned, rand)).map((w) => ({
        key: w.en, text: w.en, mic: w, ask: 'מה פירוש המילה?', options: choicesFor(w, WORDS, rand), answer: w.he, style: 'he', reward: w.pic,
      }));
    case 'sentences':
      return pick(SENTENCES, count || SENTENCES.length, rand).map((s) => ({
        key: s.en, text: s.en, textClass: 'sentence', hear: s.en, ask: 'מה פירוש המשפט?',
        options: sentenceChoicesFor(s, SENTENCES, rand), answer: s.he, style: 'he',
      }));
    case 'listen':
      return pick(WORDS, count || 20, rand).map((w) => ({
        key: w.en, pic: '🎧', speak: w.en, hear: w.en, ask: 'איזו מילה שמעת?',
        options: shuffle([w.en, soundAlike(w, WORDS, rand).en], rand), answer: w.en, style: 'en', reward: w.pic,
      }));
    case 'letters':
      // חצי: מגדולה לקטנה, חצי: מקטנה לגדולה
      return pick(LETTERS, count || 26, rand).map((l, i) => (i % 2 === 0
        ? { key: `${l.toUpperCase()}→${l}`, text: l.toUpperCase(), textClass: 'letter', ask: 'מה האות הקטנה?', options: letterOptions(l, rand), answer: l, style: 'letter' }
        : { key: `${l}→${l.toUpperCase()}`, text: l, textClass: 'letter', ask: 'מה האות הגדולה?', options: letterOptions(l, rand).map((o) => o.toUpperCase()), answer: l.toUpperCase(), style: 'letter' }));
    case 'opening':
      return pick(PIC_WORDS, count || 20, rand).map((w) => ({
        key: w.en, pic: w.pic, ask: 'באיזו אות מתחילה המילה?', options: letterOptions(firstLetter(w), rand), answer: firstLetter(w), style: 'letter', reveal: w.en,
      }));
    case 'picture':
      return pick(PIC_WORDS, count || 20, rand).map((w) => {
        const other = pick(PIC_WORDS.filter((o) => o.en !== w.en), 1, rand)[0];
        return { key: w.en, pic: w.pic, ask: 'מה רואים בתמונה?', options: shuffle([w.en, other.en], rand), answer: w.en, style: 'en' };
      });
    case 'bank': {
      // כמו בדף: מחסן של 5 מילים, וכל תמונה מקבלת מילה ממנו (המחסן נשאר באותו סדר)
      const words = pick(PIC_WORDS, count ? Math.ceil(count / 5) * 5 : 20, rand);
      const out = [];
      for (let i = 0; i < words.length; i += 5) {
        const group = words.slice(i, i + 5);
        const bank = shuffle(group.map((w) => w.en), rand);
        for (const w of shuffle(group, rand)) out.push({ key: w.en, pic: w.pic, ask: 'איזו מילה מהמחסן מתאימה לתמונה?', options: bank, answer: w.en, style: 'en' });
      }
      return count ? out.slice(0, count) : out;
    }
    case 'picsent':
      return pick(PIC_SENTENCES, count || PIC_SENTENCES.length, rand).map((s) => ({
        key: s.en, text: s.en, textClass: 'sentence', hear: s.en, ask: 'איזו תמונה מתאימה למשפט?',
        options: picOptions(s, rand), answer: s.pic.join(''), style: 'pic',
      }));
    case 'exam':
      // מבחן לדוגמה: מכל סעיף כמה שאלות, לפי הסדר של המבחן האמיתי
      return [...SECTIONS.map((s) => s.mode), 'words', 'sentences']
        .flatMap((m) => build(m, { rand, count: 4 }).map((q) => ({ ...q, section: m })));
    default:
      return [];
  }
}

// תמונות שגויות שדומות למשפט (אותה דמות או אותו חפץ)
export function picOptions(item, rand = Math.random) {
  const others = shuffle(PIC_SENTENCES.filter((s) => s.en !== item.en && s.pic.join('') !== item.pic.join('')), rand)
    .sort((a, b) => b.pic.filter((p) => item.pic.includes(p)).length - a.pic.filter((p) => item.pic.includes(p)).length);
  return shuffle([item, ...others.slice(0, 3)], rand).map((s) => s.pic.join(''));
}

export const MODE_TITLES = {
  words: 'מילים', sentences: 'משפטים – תרגום', exam: 'מבחן לדוגמה',
  ...Object.fromEntries(SECTIONS.map((s) => [s.mode, s.title])),
};

import { shuffle } from './util';

// אותיות מבולבלות; מוודאים שהסדר שונה מהמילה (אם אפשר)
export function scrambleWord(word, rand = Math.random) {
  const letters = word.split('').map((ch, i) => ({ id: i, ch }));
  if (new Set(word.split('')).size < 2) return letters;
  let out = shuffle(letters, rand);
  let tries = 0;
  while (out.map((l) => l.ch).join('') === word && tries++ < 20) out = shuffle(letters, rand);
  return out;
}

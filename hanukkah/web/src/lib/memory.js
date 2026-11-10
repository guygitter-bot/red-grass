import { shuffle } from './util';

// סמלי החג למשחק הזיכרון
export const SYMBOLS = [
  { id: 'hanukkiah', emoji: '🕎', word: 'חנוכייה' },
  { id: 'sufganiya', emoji: '🍩', word: 'סופגניה' },
  { id: 'oil', emoji: '🏺', word: 'פך שמן' },
  { id: 'gelt', emoji: '🪙', word: 'דמי חנוכה' },
  { id: 'candle', emoji: '🕯️', word: 'נר' },
  { id: 'flame', emoji: '🔥', word: 'להבה' },
  { id: 'temple', emoji: '🏛️', word: 'בית המקדש' },
  { id: 'shield', emoji: '🛡️', word: 'מגן' },
  { id: 'latke', emoji: '🥔', word: 'לביבה' },
  { id: 'olive', emoji: '🫒', word: 'זית' },
  { id: 'star', emoji: '⭐', word: 'כוכב' },
  { id: 'sword', emoji: '⚔️', word: 'חרב' },
];

// שלושה גדלים: עמודות ומספר זוגות
export const SIZES = {
  small: { label: 'קטן', cols: 3, pairs: 6 },
  medium: { label: 'בינוני', cols: 4, pairs: 8 },
  large: { label: 'גדול', cols: 5, pairs: 10 },
};

export function buildDeck(sizeKey, rand = Math.random) {
  const size = SIZES[sizeKey] || SIZES.small;
  const chosen = shuffle(SYMBOLS, rand).slice(0, size.pairs);
  const cards = [];
  chosen.forEach((s) => {
    cards.push({ key: s.id + 'a', ...s });
    cards.push({ key: s.id + 'b', ...s });
  });
  return shuffle(cards, rand);
}

import { describe, it, expect } from 'vitest';
import { buildDeck, SIZES, SYMBOLS } from './memory';

describe('זיכרון', () => {
  it('כל גודל נותן זוגות שלמים', () => {
    for (const k of Object.keys(SIZES)) {
      const deck = buildDeck(k);
      expect(deck.length).toBe(SIZES[k].pairs * 2);
      const count = {};
      deck.forEach((c) => (count[c.id] = (count[c.id] || 0) + 1));
      expect(Object.values(count).every((n) => n === 2)).toBe(true);
    }
  });
  it('יש מספיק סמלים לגודל הגדול', () => {
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(SIZES.large.pairs);
  });
});

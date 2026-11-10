import { describe, it, expect } from 'vitest';
import { scrambleWord } from './scramble';
import { WORDS } from '../data/words';

describe('מילה מבולבלת', () => {
  it('הערבוב שומר על האותיות ומשנה את הסדר', () => {
    for (const w of WORDS) {
      const s = scrambleWord(w.word);
      expect(s.map((l) => l.ch).sort().join('')).toBe(w.word.split('').sort().join(''));
      expect(s.map((l) => l.ch).join('')).not.toBe(w.word);
    }
  });
  it('לכל מילה יש רמז ומזהה ייחודי', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
    WORDS.forEach((w) => expect(w.hint.length).toBeGreaterThan(3));
  });
});

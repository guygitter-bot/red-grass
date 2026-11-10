import { describe, it, expect } from 'vitest';
import { QUESTIONS, LEVEL_INFO } from './quiz';

describe('שאלות החידון', () => {
  it('יש לפחות 36 שאלות ו-3 רמות', () => {
    expect(LEVEL_INFO.length).toBe(3);
    const total = LEVEL_INFO.reduce((n, l) => n + QUESTIONS[l.key].length, 0);
    expect(total).toBeGreaterThanOrEqual(36);
    LEVEL_INFO.forEach((l) => expect(QUESTIONS[l.key].length).toBeGreaterThanOrEqual(12));
  });
  it('כל שאלה תקינה', () => {
    const seen = new Set();
    for (const l of LEVEL_INFO) {
      for (const q of QUESTIONS[l.key]) {
        expect(q.q.length).toBeGreaterThan(5);
        expect(q.options.length).toBe(4);
        expect(new Set(q.options).size).toBe(4);
        expect(Number.isInteger(q.correct)).toBe(true);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(4);
        expect(q.explain.length).toBeGreaterThan(5);
        expect(seen.has(q.q)).toBe(false);
        seen.add(q.q);
      }
    }
  });
});

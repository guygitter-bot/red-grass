import { describe, expect, it } from 'vitest';
import { hapticMs } from './haptics';

describe('רטט', () => {
  it('בס חזק יותר מסנר ומצילה, בטווח 8-15ms', () => {
    expect(hapticMs('kick', 1)).toBeGreaterThan(hapticMs('snare', 1));
    expect(hapticMs('snare', 1)).toBeGreaterThan(hapticMs('crash', 1));
    for (const t of ['kick', 'snare', 'tom', 'hihat', 'ride', 'crash']) {
      for (const v of [0, 0.5, 1, 7, undefined]) {
        const ms = hapticMs(t, v);
        expect(ms).toBeGreaterThanOrEqual(8);
        expect(ms).toBeLessThanOrEqual(15);
      }
    }
  });
  it('עוצמה גבוהה יותר = רטט ארוך יותר', () => {
    expect(hapticMs('kick', 1)).toBeGreaterThanOrEqual(hapticMs('kick', 0));
  });
});

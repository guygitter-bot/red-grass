import { describe, expect, it } from 'vitest';
import { circlePositions, pairs, avatarSize } from './board';

describe('board', () => {
  it('הראשון למעלה במרכז', () => {
    const [p] = circlePositions(3);
    expect(Math.round(p.x)).toBe(50);
    expect(p.y).toBeLessThan(20);
  });
  it('כל הנקודות בתוך הלוח', () => {
    for (const n of [1, 3, 10]) for (const p of circlePositions(n)) expect(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100).toBe(true);
  });
  it('קווים לכל זוג', () => {
    expect(pairs(3)).toHaveLength(3);
    expect(pairs(10)).toHaveLength(45);
    expect(pairs(1)).toHaveLength(0);
  });
  it('עיגול קטן יותר עם יותר בוטים', () => {
    expect(avatarSize(10)).toBeLessThan(avatarSize(3));
  });
});

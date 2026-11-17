import { describe, expect, it } from 'vitest';
import { boardLayout, circlePositions, pairs, avatarSize } from './board';

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
  it('המנהל באמצע, מחובר לכולם', () => {
    const agents = ['creative', 'campaigns', 'editor', 'librarian', 'manager'].map((key) => ({ key }));
    const { pos, lines, mid } = boardLayout(agents);
    expect(mid).toBe(4);
    expect(pos[4]).toEqual({ x: 50, y: 50 });
    expect(Math.round(pos[0].x)).toBe(50);
    expect(lines).toHaveLength(6 + 4);
    expect(lines.filter(([a, b]) => a === 4 || b === 4)).toHaveLength(4);
  });
  it('בלי מנהל – מעגל רגיל', () => {
    const { pos, lines, mid } = boardLayout([{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
    expect(mid).toBe(-1);
    expect(lines).toHaveLength(3);
    expect(pos[0].y).toBeLessThan(30);
  });
});

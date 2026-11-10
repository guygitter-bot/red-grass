import { describe, it, expect } from 'vitest';
import { newCatchGame, step, PLATE_Y, W, fallSpeed } from './catch';

const at = (type) => ({ ...newCatchGame(), spawnIn: 99, items: [{ id: 1, x: W / 2, y: PLATE_Y - 5, type, speed: 1 }] });

describe('תפוס את הסופגניות', () => {
  it('תפיסת סופגניה מעלה ניקוד', () => {
    const s = step(at('sufganiya'), 0.016);
    expect(s.score).toBe(1);
    expect(s.items.length).toBe(0);
    expect(s.events).toContain('good');
  });
  it('מטבע שווה 2', () => {
    expect(step(at('coin'), 0.016).score).toBe(2);
  });
  it('טיפת מים מורידה חיים', () => {
    const s = step(at('drop'), 0.016);
    expect(s.lives).toBe(2);
    expect(s.score).toBe(0);
  });
  it('בלי חיים המשחק נגמר', () => {
    const s = step({ ...at('drop'), lives: 1 }, 0.016);
    expect(s.over).toBe(true);
  });
  it('פריט שפספסנו נעלם בלי עונש', () => {
    const s = step({ ...at('sufganiya'), plateX: 40, items: [{ id: 1, x: 300, y: PLATE_Y - 5, type: 'sufganiya', speed: 1 }] }, 0.016);
    expect(s.lives).toBe(3);
    expect(s.score).toBe(0);
  });
  it('הצלחת נשארת בתוך המסך', () => {
    const s = step({ ...newCatchGame(), plateX: 5, spawnIn: 99 }, 1, -1);
    expect(s.plateX).toBeGreaterThan(0);
  });
  it('המהירות עולה עם הניקוד', () => {
    expect(fallSpeed(50)).toBeGreaterThan(fallSpeed(0));
  });
});

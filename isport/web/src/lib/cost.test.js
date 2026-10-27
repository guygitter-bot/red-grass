import { describe, expect, it } from 'vitest';
import { monthCost, money } from './cost';

describe('cost', () => {
  it('estimates a month by the price list', () => {
    // מיליון טוקנים בכניסה ($4) + 100 אלף ביציאה ($2) + 100 חיפושים ($1)
    const c = monthCost({ input: 1e6, output: 1e5, searches: 100 });
    expect(c.usd).toBeCloseTo(7);
    expect(c.ils).toBeCloseTo(25.9);
  });
  it('old months without the details', () => {
    expect(monthCost({ calls: 3 }).usd).toBe(0);
    expect(monthCost().usd).toBe(0);
  });
  it('formats', () => {
    expect(money(3.456)).toBe('₪3.46');
    expect(money(1234.4)).toBe('₪1,234');
  });
});

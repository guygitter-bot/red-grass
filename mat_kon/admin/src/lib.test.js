import { describe, expect, it } from 'vitest';
import { ago, lastDays, usd } from './lib';

describe('admin helpers', () => {
  it('fills missing days with zero', () => {
    const days = lastDays({ '2026-10-19': 3 }, 3, new Date('2026-10-20T12:00:00Z'));
    expect(days).toEqual([{ day: '2026-10-18', count: 0 }, { day: '2026-10-19', count: 3 }, { day: '2026-10-20', count: 0 }]);
  });
  it('formats time and money', () => {
    const now = Date.parse('2026-10-20T12:00:00Z');
    expect(ago('2026-10-20T11:30:00Z', now)).toBe('לפני 30 דק׳');
    expect(ago('2026-10-18T12:00:00Z', now)).toBe('לפני 2 ימים');
    expect(ago(null)).toBe('—');
    expect(usd(1.234)).toBe('$1.23');
  });
});

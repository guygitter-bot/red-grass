import { describe, expect, it } from 'vitest';
import { RELOCK_AFTER_MS, recentlyActive } from './lock';

describe('נעילה אחרי 10 דקות בלי שימוש', () => {
  const now = Date.parse('2026-10-06T10:00:00Z');
  it('בתוך 10 דקות – בלי סיסמה, אחרי – עם סיסמה', () => {
    expect(RELOCK_AFTER_MS).toBe(10 * 60 * 1000);
    expect(recentlyActive(now, now - 9 * 60 * 1000)).toBe(true);
    expect(recentlyActive(now, now - 10 * 60 * 1000)).toBe(true);
    expect(recentlyActive(now, now - 11 * 60 * 1000)).toBe(false);
  });
  it('בלי שימוש קודם, או שעון שזז אחורה – מבקשים סיסמה', () => {
    expect(recentlyActive(now, null)).toBe(false);
    expect(recentlyActive(now, now + 60 * 1000)).toBe(false);
  });
});

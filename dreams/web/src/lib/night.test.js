import { describe, it, expect } from 'vitest';
import { nightKey, shiftNight, isMorning, nightLabel, upcomingNight } from './night';

describe('upcomingNight', () => {
  it('כוונה בבוקר, בערב ואחרי חצות – נקראת באותו לילה', () => {
    expect(upcomingNight(new Date(2026, 10, 25, 10, 0))).toBe('2026-11-25');
    expect(upcomingNight(new Date(2026, 10, 25, 23, 30))).toBe('2026-11-25');
    expect(upcomingNight(new Date(2026, 10, 26, 0, 30))).toBe('2026-11-25');
    // בערב (22:00) ובבוקר שאחרי (07:00) – אותו מפתח
    expect(nightKey(new Date(2026, 10, 25, 22, 0))).toBe('2026-11-25');
    expect(nightKey(new Date(2026, 10, 26, 7, 0))).toBe('2026-11-25');
  });
});

describe('nightKey', () => {
  it('ערב, חצות ובוקר – אותו לילה', () => {
    expect(nightKey(new Date(2026, 10, 24, 23, 30))).toBe('2026-11-24');
    expect(nightKey(new Date(2026, 10, 25, 0, 30))).toBe('2026-11-24');
    expect(nightKey(new Date(2026, 10, 25, 7, 0))).toBe('2026-11-24');
    expect(nightKey(new Date(2026, 10, 25, 14, 59))).toBe('2026-11-24');
  });
  it('מ-15:00 לילה חדש', () => {
    expect(nightKey(new Date(2026, 10, 25, 15, 0))).toBe('2026-11-25');
  });
  it('מעבר חודש ושנה', () => {
    expect(nightKey(new Date(2027, 0, 1, 3, 0))).toBe('2026-12-31');
    expect(shiftNight('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftNight('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('בוקר ותווית', () => {
    expect(isMorning(new Date(2026, 10, 25, 7))).toBe(true);
    expect(isMorning(new Date(2026, 10, 25, 22))).toBe(false);
    expect(nightLabel('2026-11-24')).toBe('ליל שלישי, 24.11');
  });
});

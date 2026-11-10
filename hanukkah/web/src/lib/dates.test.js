import { describe, it, expect } from 'vitest';
import { hanukkahStatus, tonightLine, FIRST_NIGHTS } from './dates';

const d = (s) => {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0);
};

describe('hanukkahStatus', () => {
  it('לפני החג: ספירה לאחור', () => {
    const st = hanukkahStatus(d('2026-11-10'));
    expect(st.state).toBe('before');
    expect(st.daysUntil).toBe(24);
    expect(tonightLine(st)).toBe('עוד 24 ימים לחנוכה');
  });
  it('יום לפני: מחר בערב', () => {
    const st = hanukkahStatus(d('2026-12-03'));
    expect(st.daysUntil).toBe(1);
    expect(tonightLine(st)).toContain('מחר');
  });
  it('לילה ראשון', () => {
    const st = hanukkahStatus(d('2026-12-04'));
    expect(st).toMatchObject({ state: 'during', night: 1 });
    expect(tonightLine(st)).toBe('הערב מדליקים נר ראשון');
  });
  it('לילה רביעי', () => {
    expect(tonightLine(hanukkahStatus(d('2026-12-07')))).toBe('הערב מדליקים נר רביעי');
  });
  it('לילה שמיני', () => {
    expect(hanukkahStatus(d('2026-12-11'))).toMatchObject({ state: 'during', night: 8 });
  });
  it('אחרי החג: סופרים לשנה הבאה', () => {
    const st = hanukkahStatus(d('2026-12-12'));
    expect(st.state).toBe('before');
    expect(st.start).toBe('2027-12-24');
    expect(st.daysUntil).toBe(377);
  });
  it('אחרי כל הרשימה', () => {
    expect(hanukkahStatus(d('2031-01-15')).state).toBe('unknown');
  });
  it('כל תאריך הוא לילה ראשון', () => {
    for (const s of FIRST_NIGHTS) expect(hanukkahStatus(d(s)).night).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { daysText, whenText, nextText, defaultForm, formFrom, budgetText } from './schedules';

describe('schedules', () => {
  it('ימים', () => {
    expect(daysText([0, 1, 2, 3, 4, 5, 6])).toBe('כל יום');
    expect(daysText([4, 3, 2, 1, 0])).toBe('ימי חול');
    expect(daysText([0, 3])).toBe('ראשון ורביעי');
    expect(daysText([0, 2, 4])).toBe('ראשון, שלישי וחמישי');
    expect(daysText([6])).toBe('שבת');
    expect(whenText({ days: [0, 1, 2, 3, 4, 5, 6], time: '02:00' })).toBe('כל יום ב-02:00');
    expect(whenText({ days: [0, 3], time: '21:00' })).toBe('ראשון ורביעי ב-21:00');
  });
  it('הפעם הבאה לפי שעון ישראל', () => {
    const now = Date.parse('2026-11-17T20:00:00Z'); // 22:00 בישראל
    expect(nextText(null, now)).toBe('מושהית');
    expect(nextText(Date.parse('2026-11-17T21:30:00Z'), now)).toBe('היום ב-23:30');
    expect(nextText(Date.parse('2026-11-17T22:30:00Z'), now)).toBe('מחר ב-00:30'); // אחרי חצות בישראל
    expect(nextText(Date.parse('2026-11-17T20:30:00Z'), now)).toBe('היום ב-22:30');
    expect(nextText(Date.parse('2026-11-18T06:00:00Z'), now)).toBe('מחר ב-08:00');
    expect(nextText(Date.parse('2026-11-20T06:00:00Z'), now)).toMatch(/ב-08:00$/);
  });
  it('טופס', () => {
    expect(defaultForm([{ key: 'manager' }]).to).toBe('manager');
    expect(defaultForm([]).to).toBe(null);
    expect(defaultForm([]).budget).toBe(2);
    expect(formFrom({ id: 'x', title: 't', text: 'a', to: null, days: [1], time: '08:00', budget: 1, enabled: false }).enabled).toBe(false);
    expect(budgetText(2)).toBe('עד $2 בכל הפעלה');
  });
});

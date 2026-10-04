import { describe, expect, it } from 'vitest';
import { parseTime, timeDraft } from './dates';

describe('הקלדת שעה בספרות', () => {
  it('הנקודתיים נכנסות לבד בזמן ההקלדה', () => {
    expect(timeDraft('1')).toBe('1');
    expect(timeDraft('10')).toBe('10');
    expect(timeDraft('103')).toBe('10:3');
    expect(timeDraft('1030')).toBe('10:30');
    expect(timeDraft('10305')).toBe('10:30');
    expect(timeDraft('930')).toBe('9:30');
    expect(timeDraft('10:')).toBe('10:');
    expect(timeDraft('9.15')).toBe('9:15');
    expect(timeDraft('')).toBe('');
  });

  it('מה שהוקלד נשמר כ-HH:MM', () => {
    expect(parseTime('1030')).toBe('10:30');
    expect(parseTime('930')).toBe('09:30');
    expect(parseTime('9')).toBe('09:00');
    expect(parseTime('14')).toBe('14:00');
    expect(parseTime('7:05')).toBe('07:05');
    expect(parseTime('00:00')).toBe('00:00');
    expect(parseTime('23:59')).toBe('23:59');
  });

  it('מחיקה = בלי שעה, ושעה לא אמיתית לא נשמרת', () => {
    expect(parseTime('')).toBe('');
    expect(parseTime('25')).toBe(null);
    expect(parseTime('2460')).toBe(null);
    expect(parseTime('10:75')).toBe(null);
    expect(parseTime(':30')).toBe(null);
  });
});

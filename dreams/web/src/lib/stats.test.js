import { describe, it, expect } from 'vitest';
import { recallRate, streak, incubation, topTags, searchEntries } from './stats';
import { safeEntry } from './store';

const NOW = new Date(2026, 10, 25, 9, 0); // בוקר אחרי ליל 24.11
const e = (night, extra = {}) => safeEntry({ night, text: 'חלום', at: 1, ...extra });

describe('stats', () => {
  it('אחוז זכירה ב-14 הלילות האחרונים', () => {
    const list = [e('2026-11-24'), e('2026-11-23'), e('2026-11-20', { type: 'none', text: '' }), e('2026-11-01')];
    expect(recallRate(list, 14, NOW)).toEqual({ hit: 2, days: 14 });
  });
  it('רצף לילות', () => {
    expect(streak([e('2026-11-24'), e('2026-11-23'), e('2026-11-21')], NOW)).toBe(2);
    expect(streak([e('2026-11-23'), e('2026-11-22')], NOW)).toBe(2);
    expect(streak([e('2026-11-20')], NOW)).toBe(0);
  });
  it('הצלחת זימון לפי סוג – הרשומה הכי קשורה בלילה קובעת', () => {
    const nights = {
      '2026-11-24': { kind: 'problem' },
      '2026-11-23': { kind: 'problem' },
      '2026-11-22': { kind: 'creative' },
      '2026-11-21': { kind: 'recall' },
      '2026-11-10': { kind: 'problem' }, // בלי רישום – לא נספר
    };
    const list = [
      e('2026-11-24', { related: 'no' }),
      e('2026-11-24', { related: 'yes' }),
      e('2026-11-23', { related: 'partly' }),
      e('2026-11-22', { type: 'none', text: '' }),
      e('2026-11-21'),
    ];
    const r = incubation(nights, list);
    expect(r.total).toEqual({ tried: 3, yes: 1, partly: 1 });
    expect(r.rows.find((x) => x.kind === 'problem')).toEqual({ kind: 'problem', tried: 2, yes: 1, partly: 1 });
  });
  it('תגיות וחיפוש', () => {
    const list = [e('2026-11-24', { tags: ['ים', 'בית'] }), e('2026-11-23', { tags: ['ים'], text: 'עפתי מעל העיר' })];
    expect(topTags(list)[0]).toEqual(['ים', 2]);
    expect(searchEntries(list, 'עפתי')).toHaveLength(1);
    expect(searchEntries(list, '')).toHaveLength(2);
  });
});

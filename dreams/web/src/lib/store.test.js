import { describe, it, expect } from 'vitest';
import { safeData, safeEntry, safeIntention, exportText, mergeImport } from './store';

describe('safe*', () => {
  it('נתונים ריקים / שבורים לא מפילים', () => {
    const d = safeData(null);
    expect(d.entries).toEqual([]);
    expect(d.settings.voice).toBe(true);
    expect(safeData({ nights: { bad: {}, '2026-11-24': 'x' }, entries: 'no' }).nights).toEqual({});
  });
  it('רשומה ישנה בלי שדות מקבלת ברירות מחדל', () => {
    const e = safeEntry({ id: 'a', at: new Date(2026, 10, 25, 7).getTime(), text: 'ים' });
    expect(e.night).toBe('2026-11-24');
    expect(e.type).toBe('dream');
    expect(e.tags).toEqual([]);
    expect(e.glimpses).toEqual([]);
    expect(e.related).toBe(null);
    expect(e.mood).toBe(null);
  });
  it('תגיות בלי כפילויות', () => {
    expect(safeEntry({ tags: ['ים', 'ים ', '', 'בית'] }).tags).toEqual(['ים', 'בית']);
  });
  it('כוונה עם סוג לא מוכר', () => {
    expect(safeIntention({ kind: 'zzz', text: 'שאלה' }).kind).toBe('problem');
    expect(safeIntention(null)).toBe(null);
  });
});

describe('גיבוי ושחזור', () => {
  it('מאחד בלי למחוק', () => {
    const a = safeData({ entries: [{ id: '1', text: 'א', at: 1 }], nights: { '2026-11-20': { kind: 'creative', text: 'שיר' } } });
    const b = safeData({ entries: [{ id: '2', text: 'ב', at: 2 }, { id: '1', text: 'א מעודכן', at: 1 }] });
    const merged = mergeImport(a, exportText(b));
    expect(merged.entries.map((e) => e.text)).toEqual(['ב', 'א מעודכן']);
    expect(merged.nights['2026-11-20'].text).toBe('שיר');
  });
  it('קובץ זר – שגיאה בעברית', () => {
    expect(() => mergeImport(safeData(null), '{}')).toThrow(/לא קובץ גיבוי/);
    expect(() => mergeImport(safeData(null), 'xx')).toThrow(/לא נקרא/);
  });
});

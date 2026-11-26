import { describe, it, expect } from 'vitest';
import { LENSES, HD_TYPES, HD_AUTHORITIES, lensQuestions } from './lenses';

const entry = { title: 'הבית עם הדלת', tags: ['ים', 'סבתא', 'דלת', 'אור'] };

describe('עדשות', () => {
  it('לכל עדשה יש תיאור, בסיס ומקורות עם כתובת', () => {
    expect(LENSES.map((l) => l.id)).toEqual(['hd', 'jung', 'jewish', 'therapy']);
    for (const l of LENSES) {
      expect(l.basis.length).toBeGreaterThan(20);
      expect(l.about.length).toBeGreaterThan(50);
      for (const s of l.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });
  it('כל עדשה מחזירה 5–8 שאלות עם טקסט', () => {
    for (const l of LENSES) {
      const qs = lensQuestions(l.id, entry, {}, 'איפה לפתוח סטודיו');
      expect(qs.length).toBeGreaterThanOrEqual(5);
      expect(qs.length).toBeLessThanOrEqual(8);
      for (const x of qs) expect(x.q.length).toBeGreaterThan(5);
    }
  });
  it('בלי חלום ובלי הגדרות לא קורסים', () => {
    for (const l of LENSES) expect(lensQuestions(l.id, null, null).length).toBeGreaterThanOrEqual(5);
    expect(lensQuestions('zzz', entry, {})).toEqual([]);
  });
  it('Human Design מותאם לסוג ולתוקף, וגנרי כשלא נבחרו', () => {
    const t = HD_TYPES.find((x) => x.id === 'projector');
    const a = HD_AUTHORITIES.find((x) => x.id === 'splenic');
    const mine = lensQuestions('hd', entry, { hd: { type: 'projector', authority: 'splenic' } }).map((x) => x.q).join('\n');
    expect(mine).toContain(t.name);
    expect(mine).toContain(t.notSelf);
    expect(mine).toContain(a.name);
    const generic = lensQuestions('hd', entry, { hd: { type: null, authority: null } }).map((x) => x.q).join('\n');
    expect(generic).not.toContain(t.name);
    expect(generic).not.toContain(a.name);
    expect(mine).not.toBe(generic);
  });
  it('תגיות וכוונה מופיעות בשאלות (עד שלוש תגיות)', () => {
    for (const l of LENSES) {
      const txt = lensQuestions(l.id, entry, {}, 'איפה לפתוח סטודיו').map((x) => x.q).join('\n');
      expect(txt).toContain('ים');
      expect(txt).not.toContain('«אור»');
    }
    const hd = lensQuestions('hd', entry, {}, 'איפה לפתוח סטודיו').map((x) => x.q).join('\n');
    expect(hd).toContain('איפה לפתוח סטודיו');
  });
});

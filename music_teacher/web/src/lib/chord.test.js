import { describe, it, expect } from 'vitest';
import { validateChord, chordMarkers, pressX, fingersDownAt, pressOrder, handSpec, FINGER_COLORS } from './chord.js';
import { AM_CHORD } from './lessons.js';

const S = 40;
const fretX = (n) => S * (1 - Math.pow(2, -n / 12));
const geom = { fretX, zS: (i, x) => (i - 3.5) * (0.64 + 0.0045 * x), ys: (x) => 0.15 + 0.0085 * x };

describe('בדיקת תקינות אקורד', () => {
  it('Am תקין', () => {
    expect(validateChord(AM_CHORD)).toEqual([]);
  });
  it('אקורדים נוספים בפורמט הזה תקינים (E, C, G, Em, Dm, D)', () => {
    const E = { fingers: [{ finger: 1, string: 3, fret: 1 }, { finger: 2, string: 5, fret: 2 }, { finger: 3, string: 4, fret: 2 }], open: [6, 2, 1], muted: [] };
    const C = { fingers: [{ finger: 1, string: 2, fret: 1 }, { finger: 2, string: 4, fret: 2 }, { finger: 3, string: 5, fret: 3 }], open: [3, 1], muted: [6] };
    const G = { fingers: [{ finger: 2, string: 5, fret: 2 }, { finger: 1, string: 6, fret: 3 }, { finger: 3, string: 1, fret: 3 }], open: [4, 3, 2], muted: [] };
    const Em = { fingers: [{ finger: 2, string: 5, fret: 2 }, { finger: 3, string: 4, fret: 2 }], open: [6, 3, 2, 1], muted: [] };
    const Dm = { fingers: [{ finger: 1, string: 1, fret: 1 }, { finger: 2, string: 3, fret: 2 }, { finger: 3, string: 2, fret: 3 }], open: [4], muted: [6, 5] };
    const D = { fingers: [{ finger: 1, string: 3, fret: 2 }, { finger: 2, string: 1, fret: 2 }, { finger: 3, string: 2, fret: 3 }], open: [4], muted: [6, 5] };
    [E, C, G, Em, Dm, D].forEach((c) => expect(validateChord(c)).toEqual([]));
  });
  it('תופס שגיאות', () => {
    expect(validateChord(null).length).toBe(1);
    expect(validateChord({ fingers: [{ finger: 1, string: 2, fret: 1 }, { finger: 1, string: 3, fret: 2 }], open: [1, 4, 5, 6], muted: [] }).some((e) => e.includes('אצבע 1'))).toBe(true);
    expect(validateChord({ fingers: [{ finger: 1, string: 2, fret: 1 }], open: [2, 1, 3, 4, 5, 6], muted: [] }).some((e) => e.includes('מיתר 2'))).toBe(true);
    expect(validateChord({ fingers: [{ finger: 1, string: 2, fret: 1 }], open: [1, 3, 4, 5], muted: [] }).some((e) => e.includes('מיתר 6'))).toBe(true);
    expect(validateChord({ fingers: [{ finger: 1, string: 2, fret: 0 }], open: [1, 3, 4, 5, 6], muted: [] }).length).toBeGreaterThan(0);
    expect(validateChord({ fingers: [{ finger: 1, string: 7, fret: 1 }], open: [1, 2, 3, 4, 5], muted: [6] }).length).toBeGreaterThan(0);
    expect(validateChord({ fingers: [{ finger: 5, string: 2, fret: 1 }], open: [1, 3, 4, 5, 6], muted: [] }).length).toBeGreaterThan(0);
  });
});

describe('מיקום הסימונים', () => {
  const m = chordMarkers(AM_CHORD, geom);
  it('כל אצבע בדיוק על המיתר שלה, בין השריגים ומאחורי חוט השריג', () => {
    expect(m.fingers.map((f) => [f.finger, f.string, f.fret])).toEqual([[1, 2, 1], [2, 4, 2], [3, 3, 2]]);
    m.fingers.forEach((f) => {
      expect(f.z).toBeCloseTo(geom.zS(f.string, f.x), 6);
      expect(f.x).toBeLessThan(fretX(f.fret));
      expect(f.x).toBeGreaterThan(fretX(f.fret - 1));
      expect(f.x).toBeCloseTo(pressX(fretX, f.fret, f.finger), 9);
      expect(f.y).toBeGreaterThan(geom.ys(f.x));
      expect(f.color).toBe(FINGER_COLORS[f.finger]);
    });
  });
  it('מיתר 4 מעל מיתר 3 (z גדול יותר) באותו שריג', () => {
    const f2 = m.fingers.find((f) => f.finger === 2);
    const f3 = m.fingers.find((f) => f.finger === 3);
    // שתי האצבעות על אותו שריג: מרוחקות מעט לאורך הצוואר, כך שלא נוגעות
    expect(Math.abs(f2.x - f3.x)).toBeGreaterThan(0.3);
    expect(Math.abs(f2.x - f3.x)).toBeLessThan(1);
    expect(f2.z).toBeGreaterThan(f3.z);
  });
  it('O על המיתרים הפתוחים ו-X על מיתר 6, ליד האום', () => {
    expect(m.open.map((o) => o.string)).toEqual([5, 1]);
    expect(m.muted.map((o) => o.string)).toEqual([6]);
    [...m.open, ...m.muted].forEach((o) => {
      expect(o.x).toBe(0);
      expect(o.z).toBeCloseTo(geom.zS(o.string, 0), 6);
    });
  });
  it('אין חפיפה בין סימונים שכנים (מרווח המיתרים גדול מקוטר העיגול)', () => {
    const d = Math.hypot(m.fingers[1].z - m.fingers[2].z, m.fingers[1].x - m.fingers[2].x);
    expect(d).toBeGreaterThan(0.6);
  });
  it('מפרט ריק לא קורס', () => {
    expect(chordMarkers(null, geom)).toEqual({ fingers: [], open: [], muted: [] });
  });
});

describe('אנימציית ההנחה', () => {
  it('האצבעות יורדות לפי הסדר, אחת ל-0.6 שניות', () => {
    expect(pressOrder(AM_CHORD)).toEqual([1, 2, 3]);
    expect(fingersDownAt(AM_CHORD, 0)).toEqual([]);
    expect(fingersDownAt(AM_CHORD, 0.5)).toEqual([1]);
    expect(fingersDownAt(AM_CHORD, 1.0)).toEqual([1]);
    expect(fingersDownAt(AM_CHORD, 1.2)).toEqual([1, 2]);
    expect(fingersDownAt(AM_CHORD, 1.8)).toEqual([1, 2, 3]);
    expect(fingersDownAt(AM_CHORD, 99)).toEqual([1, 2, 3]);
  });
  it('מצב "הפחתת תנועה": הכול מיד', () => {
    expect(fingersDownAt(AM_CHORD, 0, { reduced: true })).toEqual([1, 2, 3]);
  });
  it('מפרט ליד: רק האצבעות שירדו, וה-layout מכיל את כולן', () => {
    const h = handSpec(AM_CHORD, [1]);
    expect(h.fingers.map((f) => f.finger)).toEqual([1]);
    expect(h.layout.length).toBe(3);
    expect(handSpec(AM_CHORD).fingers.length).toBe(3);
  });
});

import { describe, it, expect } from 'vitest';
import { layoutLabels } from './labels.js';

const overlap = (a, b) => Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2;

describe('פריסת תוויות', () => {
  it('שתי תוויות חופפות מתרחקות', () => {
    const items = [
      { cx: 200, cy: 100, w: 90, h: 26 },
      { cx: 210, cy: 104, w: 80, h: 26 },
    ];
    layoutLabels(items, 400, 300);
    expect(overlap(items[0], items[1])).toBe(false);
  });
  it('תווית בקצה הבמה נכנסת פנימה', () => {
    const items = [{ cx: -30, cy: 500, w: 100, h: 26 }];
    layoutLabels(items, 360, 300);
    expect(items[0].cx).toBeGreaterThanOrEqual(50);
    expect(items[0].cy).toBeLessThanOrEqual(300 - 13);
  });
  it('שלוש תוויות בתחתית (כמו "גוף" חשמלית בטלפון): בלי חפיפה ובתוך המסגרת', () => {
    const W = 387;
    const H = 217;
    const items = [
      { cx: 140, cy: 215, w: 100, h: 26 },
      { cx: 200, cy: 212, w: 110, h: 26 },
      { cx: 190, cy: 120, w: 80, h: 26 },
    ];
    layoutLabels(items, W, H);
    for (let i = 0; i < items.length; i++) {
      expect(items[i].cx - items[i].w / 2).toBeGreaterThanOrEqual(0);
      expect(items[i].cx + items[i].w / 2).toBeLessThanOrEqual(W);
      expect(items[i].cy - items[i].h / 2).toBeGreaterThanOrEqual(0);
      expect(items[i].cy + items[i].h / 2).toBeLessThanOrEqual(H);
      for (let j = i + 1; j < items.length; j++) expect(overlap(items[i], items[j])).toBe(false);
    }
  });
  it('בלי תוויות / תווית אחת לא קורס', () => {
    expect(layoutLabels([], 100, 100)).toEqual([]);
    const one = [{ cx: 50, cy: 50, w: 40, h: 20 }];
    layoutLabels(one, 100, 100);
    expect(one[0].cx).toBe(50);
  });
});

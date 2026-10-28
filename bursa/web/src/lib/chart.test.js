import { describe, expect, it } from 'vitest';
import { buildChart, nearestIndex } from './chart';

const candles = [
  { t: 1000, c: 10 },
  { t: 2000, c: 20 },
  { t: 3000, c: 15 },
];
const forecast = {
  horizons: [
    { id: 'w1', name: 'שבוע', expected: 16, low: 14, high: 18 },
    { id: 'm1', name: 'חודש', expected: 17, low: 12, high: 22 },
    { id: 'm3', name: '3 חודשים', expected: 18, low: 9, high: 27 },
    { id: 'y1', name: 'שנה', expected: 30, low: 1, high: 90 },
  ],
};

describe('chart', () => {
  it('בלי מספיק נקודות אין גרף', () => {
    expect(buildChart({ candles: [{ t: 1, c: 1 }], width: 300, height: 200 })).toBeNull();
    expect(buildChart({ candles, width: 0, height: 200 })).toBeNull();
  });

  it('הקו עולה משמאל לימין והמחיר הגבוה למעלה', () => {
    const c = buildChart({ candles, width: 300, height: 200 });
    expect(c.line.startsWith('M')).toBe(true);
    expect(c.points[0].x).toBeLessThan(c.points[2].x);
    expect(c.points[1].y).toBeLessThan(c.points[0].y);
    expect(c.cone).toBeNull();
    expect(c.area.endsWith('Z')).toBe(true);
    expect(c.points[2].x).toBeCloseTo(296, 0);
  });

  it('תחזית: חרוט מימין לנקודה האחרונה, בלי טווח שנה', () => {
    const c = buildChart({ candles, forecast, width: 400, height: 200 });
    expect(c.cone).toMatch(/^M.*Z$/);
    expect(c.fpoints.map((q) => q.id)).toEqual(['w1', 'm1', 'm3']);
    expect(c.fpoints.every((q) => q.x > c.last.x)).toBe(true);
    expect(c.fpoints[2].x).toBeLessThanOrEqual(396);
    expect(c.fpoints[2].yh).toBeLessThan(c.fpoints[2].yl);
    expect(c.min).toBeLessThan(9);
    expect(c.max).toBeGreaterThan(27);
  });

  it('הנקודה הקרובה ביותר', () => {
    const c = buildChart({ candles, width: 300, height: 200 });
    expect(nearestIndex(c.points, 0)).toBe(0);
    expect(nearestIndex(c.points, 1000)).toBe(2);
    expect(nearestIndex(c.points, c.points[1].x + 1)).toBe(1);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import { bisPoints, formatBis } from './bis';
import { pointsFromNutrition } from '../../../../points_tracker/web/src/lib/points.js';

describe('bis points', () => {
  it('matches the Bis app formula exactly', () => {
    for (const v of [{ protein: 20, carbs: 30, fat: 10, fiber: 4 }, { protein: 3, carbs: 60, fat: 1 }, { fat: 0, fiber: 30 }]) {
      expect(bisPoints(v)).toBeCloseTo(pointsFromNutrition(v), 10);
    }
  });
  it('handles missing values and rounds for display', () => {
    expect(bisPoints({})).toBe(0);
    expect(bisPoints({ protein: '20', carbs: null })).toBeCloseTo(20 / 10.9375, 10);
    expect(formatBis(2.25)).toBe('2.3');
    expect(formatBis(3)).toBe('3');
  });
});

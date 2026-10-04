import { describe, expect, it } from 'vitest';
import { baseServings, formatAmount, parseNumber, scaleIngredient } from './scale';
import { findDurations, formatClock } from './timers';

describe('scaling ingredients', () => {
  it('reads and writes amounts', () => {
    expect(parseNumber('1/2')).toBe(0.5);
    expect(parseNumber('1 1/2')).toBe(1.5);
    expect(parseNumber('2½')).toBe(2.5);
    expect(parseNumber('0,5')).toBe(0.5);
    expect(formatAmount(1.5)).toBe('1½');
    expect(formatAmount(0.75)).toBe('¾');
    expect(formatAmount(2 / 3)).toBe('⅔');
    expect(formatAmount(3)).toBe('3');
    expect(formatAmount(337.5)).toBe('338');
    expect(formatAmount(1.15)).toBe('1.2');
    expect(formatAmount(1.125)).toBe('1⅛');
    expect(scaleIngredient('3/4 כוס סוכר', 1.5)).toBe('1⅛ כוס סוכר');
  });

  it('doubles and halves the amounts, not percents, sizes or times', () => {
    expect(scaleIngredient('2 כוסות קמח', 2)).toBe('4 כוסות קמח');
    expect(scaleIngredient('3/4 כוס סוכר – 150 גרם', 2)).toBe('1½ כוס סוכר – 300 גרם');
    expect(scaleIngredient('2 מיכלי גבינת שמנת (מומלץ מעל 16%) -450 גרם', 0.5)).toBe('1 מיכלי גבינת שמנת (מומלץ מעל 16%) -225 גרם');
    expect(scaleIngredient('3 ביצים גודל L', 2)).toBe('6 ביצים גודל L');
    expect(scaleIngredient('2-3 שיני שום', 2)).toBe('4-6 שיני שום');
    expect(scaleIngredient('חצי כוס שמן', 2)).toBe('1 כוס שמן');
    expect(scaleIngredient('½ כפית מלח', 3)).toBe('1½ כפית מלח');
    expect(scaleIngredient('תבנית 24 ס"מ', 2)).toBe('תבנית 24 ס"מ');
    expect(scaleIngredient('מלח ופלפל', 2)).toBe('מלח ופלפל');
    expect(scaleIngredient('2 כוסות קמח', 1)).toBe('2 כוסות קמח');
  });

  it('finds the base number of servings', () => {
    expect(baseServings('6 מנות')).toBe(6);
    expect(baseServings('12-14 עוגיות')).toBe(12);
    expect(baseServings('תבנית 24 ס"מ')).toBe(null);
    expect(baseServings('')).toBe(null);
  });
});

describe('timers in steps', () => {
  it('finds durations in Hebrew and English', () => {
    expect(findDurations('אופים 30 דקות בתנור')).toEqual([{ seconds: 1800, label: '30 דקות' }]);
    expect(findDurations('מבשלים 45-50 דקות')).toEqual([{ seconds: 3000, label: '45-50 דקות' }]);
    expect(findDurations('מתפיחים שעה וחצי, ואז אופים 20 דקות')).toEqual([
      { seconds: 1200, label: '20 דקות' },
      { seconds: 5400, label: 'שעה וחצי' },
    ]);
    expect(findDurations('מבשלים 6 שעות על אש קטנה').map((d) => d.seconds)).toEqual([21600]);
    expect(findDurations('Bake for 25 minutes')[0].seconds).toBe(1500);
    expect(findDurations('מערבבים היטב')).toEqual([]);
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(90)).toBe('1:30');
  });
});

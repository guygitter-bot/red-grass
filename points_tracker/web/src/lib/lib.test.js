import { describe, expect, it } from 'vitest';
import { formatQty, pointsForGrams, pointsFromNutrition, qtyPrefix, round1 } from './points';
import { addDays, weekDates } from './dates';
import { extractUserFoods, mergeFoodDb, searchFoods, SHARED_FOODS, upsertUserFood } from './foodDb';
import { scoreComponents } from './ai';

describe('points', () => {
  // אותם מקרים בדיוק נבדקים ב-points_tracker/tests/test_points.py
  it('matches the classic formula', () => {
    expect(round1(pointsFromNutrition({ protein: 9, carbs: 55, fat: 1.2, fiber: 2 }))).toBe(6.9);
    expect(round1(pointsFromNutrition({ protein: 0, carbs: 0, fat: 0, fiber: 10 }))).toBe(0);
    expect(round1(pointsForGrams({ protein: 10, carbs: 50, fat: 30, fiber: 5 }, 50))).toBe(6.8);
  });

  it('formats portions', () => {
    expect(formatQty(0.5)).toBe('½');
    expect(formatQty(1.5)).toBe('1.5');
    expect(formatQty(1 / 3)).toBe('⅓');
    expect(formatQty(2)).toBe('2');
    expect(qtyPrefix(0.5)).toBe('חצי ');
    expect(qtyPrefix(1)).toBe('');
    expect(qtyPrefix(2)).toBe('2 × ');
  });
});

describe('dates', () => {
  it('adds days across months without timezone drift', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('week starts on Sunday', () => {
    const w = weekDates('2026-10-02'); // יום שישי
    expect(w[0]).toBe('2026-09-27');
    expect(w).toHaveLength(7);
  });
});

describe('food db', () => {
  it('finds plural and partial Hebrew queries', () => {
    expect(searchFoods(SHARED_FOODS, 'פיתה').map((f) => f.name)).toContain('פיתה רגילה');
    expect(searchFoods(SHARED_FOODS, 'קוטג')[0].name).toMatch(/קוטג/);
  });

  it('keeps only user-added foods when migrating the old saved db', () => {
    const saved = [...SHARED_FOODS, { name: 'מאכל שלי', points: 3 }];
    expect(extractUserFoods(saved, SHARED_FOODS)).toEqual([{ name: 'מאכל שלי', points: 3 }]);
  });

  it('manual and agent additions are independent', () => {
    const manual = { name: 'במבה', points: 4, source: 'user' };
    let foods = upsertUserFood([], manual);
    // the agent never overwrites a manual food
    expect(upsertUserFood(foods, { name: 'במבה', points: 3.6, source: 'agent' })).toBe(foods);
    // but it adds its own foods next to it
    foods = upsertUserFood(foods, { name: 'במבה נוגט', points: 8, source: 'agent' });
    expect(foods.map((f) => f.name)).toEqual(['במבה', 'במבה נוגט']);
    // a manual edit overrides an agent food, and a rename replaces the old entry
    foods = upsertUserFood(foods, { name: 'במבה נוגט (שקית)', points: 7.5, source: 'user' }, 'במבה נוגט');
    expect(foods).toEqual([manual, { name: 'במבה נוגט (שקית)', points: 7.5, source: 'user' }]);
  });

  it('user foods override shared ones', () => {
    const db = mergeFoodDb([{ name: 'א', points: 1 }], [{ name: 'א', points: 2 }]);
    expect(db).toEqual([{ name: 'א', points: 2, source: 'user' }]);
  });
});

describe('scoreComponents', () => {
  const db = [{ name: 'פיתה רגילה', points: 6 }];
  it('uses the db item for matched components and the formula otherwise', () => {
    const per100 = { kcal: 540, protein: 6, carbs: 58, fat: 31, fiber: 3 };
    const [pita, spread] = scoreComponents(
      [
        { name: 'פיתה', amount: 'חצי פיתה', grams: 45, db_name: 'פיתה רגילה', db_quantity: 0.5, per100 },
        { name: 'ממרח שוקולד', amount: 'כף', grams: 20, db_name: null, db_quantity: null, per100 },
      ],
      db,
    );
    expect(pita.points).toBe(3);
    expect(spread.points).toBe(round1(pointsForGrams(per100, 20)));
  });
});

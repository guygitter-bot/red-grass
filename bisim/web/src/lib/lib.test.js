import { describe, expect, it } from 'vitest';
import { formatQty, bitesForGrams, bitesFromNutrition, qtyPrefix, round1 } from './bites';
import { addDays, greeting, weekDates } from './dates';
import { extractUserFoods, mergeFoodDb, searchFoods, SHARED_FOODS, upsertUserFood } from './foodDb';
import { researchToFood, scoreComponents } from './ai';
import { parseInviteToken } from './proxy';
import { steps } from '../components/BitesExplainer';
import { GENERIC_UNITS, baseName, plateItem, portionLabel, portionBites, saveChoices, unitsFor } from './measures';

describe('bites', () => {
  // נוסחת הביסים (lib/bites.js)
  it('computes bites', () => {
    expect(round1(bitesFromNutrition({ protein: 9, carbs: 55, fat: 1.2, fiber: 2 }))).toBe(6.6);
    expect(round1(bitesFromNutrition({ protein: 0, carbs: 0, fat: 0, fiber: 10 }))).toBe(0);
    expect(round1(bitesForGrams({ protein: 10, carbs: 50, fat: 30, fiber: 5 }, 50))).toBe(6.6);
    // עם קלוריות מהתווית: חזה עוף
    expect(round1(bitesFromNutrition({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }))).toBe(2.1);
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
  it('greets by the hour', () => {
    const at = (h) => greeting(new Date(2026, 9, 4, h));
    expect(at(5)).toBe('בוקר טוב');
    expect(at(11)).toBe('בוקר טוב');
    expect(at(12)).toBe('צהריים טובים');
    expect(at(16)).toBe('צהריים טובים');
    expect(at(17)).toBe('ערב טוב');
    expect(at(2)).toBe('ערב טוב');
  });
  it('adds the user name to the greeting when set', () => {
    const d = new Date(2026, 9, 4, 8);
    expect(greeting(d, 'דנה')).toBe('בוקר טוב, דנה');
    expect(greeting(d, '  ')).toBe('בוקר טוב');
    expect(greeting(d, 'אורח')).toBe('בוקר טוב');
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

  it('recomputes foods that have nutrition values, unless the number was fixed by hand', () => {
    const per100 = { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 };
    const db = mergeFoodDb(
      [{ name: 'עוף', points: 3, grams: 100, per100 }],
      [{ name: 'עוף 2', points: 9, grams: 100, per100, manualPoints: true }, { name: 'ידני', points: 4 }],
    );
    expect(db.map((f) => f.points)).toEqual([2.1, 9, 4]);
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
    expect(spread.points).toBe(round1(bitesForGrams(per100, 20)));
  });
});

describe('researchToFood', () => {
  it('builds a clean name and computes bites from per100', () => {
    const food = researchToFood({
      found: true, name: 'במבה נוגט (אסם)', serving_desc: "שקית 60 ג'", serving_grams: 60, points: 8.5,
      per100: { kcal: 523, protein: 10.4, carbs: 58.6, fat: 27.4, fiber: 3.4 }, aliases: [], sources: [],
    });
    expect(food.name).toBe("במבה נוגט אסם (שקית 60 ג')");
    expect(researchToFood({ found: false })).toBeNull();
  });
});

describe('parseInviteToken', () => {
  it('reads a full link, a bare token, and rejects other text', () => {
    const token = 'yKx3NsCL8Xq_abc-DEF123456';
    expect(parseInviteToken(`https://bis-app.pages.dev/#invite=${token}`)).toBe(token);
    expect(parseInviteToken(`הזמנה לביס:\nhttps://bis-app.pages.dev/#invite=${token} `)).toBe(token);
    expect(parseInviteToken(`  ${token}  `)).toBe(token);
    expect(parseInviteToken('https://bis-app.pages.dev/#code=Points2703')).toBeNull();
    expect(parseInviteToken('שלום')).toBeNull();
  });
});

describe('measures', () => {
  // פתיתי פרמזן תנובה מהתווית: חלבון 32, פחמימות 0, שומן 23 ל-100 ג' = 6.8 ביסים
  const parmesan = { protein: 32, carbs: 0, fat: 23, fiber: 0 };

  it('computes a spoon of parmesan', () => {
    expect(portionBites(parmesan, 100)).toBe(6.8);
    expect(portionBites(parmesan, 5)).toBe(0.3); // כף פתיתים ~5 ג'
    expect(portionBites(parmesan, 2)).toBe(0.1); // כפית ~2 ג'
  });

  it('lists grams first, then the food units, the serving, or generic units', () => {
    const own = unitsFor({ units: [{ name: 'כף', grams: 5 }, { name: 'כפית', grams: 2 }], grams: 100 });
    expect(own.map((u) => u.name)).toEqual(['גרם', 'כף', 'כפית']);
    expect(unitsFor({ grams: 30 }).map((u) => u.name)).toEqual(['גרם', 'מנה']);
    expect(unitsFor({}).slice(1)).toEqual(GENERIC_UNITS);
  });

  it('labels portions and strips the per-100g suffix', () => {
    expect(portionLabel({ name: 'כף' }, 1, 5)).toBe("כף (5 ג')");
    expect(portionLabel({ name: 'כף' }, 2, 10)).toBe("2 כף (10 ג')");
    expect(portionLabel({ name: 'גרם' }, 1, 150)).toBe("150 ג'");
    expect(baseName("פתיתי פרמזן תנובה (100 ג')")).toBe('פתיתי פרמזן תנובה');
  });

  it('turns a chosen portion into a plate item', () => {
    // 2 כפיות בלבד -> "פרמזן (כפית)" × 2
    expect(plateItem('פרמזן', { points: 0.4, label: "2 כפית (4 ג')", parts: [{ unitName: 'כפית', count: 2 }] })).toEqual({
      name: 'פרמזן (כפית)',
      points: 0.2,
      qty: 2,
    });
    // כף + 2 כפיות -> פריט אחד עם התיאור המלא
    const combo = { points: 0.8, label: "כף + 2 כפית (9 ג')", parts: [{ unitName: 'כף', count: 1 }, { unitName: 'כפית', count: 2 }] };
    expect(plateItem('פרמזן', combo)).toEqual({ name: "פרמזן · כף + 2 כפית (9 ג')", points: 0.8, qty: 1 });
  });

  it('offers to save only the chosen part or the whole thing', () => {
    // שקית שלמה (מנה אחת) ואכלתי את כולה -> אפשרות אחת בשם המקורי
    expect(saveChoices('כל החיוכים', 20, 1, 1)).toEqual([{ key: 'all', label: 'הכול', name: 'כל החיוכים', points: 20 }]);
    // שקית שלמה, בחרתי ¼ -> רק הרבע או כל השקית
    const bag = saveChoices('כל החיוכים', 20, 1, 0.25);
    expect(bag.map((c) => [c.name, c.points])).toEqual([['כל החיוכים (¼ מהכול)', 5], ['כל החיוכים (הכול)', 20]]);
    // 10 עוגיות, בחרתי אחת -> עוגייה אחת או כל השקית
    const cookies = saveChoices('עוגיות', 20, 10, 1);
    expect(cookies.map((c) => [c.name, c.points])).toEqual([['עוגיות (מנה)', 2], ['עוגיות (הכול)', 20]]);
  });
});


describe('bites explainer', () => {
  it('shows the same total as the app formula', () => {
    const s = steps({ grams: 100, per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } });
    expect(s.net).toBe(72);
    expect(Math.round(s.total * 10) / 10).toBe(2.1);
  });
});

import { describe, expect, it } from 'vitest';
import { addMeal, dateKey, plannedRecipes, prunePlan, removeMeal, shiftWeek, weekDays, weekStart } from './plan';
import { lineHas, matchRecipes, stem } from './fridge';

describe('weekly plan', () => {
  it('weeks start on Sunday', () => {
    const start = weekStart(new Date(2026, 9, 3)); // שבת 3.10.2026
    expect(dateKey(start)).toBe('2026-09-27');
    const days = weekDays(start);
    expect(days.map((d) => d.key)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(days[6].name).toBe('שבת');
    expect(dateKey(shiftWeek(start, 1))).toBe('2026-10-04');
  });

  it('adds, removes, prunes and lists recipes', () => {
    let plan = addMeal({}, '2026-10-04', { id: 'a', recipeId: 'r1', title: 'שקשוקה' });
    plan = addMeal(plan, '2026-10-04', { id: 'b', title: 'ארוחה בחוץ' });
    plan = addMeal(plan, '2026-10-05', { id: 'c', recipeId: 'r1', title: 'שקשוקה' });
    expect(plan['2026-10-04'].length).toBe(2);
    expect(removeMeal(plan, '2026-10-05', 'c')['2026-10-05']).toBeUndefined();
    const recipes = [{ id: 'r1', title: 'שקשוקה' }];
    expect(plannedRecipes(plan, weekDays(weekStart(new Date(2026, 9, 4))), recipes).length).toBe(2);
    expect(Object.keys(prunePlan({ '2026-01-01': [{ id: 'x' }], ...plan }, new Date(2026, 9, 3)))).toEqual(['2026-10-04', '2026-10-05']);
  });
});

describe('what is in my fridge', () => {
  it('matches Hebrew ingredients with plurals and prefixes', () => {
    expect(stem('ביצים')).toBe(stem('ביצה'));
    expect(lineHas('3 ביצים גודל L', 'ביצה')).toBe(true);
    expect(lineHas('2 עגבניות מרוסקות', 'עגבנייה')).toBe(true);
    expect(lineHas('500 גרם גבינת שמנת', 'גבינת שמנת')).toBe(true);
    expect(lineHas('500 גרם גבינה לבנה', 'גבינת שמנת')).toBe(false);
    expect(lineHas('כוס חלב', 'חלב')).toBe(true);
    expect(lineHas('2 כפות שמן', 'שמנת')).toBe(false);
  });

  it('ranks recipes by how much of them I can make', () => {
    const recipes = [
      { id: 'shak', title: 'שקשוקה', ingredients: [{ title: '', items: ['4 ביצים', '5 עגבניות', '1 בצל', 'מלח', '2 כפות שמן זית'] }] },
      { id: 'cake', title: 'עוגה', ingredients: [{ title: '', items: ['3 ביצים', '1 כוס סוכר', '2 כוסות קמח', '200 גרם שוקולד מריר'] }] },
      { id: 'salad', title: 'סלט', ingredients: [{ title: '', items: ['מלפפון', 'גזר'] }] },
    ];
    const res = matchRecipes(recipes, ['ביצה', 'עגבניות']);
    expect(res.map((r) => r.recipe.id)).toEqual(['shak', 'cake']);
    expect(res[0].missing).toEqual([]);
    expect(res[1].missing).toEqual(['200 גרם שוקולד מריר']);
    expect(matchRecipes(recipes, ['ביצה'], { ignoreStaples: false })[0].missing.length).toBeGreaterThan(0);
    expect(matchRecipes(recipes, [])).toEqual([]);
  });
});

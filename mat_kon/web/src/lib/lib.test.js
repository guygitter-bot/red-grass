import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import { CATEGORIES as API_CATEGORIES } from '../../../api/categories.js';
import { countByCategory, filterRecipes, linkFromShare, linkFromText, sectionsToText, textToSections } from './recipes';

describe('categories', () => {
  it('match the server list', () => {
    expect(CATEGORIES).toEqual(API_CATEGORIES);
  });
});

describe('links', () => {
  it('takes the link from a share', () => {
    expect(linkFromShare('?url=https%3A%2F%2Fyoutu.be%2Fabc')).toBe('https://youtu.be/abc');
    expect(linkFromShare('?text=' + encodeURIComponent('תראו את זה https://www.tiktok.com/@a/video/1 מעולה'))).toBe('https://www.tiktok.com/@a/video/1');
    expect(linkFromShare('?title=hi')).toBe(null);
    expect(linkFromShare('')).toBe(null);
  });

  it('accepts a pasted link with or without https', () => {
    expect(linkFromText('  https://foodis.co.il/r/1 ')).toBe('https://foodis.co.il/r/1');
    expect(linkFromText('foodis.co.il/r/1')).toBe('foodis.co.il/r/1');
    expect(linkFromText('עוגת גבינה')).toBe(null);
  });
});

const recipes = [
  { id: 1, title: 'עוגת שוקולד', category: 'עוגות', tags: ['פרווה'], ingredients: [{ title: '', items: ['2 ביצים', 'קקאו'] }] },
  { id: 2, title: 'שקשוקה', category: 'ארוחת בוקר', favorite: true, tags: [], ingredients: [{ title: '', items: ['4 ביצים', 'עגבניות'] }], source: { author: 'השף הלבן' } },
];

describe('search', () => {
  it('finds by name, ingredient, tag and author; all words must match', () => {
    expect(filterRecipes(recipes, { query: 'ביצים' }).map((r) => r.id)).toEqual([1, 2]);
    expect(filterRecipes(recipes, { query: 'ביצים עגבניות' }).map((r) => r.id)).toEqual([2]);
    expect(filterRecipes(recipes, { query: 'פרווה' }).map((r) => r.id)).toEqual([1]);
    expect(filterRecipes(recipes, { query: 'הלבן' }).map((r) => r.id)).toEqual([2]);
    expect(filterRecipes(recipes, { category: 'עוגות' }).map((r) => r.id)).toEqual([1]);
    expect(filterRecipes(recipes, { favorites: true }).map((r) => r.id)).toEqual([2]);
    expect(countByCategory(recipes)).toEqual({ 'עוגות': 1, 'ארוחת בוקר': 1 });
  });

  it('a recipe in several categories is found and counted in each of them', () => {
    const chicken = { id: 3, title: 'עוף בסויה', category: 'עוף', categories: ['עוף', 'מנה עיקרית'], tags: [], ingredients: [] };
    const all = [...recipes, chicken];
    expect(filterRecipes(all, { category: 'עוף' }).map((r) => r.id)).toEqual([3]);
    expect(filterRecipes(all, { category: 'מנה עיקרית' }).map((r) => r.id)).toEqual([3]);
    expect(countByCategory(all)).toEqual({ 'עוגות': 1, 'ארוחת בוקר': 1, 'עוף': 1, 'מנה עיקרית': 1 });
  });
});

describe('editing as text', () => {
  it('round-trips sections', () => {
    const sections = [{ title: '', items: ['קמח', 'סוכר'] }, { title: 'לציפוי', items: ['שוקולד'] }];
    expect(textToSections(sectionsToText(sections))).toEqual(sections);
    expect(textToSections('1. מערבבים\n- אופים\n\n')).toEqual([{ title: '', items: ['מערבבים', 'אופים'] }]);
  });
});

import { freeLeft, parseAuthHash } from './recipes';

describe('invites', () => {
  it('reads invite and login links', () => {
    expect(parseAuthHash('#invite=abcDEF123_-x')).toEqual({ mode: 'register', token: 'abcDEF123_-x' });
    expect(parseAuthHash('#login')).toEqual({ mode: 'login' });
    expect(parseAuthHash('#/r/123')).toBe(null);
    expect(parseAuthHash('')).toBe(null);
  });

  it('counts the free recipes left', () => {
    expect(freeLeft(null)).toBe(null);
    expect(freeLeft({ plan: 'paid', added: 50, freeLimit: 10 })).toBe(null);
    expect(freeLeft({ plan: 'free', added: 3, freeLimit: 10 })).toBe(7);
    expect(freeLeft({ plan: 'free', added: 12, freeLimit: 10 })).toBe(0);
  });
});

import { recipeAsText, shortUrl } from './recipes';

describe('sharing', () => {
  it('writes a recipe as WhatsApp text', () => {
    const text = recipeAsText({
      title: 'עוגה', servings: '8 מנות', tips: [],
      ingredients: [{ title: '', items: ['קמח'] }, { title: 'לציפוי', items: ['שוקולד'] }],
      steps: [{ title: '', items: ['מערבבים', 'אופים'] }],
    });
    expect(text).toBe('*עוגה*\n8 מנות\n\n*מצרכים*\n• קמח\n\n*לציפוי*\n• שוקולד\n\n*אופן ההכנה*\n1. מערבבים\n2. אופים');
    expect(shortUrl('https://www.foodis.co.il/r/1?x=1')).toBe('foodis.co.il/r/1');
  });
});

import { sortRecipes, topTags, emojiOf } from './recipes';

describe('sorting, tags and backup', () => {
  const list = [
    { id: 1, title: 'בורקס', rating: 3, createdAt: '2026-01-02', tags: ['לשבת', 'אפייה'] },
    { id: 2, title: 'אורז', rating: 5, createdAt: '2026-01-01', tags: ['לשבת'] },
    { id: 3, title: 'גלידה', createdAt: '2026-01-03', tags: [] },
  ];
  it('sorts by newest, name and rating', () => {
    expect(sortRecipes(list, 'new').map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortRecipes(list, 'abc').map((r) => r.id)).toEqual([2, 1, 3]);
    expect(sortRecipes(list, 'rating').map((r) => r.id)).toEqual([2, 1, 3]);
  });
  it('counts tags and filters by tag', () => {
    expect(topTags(list)).toEqual([['לשבת', 2], ['אפייה', 1]]);
    expect(filterRecipes(list, { tag: 'אפייה' }).map((r) => r.id)).toEqual([1]);
    expect(emojiOf('מתכוני סבתא')).toBe('🏷️');
  });
});

describe('join links', () => {
  it('reads a family join link', () => {
    expect(parseAuthHash('#join=abcDEF123_-x')).toEqual({ mode: 'join', token: 'abcDEF123_-x' });
  });
});

describe('round 1 fixes', () => {
  it('editing keeps decimal amounts but strips list numbering', async () => {
    const { textToSections } = await import('./recipes');
    expect(textToSections('1.5 כוסות קמח\n0.5 כפית מלח\n1. מערבבים\n2) אופים\n- תבליט')[0].items)
      .toEqual(['1.5 כוסות קמח', '0.5 כפית מלח', 'מערבבים', 'אופים', 'תבליט']);
  });
  it('thousands separators scale as numbers', async () => {
    const { scaleIngredient } = await import('./scale');
    expect(scaleIngredient('1,000 גרם קמח', 2)).toBe('2000 גרם קמח');
    expect(scaleIngredient('1,5 כוסות', 2)).toBe('3 כוסות');
  });
});

describe('list sync', () => {
  it('diffs and applies item changes', async () => {
    const { diffItems, applyOps, planToItems, itemsToPlan } = await import('./sync');
    const a = [{ id: '1', text: 'חלב' }, { id: '2', text: 'לחם' }];
    const b = [{ id: '1', text: 'חלב', checked: true }, { id: '3', text: 'ביצים' }];
    const ops = diffItems(a, b);
    expect(ops.map((o) => o.op).sort()).toEqual(['add', 'remove', 'update']);
    // מישהו אחר הוסיף בינתיים "גבינה" – נשמר
    expect(applyOps([...a, { id: '4', text: 'גבינה' }], ops).map((i) => i.text)).toEqual(['חלב', 'גבינה', 'ביצים']);
    const plan = { '2026-10-05': [{ id: 'm', title: 'פסטה' }] };
    expect(itemsToPlan(planToItems(plan))).toEqual(plan);
  });
});

describe('round 4 fixes', () => {
  it('timers find "שעה" after a word', async () => {
    const { findDurations } = await import('./timers');
    expect(findDurations('אופים שעה').map((d) => d.seconds)).toEqual([3600]);
    expect(findDurations('חצי שעה בתנור').map((d) => d.seconds)).toEqual([1800]);
  });
  it('חלב is not חלבה', async () => {
    const { lineHas } = await import('./fridge');
    expect(lineHas('כוס חלב', 'חלבה')).toBe(false);
    expect(lineHas('100 גרם חלבה', 'חלב')).toBe(false);
    expect(lineHas('100 גרם חלבה', 'חלבה')).toBe(true);
  });
});

import { orderCategories } from './recipes';
describe('orderCategories', () => {
  it('puts favorites first, then saved order, then the rest in default order', () => {
    const list = ['עוגות', 'סלטים', 'מרקים', 'אחר', 'שלי'];
    expect(orderCategories(list, {})).toEqual(list);
    expect(orderCategories(list, { order: ['מרקים', 'עוגות'], favorites: ['שלי'] })).toEqual(['שלי', 'מרקים', 'עוגות', 'סלטים', 'אחר']);
    expect(orderCategories(list, { order: ['גון'], favorites: ['לא קיים'] })).toEqual(list);
  });
});

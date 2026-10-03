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

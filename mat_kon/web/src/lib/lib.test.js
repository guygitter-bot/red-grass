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

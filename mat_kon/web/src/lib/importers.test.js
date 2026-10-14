import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { fromRecetteTek, mapCategory, needsSource, readRecetteTek } from './importers';

const recipe = {
  title: '‏ עוף ברוטב בצלים ',
  ingredients: 'מגש שוקיים\n5 בצלים\n\n1.5 כוסות מים',
  instructions: '1. מטגנים בצל\n2. מוסיפים עוף',
  quantity: '4 מנות',
  url: 'https://www.10dakot.co.il/recipe/1',
  pictures: ['/data/user/0/fr.recettetek/files/Pictures/abc.png'],
  categories: [{ title: 'קינוח' }],
  rating: 4.0,
  favorite: true,
  notes: 'פחות סוכר',
  lastModifiedDate: '2025-11-28 15:58:20',
  uuid: 'u1',
};

describe('RecetteTek import', () => {
  it('maps a recipe', () => {
    const r = fromRecetteTek(recipe);
    expect(r.title).toBe('עוף ברוטב בצלים');
    expect(r.ingredients[0].items).toEqual(['מגש שוקיים', '5 בצלים', '1.5 כוסות מים']);
    expect(r.steps[0].items).toEqual(['מטגנים בצל', 'מוסיפים עוף']);
    expect(r).toMatchObject({ category: 'קינוחים', servings: '4 מנות', rating: 4, favorite: true, myNotes: 'פחות סוכר', picture: 'abc.png', id: 'u1' });
    expect(r.source.url).toBe('https://www.10dakot.co.il/recipe/1');
    expect(needsSource(r)).toBe(false);
    expect(needsSource(fromRecetteTek({ ...recipe, ingredients: '' }))).toBe(true);
    expect(fromRecetteTek({ title: '  ' })).toBeNull();
  });

  it('keeps unknown categories as the user own', () => {
    expect(mapCategory('יונתן')).toBe('יונתן');
    expect(mapCategory('עוף')).toBe('עוף');
  });

  it('reads the zip with images and categories', () => {
    const zip = zipSync({
      'recipes_0.json': strToU8(JSON.stringify([recipe, { ...recipe, uuid: 'u2', categories: [{ title: 'יונתן' }], pictures: [] }])),
      'categories.json': strToU8(JSON.stringify([{ title: 'קינוח' }, { title: 'יונתן' }, { title: 'מנה עיקרית' }])),
      'abc.png': new Uint8Array([1, 2, 3]),
    });
    const { recipes, categories, images } = readRecetteTek(zip);
    expect(recipes).toHaveLength(2);
    expect(categories).toEqual(['יונתן', 'מנה עיקרית']);
    expect(Object.keys(images)).toEqual(['abc.png']);
    expect(() => readRecetteTek(zipSync({ 'x.json': strToU8('[]') }))).toThrow();
  });
});

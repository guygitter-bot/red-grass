import { describe, expect, it } from 'vitest';
import { mergePantry, missingLines } from './fridge';

describe('home inventory', () => {
  it('merges new products without duplicates, per place', () => {
    let list = mergePantry([], [{ name: 'חלב', place: 'fridge' }, { name: 'אורז', place: 'pantry' }]);
    list = mergePantry(list, [{ name: ' חלב ', place: 'fridge', qty: '2 ליטר' }, { name: 'חלב', place: 'pantry' }]);
    expect(list.map((i) => [i.name, i.place, i.qty])).toEqual([
      ['חלב', 'fridge', '2 ליטר'], ['אורז', 'pantry', undefined], ['חלב', 'pantry', undefined],
    ]);
  });

  it('finds what is missing at home for a recipe', () => {
    const lines = ['3 ביצים', '200 גרם שמנת מתוקה', 'מלח ופלפל', '2 עגבניות'];
    expect(missingLines(lines, ['ביצה', 'עגבנייה'])).toEqual(['200 גרם שמנת מתוקה']);
    expect(missingLines(lines, [])).toEqual(['3 ביצים', '200 גרם שמנת מתוקה', '2 עגבניות']);
  });
});

describe('staples', () => {
  it('black pepper is a staple, a red bell pepper is not', () => {
    expect(missingLines(['מלח ופלפל', '1 פלפל אדום', 'פלפל שחור גרוס'], [])).toEqual(['1 פלפל אדום']);
  });
});

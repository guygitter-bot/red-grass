import { describe, expect, it } from 'vitest';
import { shoppingName } from './shopping';

describe('shoppingName', () => {
  it('keeps only the product, without amount, unit, size or notes', () => {
    expect(shoppingName('4 ביצים')).toBe('ביצים');
    expect(shoppingName('4 ביצים L')).toBe('ביצים');
    expect(shoppingName('2 כוסות קמח, מנופה')).toBe('קמח');
    expect(shoppingName('1/2 כפית מלח')).toBe('מלח');
    expect(shoppingName('½ כוס שמן')).toBe('שמן');
    expect(shoppingName('200 גרם שוקולד מריר (70%)')).toBe('שוקולד מריר');
    expect(shoppingName('3 שיני שום כתושות')).toBe('שום');
    expect(shoppingName('1 בצל קצוץ')).toBe('בצל');
    expect(shoppingName('1 פלפל אדום חתוך לרצועות')).toBe('פלפל אדום');
    expect(shoppingName('6 עגבניות בשלות מרוסקות')).toBe('עגבניות');
    expect(shoppingName('50 גרם חמאה רכה')).toBe('חמאה');
    expect(shoppingName('500 גרם בשר טחון')).toBe('בשר טחון');
    expect(shoppingName('פטרוזיליה טרייה קצוצה')).toBe('פטרוזיליה');
    expect(shoppingName('חצי כוס סוכר')).toBe('סוכר');
    expect(shoppingName('1 בצל גדול')).toBe('בצל');
    expect(shoppingName('2-3 עגבניות')).toBe('עגבניות');
    expect(shoppingName('חבילת שמנת מתוקה')).toBe('שמנת מתוקה');
    expect(shoppingName('כוס של חלב')).toBe('חלב');
    expect(shoppingName('מלח ופלפל לפי הטעם')).toBe('מלח ופלפל');
    expect(shoppingName('שמן זית')).toBe('שמן זית');
  });
  it('falls back to the line when nothing is left', () => {
    expect(shoppingName('2 כוסות')).toBe('2 כוסות');
  });
});

import { describe, it, expect } from 'vitest';
import { priceText, safeShop, searchLinks, shopText, totals } from './shop';

const shop = {
  summary: 'חיפוי וספה', tips: '',
  items: [
    { name: 'פסי עץ', details: '', quantity: 'כ-8 מ״ר', min: 1600, max: 2400, stores: ['הום סנטר'], search: 'חיפוי עץ לקיר' },
    { name: 'ספה', details: '', quantity: '', min: 3000, max: 3000, stores: [], search: 'ספה אפורה' },
  ],
  labor: { description: 'נגר', min: 800, max: 1500 },
};

describe('רשימת קניות', () => {
  it('סכומים עם ובלי עבודה', () => {
    expect(totals(shop)).toEqual({ items: { min: 4600, max: 5400 }, labor: { min: 800, max: 1500 }, all: { min: 5400, max: 6900 } });
    expect(totals({ items: shop.items, labor: null }).all).toEqual({ min: 4600, max: 5400 });
    expect(totals(null).all).toEqual({ min: 0, max: 0 });
  });
  it('תצוגת מחיר', () => {
    expect(priceText(1600, 2400)).toBe('1,600 עד 2,400 ₪');
    expect(priceText(3000, 3000)).toBe('כ-3,000 ₪');
    expect(priceText(0, 300)).toBe('כ-300 ₪');
    expect(priceText(0, 0)).toBe('מחיר לא ידוע');
  });
  it('קישורי חיפוש מקודדים', () => {
    const [zap, google] = searchLinks('ספה אפורה');
    expect(zap.url).toBe('https://www.zap.co.il/search.aspx?keyword=%D7%A1%D7%A4%D7%94%20%D7%90%D7%A4%D7%95%D7%A8%D7%94');
    expect(google.url).toContain('tbm=shop');
  });
  it('טקסט לשיתוף ורשימה ישנה', () => {
    const text = shopText(shop, 'סלון');
    expect(text).toContain('• פסי עץ (כ-8 מ״ר) – 1,600 עד 2,400 ₪');
    expect(text).toContain('סך הכול בערך: 5,400 עד 6,900 ₪');
    expect(safeShop(undefined)).toBe(null);
    expect(safeShop({ items: [] }).labor).toBe(null);
  });
});

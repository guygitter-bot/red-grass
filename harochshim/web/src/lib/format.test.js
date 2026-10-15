import { describe, expect, test } from 'vitest';
import { isStale, leadsCsv, money, savePercent } from './format';

describe('format', () => {
  test('prices and savings', () => {
    expect(money(2150)).toBe('₪2,150');
    expect(money(0)).toBe('');
    expect(savePercent({ price: 2150, regularPrice: 2900 })).toBe(26);
    expect(savePercent({ price: 100 })).toBe(0);
  });

  test('stale leads: new and older than 48 hours', () => {
    const now = Date.now();
    expect(isStale({ status: 'new', createdAt: now - 49 * 3600e3 }, now)).toBe(true);
    expect(isStale({ status: 'contacted', createdAt: now - 49 * 3600e3 }, now)).toBe(false);
    expect(isStale({ status: 'new', createdAt: now - 3600e3 }, now)).toBe(false);
  });

  test('csv: hebrew, quotes, and no formulas', () => {
    const csv = leadsCsv(
      [{ createdAt: 0, supplierId: 's', offerId: 'o', categoryId: 'c', name: '=HYPERLINK("x")', phone: '050-1234567', city: 'רמת גן', status: 'won', amount: 5100, summary: 'שורה\nשנייה' }],
      { suppliers: [{ id: 's', name: 'אקווה' }], offers: [{ id: 'o', title: 'מקלחון, פינתי' }], categories: [{ id: 'c', name: 'מקלחונים' }] },
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"מקלחון, פינתי"');
    expect(csv).toContain('050-1234567');
    expect(csv).toContain('נסגרה עסקה');
    expect(csv).toContain('"שורה\nשנייה"');
  });
});

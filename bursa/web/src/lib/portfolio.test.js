import { describe, expect, it } from 'vitest';
import { neededSymbols, rateOf, valueDemo, valueHoldings } from './portfolio';

const quotes = {
  'ILS=X': { price: 4 },
  AAPL: { price: 110, change: 10, currency: 'USD' },
  'TEVA.TA': { price: 50, change: -2, currency: 'ILS' },
};

describe('portfolio', () => {
  it('שער מטבע', () => {
    expect(rateOf('ILS', quotes)).toBe(1);
    expect(rateOf('USD', quotes)).toBe(4);
    expect(rateOf('USD', {})).toBeNull();
  });

  it('סמלים לבקשה כוללים את הדולר', () => {
    expect(neededSymbols([[{ symbol: 'AAPL', currency: 'USD' }]]).sort()).toEqual(['AAPL', 'ILS=X']);
  });

  it('שווי תיק בשקלים', () => {
    const r = valueHoldings([
      { symbol: 'AAPL', qty: 10, price: 100, currency: 'USD' },
      { symbol: 'TEVA.TA', qty: 10, price: 40, currency: 'ILS' },
      { symbol: 'XXX', qty: 1, price: 5, currency: 'USD' },
    ], quotes);
    expect(r.rows[0].valueILS).toBe(4400);
    expect(r.rows[0].gainPct).toBeCloseTo(10);
    expect(r.rows[2].value).toBeNull();
    expect(r.value).toBe(4400 + 500);
    expect(r.cost).toBe(4000 + 400);
    expect(r.gain).toBe(500);
    // מחר: AAPL עלתה 10% => אתמול 100, היום 110 => +10*10*4
    expect(r.day).toBeCloseTo(400 + (500 - 500 / 0.98));
  });

  it('תיק דמה מול 100,000', () => {
    const d = valueDemo({ cash: 99000, holdings: [{ symbol: 'TEVA.TA', qty: 20, price: 50, currency: 'ILS' }] }, quotes);
    expect(d.total).toBe(100000);
    expect(d.gain).toBe(0);
    expect(valueDemo(null, {}).total).toBe(100000);
  });
});

import { describe, expect, it } from 'vitest';
import { chatLink, parseHash, stockLink, termLink } from './route';

describe('route', () => {
  it('מסכים רגילים', () => {
    expect(parseHash('').name).toBe('home');
    expect(parseHash('#/').name).toBe('home');
    expect(parseHash('#/portfolio').name).toBe('portfolio');
    expect(parseHash('#/nope').name).toBe('home');
  });

  it('מניה עם תווים מיוחדים', () => {
    expect(parseHash(stockLink('^GSPC'))).toMatchObject({ name: 'stock', symbol: '^GSPC' });
    expect(parseHash(stockLink('teva.ta')).symbol).toBe('TEVA.TA');
    expect(parseHash('#/s/ILS%3DX').symbol).toBe('ILS=X');
  });

  it('פרמטרים', () => {
    expect(parseHash(chatLink('מה דעתך על AAPL?')).params.get('q')).toBe('מה דעתך על AAPL?');
    expect(parseHash(termLink('RSI')).params.get('term')).toBe('RSI');
  });
});

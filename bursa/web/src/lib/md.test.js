import { describe, expect, it } from 'vitest';
import { parseInline, parseMd } from './md';

describe('md', () => {
  it('מודגש, קוד וקישורים', () => {
    expect(parseInline('היי **עולם** ו-`RSI`')).toEqual([
      { t: 'text', text: 'היי ' },
      { t: 'b', text: 'עולם' },
      { t: 'text', text: ' ו-' },
      { t: 'code', text: 'RSI' },
    ]);
    const a = parseInline('ראו [כאן](https://example.com/x) או https://a.com/b.');
    expect(a[1]).toEqual({ t: 'a', text: 'כאן', href: 'https://example.com/x' });
    expect(a[3]).toEqual({ t: 'a', text: 'https://a.com/b', href: 'https://a.com/b' });
  });

  it('לא הופך javascript: לקישור', () => {
    expect(parseInline('[x](javascript:alert(1))').every((p) => p.t === 'text')).toBe(true);
  });

  it('תבליטים, כותרות ושורות ריקות', () => {
    const b = parseMd('# כותרת\n- אחד\n* שניים\n1. שלוש\n\n\nסוף');
    expect(b.map((x) => x.type)).toEqual(['h', 'li', 'li', 'li', 'gap', 'p']);
  });

  it('HTML נשאר טקסט', () => {
    const b = parseMd('<img src=x onerror=alert(1)>');
    expect(b[0].inline[0]).toEqual({ t: 'text', text: '<img src=x onerror=alert(1)>' });
  });
});

import { describe, expect, it } from 'vitest';
import { parseMarkdown, parseInline } from './markdown';

describe('markdown', () => {
  it('מדגיש', () => {
    expect(parseInline('שלום **עולם** יפה')).toEqual([
      { t: 'text', text: 'שלום ' },
      { t: 'bold', text: 'עולם' },
      { t: 'text', text: ' יפה' },
    ]);
  });
  it('תבליטים ופסקאות', () => {
    const b = parseMarkdown('כותרת\n\n• אחד\n- שניים\n\nסוף');
    expect(b.map((x) => x.type)).toEqual(['p', 'ul', 'p']);
    expect(b[1].items).toHaveLength(2);
  });
  it('קישור בלי סימן פיסוק בסוף', () => {
    const n = parseInline('ראו https://a.co/x?y=1, תודה');
    expect(n[1]).toEqual({ t: 'link', text: 'https://a.co/x?y=1', href: 'https://a.co/x?y=1' });
    expect(n[2].text).toBe(', תודה');
  });
  it('לא יוצר HTML מטקסט', () => {
    const b = parseMarkdown('<img src=x onerror=alert(1)>');
    expect(b[0].lines[0][0]).toEqual({ t: 'text', text: '<img src=x onerror=alert(1)>' });
  });
  it('קלט ריק', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
  });
});

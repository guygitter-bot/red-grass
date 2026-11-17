import { describe, expect, it } from 'vitest';
import { chunks, cleanForSpeech, joinText } from './voice';

describe('voice', () => {
  it('cleans markdown, links and emojis before reading aloud', () => {
    const t = cleanForSpeech('## כותרת\n**חשוב**: ראו [האתר](https://x.com) 📈\n- סעיף\n```js\ncode\n```\nhttps://a.b/c');
    expect(t).toBe('כותרת\nחשוב: ראו האתר\nסעיף');
  });
  it('splits long text into short parts by sentence', () => {
    const long = `${'מילה '.repeat(80)}סוף.`;
    const parts = chunks(`שלום. מה שלומך? ${long}`, 100);
    expect(parts[0]).toBe('שלום.');
    expect(parts[1]).toBe('מה שלומך?');
    expect(parts.every((p) => p.length <= 100)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toContain('סוף.');
  });
  it('joins dictated pieces with one space', () => {
    expect(joinText('שלום ', ' עולם')).toBe('שלום עולם');
    expect(joinText('', 'היי')).toBe('היי');
  });
});

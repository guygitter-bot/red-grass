import { describe, expect, it } from 'vitest';
import { plainText } from './copy';

describe('copy', () => {
  it('turns a bot answer into clean text for pasting', () => {
    const md = '## כותרת\n**חשוב**: ראו [האתר](https://x.com)\n- סעיף א\n- סעיף *ב*\n\n\n\n`קוד`';
    expect(plainText(md)).toBe('כותרת\nחשוב: ראו האתר (https://x.com)\n• סעיף א\n• סעיף ב\n\nקוד');
  });
});

import { describe, expect, it } from 'vitest';
import { joinText } from './voice';

describe('voice', () => {
  it('joins dictated pieces with one space', () => {
    expect(joinText('שלום ', ' עולם')).toBe('שלום עולם');
    expect(joinText('', 'היי')).toBe('היי');
  });
});

import { describe, expect, it } from 'vitest';
import { joinSegments } from './voice';

describe('voice dictation', () => {
  it('joins finished segments and the one being spoken', () => {
    expect(joinSegments(['עוגת שוקולד', ' שתי כוסות קמח '], 'כוס סו')).toBe('עוגת שוקולד\nשתי כוסות קמח\nכוס סו');
    expect(joinSegments([], '')).toBe('');
  });
});

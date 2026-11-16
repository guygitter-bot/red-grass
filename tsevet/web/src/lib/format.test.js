import { describe, expect, it } from 'vitest';
import { relTime, ils, fileSize } from './format';

describe('format', () => {
  it('זמן יחסי', () => {
    const now = 1_000_000_000_000;
    expect(relTime(now - 5000, now)).toBe('עכשיו');
    expect(relTime(now - 5 * 60000, now)).toBe('לפני 5 דק׳');
    expect(relTime(now - 3 * 3600000, now)).toBe('לפני 3 שע׳');
    expect(relTime(now - 25 * 3600000, now)).toBe('אתמול');
  });
  it('שקלים', () => {
    expect(ils(1, 3.7)).toBe('₪3.70');
    expect(ils(100, 3.7)).toBe('₪370');
    expect(ils(undefined, 3.7)).toBe('₪0.00');
  });
  it('גודל קובץ', () => {
    expect(fileSize(500)).toBe('1 KB');
    expect(fileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

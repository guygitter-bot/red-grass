import { describe, expect, it } from 'vitest';
import { checkFile, fitSize, kindOf } from './media';

describe('media', () => {
  it('הקטנה לפי הצלע הארוכה', () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitSize(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });
  it('סוג קובץ', () => {
    expect(kindOf({ type: 'video/mp4' })).toBe('video');
    expect(kindOf({ type: 'application/pdf', name: 'a.pdf' })).toBe('doc');
    expect(kindOf({ type: 'application/zip', name: 'a.zip' })).toBe(null);
  });
  it('קובץ גדול מדי', () => {
    const msg = checkFile({ name: 'a.mp4', type: 'video/mp4', size: 100 * 1024 * 1024 });
    expect(msg).toContain('95MB');
    expect(checkFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 })).toBe(null);
  });
});

import { describe, it, expect } from 'vitest';
import { hamming, groupPhotos, parseHash } from './similar.js';

const H = 'f0f0f0f0a5a5a5a5';
const flip = (h, bits) => {
  let a = BigInt('0x' + h);
  for (const b of bits) a ^= 1n << BigInt(b);
  return a.toString(16).padStart(16, '0');
};

describe('similar', () => {
  it('measures distance', () => {
    expect(hamming(H, H)).toBe(0);
    expect(hamming(H, flip(H, [0, 33, 63]))).toBe(3);
    expect(hamming(H, 'bad')).toBe(64);
    expect(parseHash(null)).toBeNull();
  });

  it('groups duplicates across time and bursts only close in time', () => {
    const day = 86400000;
    const photos = [
      { id: 'a', date: 0, w: 100, h: 100, size: 10 },
      { id: 'b', date: 30 * day, w: 100, h: 100, size: 20 }, // אותה תמונה, חודש אחרי
      { id: 'c', date: 100 * day, w: 100, h: 100, size: 5 },
      { id: 'd', date: 100 * day + 5000, w: 100, h: 100, size: 5 }, // רצף
      { id: 'e', date: 200 * day, w: 100, h: 100, size: 5 }, // דומה ל-c אבל רחוק בזמן
      { id: 'f', date: 300 * day, w: 100, h: 100, size: 5 },
    ];
    const C = '123456789abcdef0';
    const feats = {
      a: { hash: H, sharp: 100 },
      b: { hash: flip(H, [5]), sharp: 300 },
      c: { hash: C, sharp: 50 },
      d: { hash: flip(C, [1, 2, 3, 4, 5, 6, 7]), sharp: 400 },
      e: { hash: flip(C, [10, 11, 12, 13, 14, 15, 16]), sharp: 10 },
      f: { hash: '0000000000000000' },
    };
    const groups = groupPhotos(photos, feats);
    expect(groups).toHaveLength(2);
    const dup = groups.find((g) => g.kind === 'dup');
    expect(dup.ids).toEqual(['b', 'a']); // החדה יותר ראשונה
    expect(dup.save).toBe(10);
    const sim = groups.find((g) => g.kind === 'similar');
    expect(sim.ids).toEqual(['d', 'c']);
  });

  it('prefers favorites as the one to keep', () => {
    const photos = [
      { id: 'x', date: 0, fav: true },
      { id: 'y', date: 1000 },
    ];
    const feats = { x: { hash: H, sharp: 1 }, y: { hash: H, sharp: 999 } };
    expect(groupPhotos(photos, feats)[0].ids[0]).toBe('x');
  });
});

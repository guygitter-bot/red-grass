import { describe, expect, it } from 'vitest';
import { parseYouTubeId } from '../lib/youtube';
import { KITS } from './kits';
import { KIT_SONGS, songsForKit } from './songs';

const famous = KITS.filter((k) => k.id !== 'standard');

describe('שירים לכל סט מפורסם', () => {
  it('לכל סט מפורסם בדיוק 5 שירים תקינים', () => {
    for (const k of famous) {
      const list = KIT_SONGS[k.id];
      expect(list, k.id).toHaveLength(5);
      for (const s of list) {
        expect(s.title).toBeTruthy();
        expect(s.artist).toBeTruthy();
        expect(s.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
        expect(parseYouTubeId('https://www.youtube.com/watch?v=' + s.youtubeId)).toBe(s.youtubeId);
      }
    }
  });
  it('אין מזהים כפולים ואין שירים לסט שלא קיים', () => {
    const ids = Object.values(KIT_SONGS).flat().map((s) => s.youtubeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const key of Object.keys(KIT_SONGS)) expect(famous.some((k) => k.id === key), key).toBe(true);
  });
  it('סט רגיל או לא מוכר – בלי שירים', () => {
    expect(songsForKit('standard')).toEqual([]);
    expect(songsForKit('my-1')).toEqual([]);
    expect(songsForKit(undefined)).toEqual([]);
  });
});

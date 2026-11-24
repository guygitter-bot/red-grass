import { describe, expect, it } from 'vitest';
import { isWatching, needsUpload, videoState, allCodes, categoryList, codesOf, CODES, filterFromHash, filterItems, hashFromFilter, matches, newestTitles, parsePasted, sharedText, sourceOf } from './videos';

describe('parsePasted', () => {
  it('finds links and keeps the rest as a note', () => {
    expect(parsePasted('קודים https://a.com/x, וגם https://b.com/y.')).toEqual({ links: ['https://a.com/x', 'https://b.com/y'], note: 'קודים וגם' });
  });
  it('does not add the same link twice', () => {
    expect(parsePasted('https://a.com https://a.com').links).toEqual(['https://a.com']);
  });
  it('reads a share', () => {
    expect(sharedText('?title=GTA&url=https%3A%2F%2Fa.com')).toBe('GTA\nhttps://a.com');
  });
});

describe('filters and codes', () => {
  const items = [
    { id: '1', title: 'קוד לנשק', category: 'קודים', codes: [{ code: 'R1 R2', effect: 'נשק', platform: 'PlayStation' }], status: 'ready' },
    { id: '2', title: 'כסף מהיר', category: 'כסף', summary: 'שוד בנק', status: 'ready' },
    { id: '3', title: 'facebook.com', status: 'pending' },
    { id: '4', title: 'רכב נדיר', category: 'קודים', codes: [{ code: '1-999', effect: 'רכב', platform: 'טלפון' }], status: 'failed' },
  ];
  it('old items without codes still work', () => {
    expect(codesOf(items[1])).toEqual([]);
    expect(codesOf(undefined)).toEqual([]);
  });
  it('lists categories by size', () => {
    expect(categoryList(items, { קודים: { emoji: '🔫' } })).toEqual([
      { name: 'קודים', count: 2, emoji: '🔫' },
      { name: 'כסף', count: 1, emoji: '🎮' },
    ]);
  });
  it('filters by category, waiting, codes and search', () => {
    expect(filterItems(items, 'קודים', '').map((i) => i.id)).toEqual(['1', '4']);
    expect(filterItems(items, 'waiting', '').map((i) => i.id)).toEqual(['3', '4']);
    expect(filterItems(items, CODES, '').map((i) => i.id)).toEqual(['1', '4']);
    expect(filterItems(items, 'all', 'שוד').map((i) => i.id)).toEqual(['2']);
    expect(matches(items[0], 'r1')).toBe(true);
  });
  it('collects all codes with their video', () => {
    expect(allCodes(items).map((c) => [c.code, c.item.id])).toEqual([['R1 R2', '1'], ['1-999', '4']]);
    expect(allCodes(items, 'רכב').map((c) => c.code)).toEqual(['1-999']);
  });
  it('newest titles', () => {
    expect(newestTitles([{ title: 'א', category: 'x', createdAt: 1 }, { title: 'ב', category: 'x', createdAt: 2 }], 'x')).toEqual(['ב', 'א']);
  });
});

describe('hash <-> filter', () => {
  it('round-trips', () => {
    for (const f of ['all', 'waiting', CODES, 'קודים וצ׳יטים', 'a/b#c']) expect(filterFromHash(hashFromFilter(f))).toBe(f);
    expect(filterFromHash('#/c/%E0%A4%A')).toBe('all');
  });
});

describe('sourceOf', () => {
  it('names the site', () => {
    expect(sourceOf('https://www.facebook.com/share/r/1JVJ2AkHeK/')).toBe('Facebook');
    expect(sourceOf('https://youtu.be/x')).toBe('YouTube');
    expect(sourceOf('https://example.com/a')).toBe('example.com');
  });
});

describe('video watching state', () => {
  it('works for old items without video', () => {
    expect(videoState({})).toBe('');
    expect(isWatching({})).toBe(false);
    expect(needsUpload({})).toBe(false);
  });
  it('knows busy and needs-upload', () => {
    expect(isWatching({ video: { state: 'fetching' } })).toBe(true);
    expect(isWatching({ video: { state: 'uploaded' } })).toBe(true);
    expect(needsUpload({ video: { state: 'need_upload' } })).toBe(true);
    expect(needsUpload({ video: { state: 'watched' } })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { categoryList, filterItems, matches, parsePasted, sharedText } from './library';

describe('parsePasted', () => {
  it('finds links and keeps the rest as a note', () => {
    expect(parsePasted('כלי מעולה https://a.com/x, וגם https://b.com/y.')).toEqual({
      links: ['https://a.com/x', 'https://b.com/y'],
      text: '',
      note: 'כלי מעולה וגם',
    });
  });
  it('text without links is saved as text', () => {
    expect(parsePasted('  טיפ לפרומפט  ')).toEqual({ links: [], text: 'טיפ לפרומפט', note: '' });
  });
  it('does not add the same link twice', () => {
    expect(parsePasted('https://a.com https://a.com').links).toEqual(['https://a.com']);
  });
});

describe('sharedText', () => {
  it('joins title, text and url from a share', () => {
    expect(sharedText('?title=כותרת&url=https%3A%2F%2Fa.com')).toBe('כותרת\nhttps://a.com');
  });
});

describe('filters', () => {
  const items = [
    { id: '1', title: 'Midjourney', category: 'תמונות', tags: ['אמנות'], status: 'ready' },
    { id: '2', title: 'Cursor', category: 'קוד', summary: 'עורך קוד חכם', status: 'ready' },
    { id: '3', title: 'x.com', status: 'pending' },
    { id: '4', title: 'Claude Code', category: 'קוד', status: 'failed' },
  ];
  it('lists categories by size', () => {
    expect(categoryList(items, { קוד: { emoji: '💻' } })).toEqual([
      { name: 'קוד', count: 2, emoji: '💻' },
      { name: 'תמונות', count: 1, emoji: '📁' },
    ]);
  });
  it('filters by category, waiting and search', () => {
    expect(filterItems(items, 'קוד', '').map((i) => i.id)).toEqual(['2', '4']);
    expect(filterItems(items, 'waiting', '').map((i) => i.id)).toEqual(['3', '4']);
    expect(filterItems(items, 'all', 'עורך').map((i) => i.id)).toEqual(['2']);
    expect(matches(items[0], 'אמנות midjourney')).toBe(true);
  });
});

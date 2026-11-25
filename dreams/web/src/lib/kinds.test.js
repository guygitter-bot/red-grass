import { describe, it, expect } from 'vitest';
import { makePhrase, kindById } from './kinds';

describe('makePhrase', () => {
  it('מוריד סימן שאלה ובונה משפט', () => {
    expect(makePhrase('problem', 'האם לעבור דירה?')).toBe('הלילה אחלום על: האם לעבור דירה');
  });
  it('בלי טקסט – ריק, חוץ מזכירה וצלול', () => {
    expect(makePhrase('problem', '  ')).toBe('');
    expect(makePhrase('recall', '')).toContain('אזכור');
    expect(makePhrase('lucid', '')).toContain('שזה חלום');
  });
  it('סוג לא מוכר → בעיה', () => {
    expect(kindById('xx').id).toBe('problem');
  });
});

import { describe, it, expect } from 'vitest';
import { addToRequest, colorText, defaultName, shortTitle, COLORS, QUICK } from './design';
import { fitSize, dataUrl, fromDataUrl } from './image';
import { safeProject } from './store';

describe('בקשה', () => {
  it('מוסיף משפט בלי לכפול', () => {
    expect(addToRequest('', 'טפט')).toBe('טפט');
    expect(addToRequest('קיר ירוק', 'טפט')).toBe('קיר ירוק. טפט');
    expect(addToRequest('קיר ירוק.', 'טפט')).toBe('קיר ירוק. טפט');
    expect(addToRequest('קיר ירוק. טפט', 'טפט')).toBe('קיר ירוק. טפט');
  });
  it('צבע כולל שם וקוד', () => {
    expect(colorText(COLORS[3])).toBe('לצבוע את הקיר בצבע ירוק זית (#7c8560)');
    expect(QUICK.every((q) => q.label && q.text)).toBe(true);
  });
  it('שם וכותרת', () => {
    expect(defaultName(new Date(2026, 10, 12))).toBe('חדר 12.11');
    expect(shortTitle('  קצר ')).toBe('קצר');
    expect(shortTitle('א'.repeat(40)).length).toBe(28);
  });
});

describe('תמונה', () => {
  it('מקטין בלי לעוות ולא מגדיל', () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitSize(3000, 4000, 1600)).toEqual({ w: 1200, h: 1600 });
    expect(fitSize(800, 600, 1600)).toEqual({ w: 800, h: 600 });
    expect(fitSize(0, 0, 1600)).toEqual({ w: 0, h: 0 });
  });
  it('data url הלוך וחזור', () => {
    const im = { media_type: 'image/png', data: 'QUJD' };
    expect(fromDataUrl(dataUrl(im))).toEqual(im);
    expect(fromDataUrl('nope')).toBe(null);
    expect(dataUrl(null)).toBe('');
  });
});

describe('פרויקט ישן', () => {
  it('שדות חסרים מקבלים ברירת מחדל', () => {
    const p = safeProject({ id: 'a' });
    expect(p.versions).toEqual([]);
    expect(p.ideas).toEqual([]);
    expect(p.id).toBe('a');
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, attachmentsOf, emptyState, fileSize, isImage, makeTask, moveCategory, normalize, search, sortCategories, upsertCategory } from './store';
import { applyRemote } from './sync';
import { base64ToBytes, jpgName, scaledSize, shrinkable } from './files';
import { FONT_OPTIONS, fontScale, normalizeFont } from './fontsize';

const ids = (state) => state.categories.map((c) => c.id);

describe('סדר התחומים', () => {
  it('תחומים ישנים בלי order נשארים בסדר שלהם', () => {
    expect(sortCategories(DEFAULT_CATEGORIES).map((c) => c.id)).toEqual(DEFAULT_CATEGORIES.map((c) => c.id));
    expect(ids(normalize({ categories: [{ id: 'b', order: 1 }, { id: 'a', order: 0 }] }))).toEqual(['a', 'b']);
  });

  it('הזזה למעלה ולמטה, ולא מעבר לקצוות', () => {
    let s = emptyState();
    s = moveCategory(s, 'work', -1);
    expect(ids(s).slice(0, 3)).toEqual(['care', 'work', 'home']);
    s = moveCategory(s, 'work', -1);
    expect(ids(s)[0]).toBe('work');
    expect(moveCategory(s, 'work', -1)).toBe(s);
    expect(moveCategory(s, 'guy', 1)).toBe(s);
    expect(s.categories.map((c) => c.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.categories.every((c) => c.updatedAt)).toBe(true);
  });

  it('תחום חדש נכנס בסוף, גם אחרי שינוי סדר', () => {
    let s = moveCategory(emptyState(), 'guy', -1);
    s = upsertCategory(s, { name: 'בריאות', emoji: '🩺', color: 'teal' });
    expect(sortCategories(s.categories).at(-1).name).toBe('בריאות');
  });

  it('הסדר שנקבע במכשיר אחר מגיע בסנכרון', () => {
    const phone = moveCategory(emptyState(), 'kids', -4);
    const records = phone.categories.map((c) => ({ kind: 'category', id: c.id, data: c, updatedAt: c.updatedAt }));
    const pc = applyRemote(emptyState(), [], { cursor: 6, records });
    expect(ids(pc)).toEqual(ids(phone));
    expect(ids(pc)[0]).toBe('kids');
  });
});

describe('תמונות וקבצים במשימה', () => {
  it('משימה ישנה בלי קבצים לא נשברת', () => {
    expect(attachmentsOf({ id: 'x', title: 'ישנה' })).toEqual([]);
    expect(attachmentsOf({ attachments: [null, { name: 'בלי מזהה' }, { id: 'a1', name: 'קבלה.pdf' }] })).toEqual([{ id: 'a1', name: 'קבלה.pdf' }]);
    expect(makeTask({ title: 'חדשה' }).attachments).toEqual([]);
  });

  it('תמונה או קובץ, וגודל קריא', () => {
    expect(isImage({ type: 'image/jpeg' })).toBe(true);
    expect(isImage({ type: 'application/pdf' })).toBe(false);
    expect(fileSize(300)).toBe('1KB');
    expect(fileSize(350 * 1024)).toBe('350KB');
    expect(fileSize(1.5 * 1024 * 1024)).toBe('1.5MB');
    expect(fileSize(2 * 1024 * 1024)).toBe('2MB');
  });

  it('חיפוש מוצא גם לפי שם הקובץ', () => {
    const t = makeTask({ title: 'ביטוח רכב', attachments: [{ id: 'f1', name: 'פוליסה.pdf', type: 'application/pdf', size: 1 }] });
    expect(search([t], 'פוליסה')).toHaveLength(1);
  });

  it('תמונה גדולה מוקטנת, קטנה נשארת', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(shrinkable('image/jpeg')).toBe(true);
    expect(shrinkable('image/gif')).toBe(false);
    expect(shrinkable('application/pdf')).toBe(false);
    expect(jpgName('IMG_1234.HEIC')).toBe('IMG_1234.jpg');
    expect(jpgName('')).toBe('תמונה.jpg');
  });

  it('base64 חוזר לאותם בתים', () => {
    expect([...base64ToBytes(btoa('abc'))]).toEqual([97, 98, 99]);
  });
});

describe('גודל הטקסט', () => {
  it('רגיל / גדול / גדול מאוד, וערך לא מוכר = רגיל', () => {
    expect(FONT_OPTIONS.map((o) => o.value)).toEqual(['normal', 'large', 'xlarge']);
    expect(fontScale('normal')).toBe(1);
    expect(fontScale('xlarge')).toBe(1.25);
    expect(normalizeFont(null)).toBe('normal');
    expect(fontScale('huge')).toBe(1);
  });
});

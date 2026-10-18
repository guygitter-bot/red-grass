import { describe, expect, it } from 'vitest';
import { allProducts, parseCode, readExport } from './telegram';

// כמו הייצוא של Telegram Desktop: אלבום = כמה הודעות באותה שנייה, הטקסט באחת מהן
const EXPORT = {
  name: 'iSport',
  messages: [
    { id: 10, type: 'service', date: '2026-10-01T10:00:00', action: 'create_channel' },
    { id: 11, type: 'message', date: '2026-10-15T13:19:00', date_unixtime: '1792059540', photo: 'photos/photo_1.jpg', text: '' },
    {
      id: 12, type: 'message', date: '2026-10-15T13:19:00', date_unixtime: '1792059540', photo: 'photos/photo_2.jpg',
      text: [
        'נוספו גם שרוולים ארוכים\n(למבוגרים בלבד, גרסאות ES ו-PV)\n\nלינק: ',
        { type: 'link', text: 'https://t.me/Sportv4Us/9294' },
        "\n\nחולצת הפרידה של ליונל מסי -\nקוד: Messi-Tribute-27\n\nלבחור בלינק ES לחולצת אוהד מבוגרים - אם רוצים שרוול ארוך, הקוד:\nMessi-Tribute-27-LongSleeve\nתהנו!",
      ],
    },
    { id: 20, type: 'message', date: '2026-10-16T14:25:00', date_unixtime: '1792160700', photo: 'photos/photo_3.jpg', text: '' },
    { id: 21, type: 'message', date: '2026-10-16T14:25:00', date_unixtime: '1792160700', photo: 'photos/photo_4.jpg', text: '' },
    {
      id: 22, type: 'message', date: '2026-10-16T14:25:01', date_unixtime: '1792160701', photo: 'photos/photo_5.jpg',
      text: [
        "בוקה ג'וניורס 2027\nבכל הגרסאות\n⚪⚪🆕\n\nלינק ישיר לרכישה: ",
        { type: 'link', text: 'https://store.flylinking.com/g/M2Q8AJ5C10' },
        '\n\nקודים:\nכחול BocaJuniors-H-27 (Home)\nלבן BocaJuniors-A-27 (Away)\n\nניתן להוסיף פאצ\' בהוספת ההערה:\nAdd League Patches\nName: Israel Number: 1',
      ],
    },
    { id: 30, type: 'message', date: '2026-10-17T09:00:00', date_unixtime: '1792227600', text: 'בוקר טוב לכולם! מבצעים בקרוב' },
  ],
};

describe('telegram export', () => {
  const posts = readExport(EXPORT);
  it('groups album photos with their text', () => {
    expect(posts.map((p) => p.id)).toEqual([11, 20, 30]);
    expect(posts[0].photos).toEqual(['photos/photo_1.jpg', 'photos/photo_2.jpg']);
    expect(posts[1].photos).toEqual(['photos/photo_3.jpg', 'photos/photo_4.jpg', 'photos/photo_5.jpg']);
  });

  it('products: one per code, long sleeve variant, FlyLinking link, type and color', () => {
    const items = allProducts(posts);
    expect(items.map((i) => i.code)).toEqual(['Messi-Tribute-27', 'BocaJuniors-H-27', 'BocaJuniors-A-27']);
    const [messi, home, away] = items;
    expect(messi.longSleeve).toBe(true);
    expect(messi.flyLink).toBe('');
    expect(messi.otherLink).toBe('https://t.me/Sportv4Us/9294');
    expect(home).toMatchObject({ team: 'Boca Juniors', type: 'Home', year: '2027', colorHe: 'כחול', flyLink: 'https://store.flylinking.com/g/M2Q8AJ5C10', longSleeve: false });
    expect(away).toMatchObject({ type: 'Away', colorHe: 'לבן' });
    expect(home.title).toBe("בוקה ג'וניורס 2027");
    expect(home.photos).toHaveLength(3);
  });

  it('parses codes', () => {
    expect(parseCode('RealMadrid-GK-2026')).toEqual({ team: 'Real Madrid', type: 'GK', year: '2026' });
    expect(parseCode('Messi-Tribute-27')).toEqual({ team: 'Messi', type: 'Tribute', year: '2027' });
  });

  it('ignores messages without codes and broken files', () => {
    expect(readExport({})).toEqual([]);
    expect(allProducts(readExport({ messages: [{ type: 'message', id: 1, text: 'Add League Patches Name: Israel' }] }))).toEqual([]);
  });

  // עוזר: הודעה בייצוא
  const msg = (id, t, photo, text = '') => ({
    id, type: 'message', date: `2026-10-20T10:00:${String(t).padStart(2, '0')}`, date_unixtime: String(1792400000 + t),
    ...(photo ? { photo: `photos/p${id}.jpg` } : {}), text,
  });

  it('album with the caption on the first message', () => {
    const out = readExport({ messages: [msg(1, 0, true, 'Boca-H-27'), msg(2, 0, true), msg(3, 1, true)] });
    expect(out).toHaveLength(1);
    expect(out[0].photos).toEqual(['photos/p1.jpg', 'photos/p2.jpg', 'photos/p3.jpg']);
  });

  it('album with the caption on the last message', () => {
    const out = readExport({ messages: [msg(1, 0, true), msg(2, 0, true), msg(3, 0, true, 'Boca-H-27')] });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
    expect(out[0].photos).toHaveLength(3);
  });

  it('two albums back to back (caption first) stay separate', () => {
    const out = readExport({ messages: [msg(1, 0, true, 'Boca-H-27'), msg(2, 0, true), msg(3, 1, true, 'River-H-27'), msg(4, 1, true)] });
    expect(out.map((p) => p.photos)).toEqual([['photos/p1.jpg', 'photos/p2.jpg'], ['photos/p3.jpg', 'photos/p4.jpg']]);
    expect(allProducts(out).map((i) => i.code)).toEqual(['Boca-H-27', 'River-H-27']);
  });

  it('two albums back to back (caption last) stay separate', () => {
    const out = readExport({ messages: [msg(1, 0, true), msg(2, 0, true, 'Boca-H-27'), msg(3, 1, true), msg(4, 1, true), msg(5, 2, true, 'River-H-27')] });
    expect(out.map((p) => p.photos.length)).toEqual([2, 3]);
    expect(allProducts(out).map((i) => i.code)).toEqual(['Boca-H-27', 'River-H-27']);
  });

  it('single photo with text, and a photo-only message later is not attached', () => {
    const out = readExport({ messages: [msg(1, 0, true, 'Boca-H-27'), msg(2, 30, true)] });
    expect(out).toHaveLength(1);
    expect(out[0].photos).toEqual(['photos/p1.jpg']);
  });

  it('uses grouped_id when present', () => {
    const a = { ...msg(1, 0, true), grouped_id: 'g1' };
    const b = { ...msg(2, 0, true, 'Boca-H-27'), grouped_id: 'g1' };
    const c = { ...msg(3, 0, true, 'River-H-27'), grouped_id: 'g2' };
    expect(readExport({ messages: [a, b, c] }).map((p) => p.photos.length)).toEqual([2, 1]);
  });

  it('a missing-file photo is not a photo', () => {
    const missing = { ...msg(1, 0, false, 'Boca-H-27'), photo: '(File not included. Change data exporting settings to download.)' };
    expect(readExport({ messages: [missing] })[0].photos).toEqual([]);
  });

  it('names with hyphens but no digits are not codes', () => {
    const p = readExport({ messages: [msg(1, 0, false, 'Paris-Saint-Germain חדש!\nBoca-H-27')] });
    expect(allProducts(p).map((i) => i.code)).toEqual(['Boca-H-27']);
  });

  it('only real flylinking hosts count as the FlyLinking link', () => {
    const text = (link) => ({ messages: [msg(1, 0, false, `Boca-H-27 ${link}`)] });
    const fly = (link) => allProducts(readExport(text(link)))[0].flyLink;
    expect(fly('https://store.flylinking.com/g/ABC')).toBe('https://store.flylinking.com/g/ABC');
    expect(fly('https://flylinking.com/x')).toBe('https://flylinking.com/x');
    expect(fly('https://evil.com/flylinking.com')).toBe('');
    expect(fly('https://notflylinking.com/x')).toBe('');
  });
});

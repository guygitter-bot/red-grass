import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { isKeepTakeout, noteToMessage, readKeepTakeout } from './keep';
import { findCandidates } from './whatsapp';

const recipe = {
  title: 'עוגת גזר של אמא',
  textContent: 'מצרכים:\n3 ביצים\n1 כוס סוכר\n2 כוסות קמח\n3 גזרים מגוררים\nאופן הכנה:\nמערבבים את הביצים והסוכר\nמוסיפים קמח וגזר\nאופים 40 דקות ב-180 מעלות',
  labels: [], createdTimestampUsec: 1700000000000000,
};

describe('Google Keep import', () => {
  it('turns notes into messages (title, text, checklist), skipping the trash', () => {
    const list = noteToMessage({ title: 'שקשוקה', listContent: [{ text: '6 ביצים' }, { text: '4 עגבניות' }], labels: [{ name: 'מתכונים' }] });
    expect(list.text).toBe('שקשוקה\n6 ביצים\n4 עגבניות');
    expect(list.tagged).toBe(true);
    expect(noteToMessage({ ...recipe, isTrashed: true })).toBeNull();
    expect(noteToMessage({ title: '', textContent: '' })).toBeNull();
  });

  it('reads a Takeout zip and offers every note; recipe-like and labelled notes are pre-selected', () => {
    const zip = zipSync({
      'Takeout/Keep/carrot.json': strToU8(JSON.stringify(recipe)),
      'Takeout/Keep/shakshuka.json': strToU8(JSON.stringify({ title: 'שקשוקה', listContent: [{ text: '6 ביצים' }, { text: '4 עגבניות' }], labels: [{ name: 'מתכון' }] })),
      'Takeout/Keep/todo.json': strToU8(JSON.stringify({ title: 'לקנות', textContent: 'מתנה ליום הולדת של דני' })),
      'Takeout/Keep/link.json': strToU8(JSON.stringify({ title: 'פסטה', textContent: 'https://www.youtube.com/watch?v=abc מתכון טוב' })),
      'Takeout/Keep/carrot.html': strToU8('<html></html>'),
    });
    expect(isKeepTakeout(zip)).toBe(true);
    expect(isKeepTakeout(zipSync({ 'a.txt': strToU8('x') }))).toBe(false);
    const notes = readKeepTakeout(zip);
    expect(notes).toHaveLength(4);
    const items = findCandidates(notes, { allText: true });
    const byTitle = Object.fromEntries(items.map((i) => [i.title || i.url, i]));
    expect(byTitle['עוגת גזר של אמא'].likely).toBe(true);
    expect(byTitle['שקשוקה'].likely).toBe(true);
    expect(byTitle['לקנות'].likely).toBe(false);
    expect(items.some((i) => i.type === 'link' && /youtube/.test(i.url))).toBe(true);
    // צ'אט רגיל מווטסאפ: לא כל הודעה מועמדת
    expect(findCandidates([{ author: 'a', date: '', text: 'מתנה ליום הולדת של דני ושל אחותו' }])).toHaveLength(0);
  });

  it('explains an empty export', () => {
    expect(() => readKeepTakeout(zipSync({ 'Takeout/Keep/x.json': strToU8(JSON.stringify({ isTrashed: true, title: 'x' })) }))).toThrow(/לא נמצאו פתקים/);
  });
});

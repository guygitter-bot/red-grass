import { describe, expect, it } from 'vitest';
import { addMonths } from './dates';
import { toIcs, googleCalendarUrl } from './calendar';
import { taskText } from './share';
import {
  addTask, clearChecked, currentReminderAt, dashboard, dueReminders, emptyState, nextOccurrence, occurrenceKey,
  removeCategory, repeatLabel, toggleDone, uncheckAll, upsertCategory,
} from './store';

describe('משימה / תזכורת חוזרת', () => {
  it('הפעמים: כל יום, כל שבוע, כל חודש (סוף החודש נשאר בחודש)', () => {
    expect(occurrenceKey('2026-10-30', 'daily', 3)).toBe('2026-11-02');
    expect(occurrenceKey('2026-10-04', 'weekly', 2)).toBe('2026-10-18');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(occurrenceKey('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
    expect(occurrenceKey('2026-11-15', 'monthly', 3)).toBe('2027-02-15');
  });

  it('הפעם הבאה היא אחרי היום – גם כשהמשימה באיחור', () => {
    expect(nextOccurrence({ due: '2026-10-04', repeat: 'daily' }, '2026-10-04')).toBe('2026-10-05');
    expect(nextOccurrence({ due: '2026-09-29', repeat: 'weekly' }, '2026-10-04')).toBe('2026-10-06');
    expect(nextOccurrence({ due: '2026-10-20', repeat: 'monthly' }, '2026-10-04')).toBe('2026-11-20');
  });

  it('תיאור בעברית', () => {
    expect(repeatLabel({ due: '2026-10-06', repeat: 'weekly' })).toBe('כל שבוע ביום שלישי');
    expect(repeatLabel({ due: '2026-10-15', repeat: 'monthly' })).toBe('כל חודש ב-15');
    expect(repeatLabel({ due: '2026-10-15', repeat: 'daily' })).toBe('כל יום');
    expect(repeatLabel({ due: null, repeat: 'daily' })).toBe('');
    expect(repeatLabel({ due: '2026-10-15' })).toBe('');
  });

  it('סימון ✓ מעביר לפעם הבאה ומאפס את תתי המשימות', () => {
    let s = addTask(emptyState(), { title: 'לקחת ויטמין', due: '2026-10-04', repeat: 'daily', remind: 0 });
    const id = s.tasks[0].id;
    s = addTask(s, { title: 'כוס מים', parentId: id, done: true });
    s = { ...s, notified: { [id]: 1 } };
    s = toggleDone(s, id, new Date(2026, 9, 4, 20, 0));
    const t = s.tasks.find((x) => x.id === id);
    expect(t.done).toBe(false);
    expect(t.due).toBe('2026-10-05');
    expect(t.lastDoneAt).toBeTruthy();
    expect(s.tasks.find((x) => x.parentId === id).done).toBe(false);
    expect(s.notified[id]).toBeUndefined();
  });

  it('משימה רגילה נסגרת כמו קודם', () => {
    let s = addTask(emptyState(), { title: 'רגילה', due: '2026-10-04' });
    s = toggleDone(s, s.tasks[0].id);
    expect(s.tasks[0].done).toBe(true);
    expect(s.tasks[0].due).toBe('2026-10-04');
  });

  it('התזכורת חוזרת בכל פעם, גם בלי לסמן ✓', () => {
    let s = addTask(emptyState(), { title: 'תרופה', due: '2026-10-01', repeat: 'daily', remind: 0, remindTime: '08:00' });
    const id = s.tasks[0].id;
    const day4 = new Date(2026, 9, 4, 8, 5);
    expect(currentReminderAt(s.tasks[0], day4)).toEqual(new Date(2026, 9, 4, 8, 0));
    expect(dueReminders(s, day4).map((t) => t.id)).toEqual([id]);
    // הוצגה -> לא שוב באותו יום
    s = { ...s, notified: { [id]: day4.getTime() } };
    expect(dueReminders(s, new Date(2026, 9, 4, 9, 0))).toHaveLength(0);
    // מחר – שוב
    expect(dueReminders(s, new Date(2026, 9, 5, 8, 1)).map((t) => t.id)).toEqual([id]);
    // לפני הפעם הראשונה – כלום
    expect(dueReminders(s, new Date(2026, 8, 30, 8, 1))).toHaveLength(0);
  });

  it('ביומן: אירוע חוזר', () => {
    const task = { id: 'r1', title: 'חוג', due: '2026-10-06', time: '17:00', repeat: 'weekly', remind: null };
    expect(toIcs([task])).toContain('RRULE:FREQ=WEEKLY');
    expect(googleCalendarUrl(task)).toContain('recur=RRULE%3AFREQ%3DWEEKLY');
    expect(toIcs([{ ...task, repeat: null }])).not.toContain('RRULE');
    expect(taskText(task)).toContain('🔁 כל שבוע ביום שלישי');
  });
});

describe('רשימות ומחיקת תחומים', () => {
  const withList = () => {
    let s = upsertCategory(emptyState(), { id: 'pack', name: 'מה לארוז', emoji: '✈️', color: 'sky', kind: 'list' });
    for (const title of ['דרכון', 'מטען', 'משקפי שמש']) s = addTask(s, { title, categoryId: 'pack' });
    return s;
  };

  it('הכול מחדש: כל הסימונים יורדים', () => {
    let s = withList();
    s = toggleDone(s, s.tasks[0].id);
    s = toggleDone(s, s.tasks[1].id);
    s = uncheckAll(s, 'pack');
    expect(s.tasks.filter((t) => t.done)).toHaveLength(0);
  });

  it('ניקוי: רק מה שסומן יוצא מהרשימה', () => {
    let s = withList();
    s = toggleDone(s, s.tasks[0].id);
    s = clearChecked(s, 'pack');
    expect(s.tasks.map((t) => t.title)).toEqual(['מטען', 'משקפי שמש']);
  });

  it('פריטים ברשימה לא נספרים כ"משימות בלי תאריך" בלוח', () => {
    let s = withList();
    s = addTask(s, { title: 'משימה בלי תאריך', categoryId: 'home' });
    expect(dashboard(s).noDate).toBe(1);
  });

  it('מחיקת תחום: המשימות נשארות בלי תחום, או נמחקות יחד איתו (כולל תתי משימות)', () => {
    let s = withList();
    s = addTask(s, { title: 'תת פריט', categoryId: 'pack', parentId: s.tasks[0].id });
    const keep = removeCategory(s, 'pack');
    expect(keep.categories.some((c) => c.id === 'pack')).toBe(false);
    expect(keep.tasks).toHaveLength(4);
    expect(keep.tasks.every((t) => t.categoryId === null)).toBe(true);

    let other = addTask(s, { title: 'בבית', categoryId: 'home' });
    other = removeCategory(other, 'pack', true);
    expect(other.categories.some((c) => c.id === 'pack')).toBe(false);
    expect(other.tasks.map((t) => t.title)).toEqual(['בבית']);
  });
});

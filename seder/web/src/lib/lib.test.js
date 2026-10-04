import { describe, expect, it } from 'vitest';
import { addDays, dayLabel, greeting, todayKey, weekdayShort } from './dates';
import { findDate, findTime, parseMessage, parseQuick } from './parse';
import { googleCalendarUrl, toIcs } from './calendar';
import { addTask, contactsOf, dashboard, dueReminders, emptyState, knownContacts, normalize, removeTask, saveTree, search, setName, subtasksOf, telUrl, toggleDone, updateTask } from './store';
import { taskText } from './share';

// שבת, 3 באוקטובר 2026, 10:00
const NOW = new Date(2026, 9, 3, 10, 0);

const WEBINAR = `מחר ב20:00 זה קורה!🥹
*הרצאה ללא עלות - איך לתת חצי מליון לכל ילד*

✨ כמה ואיפה צריך לשים לילד כל חודש כדי להגיע לחצי מליון
✨ איך עושים את זה ב3 דקות בחודש בשיטה שכל עשירי העולם משתמשים בה
✨ ומאיפה להביא את הכסף (ב90% מהמקרים הוא כבר נמצא אצלך)

שעה בזום. ללא עלות. מספר המקומות מוגבל

נשארו מקומות אחרונים
כאן תוכלי לשריין 👇
https://academy.mominvest.co.il/r/webinar-wagroup`;

describe('dates', () => {
  it('labels days relative to today', () => {
    const today = todayKey(NOW);
    expect(today).toBe('2026-10-03');
    expect(dayLabel(today, NOW)).toBe('היום');
    expect(dayLabel(addDays(today, 1), NOW)).toBe('מחר');
    expect(dayLabel(addDays(today, 3), NOW)).toBe('יום שלישי');
    expect(dayLabel('2026-10-20', NOW)).toBe('20 באוקטובר');
  });

  it('short weekday letters', () => {
    // 4.10.2026 is a Sunday
    expect(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(weekdayShort)).toEqual(["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]);
  });
});

describe('parse', () => {
  it('reads the WhatsApp webinar message as an event tomorrow at 20:00', () => {
    const draft = parseMessage(WEBINAR, NOW);
    expect(draft.title).toBe('הרצאה ללא עלות - איך לתת חצי מליון לכל ילד');
    expect(draft.due).toBe('2026-10-04');
    expect(draft.time).toBe('20:00');
    expect(draft.type).toBe('event');
    expect(draft.remind).toBe(30);
    expect(draft.links).toEqual([{ url: 'https://academy.mominvest.co.il/r/webinar-wagroup', kind: 'link' }]);
    expect(draft.notes).toContain('שעה בזום');
  });

  it('keeps a message with only a link as something to check later', () => {
    const draft = parseMessage('ממליצה בחום על הסרטון הזה https://youtu.be/abc123', NOW);
    expect(draft.type).toBe('later');
    expect(draft.links[0].kind).toBe('video');
    expect(draft.title).toBe('ממליצה בחום על הסרטון הזה');
  });

  it('finds dates in Hebrew', () => {
    expect(findDate('להתקשר מחרתיים', NOW).due).toBe('2026-10-05');
    expect(findDate('פגישה ביום שלישי', NOW).due).toBe('2026-10-06');
    expect(findDate('יום ה׳ בבוקר', NOW).due).toBe('2026-10-08');
    expect(findDate('בשבת', NOW).due).toBe('2026-10-10');
    expect(findDate('ב-12/10 בערב', NOW).due).toBe('2026-10-12');
    expect(findDate('תור ל 5.1', NOW).due).toBe('2027-01-05');
    expect(findDate('בלי תאריך', NOW)).toBeNull();
  });

  it('finds times', () => {
    expect(findTime('ב20:00').time).toBe('20:00');
    expect(findTime('בשעה 8:30').time).toBe('08:30');
    expect(findTime('ב-8 בערב').time).toBe('20:00');
    expect(findTime('3 דקות')).toBeNull();
  });

  it('quick add pulls date, time and priority out of the title', () => {
    expect(parseQuick('להתקשר לרופא מחר ב10:00 !', NOW)).toEqual({ due: '2026-10-04', time: '10:00', priority: 3, title: 'להתקשר לרופא' });
    expect(parseQuick('לקנות חלב', NOW)).toEqual({ title: 'לקנות חלב' });
  });
});

describe('calendar', () => {
  const task = { id: 'abc', title: 'הרצאה, בזום', due: '2026-10-04', time: '20:00', remind: 30, notes: '', links: [{ url: 'https://x.co/a' }] };

  it('builds an ics event with an alarm', () => {
    const ics = toIcs([task], NOW);
    expect(ics).toContain('DTSTART:20261004T200000');
    expect(ics).toContain('DTEND:20261004T210000');
    expect(ics).toContain('SUMMARY:הרצאה\\, בזום');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('URL:https://x.co/a');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('uses an all-day event without a time', () => {
    const ics = toIcs([{ ...task, time: null }], NOW);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261004');
    expect(ics).toContain('DTEND;VALUE=DATE:20261005');
  });

  it('builds a Google Calendar link', () => {
    const url = new URL(googleCalendarUrl(task));
    expect(url.searchParams.get('dates')).toBe('20261004T200000/20261004T210000');
    expect(url.searchParams.get('text')).toBe('הרצאה, בזום');
  });
});

describe('store', () => {
  it('adds, completes and removes tasks with their subtasks', () => {
    let s = addTask(emptyState(), { title: 'לארגן יום הולדת', due: '2026-10-03', priority: 3 });
    const parent = s.tasks[0];
    s = addTask(s, { title: 'להזמין עוגה', parentId: parent.id });
    s = addTask(s, { title: 'בלונים', parentId: s.tasks[1].id });
    expect(s.tasks).toHaveLength(3);
    s = toggleDone(s, s.tasks[1].id);
    expect(s.tasks[1].done).toBe(true);
    s = removeTask(s, parent.id);
    expect(s.tasks).toHaveLength(0);
  });

  it('saves a task with its subtasks from the editor', () => {
    let s = saveTree(emptyState(), { id: 'p1', title: 'מעבר דירה', categoryId: 'home' }, [
      { id: 's1', title: 'קרטונים', due: '2026-10-05', priority: 3 },
      { id: 's2', title: 'מוביל' },
    ]);
    expect(subtasksOf(s.tasks, 'p1').map((t) => [t.title, t.categoryId])).toEqual([['קרטונים', 'home'], ['מוביל', 'home']]);
    s = saveTree(s, { id: 'p1', title: 'מעבר דירה!' }, [{ id: 's2', title: 'מוביל זול', done: true }]);
    expect(s.tasks.map((t) => t.title)).toEqual(['מעבר דירה!', 'מוביל זול']);
    expect(s.tasks[1].done).toBe(true);
  });

  it('summarises the dashboard', () => {
    let s = emptyState();
    s = addTask(s, { title: 'היום', due: '2026-10-03', categoryId: 'work' });
    s = addTask(s, { title: 'באיחור', due: '2026-10-01' });
    s = addTask(s, { title: 'מחכה לתשובה מהבנק', type: 'followup' });
    s = addTask(s, { title: 'סרטון', type: 'later' });
    const d = dashboard(s, NOW);
    expect(d.today).toBe(1);
    expect(d.overdue.map((t) => t.title)).toEqual(['באיחור']);
    expect(d.waiting).toHaveLength(1);
    expect(d.later).toBe(1);
    expect(d.byCategory.find((c) => c.id === 'work').open).toBe(1);
  });

  it('fires a reminder once, and again after the time changes', () => {
    let s = addTask(emptyState(), { title: 'הרצאה', due: '2026-10-03', time: '10:20', remind: 30 });
    const id = s.tasks[0].id;
    expect(dueReminders(s, NOW).map((t) => t.id)).toEqual([id]);
    s = { ...s, notified: { [id]: Date.now() } };
    expect(dueReminders(s, NOW)).toHaveLength(0);
    s = updateTask(s, id, { time: '10:25' });
    expect(dueReminders(s, NOW)).toHaveLength(1);
  });

  it('saves the name for the greeting, and keeps old data without one', () => {
    expect(normalize({ tasks: [] }).profile).toEqual({ id: 'profile', name: '', updatedAt: 0 });
    let s = setName(emptyState(), '  נועה   כהן ');
    expect(s.profile.name).toBe('נועה כהן');
    expect(s.profile.updatedAt).toBeGreaterThan(0);
    expect(setName(s, 'נועה כהן')).toBe(s);
    s = setName(s, '');
    expect(s.profile.name).toBe('');
    expect(normalize(JSON.parse(JSON.stringify(setName(s, 'נועה')))).profile.name).toBe('נועה');
  });
});

describe('greeting', () => {
  it('greets by the time of day, with the name when there is one', () => {
    expect(greeting(9)).toBe('בוקר טוב');
    expect(greeting(13, 'נועה')).toBe('צהריים טובים, נועה');
    expect(greeting(19, '  ')).toBe('ערב טוב');
    expect(greeting(2, 'נועה')).toBe('לילה טוב, נועה');
  });
});

describe('share', () => {
  it('formats a task for WhatsApp', () => {
    const text = taskText({ title: 'מעבר דירה', due: '2026-10-04', time: '09:00', priority: 3, notes: '', links: [] }, [{ title: 'קרטונים', done: true }, { title: 'מוביל', done: false }], NOW);
    expect(text).toBe('*מעבר דירה*\n🗓️ מחר ב-09:00\n❗ חשוב מאוד\n\n✅ קרטונים\n⬜ מוביל');
  });
});

describe('contacts', () => {
  it('old tasks without contacts still work', () => {
    expect(contactsOf({ id: 'a', title: 'ישנה' })).toEqual([]);
    expect(contactsOf({ contacts: [{ name: '  דנה   כהן ', phone: '050-123 4567' }, { name: '', phone: '' }] })).toEqual([{ name: 'דנה כהן', phone: '050-123 4567' }]);
  });

  it('dial link only for real numbers', () => {
    expect(telUrl('050-123 4567')).toBe('tel:0501234567');
    expect(telUrl('+972 50 1234567')).toBe('tel:+972501234567');
    expect(telUrl('')).toBe(null);
  });

  it('remembers names across tasks with the latest phone', () => {
    const tasks = [
      { id: '1', title: 'א', updatedAt: 1, contacts: [{ name: 'קופת חולים', phone: '*2700' }, { name: 'דנה', phone: '' }] },
      { id: '2', title: 'ב', updatedAt: 2, contacts: [{ name: 'דנה', phone: '0501111111' }] },
      { id: '3', title: 'ג', updatedAt: 3, contacts: [{ name: 'קופת חולים', phone: '' }] },
    ];
    expect(knownContacts(tasks)).toEqual([{ name: 'דנה', phone: '0501111111' }, { name: 'קופת חולים', phone: '*2700' }]);
  });

  it('search, share and calendar include the people', () => {
    let s = addTask(emptyState(), { title: 'לברר על החזר', due: '2026-10-04', contacts: [{ name: 'ביטוח לאומי', phone: '*6050' }] });
    expect(search(s.tasks, 'לאומי')).toHaveLength(1);
    expect(search(s.tasks, '6050')).toHaveLength(1);
    const task = s.tasks[0];
    expect(taskText(task, [], NOW)).toContain('👤 לבירור עם: ביטוח לאומי · *6050');
    expect(toIcs([task], NOW).replace(/\r\n /g, '')).toContain('לבירור עם: ביטוח לאומי · *6050');
    // השדה נשמר (ומתרוקן) בשמירה מהעורך
    s = saveTree(s, { ...task, contacts: [] }, []);
    expect(contactsOf(s.tasks[0])).toEqual([]);
  });
});

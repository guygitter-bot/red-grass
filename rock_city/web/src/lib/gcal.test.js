import { expect, test } from 'vitest';
import { gcalLink, icsFile } from './gcal';

const app = { teacherMap: { t1: { first: 'אבי' } }, studentMap: { s1: { first: 'דני', last: 'כהן' } }, roomMap: { r1: { name: 'חדר 1' } } };
const l = { id: 'les-1', teacherId: 't1', studentIds: ['s1'], subject: 'גיטרה', roomId: 'r1', kind: 'weekly', day: 1, start: '16:00', minutes: 45, from: '2026-10-01', until: '2026-12-31', dates: { '2026-10-19': { status: 'cancelled' } } };

test('google calendar link repeats weekly', () => {
  const u = new URL(gcalLink(l, app, { forStudent: true }));
  expect(u.searchParams.get('text')).toBe('גיטרה עם אבי – רוק סיטי');
  expect(u.searchParams.get('dates')).toMatch(/^\d{8}T160000\/\d{8}T164500$/);
  expect(u.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z');
  expect(u.searchParams.get('ctz')).toBe('Asia/Jerusalem');
});

test('ics file with cancelled dates removed', () => {
  const ics = icsFile([l], app);
  expect(ics).toContain('DTSTART;TZID=Asia/Jerusalem:20261005T160000');
  expect(ics).toContain('SUMMARY:גיטרה – דני כהן');
  expect(ics).toContain('EXDATE;TZID=Asia/Jerusalem:20261019T160000');
});

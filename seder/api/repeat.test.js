import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrenceKey, reminderTimes, zonedToUtc } from './reminders.js';

const TZ = 'Asia/Jerusalem';
const iso = (ms) => new Date(ms).toISOString();

test('recurring dates: every day, week and month (end of month stays in the month)', () => {
  assert.equal(occurrenceKey('2026-10-04', 'daily', 0), '2026-10-04');
  assert.equal(occurrenceKey('2026-10-30', 'daily', 3), '2026-11-02');
  assert.equal(occurrenceKey('2026-10-04', 'weekly', 2), '2026-10-18');
  assert.equal(occurrenceKey('2026-12-28', 'weekly', 1), '2027-01-04');
  assert.equal(occurrenceKey('2026-01-31', 'monthly', 1), '2026-02-28');
  assert.equal(occurrenceKey('2026-01-31', 'monthly', 2), '2026-03-31');
  assert.equal(occurrenceKey('2026-11-15', 'monthly', 3), '2027-02-15');
});

test('a recurring reminder: the last one that arrived and the next one', () => {
  const task = { due: '2026-10-01', remind: 0, remindTime: '08:00', repeat: 'daily' };
  // 4.10 בשעה 9:00 – התזכורת של היום כבר הגיעה, הבאה מחר
  const now = zonedToUtc('2026-10-04', '09:00', TZ);
  assert.deepEqual(reminderTimes(task, TZ, now).map(iso), ['2026-10-04T05:00:00.000Z', '2026-10-05T05:00:00.000Z']);
  // לפני הפעם הראשונה – רק היא
  assert.deepEqual(reminderTimes(task, TZ, zonedToUtc('2026-09-30', '09:00', TZ)).map(iso), ['2026-10-01T05:00:00.000Z']);
  // שבועי וחודשי
  const weekly = { ...task, repeat: 'weekly' };
  assert.deepEqual(reminderTimes(weekly, TZ, now).map(iso), ['2026-10-01T05:00:00.000Z', '2026-10-08T05:00:00.000Z']);
  const monthly = { due: '2026-01-31', remind: 0, repeat: 'monthly' };
  assert.deepEqual(reminderTimes(monthly, TZ, zonedToUtc('2026-03-01', '12:00', TZ)).map(iso), ['2026-02-28T07:00:00.000Z', '2026-03-31T06:00:00.000Z']);
  // הרבה זמן אחרי – עדיין מהיר ומדויק
  assert.deepEqual(reminderTimes(task, TZ, zonedToUtc('2030-05-10', '07:00', TZ)).map(iso), ['2030-05-09T05:00:00.000Z', '2030-05-10T05:00:00.000Z']);
});

test('not recurring, done, or without a reminder – as before', () => {
  const now = zonedToUtc('2026-10-04', '09:00', TZ);
  assert.deepEqual(reminderTimes({ due: '2026-10-01', remind: 0 }, TZ, now).map(iso), ['2026-10-01T06:00:00.000Z']);
  assert.deepEqual(reminderTimes({ due: '2026-10-01', remind: 0, repeat: 'daily', done: true }, TZ, now), []);
  assert.deepEqual(reminderTimes({ due: '2026-10-01', remind: null, repeat: 'daily' }, TZ, now), []);
});

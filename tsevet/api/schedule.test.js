import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSchedule, isDue, israelParts, israelToUtc, nextOf, nextRun } from './schedule.js';

test('Israel time, winter and summer', () => {
  // חורף: UTC+2, קיץ: UTC+3
  assert.equal(new Date(israelToUtc(2026, 1, 15, 2, 0)).toISOString(), '2026-01-15T00:00:00.000Z');
  assert.equal(new Date(israelToUtc(2026, 7, 15, 2, 0)).toISOString(), '2026-07-14T23:00:00.000Z');
  assert.deepEqual(israelParts(Date.parse('2026-11-17T22:30:00Z')), { y: 2026, m: 11, d: 18, wd: 3, hh: 0, mm: 30 });
});

test('next run', () => {
  const every = { days: [0, 1, 2, 3, 4, 5, 6], time: '02:00' };
  // יום שלישי 17/11/2026, 10:00 בישראל -> מחר ב-2:00
  const now = israelToUtc(2026, 11, 17, 10, 0);
  assert.equal(nextRun(every, now), israelToUtc(2026, 11, 18, 2, 0));
  // באותו יום, לפני השעה
  assert.equal(nextRun({ days: [2], time: '23:15' }, now), israelToUtc(2026, 11, 17, 23, 15));
  // רק יום ראשון -> ראשון הבא
  assert.equal(nextRun({ days: [0], time: '08:00' }, now), israelToUtc(2026, 11, 22, 8, 0));
  // אותו יום, שעה שעברה -> שבוע הבא
  assert.equal(nextRun({ days: [2], time: '09:00' }, now), israelToUtc(2026, 11, 24, 9, 0));
  assert.equal(nextRun({ days: [], time: '09:00' }, now), null);
});

test('due once, even after missing several runs', () => {
  const createdAt = israelToUtc(2026, 11, 10, 12, 0);
  const s = { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], time: '02:00', createdAt };
  const now = israelToUtc(2026, 11, 17, 10, 0);
  assert.ok(isDue(s, now));
  assert.ok(!isDue({ ...s, lastRun: now }, now + 60_000));
  assert.ok(!isDue({ ...s, enabled: false }, now));
  assert.equal(nextOf([{ ...s, lastRun: now }, { ...s, time: '01:00', lastRun: now }], now), israelToUtc(2026, 11, 18, 1, 0));
});

test('clean schedule', () => {
  assert.deepEqual(cleanSchedule({ text: 'תבדוק מה חדש במאגר', days: [3, 1, 1, 9], time: '02:30' }), {
    title: 'תבדוק מה חדש במאגר', text: 'תבדוק מה חדש במאגר', days: [1, 3], time: '02:30', to: 'manager', budget: 2, enabled: true,
  });
  assert.equal(cleanSchedule({ text: 'משימה', days: [1], time: '24:00' }).error, 'שעה לא תקינה');
  assert.equal(cleanSchedule({ text: 'משימה', days: [], time: '02:00' }).error, 'צריך לבחור לפחות יום אחד');
  assert.equal(cleanSchedule({ text: 'משימה', days: [1], time: '02:00', to: 'librarian', budget: 5 }).to, 'librarian');
  assert.equal(cleanSchedule({ text: 'משימה', days: [1], time: '02:00', to: null }).to, null);
  assert.equal(cleanSchedule({ text: 'משימה', days: [1], time: '02:00', budget: 1000 }).budget, 2);
  // עדכון: מה שלא נשלח נשאר
  const old = { id: 'a', title: 'ישן', text: 'הטקסט הישן', days: [5], time: '06:00', to: 'creative', budget: 1, enabled: false, conv: 'c1' };
  assert.deepEqual(cleanSchedule({ time: '07:00' }, old), { ...old, time: '07:00' });
});

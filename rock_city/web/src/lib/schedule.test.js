import { describe, expect, test } from 'vitest';
import { addDays, addMonths, conflicts, dayOf, nextDates, occursOn, paymentStatus, roomDay, weekStart, whatsapp } from './schedule';

const lesson = (id, extra) => ({ id, teacherId: 't1', studentIds: ['s1'], roomId: 'r1', kind: 'weekly', day: 1, start: '16:00', minutes: 45, from: '', until: '', ...extra });

describe('dates', () => {
  test('week and months', () => {
    expect(dayOf('2026-10-12')).toBe(1);
    expect(weekStart('2026-10-14')).toBe('2026-10-11');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  test('weekly lessons respect from/until', () => {
    const l = lesson('a', { from: '2026-10-12', until: '2026-10-26' });
    expect(occursOn(l, '2026-10-05')).toBe(false);
    expect(occursOn(l, '2026-10-19')).toBe(true);
    expect(occursOn(l, '2026-10-20')).toBe(false);
    expect(nextDates(l, '2026-10-01')).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
  });
});

describe('conflicts', () => {
  test('same room at overlapping time', () => {
    const other = lesson('b', { teacherId: 't2', studentIds: ['s2'], start: '16:30' });
    const res = conflicts(lesson('a'), [other], { rooms: [{ id: 'r1', name: 'חדר 1' }], from: '2026-10-01' });
    expect(res).toHaveLength(1);
    expect(res[0].why[0]).toContain('חדר 1');
  });

  test('back to back is fine, other room is fine, cancelled is fine', () => {
    const next = lesson('b', { teacherId: 't2', studentIds: ['s2'], start: '16:45' });
    const room2 = lesson('c', { teacherId: 't2', studentIds: ['s2'], roomId: 'r2' });
    expect(conflicts(lesson('a'), [next, room2], { from: '2026-10-01' })).toHaveLength(0);
    const once = lesson('d', { kind: 'once', date: '2026-10-12', teacherId: 't2', studentIds: ['s2'], day: null });
    expect(conflicts(lesson('a'), [once], { from: '2026-10-01' })).toHaveLength(1);
    once.dates = { '2026-10-12': { status: 'cancelled' } };
    expect(conflicts(lesson('a'), [once], { from: '2026-10-01' })).toHaveLength(0);
  });

  test('same student in another room', () => {
    const res = conflicts(lesson('a'), [lesson('b', { teacherId: 't2', roomId: 'r2' })], { students: [{ id: 's1', first: 'דני' }], from: '2026-10-01' });
    expect(res[0].why).toEqual(['לדני יש שיעור אחר']);
  });
});

describe('payments', () => {
  const pays = [
    { id: 'p1', studentId: 's1', amount: 400, date: '2026-09-01', until: '2026-10-01' },
    { id: 'p2', studentId: 's1', amount: 400, date: '2026-10-01', until: '2026-11-01' },
  ];
  test('days left until next payment', () => {
    expect(paymentStatus('s1', pays, '2026-10-09')).toMatchObject({ state: 'ok', paidUntil: '2026-11-01', daysLeft: 23 });
    expect(paymentStatus('s1', pays, '2026-10-28').state).toBe('soon');
    expect(paymentStatus('s1', pays, '2026-11-05')).toMatchObject({ state: 'late', daysLeft: -4 });
    expect(paymentStatus('s2', pays).state).toBe('none');
  });
});

test('whatsapp links', () => {
  expect(whatsapp('050-123 4567')).toBe('https://wa.me/972501234567');
  expect(whatsapp('')).toBe('');
});

describe('room availability', () => {
  test('free windows around lessons, cancelled lessons free the room', () => {
    const ls = [lesson('a', { start: '16:00', minutes: 45 }), lesson('b', { start: '17:00', minutes: 60, roomId: 'r1' }), lesson('c', { roomId: 'r2', start: '10:00' })];
    const { busy, free } = roomDay(ls, 'r1', '2026-10-12', { from: '08:00', to: '20:00' });
    expect(busy).toHaveLength(2);
    expect(free).toEqual([
      { start: 480, end: 960 },
      { start: 1005, end: 1020 },
      { start: 1080, end: 1200 },
    ]);
    ls[0].dates = { '2026-10-12': { status: 'cancelled' } };
    expect(roomDay(ls, 'r1', '2026-10-12', { from: '08:00', to: '20:00' }).free[0]).toEqual({ start: 480, end: 1020 });
  });
});

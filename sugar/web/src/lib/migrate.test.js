import { describe, expect, test } from 'vitest';
import { basalMigration } from './migrate';
import { basalOn, prepare } from './diary';

const apply = (records) => {
  const map = new Map(records.map((r) => [r.id, r]));
  for (const c of basalMigration(records)) map.set(c.id, { ...map.get(c.id), ...c });
  return [...map.values()];
};

describe('המרת הערות "זריקה לילית" לזריקה לילית', () => {
  test('מדידה עם הערה – הופכת לזריקה לילית, עם היחידות שבה או מההערה', () => {
    const recs = [
      { id: 'r1', t: 'reading', date: '2026-11-10', time: '21:05', value: 150, insulin: 11, note: 'זריקה לילית' },
      { id: 'r2', t: 'reading', date: '2026-11-11', time: '21:00', value: 140, note: 'זריקה לילית 12 יחידות' },
      { id: 'r3', t: 'reading', date: '2026-11-12', time: '21:10', value: 130, note: 'לילית' },
      { id: 'r4', t: 'reading', date: '2026-11-12', time: '08:00', value: 100, note: 'בוקר בצום' },
    ];
    const data = prepare(apply(recs));
    expect(basalOn(data, '2026-11-10')).toMatchObject({ insulin: 11, value: 150, note: '' });
    expect(basalOn(data, '2026-11-11')).toMatchObject({ insulin: 12, value: 140 });
    expect(basalOn(data, '2026-11-12')).toMatchObject({ insulin: 11, id: 'r3' });
    expect(data.readings.find((r) => r.id === 'r4').basal).toBe(false);
  });

  test('ארוחה בשם "זריקה לילית" – נהפכת לזריקה ונמחקת; ארוחה עם הערה – נשארת ונוספת זריקה', () => {
    const recs = [
      { id: 'm1', t: 'meal', date: '2026-11-10', time: '21:00', name: 'זריקה לילית', insulin: 11, before: 160, site: 'legR' },
      { id: 'm2', t: 'meal', date: '2026-11-11', time: '19:30', name: 'ערב', insulin: 3, note: 'אחרי זה זריקה לילית 11' },
      { id: 'm3', t: 'meal', date: '2026-11-12', time: '13:00', name: 'צהריים' },
      { id: 'm4', t: 'meal', date: '2026-11-13', time: '22:00', name: 'ארוחה לילית', note: 'ארוחה לילית קטנה' },
    ];
    const once = apply(recs);
    const data = prepare(once);
    expect(data.meals.map((m) => m.id)).toEqual(['m2', 'm3', 'm4']);
    expect(basalOn(data, '2026-11-13')).toBeNull();
    expect(basalOn(data, '2026-11-10')).toMatchObject({ id: 'b-from-m1', insulin: 11, value: 160, site: 'legR', time: '21:00' });
    expect(basalOn(data, '2026-11-11')).toMatchObject({ id: 'b-from-m2', insulin: 11 });
    // הרצה שנייה – כלום לא משתנה
    expect(basalMigration(once)).toEqual([]);
  });

  test('יום שכבר יש בו זריקה לילית – לא מוסיפים', () => {
    const recs = [
      { id: 'b', t: 'reading', basal: true, date: '2026-11-10', time: '21:00', insulin: 11, value: '' },
      { id: 'r', t: 'reading', date: '2026-11-10', time: '21:02', value: 150, note: 'זריקה לילית' },
    ];
    expect(basalMigration(recs)).toEqual([]);
  });
});

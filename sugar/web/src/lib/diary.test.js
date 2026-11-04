import { describe, expect, test } from 'vitest';
import { addDays, aiContext, allPoints, level, mealFromTemplate, minutesAfter, missingFixed, outcome, pattern, patternsByMeal, prepare, safeMeal, similarMeals, stats, suggestByRatio, toCsv, waitingForCheck } from './diary';

const BASE = '2026-11-04'; // יום רביעי
const tpl = { id: 'tl', t: 'template', name: 'צהריים בבית', slot: 'lunch', time: '13:30', food: 'אורז ועוף', portion: 1, days: [] };
const tplSun = { id: 'ts', t: 'template', name: 'פיצה של ראשון', slot: 'dinner', time: '19:00', days: [0] };

function meal(date, insulin, before, readings, extra = {}) {
  return { id: `m${date}${extra.time || ''}`, t: 'meal', date, time: '13:30', templateId: 'tl', name: 'צהריים בבית', portion: 2, insulin, before, readings, ...extra };
}

const records = [
  { id: 'settings', t: 'settings', low: 70, high: 180, icr: 15, cf: 50, target: 120 },
  tpl,
  tplSun,
  meal('2026-11-02', 4, 120, [{ time: '15:30', value: 260 }, { time: '17:30', value: 190 }]),
  meal('2026-11-03', 5, 110, [{ time: '15:20', value: 150 }]),
  meal(BASE, 6, 100, [{ time: '15:30', value: 60 }]),
  { id: 'r1', t: 'reading', date: BASE, time: '03:00', value: 95 },
  { id: 'gone', t: 'meal', date: BASE, deleted: true },
];

describe('יומן סוכר', () => {
  test('רשומה ישנה בלי שדות מקבלת ברירות מחדל', () => {
    const m = safeMeal({ id: 'x', t: 'meal', date: BASE });
    expect(m).toMatchObject({ portion: 1, before: '', insulin: '', readings: [], tags: [], slot: 'other' });
    expect(safeMeal({ id: 'y', t: 'meal', insulin: '1,5', readings: [{ time: '9:00', value: 1 }, { time: '10:00', value: '130' }] })).toMatchObject({ insulin: 1.5, readings: [{ time: '10:00', value: 130 }] });
  });

  test('הכנה: מחוקים בחוץ, הגדרות עם ברירת מחדל', () => {
    const data = prepare(records);
    expect(data.meals).toHaveLength(3);
    expect(data.settings.low).toBe(70);
    expect(prepare([]).settings).toMatchObject({ low: 70, high: 180, icr: '' });
  });

  test('רמות סוכר', () => {
    const s = prepare([]).settings;
    expect(level(60, s)).toBe('low');
    expect(level(120, s)).toBe('ok');
    expect(level(200, s)).toBe('high');
    expect(level(300, s)).toBe('veryHigh');
    expect(level('', s)).toBe('');
  });

  test('מדידה אחרי חצות שייכת לארוחת הערב של אתמול', () => {
    expect(minutesAfter('20:00', '01:00')).toBe(300);
    expect(minutesAfter('13:00', '12:30')).toBe(-30);
  });

  test('מה קרה אחרי הארוחה: שעתיים, שיא ושינוי', () => {
    const data = prepare(records);
    const o = outcome(data.meals[0]);
    expect(o.after2h).toBe(260);
    expect(o.peak).toBe(260);
    expect(o.lowest).toBe(190);
    expect(o.rise).toBe(140);
  });

  test('דפוס לארוחה: ממוצעים, בטווח, נפילות ומה עבד', () => {
    const data = prepare(records);
    const p = pattern(data, data.meals);
    expect(p).toMatchObject({ count: 3, measured: 3, inRange: 1, lows: 1, dose: 5, dosePerPortion: 2.5 });
    expect(p.good.map((m) => m.insulin)).toEqual([5]);
    const all = patternsByMeal(data, 30, BASE);
    expect(all[0]).toMatchObject({ name: 'צהריים בבית', count: 3 });
  });

  test('ארוחות קודמות מאותו סוג', () => {
    const data = prepare(records);
    const last = data.meals[2];
    expect(similarMeals(data, last).map((m) => m.date)).toEqual(['2026-11-03', '2026-11-02']);
  });

  test('התפריט הקבוע: רק מה שמתאים ליום ועוד לא נוסף', () => {
    const data = prepare(records);
    expect(missingFixed(data, BASE)).toHaveLength(0);
    const sunday = '2026-11-08';
    expect(missingFixed(data, sunday).map((t) => t.id)).toEqual(['tl', 'ts']);
    expect(mealFromTemplate(data.templates[0], sunday)).toMatchObject({ date: sunday, templateId: 'tl', name: 'צהריים בבית', time: '13:30' });
  });

  test('סטטיסטיקה ונקודות לגרף', () => {
    const data = prepare(records);
    expect(allPoints(data, BASE, BASE)).toHaveLength(3);
    const st = stats(data, 7, BASE);
    expect(st.count).toBe(8);
    expect(st.low).toBe(1);
    expect(st.high).toBe(2);
    expect(st.gmi).toBeGreaterThan(5);
  });

  test('חישוב לפי יחס פחמימות ופקטור תיקון', () => {
    const s = prepare(records).settings;
    expect(suggestByRatio(s, 45, 220)).toEqual({ food: 3, correction: 2, total: 5 });
    expect(suggestByRatio(s, 45, 100)).toEqual({ food: 3, correction: 0, total: 3 });
    expect(suggestByRatio(prepare([]).settings, 45, 100)).toBeNull();
  });

  test('תזכורת למדידה שעתיים אחרי', () => {
    const data = prepare([...records, { id: 'mx', t: 'meal', date: BASE, time: '18:00', insulin: 3 }]);
    expect(waitingForCheck(data, BASE, '20:10').map((m) => m.id)).toEqual(['mx']);
    expect(waitingForCheck(data, BASE, '19:00')).toHaveLength(0);
  });

  test('סיכום ל-AI וייצוא', () => {
    const data = prepare(records);
    const ctx = aiContext(data, BASE);
    expect(ctx).toMatch(/טווח יעד 70-180/);
    expect(ctx).toMatch(/צהריים בבית: 3 פעמים/);
    expect(ctx).toMatch(/15:30=60/);
    expect(ctx).toMatch(/03:00 \| מדידה 95/);
    expect(toCsv(data).split('\n')).toHaveLength(5);
    expect(addDays(BASE, 1)).toBe('2026-11-05');
  });
});

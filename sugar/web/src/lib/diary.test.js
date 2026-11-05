import { describe, expect, test } from 'vitest';
import { templateFromMeal, lastSite, DEFAULT_FOODS, calcDose, insights, itemsCarbs, monthDays, addDays, aiContext, allPoints, level, mealFromTemplate, minutesAfter, missingFixed, outcome, pattern, patternsByMeal, prepare, safeMeal, similarMeals, stats, suggestByRatio, toCsv, waitingForCheck } from './diary';

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
    expect(prepare([]).settings).toMatchObject({ low: 70, high: 110, icr: 15 });
    expect(prepare([{ id: 'settings', t: 'settings', icr: '' }]).settings.icr).toBe('');
  });

  test('רמות סוכר', () => {
    const s = prepare([{ id: 'settings', t: 'settings', high: 180 }]).settings;
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
    expect(suggestByRatio(prepare([{ id: 'settings', t: 'settings', icr: '' }]).settings, 45, 100)).toBeNull();
  });

  test('תזכורת למדידה שעתיים אחרי', () => {
    const data = prepare([...records, { id: 'mx', t: 'meal', date: BASE, time: '18:00', insulin: 3 }]);
    expect(waitingForCheck(data, BASE, '20:10').map((m) => m.id)).toEqual(['mx']);
    expect(waitingForCheck(data, BASE, '19:00')).toHaveLength(0);
  });

  test('סיכום ל-AI וייצוא', () => {
    const data = prepare(records);
    const ctx = aiContext(data, BASE);
    expect(ctx).toMatch(/טווח תקין לפני ארוחה 70-180/);
    expect(ctx).toMatch(/פתיתים \(כוס חד פעמית\) = 40/);
    expect(ctx).toMatch(/צהריים בבית: 3 פעמים/);
    expect(ctx).toMatch(/15:30=60/);
    expect(ctx).toMatch(/03:00 \| מדידה 95/);
    expect(toCsv(data).split('\n')).toHaveLength(5);
    expect(addDays(BASE, 1)).toBe('2026-11-05');
  });

  test('מחשבון: 15 גרם ליחידה, תיקון רק עם פקטור, אזהרה בנמוך', () => {
    const s = prepare([]).settings; // 70-110, יחס 15, בלי פקטור תיקון
    expect(calcDose(s, 45, 100)).toMatchObject({ food: 3, correction: 0, total: 3, rounded: 3, status: 'ok' });
    expect(calcDose(s, 40, 200)).toMatchObject({ food: 2.7, rounded: 2.5, status: 'high', needsCf: true, correction: 0 });
    expect(calcDose(s, 30, 60)).toMatchObject({ total: 2, status: 'low' });
    const withCf = prepare([{ id: 'settings', t: 'settings', cf: 50 }]).settings;
    // תיקון עד הגבול העליון (110): (210-110)/50 = 2
    expect(calcDose(withCf, 30, 210)).toMatchObject({ food: 2, correction: 2, total: 4, target: 110 });
    expect(calcDose(s, '', 100)).toBeNull();
  });

  test('טבלת הפחמימות: מובנית, עריכה ומחיקה, ופריט חדש', () => {
    expect(prepare([]).foods.find((f) => f.name === 'פתיתים').carbs).toBe(40);
    const foods = prepare([
      { id: 'food:rice', t: 'food', name: 'אורז', unit: 'כוס חד פעמית', carbs: 35 },
      { id: 'food:shawarma', t: 'food', deleted: true },
      { id: 'fx1', t: 'food', name: 'פיתה', unit: 'יחידה', carbs: 45 },
    ]).foods;
    expect(foods.find((f) => f.id === 'food:rice').carbs).toBe(35);
    expect(foods.some((f) => f.id === 'food:shawarma')).toBe(false);
    expect(foods.at(-1).name).toBe('פיתה');
    expect(foods).toHaveLength(DEFAULT_FOODS.length);
    expect(itemsCarbs([{ qty: 1.5, carbs: 30 }, { qty: 1, carbs: 40 }, { qty: 2, carbs: 0 }])).toBe(85);
  });

  test('תובנות אוטומטיות מהנתונים', () => {
    const list = [];
    for (let i = 1; i <= 4; i++) list.push({ id: `l${i}`, t: 'meal', date: addDays(BASE, -i), time: '13:00', templateId: 'tl', name: 'צהריים בבית', insulin: 2, carbs: 30, before: 100, readings: [{ time: '15:00', value: 250 }] });
    for (let i = 1; i <= 3; i++) list.push({ id: `b${i}`, t: 'meal', date: addDays(BASE, -i), time: '07:30', name: 'בוקר', insulin: 2, carbs: 30, before: 90, readings: [{ time: '09:30', value: 100 }] });
    const out = insights(prepare([tpl, ...list]), 30, BASE);
    expect(out[0]).toMatchObject({ kind: 'high' });
    expect(out[0].text).toMatch(/צהריים בבית.*4 מתוך 4/);
    expect(out.some((x) => x.kind === 'good' && /בוקר/.test(x.text))).toBe(true);
    expect(insights(prepare([]), 30, BASE)).toEqual([]);
  });

  test('לוח שנה: ממוצע ונמוכים לכל יום', () => {
    const cal = monthDays(prepare(records), '2026-11');
    expect(cal.days).toHaveLength(30);
    expect(cal.offset).toBe(0); // 1.11.2026 יום ראשון
    expect(cal.days[3]).toMatchObject({ date: BASE, count: 3, low: 1, meals: 1 });
  });

  test('מיקום הזריקה: ברירת מחדל ריקה, והמיקום הקודם', () => {
    expect(safeMeal({ id: 'a', t: 'meal' }).site).toBe('');
    expect(safeMeal({ id: 'a', t: 'meal', site: 'xx' }).site).toBe('');
    const data = prepare([
      { id: 'a', t: 'meal', date: '2026-11-03', time: '13:00', site: 'armR' },
      { id: 'b', t: 'meal', date: '2026-11-04', time: '08:00', site: 'bellyL' },
      { id: 'c', t: 'meal', date: '2026-11-04', time: '13:00' },
    ]);
    expect(lastSite(data, data.meals[2])).toBe('bellyL');
    expect(lastSite(data, data.meals[1])).toBe('armR');
    expect(toCsv(data)).toMatch(/בטן שמאל/);
  });

  test('ארוחה שנרשמה → ארוחה קבועה', () => {
    const m = safeMeal({ id: 'a', t: 'meal', name: 'פסטה', slot: 'lunch', time: '13:15', food: 'פסטה ועוף', portion: '1.5', carbs: '45', insulin: '3' });
    expect(templateFromMeal(m)).toEqual({ t: 'template', name: 'פסטה', slot: 'lunch', time: '13:15', food: 'פסטה ועוף', portion: 1.5, carbs: 45, dose: 3, days: [] });
  });

  test('שני טווחים: לפני ארוחה (70-110) ולאורך היום (עד 180)', () => {
    const s = prepare([]).settings;
    expect(s).toMatchObject({ low: 70, high: 110, dayHigh: 180 });
    expect(level(150, s)).toBe('ok');
    expect(level(150, s, true)).toBe('high');
    expect(level(60, s)).toBe('low');
    expect(prepare([{ id: 'settings', t: 'settings', dayHigh: 160 }]).settings.dayHigh).toBe(160);
  });
});

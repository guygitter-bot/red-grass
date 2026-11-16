import { describe, expect, test } from 'vitest';
import { buckets, buildReport, daysBetween, reportText } from './report';
import { addDays, prepare } from './diary';

// שבועיים מומצאים: בשבוע הקודם סוכר גבוה, בשבוע האחרון טוב יותר
function sample() {
  const recs = [];
  for (let i = 0; i < 14; i++) {
    const date = addDays('2026-11-15', -i);
    const recent = i < 7;
    recs.push({ id: `m${i}`, t: 'meal', date, time: '13:00', name: 'צהריים', insulin: 4, carbs: 60, before: recent ? 100 : 150, readings: [{ time: '15:00', value: recent ? 150 : 240 }] });
    recs.push({ id: `r${i}`, t: 'reading', date, time: '07:00', value: recent ? 95 : 60, insulin: i === 0 ? 1 : '' });
  }
  return prepare(recs);
}

describe('דוח לתקופה', () => {
  test('ימים וקבוצות זמן', () => {
    expect(daysBetween('2026-11-09', '2026-11-15')).toBe(7);
    expect(buckets('2026-11-09', '2026-11-15')).toMatchObject({ unit: 'day' });
    expect(buckets('2026-11-09', '2026-11-15').list).toHaveLength(7);
    expect(buckets('2026-08-18', '2026-11-15')).toMatchObject({ unit: 'week' });
    const year = buckets('2025-11-16', '2026-11-15');
    expect(year.unit).toBe('month');
    expect(year.list[0]).toMatchObject({ from: '2025-11-16', to: '2025-11-30' });
    expect(year.list.at(-1)).toMatchObject({ from: '2026-11-01', to: '2026-11-15' });
  });

  test('מדדים, השוואה לתקופה הקודמת ומסקנות', () => {
    const r = buildReport(sample(), '2026-11-09', '2026-11-15');
    expect(r.days).toBe(7);
    expect(r.prev).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(r.kpis.count).toBe(21);
    expect(r.kpis.inRange).toBe(100);
    expect(r.prevKpis.lowPct).toBeGreaterThan(0);
    expect(r.changes.inRange.better).toBe(true);
    expect(r.changes.mean.better).toBe(true);
    expect(r.kpis.insulinPerDay).toBeCloseTo(4.1, 1);
    expect(r.trend).toHaveLength(7);
    expect(r.trend[6]).toMatchObject({ count: 3, ok: 100, insulin: 5 });
    expect(r.findings.some((f) => /הזמן בטווח .*עלה/.test(f.text))).toBe(true);
    expect(r.meals[0]).toMatchObject({ name: 'צהריים', count: 7 });
    expect(reportText(r)).toMatch(/בטווח 100%/);
  });

  test('תקופה בלי נתונים לא נופלת', () => {
    const r = buildReport(prepare([]), '2026-01-01', '2026-01-31');
    expect(r.kpis.count).toBe(0);
    expect(r.findings).toEqual([]);
    expect(r.trend).toHaveLength(31);
  });
});

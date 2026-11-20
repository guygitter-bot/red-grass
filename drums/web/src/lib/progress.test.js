import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/rudiments';
import { dayKey, MIN_SECONDS, prevDay, recordRun, safeProgress, starsFor, streakOf, suggestNext, totalMinutes, totalStars } from './progress';

describe('כוכבים', () => {
  it('60 / 80 / 95 במהירות מלאה', () => {
    expect([0, 59, 60, 79, 80, 94, 95, 100].map((s) => starsFor(s, 1))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('במהירות איטית – עד שני כוכבים', () => {
    expect(starsFor(100, 0.75)).toBe(2);
    expect(starsFor(100, 0.5)).toBe(2);
    expect(starsFor(85, 0.5)).toBe(2);
    expect(starsFor(65, 0.5)).toBe(1);
  });
  it('קלט לא תקין = 0', () => {
    expect(starsFor(undefined)).toBe(0);
    expect(starsFor(NaN)).toBe(0);
  });
});

describe('תאריכים ורצף', () => {
  it('dayKey לפי תאריך מקומי עם אפסים', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
  it('prevDay חוצה חודש, שנה ושנה מעוברת, בלי תלות בשעון קיץ', () => {
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2028-03-01')).toBe('2028-02-29');
    expect(prevDay('2026-01-01')).toBe('2025-12-31');
    expect(prevDay('2026-03-29')).toBe('2026-03-28'); // יום מעבר שעון קיץ באירופה / ישראל
    expect(prevDay('2026-10-25')).toBe('2026-10-24');
  });
  it('רצף: ימים רצופים, פער שובר, והיום עוד פתוח', () => {
    const days = { '2026-05-10': 60, '2026-05-09': 30, '2026-05-08': 90, '2026-05-05': 60 };
    expect(streakOf(days, '2026-05-10')).toBe(3);
    expect(streakOf(days, '2026-05-11')).toBe(3); // היום עוד לא תרגלו – הרצף מחכה
    expect(streakOf(days, '2026-05-12')).toBe(0); // יום שלם בלי תרגול – נשבר
    expect(streakOf({ '2026-05-05': 60 }, '2026-05-05')).toBe(1);
    expect(streakOf({}, '2026-05-05')).toBe(0);
  });
  it('רצף על פני גבול חודש ושנה', () => {
    const days = { '2026-01-01': 10, '2025-12-31': 10, '2025-12-30': 10 };
    expect(streakOf(days, '2026-01-01')).toBe(3);
  });
  it('ימים עם 0 שניות לא נספרים', () => {
    expect(streakOf({ '2026-05-10': 0, '2026-05-09': 50 }, '2026-05-10')).toBe(1);
  });
});

describe('נרמול והקלטה', () => {
  it('נתונים חסרים / שבורים / ישנים לא שוברים', () => {
    for (const bad of [null, undefined, 5, 'x', [], { items: 3, days: 'a' }, { items: { a: null, b: { best: 'x', stars: 9 } }, days: { bad: 5, '2026-01-01': -4 } }]) {
      const p = safeProgress(bad);
      expect(p.v).toBe(1);
      expect(typeof p.items).toBe('object');
      expect(totalMinutes(p)).toBeGreaterThanOrEqual(0);
    }
    const p = safeProgress({ items: { b: { best: 'x', stars: 9, bestBpm: 9999, last: 'oops' } }, days: { bad: 5, '2026-01-01': -4 } });
    expect(p.items.b).toEqual({ best: 0, stars: 3, runs: 0, bestBpm: 400, last: '' });
    expect(p.days).toEqual({ '2026-01-01': 0 });
  });
  it('ריצה נרשמת: שיא, כוכבים, דקות, והכוכבים לא יורדים', () => {
    const now = new Date(2026, 4, 10, 12);
    let r = recordRun(null, { key: 'ex:single8', score: 92, speed: 1, seconds: 120, bpm: 70 }, now);
    expect(r.counted).toBe(true);
    expect(r.stars).toBe(2);
    expect(r.newBest).toBe(true);
    expect(r.gained).toBe(true);
    expect(r.progress.items['ex:single8']).toMatchObject({ best: 92, stars: 2, runs: 1, bestBpm: 70, last: '2026-05-10' });
    r = recordRun(r.progress, { key: 'ex:single8', score: 50, speed: 1, seconds: 60, bpm: 80 }, now);
    expect(r.progress.items['ex:single8']).toMatchObject({ best: 92, stars: 2, runs: 2, bestBpm: 70 }); // ציון נמוך לא מעלה BPM
    expect(r.newBest).toBe(false);
    expect(totalMinutes(r.progress)).toBe(3);
    expect(r.progress.days['2026-05-10']).toBe(180);
    expect(totalStars(r.progress)).toBe(2);
  });
  it('תרגול קצר מדי או בלי מפתח לא נספר', () => {
    const r = recordRun(null, { key: 'ex:a', score: 100, seconds: MIN_SECONDS - 1 });
    expect(r.counted).toBe(false);
    expect(r.progress.items).toEqual({});
    expect(recordRun(null, { score: 100, seconds: 60 }).counted).toBe(false);
  });
  it('שיר במהירות איטית לא נותן שלושה כוכבים', () => {
    const r = recordRun(null, { key: 'song:abc:main', score: 100, speed: 0.5, seconds: 30 });
    expect(r.stars).toBe(2);
  });
});

describe('ההצעה הבאה', () => {
  const none = safeProgress(null);
  it('מתחיל מהתרגיל הראשון, ומתקדם לפי הסדר', () => {
    expect(suggestNext(none, EXERCISES)).toMatchObject({ id: EXERCISES[0].id, reason: 'new' });
    let p = none;
    p = recordRun(p, { key: `ex:${EXERCISES[0].id}`, score: 85, seconds: 30 }).progress;
    expect(suggestNext(p, EXERCISES).id).toBe(EXERCISES[1].id);
    p = recordRun(p, { key: `ex:${EXERCISES[1].id}`, score: 65, seconds: 30 }).progress;
    expect(suggestNext(p, EXERCISES)).toMatchObject({ id: EXERCISES[1].id, reason: 'again' });
  });
  it('אחרי שכולם בשני כוכבים – מלטשים לשלישי; כולם שלושה = null', () => {
    let p = none;
    for (const e of EXERCISES) p = recordRun(p, { key: `ex:${e.id}`, score: 85, seconds: 30 }).progress;
    expect(suggestNext(p, EXERCISES)).toMatchObject({ id: EXERCISES[0].id, reason: 'polish' });
    for (const e of EXERCISES) p = recordRun(p, { key: `ex:${e.id}`, score: 99, speed: 1, seconds: 30 }).progress;
    expect(suggestNext(p, EXERCISES)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  barSeconds, candidatesAround, cueAt, fitPiece, fitSection, gradeHit, hitsAt, loopSeconds, matchHit,
  phaseFromTaps, rowsFor, scheduleFor, scorePercent, wrap,
} from './lesson';

const s16 = { id: 'm', steps: 16, bars: 1, hits: { kick: [0, 8], snare: [4, 12], hihat: [0, 2, 4, 6, 8, 10, 12, 14] } };
const s12 = { id: 'm', steps: 12, bars: 1, hits: { kick: [0], snare: [3, 9], hihat: [0, 2, 3, 5, 6, 8, 9, 11] } };

describe('לוח זמנים', () => {
  it('16 צעדים ב-120 בפעם: תיבה = 2 שניות, צעד = 125ms', () => {
    expect(barSeconds(120)).toBeCloseTo(2, 6);
    const ev = scheduleFor(s16, 120, 1);
    expect(ev[0]).toEqual({ index: 0, time: 0, pieces: ['kick', 'hihat'] });
    const snare = ev.find((e) => e.pieces.includes('snare'));
    expect(snare.time).toBeCloseTo(0.5, 6); // פעמה 2
    expect(ev.at(-1).time).toBeCloseTo(1.75, 6);
  });
  it('12 צעדים: הסנר בפעמות 2 ו-4', () => {
    const ev = scheduleFor(s12, 120, 1);
    const times = ev.filter((e) => e.pieces.includes('snare')).map((e) => e.time);
    expect(times[0]).toBeCloseTo(0.5, 6);
    expect(times[1]).toBeCloseTo(1.5, 6);
  });
  it('50% מכפיל את הזמנים פי 2', () => {
    const a = scheduleFor(s16, 100, 1);
    const b = scheduleFor(s16, 100, 0.5);
    a.forEach((e, i) => expect(b[i].time).toBeCloseTo(e.time * 2, 9));
    expect(loopSeconds(s16, 100, 0.5)).toBeCloseTo(2 * loopSeconds(s16, 100, 1), 9);
  });
  it('שתי תיבות: הזמנים ממשיכים', () => {
    const two = { steps: 16, bars: 2, hits: { kick: [0, 16] } };
    const ev = scheduleFor(two, 120, 1);
    expect(ev[1].time).toBeCloseTo(2, 6);
    expect(loopSeconds(two, 120, 1)).toBeCloseTo(4, 6);
  });
  it('hitsAt', () => {
    expect(hitsAt(s16, 0).sort()).toEqual(['hihat', 'kick']);
    expect(hitsAt(s16, 1)).toEqual([]);
  });
});

describe('דירוג', () => {
  const ev = [{ time: 1, pieces: ['snare'] }, { time: 2, pieces: ['kick', 'hihat'] }];
  it('מושלם עד 50ms, טוב עד 120ms, אחרת פספוס', () => {
    expect(gradeHit('snare', 1.03, ev)).toBe('perfect');
    expect(gradeHit('snare', 0.96, ev)).toBe('perfect');
    expect(gradeHit('snare', 1.1, ev)).toBe('good');
    expect(gradeHit('snare', 1.119, ev)).toBe('good');
    expect(gradeHit('snare', 1.2, ev)).toBe('miss');
  });
  it('חלק שלא מצפים לו = פספוס', () => {
    expect(gradeHit('tom1', 1, ev)).toBe('miss');
    expect(gradeHit('kick', 1, ev)).toBe('miss');
    expect(matchHit('kick', 2.01, ev).delta).toBeCloseTo(0.01, 6);
  });
  it('לולאה: מועמדים מהמעבר הקודם והבא', () => {
    const cands = candidatesAround(ev, 2, 3.9, true);
    expect(cands.some((c) => Math.abs(c.time - 4) < 1e-9)).toBe(true);
    expect(candidatesAround(ev, 2, 3.9, false).every((c) => c.time < 4)).toBe(true);
  });
});

describe('הדגשה', () => {
  const ev = scheduleFor(s16, 120, 1);
  it('now סביב המכה ו-soon למכה הבאה', () => {
    const c = cueAt(ev, 2, 0.51, 1);
    expect(c.now.has('snare')).toBe(true);
    expect(c.soon.has('hihat')).toBe(true);
  });
  it('עוטף את הלולאה', () => {
    const c = cueAt(ev, 2, 1.98, 1);
    expect(c.now.has('kick')).toBe(true); // המכה בתחילת המעבר הבא קרובה מאוד
  });
});

describe('ציון', () => {
  it('חישוב אחוזים', () => {
    expect(scorePercent({})).toBe(0);
    expect(scorePercent({ perfect: 10 })).toBe(100);
    expect(scorePercent({ perfect: 5, good: 5 })).toBe(80);
    expect(scorePercent({ perfect: 1, missed: 1 })).toBe(50);
  });
});

describe('סנכרון לפי הקשות', () => {
  const bpm = 120; // פעמה = 0.5 שנ'
  it('הקשות בכל פעמה: מוצא את ההיסט', () => {
    const taps = [0.13, 0.63, 1.13, 1.63, 2.13];
    const r = phaseFromTaps(taps, bpm);
    expect(r.ok).toBe(true);
    expect(r.phase).toBeCloseTo(0.13, 2);
    expect(r.unit).toBeCloseTo(0.5, 6);
  });
  it('הקשות בראש כל תיבה (4 פעמות)', () => {
    const r = phaseFromTaps([10.3, 12.3, 14.3, 16.3], bpm);
    expect(r.ok).toBe(true);
    expect(r.unit).toBeCloseTo(2, 6);
    expect(r.phase).toBeCloseTo(0.3, 2);
  });
  it('סטייה קטנה בהקשות מתמצעת', () => {
    const r = phaseFromTaps([0.2, 0.72, 1.19, 1.73, 2.2], bpm);
    expect(r.ok).toBe(true);
    expect(r.phase).toBeCloseTo(0.21, 1);
  });
  it('הקשות סביב אפס לא מתבטלות', () => {
    const r = phaseFromTaps([0.49, 1.0, 1.51, 2.0], bpm);
    expect(r.ok).toBe(true);
    const d = Math.min(r.phase, 0.5 - r.phase);
    expect(d).toBeLessThan(0.02);
  });
  it('קצב שונה בהרבה – לא מתקבל', () => {
    expect(phaseFromTaps([0, 0.3, 0.6, 0.9, 1.2], bpm)).toMatchObject({ ok: false, reason: 'tempo' });
  });
  it('מעט הקשות או הקשות מפוזרות', () => {
    expect(phaseFromTaps([0, 0.5, 1], bpm).reason).toBe('few');
    expect(phaseFromTaps([0, 0.5, 0.75, 1.0, 1.5, 1.75, 2.0], bpm).ok).toBe(false);
  });
  it('wrap', () => {
    expect(wrap(-0.1, 2)).toBeCloseTo(1.9, 9);
    expect(wrap(4.5, 2)).toBeCloseTo(0.5, 9);
  });
});

describe('התאמה לסט אישי', () => {
  const small = ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'floor1', 'crash1', 'ride'];
  it('חלק קיים נשאר', () => {
    expect(fitPiece('snare', small)).toBe('snare');
  });
  it('טומים לטום הקרוב, רצפה לרצפה', () => {
    expect(fitPiece('tom3', small)).toBe('tom1');
    expect(fitPiece('floor2', small)).toBe('floor1');
    expect(fitPiece('tom2', ['kick', 'snare', 'hihat', 'floor1'])).toBe('floor1');
  });
  it('רייד וצ׳יינה וקראש 2', () => {
    expect(fitPiece('ride', ['kick', 'snare', 'hihat'])).toBe('hihat');
    expect(fitPiece('china', small)).toBe('crash1');
    expect(fitPiece('crash2', small)).toBe('crash1');
    expect(fitPiece('kick2', small)).toBe('kick');
    expect(fitPiece('cowbell', small)).toBe('ride');
  });
  it('fitSection ממזג מכות ומחזיר הודעות', () => {
    const sec = { id: 'x', steps: 16, bars: 1, hits: { tom1: [0], tom2: [4], snare: [8] } };
    const r = fitSection(sec, ['kick', 'snare', 'hihat', 'tom1']);
    expect(r.section.hits.tom1).toEqual([0, 4]);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toContain('טום 2');
    expect(fitSection(sec, ['kick', 'snare', 'hihat', 'tom1', 'tom2']).notes).toEqual([]);
  });
  it('שורות ציר הזמן בסדר קבוע', () => {
    expect(rowsFor(s16)).toEqual(['hihat', 'snare', 'kick']);
  });
});

describe('ידיים בתרגילי טכניקה', () => {
  const ex = { id: 'e', steps: 16, bars: 1, hits: { snare: [0, 4], kick: [4] }, hands: { snare: { 0: 'R', 4: 'L' } }, soft: { snare: [4] } };
  it('לוח הזמנים מוסיף ידיים רק כשהן מוגדרות', () => {
    const ev = scheduleFor(ex, 120, 1);
    expect(ev[0].hands).toEqual({ snare: 'R' });
    expect(ev[1].hands).toEqual({ snare: 'L' }); // הבס בלי יד
    expect(scheduleFor(s16, 120, 1)[0].hands).toBeUndefined();
  });
  it('ההדגשה מחזירה את היד של החלק שמכים עכשיו', () => {
    const ev = scheduleFor(ex, 120, 1);
    const c = cueAt(ev, 2, 0.5);
    expect([...c.now].sort()).toEqual(['kick', 'snare']);
    expect(c.hands).toEqual({ snare: 'L' });
    const soon = cueAt(ev, 2, 0.3, 1);
    expect(soon.hands).toEqual({ snare: 'L' }); // הבא בתור
  });
  it('התאמה לסט: הידיים והשקט עוברים עם החלק שהוחלף', () => {
    const e2 = { ...ex, hits: { tom3: [0, 4] }, hands: { tom3: { 0: 'R', 4: 'L' } }, soft: { tom3: [4] } };
    const fit = fitSection(e2, ['kick', 'snare', 'hihat', 'tom1']);
    expect(fit.section.hits).toEqual({ tom1: [0, 4] });
    expect(fit.section.hands).toEqual({ tom1: { 0: 'R', 4: 'L' } });
    expect(fit.section.soft).toEqual({ tom1: [4] });
  });
});

import { describe, expect, it } from 'vitest';
import { contactSignal, createVelocity, MIN_VEL, pressureSignal } from './velocity';

const fixed = (x) => () => x;
const touch = (pressure, size = 0) => ({ pointerType: 'touch', pressure, width: size, height: size });

describe('עוצמת מכה', () => {
  it('לחץ ברירת מחדל (0 / 0.5) ועכבר – לא נחשבים', () => {
    expect(pressureSignal(touch(0))).toBeNull();
    expect(pressureSignal(touch(0.5))).toBeNull();
    expect(pressureSignal({ pointerType: 'mouse', pressure: 0.7 })).toBeNull();
    expect(pressureSignal(touch(0.8))).toBe(0.8);
    expect(contactSignal({ pointerType: 'mouse', width: 1, height: 1 })).toBeNull();
    expect(contactSignal(touch(0, 12))).toBe(0);
    expect(contactSignal(touch(0, 48))).toBe(1);
  });
  it('לחץ אמיתי: חזק יותר = עוצמה גבוהה יותר', () => {
    const v = createVelocity(fixed(0.5));
    const soft = v.estimate(touch(0.2), 'snare', 'center');
    const hard = v.estimate(touch(0.9), 'snare', 'center');
    expect(hard).toBeGreaterThan(soft);
    expect(soft).toBeGreaterThanOrEqual(MIN_VEL);
    expect(hard).toBeLessThanOrEqual(1);
  });
  it('לחץ קבוע (המסך לא מדווח באמת) מתעלמים ממנו אחרי כמה מכות', () => {
    const v = createVelocity(fixed(0.5));
    const out = [];
    for (let i = 0; i < 6; i++) out.push(v.estimate(touch(1), 'snare', 'center'));
    // אחרי שהאיתות הוכח כקבוע – חוזרים לעוצמה בינונית־חזקה אנושית, לא מקסימום קבוע
    expect(out.at(-1)).toBeCloseTo(0.72, 2);
  });
  it('בלי לחץ אבל עם גודל מגע – הגודל קובע', () => {
    const v = createVelocity(fixed(0.5));
    const light = v.estimate(touch(0, 14), 'tom', 'center');
    const heavy = v.estimate(touch(0, 46), 'tom', 'center');
    expect(heavy).toBeGreaterThan(light);
  });
  it('בלי שום איתות: סביב בינוני־חזק עם אנושיות; אזור מזיז את העוצמה', () => {
    const lo = createVelocity(fixed(0)).estimate({ pointerType: 'mouse' }, 'snare', 'center');
    const hi = createVelocity(fixed(1)).estimate({ pointerType: 'mouse' }, 'snare', 'center');
    expect(lo).toBeGreaterThan(0.6);
    expect(hi).toBeLessThan(0.85);
    expect(hi).toBeGreaterThan(lo);
    const v = createVelocity(fixed(0.5));
    expect(v.estimate({ pointerType: 'mouse' }, 'snare', 'rim')).toBeGreaterThan(v.estimate({ pointerType: 'mouse' }, 'snare', 'edge'));
  });
  it('מקלדת: בינוני־חזק, ותמיד בטווח', () => {
    for (const r of [0, 0.5, 1]) {
      const x = createVelocity(fixed(r)).estimate({ key: true }, 'snare', 'center');
      expect(x).toBeGreaterThanOrEqual(0.7);
      expect(x).toBeLessThanOrEqual(0.92);
    }
  });
  it('בלי מידע בכלל (undefined) לא קורס', () => {
    const x = createVelocity(fixed(0.5)).estimate(undefined, 'kick', 'center');
    expect(x).toBeGreaterThanOrEqual(MIN_VEL);
    expect(x).toBeLessThanOrEqual(1);
  });
});

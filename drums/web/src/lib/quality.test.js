import { describe, expect, it } from 'vitest';
import { bpmLabel, isBlank, nextQuality, recoveryStep } from './quality';

describe('nextQuality', () => {
  it('יורד רמה רק אחרי שתי בדיקות איטיות ברצף', () => {
    let s = { level: 1, slow: 0 };
    s = nextQuality(s, 20, 4, false);
    expect(s).toMatchObject({ level: 1, slow: 1, changed: false });
    s = nextQuality(s, 20, 4, false);
    expect(s).toMatchObject({ level: 2, slow: 0, changed: true });
  });
  it('בדיקה מהירה מאפסת את הספירה', () => {
    expect(nextQuality({ level: 1, slow: 1 }, 60, 4, false)).toMatchObject({ level: 1, slow: 0, changed: false });
  });
  it('לא יורד מתחת לרמה האחרונה ולא כשהאיכות נעולה', () => {
    expect(nextQuality({ level: 3, slow: 1 }, 5, 4, false).changed).toBe(false);
    expect(nextQuality({ level: 0, slow: 1 }, 5, 4, true).changed).toBe(false);
  });
});

describe('isBlank', () => {
  it('שחור מוחלט בכל הנקודות = ריק', () => {
    expect(isBlank([[0, 0, 0, 255], [0, 0, 0, 255]])).toBe(true);
  });
  it('רקע כהה אבל לא אפס, או נקודה אחת עם צבע – לא ריק', () => {
    expect(isBlank([[5, 3, 10, 255], [4, 3, 9, 255]])).toBe(false);
    expect(isBlank([[0, 0, 0, 255], [120, 80, 40, 255]])).toBe(false);
  });
  it('בלי דגימות – לא נחשב ריק', () => {
    expect(isBlank([])).toBe(false);
    expect(isBlank(null)).toBe(false);
  });
});

describe('recoveryStep', () => {
  it('קודם בנייה מחדש באיכות נמוכה, ואחר כך הבמה השטוחה', () => {
    expect(recoveryStep(0)).toBe('safe');
    expect(recoveryStep(1)).toBe('flat');
  });
});

describe('bpmLabel', () => {
  it('תמיד מציג מספר', () => {
    expect(bpmLabel(71)).toBe('71 BPM');
    expect(bpmLabel(70.6)).toBe('71 BPM');
    expect(bpmLabel(undefined)).toBe('– BPM');
  });
});

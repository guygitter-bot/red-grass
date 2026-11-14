import { describe, it, expect } from 'vitest';
import { blackAt, layerAlpha, outroAlpha, coverRect, pickMime, wrapLines, frameSize, FADE, OUTRO } from './film';
import { fitSize, fileName, videoExt, fromDataUrl, dataUrl } from './image';
import { safeProject, safeShot } from './store';
import { shotState, readyCount, withExtra, waitText } from './shots';

describe('הסרט המלא', () => {
  it('גודל המסגרת לפי הפורמט', () => {
    expect(frameSize('16:9')).toEqual({ w: 1920, h: 1080 });
    expect(frameSize('9:16')).toEqual({ w: 1080, h: 1920 });
  });

  it('מעברים: שחור בהתחלה ובסוף, נקי באמצע; הסיום ארוך יותר', () => {
    expect(blackAt(0, 8, false)).toBe(1);
    expect(blackAt(4, 8, false)).toBe(0);
    expect(blackAt(8, 8, false)).toBe(1);
    expect(blackAt(8 - FADE, 8, false)).toBe(0);
    expect(blackAt(8 - FADE, 8, true)).toBeCloseTo(0.5);
  });

  it('כותרת: מופיעה ונעלמת ברכות', () => {
    expect(layerAlpha(0, 1, 4)).toBe(0);
    expect(layerAlpha(1.3, 1, 4)).toBeCloseTo(0.5);
    expect(layerAlpha(2.5, 1, 4)).toBe(1);
    expect(layerAlpha(4, 1, 4)).toBe(0);
    expect(outroAlpha(8 - OUTRO, 8)).toBe(0);
    expect(outroAlpha(8, 8)).toBe(1);
  });

  it('וידאו ממלא את המסגרת בלי לעוות', () => {
    expect(coverRect(1920, 1080, 1920, 1080)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
    const r = coverRect(1280, 720, 1080, 1920);
    expect(r.h).toBe(1920);
    expect(r.x).toBeLessThan(0);
    expect(coverRect(0, 0, 100, 50)).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it('סוג הקובץ: mp4 קודם, אחרת webm, ואם אין – ריק', () => {
    expect(pickMime(() => true)).toMatch(/^video\/mp4/);
    expect(pickMime((m) => m.startsWith('video/webm'))).toMatch(/^video\/webm/);
    expect(pickMime(() => false)).toBe('');
  });

  it('שבירת שורות', () => {
    const measure = (s) => s.length * 10;
    expect(wrapLines('מגדלי הים התיכון', 80, measure)).toEqual(['מגדלי', 'הים', 'התיכון']);
    expect(wrapLines('מגדלי הים', 500, measure)).toEqual(['מגדלי הים']);
    expect(wrapLines('', 100, measure)).toEqual([]);
  });
});

describe('תמונות וקבצים', () => {
  it('הקטנה בלי עיוות', () => {
    expect(fitSize(4000, 3000, 1920)).toEqual({ w: 1920, h: 1440 });
    expect(fitSize(800, 600, 1920)).toEqual({ w: 800, h: 600 });
    expect(fitSize(0, 0, 1920)).toEqual({ w: 0, h: 0 });
  });
  it('שם קובץ וסיומת', () => {
    expect(fileName('מגדלי הים / שלב ב')).toBe('מגדלי הים   שלב ב');
    expect(fileName('')).toBe('nadlan');
    expect(videoExt('video/webm;codecs=vp9')).toBe('webm');
    expect(videoExt('video/mp4')).toBe('mp4');
    expect(fromDataUrl(dataUrl({ media_type: 'image/png', data: 'QUJD' }))).toEqual({ media_type: 'image/png', data: 'QUJD' });
  });
});

describe('שוטים', () => {
  it('פרויקט ושוט ישנים מקבלים ברירות מחדל', () => {
    const p = safeProject({ id: 'a', shots: [{ id: 's', title: 'פתיחה' }] });
    expect(p.quality).toBe('max');
    expect(p.brief.aspect).toBe('16:9');
    expect(p.shots[0].hasClip).toBe(false);
    expect(p.shots[0].extra).toBe('');
    expect(safeProject({}).shots).toEqual([]);
  });

  it('מצב השוט', () => {
    expect(shotState(safeShot({ still: 'x' }))).toBe('needs-still');
    expect(shotState(safeShot({ still: 'x', hasStill: true }))).toBe('ready-to-film');
    expect(shotState(safeShot({ still: '' }))).toBe('ready-to-film');
    expect(shotState(safeShot({ op: 'models/x/operations/y' }))).toBe('filming');
    expect(shotState(safeShot({ hasClip: true, op: 'x' }))).toBe('done');
    expect(shotState(safeShot({ still: 'x' }), 'still')).toBe('making-still');
    expect(readyCount(safeProject({ shots: [{ hasClip: true }, {}] }))).toBe(1);
    expect(waitText(45_000)).toBe('0:45');
    expect(waitText(125_900)).toBe('2:05');
    expect(waitText(-5)).toBe('0:00');
  });

  it('בקשה מיוחדת מצורפת להוראה', () => {
    expect(withExtra('orbit', '')).toBe('orbit');
    expect(withExtra('orbit', ' בלי מכוניות ')).toMatch(/^orbit\n\nExtra request from the client \(may be in Hebrew\): בלי מכוניות$/);
  });
});

import { describe, it, expect } from 'vitest';
import { demoPosition, demoBattery, DEMO_PATH } from './demo';

describe('demo', () => {
  it('בתחילת הסיבוב הילד בנקודת ההתחלה', () => {
    const p = demoPosition(0);
    expect(p.lat).toBeCloseTo(DEMO_PATH[0][0], 5);
    expect(p.lng).toBeCloseTo(DEMO_PATH[0][1], 5);
  });
  it('באמצע קטע – בין שתי נקודות', () => {
    const loop = 60000;
    const seg = loop / (DEMO_PATH.length - 1);
    const p = demoPosition(seg / 2, loop); // חצי מהקטע הראשון
    expect(p.lat).toBeGreaterThan(DEMO_PATH[0][0]);
    expect(p.lat).toBeLessThan(DEMO_PATH[1][0]);
  });
  it('המיקום חוזר על עצמו כל סיבוב', () => {
    const a = demoPosition(12345, 60000);
    const b = demoPosition(12345 + 60000, 60000);
    expect(a.lat).toBeCloseTo(b.lat, 9);
  });
  it('סוללה בטווח סביר', () => {
    expect(demoBattery(0)).toBeLessThanOrEqual(95);
    expect(demoBattery(59000)).toBeGreaterThan(40);
  });
});

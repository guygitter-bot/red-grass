import { describe, expect, it } from 'vitest';
import { PIECE_IDS, PIECES } from './kit';
import { pieceSample, SAMPLE_GROUPS } from './samples';
import { applyZone, zoneAt, zoneVelBias } from './zones';

describe('אזורי הקשה', () => {
  it('בלי מיקום – האזור הרגיל של החלק', () => {
    expect(zoneAt('snare')).toBe('center');
    expect(zoneAt('ride')).toBe('bow');
    expect(zoneAt('crash', undefined)).toBe('mid');
    expect(zoneAt('kick', 0.9)).toBe('center');
  });
  it('סנר: מרכז, שפה, חישוק', () => {
    expect(zoneAt('snare', 0.1)).toBe('center');
    expect(zoneAt('snare', 0.7)).toBe('edge');
    expect(zoneAt('snare', 0.95)).toBe('rim');
  });
  it('רייד: פעמון במרכז, גוף, ושפה', () => {
    expect(zoneAt('ride', 0.1)).toBe('bell');
    expect(zoneAt('ride', 0.5)).toBe('bow');
    expect(zoneAt('ride', 0.9)).toBe('edge');
  });
  it('קראש: מרכז רך, אמצע, שפה', () => {
    expect(zoneAt('crash', 0.1)).toBe('center');
    expect(zoneAt('china', 0.5)).toBe('mid');
    expect(zoneAt('splash', 0.95)).toBe('edge');
  });
  it('טום והיי-האט: מרכז מול שפה; ערכים מחוץ לטווח נחתכים', () => {
    expect(zoneAt('tom', 0.2)).toBe('center');
    expect(zoneAt('floor', 0.9)).toBe('edge');
    expect(zoneAt('hihat', 0.9)).toBe('edge');
    expect(zoneAt('hihatOpen', 0.3)).toBe('center');
    expect(zoneAt('snare', 7)).toBe('rim');
    expect(zoneAt('snare', -3)).toBe('center');
    expect(zoneAt('snare', NaN)).toBe('center');
  });
  it('אזור רגיל לא משנה את המפרט, והשפה / החישוק כן', () => {
    const s = pieceSample('snare', {});
    expect(applyZone(s, 'snare', 'center')).toBe(s);
    const rim = applyZone(s, 'snare', 'rim');
    expect(rim.gain).toBeGreaterThan(s.gain);
    expect(rim.peak).toBeGreaterThan(s.peak);
    expect(rim.decay).toBeLessThan(s.decay);
    const edge = applyZone(s, 'snare', 'edge');
    expect(edge.gain).toBeLessThan(s.gain);
    expect(edge.highpass).toBeGreaterThan(0); // דק יותר
  });
  it('פעמון הרייד משתמש בדגימת הפעמון; שפת הרייד ושפת הקראש חזקות יותר', () => {
    const ride = pieceSample('ride', {});
    expect(applyZone(ride, 'ride', 'bell').group).toBe('bell');
    expect(applyZone(ride, 'ride', 'bow').group).toBe('ride');
    expect(applyZone(ride, 'ride', 'edge').decay).toBeGreaterThan(ride.decay);
    const crash = pieceSample('crash1', {});
    expect(applyZone(crash, 'crash', 'edge').gain).toBeGreaterThan(applyZone(crash, 'crash', 'center').gain);
    expect(applyZone(crash, 'crash', 'center').lowpass).toBeGreaterThan(0); // עמום יותר
  });
  it('לכל חלק ואזור אפשרי המפרט תקין והדגימה קיימת', () => {
    for (const id of PIECE_IDS) {
      const type = PIECES[id].type;
      for (const r of [0, 0.15, 0.4, 0.7, 0.9, 1]) {
        const s = applyZone(pieceSample(id, {}), type, zoneAt(type, r));
        expect(SAMPLE_GROUPS[s.group], `${id} ${r}`).toBeTruthy();
        expect(s.rate).toBeGreaterThan(0.3);
        expect(s.rate).toBeLessThan(3);
        expect(s.gain).toBeGreaterThan(0);
        expect(s.decay).toBeGreaterThan(0);
      }
    }
  });
  it('הטיית עוצמה: חישוק חזק יותר, שפת תוף חלשה יותר', () => {
    expect(zoneVelBias('snare', 'rim')).toBeGreaterThan(0);
    expect(zoneVelBias('snare', 'edge')).toBeLessThan(0);
    expect(zoneVelBias('snare', 'center')).toBe(0);
    expect(zoneVelBias('kick', 'center')).toBe(0);
  });
});

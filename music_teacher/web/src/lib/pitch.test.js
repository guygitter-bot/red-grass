import { describe, it, expect } from 'vitest';
import { detectPitch, freqToNote, centsOff, nearestString } from './pitch.js';

const SR = 44100;
const N = 4096;
function sine(f, amp = 0.5) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) b[i] = amp * Math.sin((2 * Math.PI * f * i) / SR);
  return b;
}
function saw(f, amp = 0.5) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) b[i] = amp * (2 * ((f * i) / SR - Math.floor((f * i) / SR + 0.5)));
  return b;
}
// מיתר פשוט: הרמוניות עם דעיכה
function pluckLike(f) {
  const b = new Float32Array(N);
  for (let h = 1; h <= 6; h++) for (let i = 0; i < N; i++) b[i] += (0.4 / h) * Math.sin((2 * Math.PI * f * h * i) / SR);
  return b;
}
const cents = (a, b) => Math.abs(1200 * Math.log2(a / b));

const OPEN = [82.41, 110, 146.83, 196, 246.94, 329.63];

describe('detectPitch', () => {
  it.each(OPEN)('מזהה גל סינוס %f הרץ', (f) => {
    const r = detectPitch(sine(f), SR);
    expect(r).not.toBeNull();
    expect(cents(r.freq, f)).toBeLessThan(3);
  });
  it.each(OPEN)('מזהה גל שן־מסור %f הרץ', (f) => {
    const r = detectPitch(saw(f), SR);
    expect(r).not.toBeNull();
    expect(cents(r.freq, f)).toBeLessThan(5);
  });
  it.each(OPEN)('מזהה צליל עם הרמוניות %f הרץ', (f) => {
    const r = detectPitch(pluckLike(f), SR);
    expect(r).not.toBeNull();
    expect(cents(r.freq, f)).toBeLessThan(5);
  });
  it('מזהה צלילים מכוונים קצת נמוך וקצת גבוה', () => {
    for (const [f, off] of [[110, -20], [110, 15], [82.41, -12], [329.63, 18], [196, -8]]) {
      const target = f * Math.pow(2, off / 1200);
      const r = detectPitch(saw(target), SR);
      expect(r).not.toBeNull();
      expect(cents(r.freq, target)).toBeLessThan(5);
    }
  });
  it('108 הרץ הוא לה נמוך בכמה סנט', () => {
    const r = detectPitch(saw(108), SR);
    const n = freqToNote(r.freq);
    expect(n.name).toBe('A');
    expect(nearestString(r.freq).string).toBe(5);
    expect(n.cents).toBeLessThan(-5);
  });
  it('עובד גם בקצבי דגימה אחרים ובתדרים גבוהים', () => {
    const sr = 48000;
    const b = new Float32Array(4096);
    for (let i = 0; i < b.length; i++) b[i] = 0.4 * Math.sin((2 * Math.PI * 880 * i) / sr);
    expect(cents(detectPitch(b, sr).freq, 880)).toBeLessThan(3);
  });
  it('שקט -> null', () => {
    expect(detectPitch(new Float32Array(N), SR)).toBeNull();
    const quiet = sine(110, 0.001);
    expect(detectPitch(quiet, SR)).toBeNull();
  });
  it('רעש אקראי חלש -> null', () => {
    const b = new Float32Array(N);
    for (let i = 0; i < N; i++) b[i] = (Math.random() - 0.5) * 0.004;
    expect(detectPitch(b, SR)).toBeNull();
  });
});

describe('עזרי תווים', () => {
  it('freqToNote', () => {
    expect(freqToNote(440)).toMatchObject({ name: 'A', octave: 4, he: 'לה' });
    expect(freqToNote(82.41)).toMatchObject({ name: 'E', octave: 2, he: 'מי' });
    expect(freqToNote(277.18).name).toBe('C#');
    expect(freqToNote(277.18).he).toBe('דו דיאז');
  });
  it('centsOff', () => {
    expect(centsOff(440, 440)).toBeCloseTo(0);
    expect(centsOff(880, 440)).toBeCloseTo(1200);
    expect(centsOff(220, 440)).toBeCloseTo(-1200);
  });
  it('nearestString', () => {
    expect(nearestString(82).string).toBe(6);
    expect(nearestString(112).string).toBe(5);
    expect(nearestString(145).string).toBe(4);
    expect(nearestString(200).string).toBe(3);
    expect(nearestString(250).string).toBe(2);
    expect(nearestString(330).string).toBe(1);
  });
});

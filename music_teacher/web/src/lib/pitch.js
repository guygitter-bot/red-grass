// זיהוי גובה צליל – פונקציות טהורות (בלי דפדפן), כדי שאפשר יהיה לבדוק אותן
import { STRINGS, STRING_ORDER, heNote } from './notes.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// עוצמה ממוצעת (RMS) של קטע שמע
export function rms(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / (buf.length || 1));
}

/**
 * זיהוי תדר בשיטת YIN (autocorrelation מנורמל).
 * מחזיר { freq, clarity } או null כשיש שקט / אין צליל ברור.
 */
export function detectPitch(buf, sampleRate, opts = {}) {
  const { minFreq = 70, maxFreq = 1000, gate = 0.008, threshold = 0.15, maxWindow = 2048 } = opts;
  if (!buf || buf.length < 256) return null;
  if (rms(buf) < gate) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.floor(sampleRate / minFreq);
  const W = Math.min(maxWindow, buf.length - tauMax - 1);
  if (W < tauMax) return null;

  // פונקציית הפרש
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // הפרש מנורמל מצטבר
  const cm = new Float32Array(tauMax + 1);
  cm[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    run += d[tau];
    cm[tau] = run === 0 ? 1 : (d[tau] * tau) / run;
  }
  // הירידה הראשונה מתחת לסף
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cm[t] < threshold) {
      while (t + 1 < tauMax && cm[t + 1] < cm[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // דיוק תת־דגימה (פרבולה)
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1];
    const den = a + c - 2 * b;
    if (Math.abs(den) > 1e-12) better = tau + (a - c) / (2 * den);
  }
  const freq = sampleRate / better;
  if (freq < minFreq * 0.95 || freq > maxFreq * 1.05) return null;
  return { freq, clarity: 1 - cm[tau] };
}

// תדר -> תו הקרוב ביותר
export function freqToNote(freq) {
  const midiExact = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiExact);
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const target = 440 * Math.pow(2, (midi - 69) / 12);
  return { name, octave, midi, he: heNote(name), cents: centsOff(freq, target), freq: target };
}

// כמה סנט (מאית חצי־טון) התדר רחוק מהיעד; חיובי = גבוה מדי
export function centsOff(freq, target) {
  return 1200 * Math.log2(freq / target);
}

// המיתר הקרוב ביותר לתדר
export function nearestString(freq) {
  let best = null;
  for (const n of STRING_ORDER) {
    const c = centsOff(freq, STRINGS[n].freq);
    if (!best || Math.abs(c) < Math.abs(best.cents)) best = { string: n, cents: c, target: STRINGS[n].freq };
  }
  return best;
}

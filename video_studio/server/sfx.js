// ספריית סאונד מובנית: האפקטים והלופים מסונתזים כאן בקוד (בלי קבצים חיצוניים ובלי זכויות יוצרים),
// ונשמרים כ-WAV בתיקיית data/sfx בהפעלה הראשונה.
import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from './store.js';

const SR = 44100;
const TAU = Math.PI * 2;

// --- כלי סינתזה קטנים ---
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2147483648 - 1; }; }
const buf = (sec) => new Float32Array(Math.round(sec * SR));
const lerp = (a, b, k) => a + (b - a) * k;
const expo = (a, b, k) => a * Math.pow(b / a, k);
// מעטפת: עלייה מהירה ודעיכה מעריכית
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

// תנודה עם תדר שמשתנה בזמן. freq: (t, k) => Hz
function tone(out, { at = 0, dur, freq, amp = 1, shape = 'sine', envelope }) {
  let ph = 0;
  const n = Math.round(dur * SR), o = Math.round(at * SR);
  for (let i = 0; i < n && o + i < out.length; i++) {
    const t = i / SR, k = i / n;
    ph += (TAU * (typeof freq === 'function' ? freq(t, k) : freq)) / SR;
    let v = Math.sin(ph);
    if (shape === 'square') v = Math.tanh(v * 4) * 0.6;
    else if (shape === 'saw') v = ((ph / TAU) % 1) * 2 - 1;
    else if (shape === 'tri') v = (2 / Math.PI) * Math.asin(v);
    out[o + i] += v * amp * (envelope ? envelope(t, k) : 1);
  }
}

// רעש מסונן (band-pass פשוט) עם תדר מרכזי שמשתנה
function noise(out, { at = 0, dur, amp = 1, freq = 2000, q = 1, envelope, seed = 1 }) {
  const r = rng(seed);
  let lo = 0, band = 0;
  const n = Math.round(dur * SR), o = Math.round(at * SR);
  for (let i = 0; i < n && o + i < out.length; i++) {
    const t = i / SR, k = i / n;
    const f = Math.min(0.9, (2 * Math.sin((Math.PI * (typeof freq === 'function' ? freq(t, k) : freq)) / SR)));
    const high = r() - lo - band / q;
    band += f * high;
    lo += f * band;
    out[o + i] += band * amp * (envelope ? envelope(t, k) : 1);
  }
}

function lowpass(out, hz) {
  const a = 1 - Math.exp((-TAU * hz) / SR);
  let y = 0;
  for (let i = 0; i < out.length; i++) { y += a * (out[i] - y); out[i] = y; }
}

function finish(out, peak = 0.89) {
  let max = 0;
  for (const v of out) if (Math.abs(v) > max) max = Math.abs(v);
  const g = max ? peak / max : 1;
  const fade = Math.min(400, out.length >> 3);
  for (let i = 0; i < out.length; i++) {
    let v = out[i] * g;
    if (i < 40) v *= i / 40;
    if (i > out.length - fade) v *= (out.length - i) / fade;
    out[i] = v;
  }
  return out;
}

const hump = (k) => Math.sin(Math.PI * k) ** 2;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const bell = (out, at, f, amp = 1, decay = 0.5) => {
  for (const [mult, a] of [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.9, 0.12]]) {
    tone(out, { at, dur: decay * 4, freq: f * mult, amp: amp * a, envelope: (t) => env(t, 0.002, decay / mult ** 0.5) });
  }
};

// --- מוזיקה: לופים פשוטים ---
function kick(out, at, amp = 1) { tone(out, { at, dur: 0.3, freq: (t) => 45 + 110 * Math.exp(-t * 28), amp, envelope: (t) => env(t, 0.002, 0.11) }); }
function snare(out, at, amp = 0.6, seed = 3) {
  noise(out, { at, dur: 0.2, freq: 1900, q: 0.8, amp, envelope: (t) => env(t, 0.001, 0.06), seed });
  tone(out, { at, dur: 0.12, freq: 190, amp: amp * 0.5, envelope: (t) => env(t, 0.001, 0.04) });
}
function hat(out, at, amp = 0.25, seed = 5) { noise(out, { at, dur: 0.06, freq: 8500, q: 0.6, amp, envelope: (t) => env(t, 0.001, 0.018), seed }); }
function chord(out, at, notes, dur, amp, shape = 'tri') {
  for (const n of notes) tone(out, { at, dur, freq: midi(n), amp, shape, envelope: (t, k) => Math.min(1, t / 0.04) * (1 - k) ** 0.6 });
}

function loop({ bpm, bars, prog, style }) {
  const beat = 60 / bpm;
  const out = buf(bars * 4 * beat);
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const ch = prog[bar % prog.length];
    if (style === 'calm') {
      chord(out, t0, ch, 4 * beat, 0.12, 'sine');
      chord(out, t0, ch.map((n) => n + 12), 4 * beat, 0.04, 'tri');
      ch.forEach((n, i) => bell(out, t0 + i * beat, midi(n + 12), 0.1, 0.5));
      continue;
    }
    chord(out, t0, ch, style === 'lofi' ? 3.8 * beat : 1.9 * beat, style === 'lofi' ? 0.11 : 0.07, style === 'lofi' ? 'tri' : 'saw');
    if (style !== 'lofi') chord(out, t0 + 2 * beat, ch, 1.9 * beat, 0.07, 'saw');
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      if (style === 'upbeat') {
        kick(out, t, 0.9);
        if (b % 2) snare(out, t, 0.45, bar * 4 + b);
        hat(out, t + beat / 2, 0.22, bar * 8 + b);
        // בס על הטוניקה ונגינה מפורקת של האקורד
        tone(out, { at: t + beat / 2, dur: beat * 0.45, freq: midi(ch[0] - 24), amp: 0.4, shape: 'tri', envelope: (x) => env(x, 0.005, 0.15) });
        for (let s = 0; s < 2; s++) {
          tone(out, { at: t + (s * beat) / 2, dur: 0.2, freq: midi(ch[(b * 2 + s) % ch.length] + 12), amp: 0.14, shape: 'square', envelope: (x) => env(x, 0.003, 0.07) });
        }
      } else {
        if (b === 0 || (b === 2 && bar % 2 === 0)) kick(out, t, 0.8);
        if (b === 2 && bar % 2) kick(out, t + beat / 2, 0.6);
        if (b % 2) snare(out, t, 0.35, bar * 4 + b);
        hat(out, t, 0.12, bar * 8 + b);
        hat(out, t + beat * 0.58, 0.1, bar * 8 + b + 100);
        if (b === 0) tone(out, { at: t, dur: beat * 1.5, freq: midi(ch[0] - 24), amp: 0.38, envelope: (x) => env(x, 0.01, 0.5) });
      }
    }
  }
  if (style === 'lofi') lowpass(out, 3200);
  return finish(out, 0.8);
}

// --- הספרייה ---
const LIB = [
  // מעברים
  ['whoosh', 'transitions', 'וווש', 'Whoosh', () => { const o = buf(0.7); noise(o, { dur: 0.7, freq: (t, k) => expo(300, 5000, hump(k)), q: 0.7, envelope: (t, k) => hump(k) ** 1.5 }); return o; }],
  ['swish', 'transitions', 'סוויש מהיר', 'Fast swish', () => { const o = buf(0.28); noise(o, { dur: 0.28, freq: (t, k) => expo(1500, 9000, k), q: 0.9, envelope: (t, k) => hump(k) ** 2, seed: 7 }); return o; }],
  ['riser', 'transitions', 'עלייה', 'Riser', () => { const o = buf(2); noise(o, { dur: 2, freq: (t, k) => expo(250, 9000, k), q: 0.5, amp: 0.7, envelope: (t, k) => k ** 2 }); tone(o, { dur: 2, freq: (t, k) => expo(180, 1400, k), amp: 0.3, shape: 'saw', envelope: (t, k) => k ** 2 }); return o; }],
  ['downer', 'transitions', 'ירידה', 'Downer', () => { const o = buf(1.2); tone(o, { dur: 1.2, freq: (t, k) => expo(900, 60, k), amp: 0.5, shape: 'saw', envelope: (t, k) => 1 - k }); noise(o, { dur: 1.2, freq: (t, k) => expo(6000, 200, k), q: 0.6, amp: 0.5, envelope: (t, k) => (1 - k) ** 2 }); lowpass(o, 5000); return o; }],
  ['tape-stop', 'transitions', 'עצירת טייפ', 'Tape stop', () => { const o = buf(0.8); tone(o, { dur: 0.8, freq: (t, k) => 440 * (1 - k) ** 2 + 20, amp: 0.6, shape: 'saw', envelope: (t, k) => 1 - k ** 3 }); lowpass(o, 2500); return o; }],
  // ממשק
  ['click', 'ui', 'קליק', 'Click', () => { const o = buf(0.06); noise(o, { dur: 0.03, freq: 3500, q: 1.2, envelope: (t) => env(t, 0.0005, 0.006) }); tone(o, { dur: 0.03, freq: 1800, amp: 0.4, envelope: (t) => env(t, 0.0005, 0.005) }); return o; }],
  ['pop', 'ui', 'פופ', 'Pop', () => { const o = buf(0.14); tone(o, { dur: 0.14, freq: (t) => 280 + 700 * Math.exp(-t * 60), envelope: (t) => env(t, 0.002, 0.03) }); return o; }],
  ['ding', 'ui', 'דינג', 'Ding', () => { const o = buf(1.4); bell(o, 0, 1568, 1, 0.35); return o; }],
  ['notify', 'ui', 'התראה', 'Notification', () => { const o = buf(0.9); bell(o, 0, 880, 0.8, 0.18); bell(o, 0.14, 1318.5, 1, 0.25); return o; }],
  ['shutter', 'ui', 'צילום', 'Camera shutter', () => { const o = buf(0.22); noise(o, { dur: 0.04, freq: 5000, q: 0.7, envelope: (t) => env(t, 0.0005, 0.008) }); noise(o, { at: 0.09, dur: 0.07, freq: 3000, q: 0.7, amp: 0.8, envelope: (t) => env(t, 0.0005, 0.014), seed: 9 }); return o; }],
  ['typing', 'ui', 'הקלדה', 'Typing', () => { const o = buf(1.2); const r = rng(11); let t = 0; while (t < 1.1) { noise(o, { at: t, dur: 0.03, freq: 2600 + r() * 600, q: 1.5, amp: 0.7 + r() * 0.2, envelope: (x) => env(x, 0.0005, 0.006), seed: Math.round(t * 1000) + 1 }); t += 0.09 + (r() + 1) * 0.04; } return o; }],
  ['beep', 'ui', 'ביפ צנזורה', 'Censor beep', () => { const o = buf(0.6); tone(o, { dur: 0.6, freq: 1000, amp: 0.7 }); return o; }],
  // מכות
  ['boom', 'impacts', 'בום', 'Boom', () => { const o = buf(1.6); tone(o, { dur: 1.6, freq: (t) => 38 + 90 * Math.exp(-t * 9), envelope: (t) => env(t, 0.004, 0.45) }); noise(o, { dur: 0.5, freq: 400, q: 0.5, amp: 0.7, envelope: (t) => env(t, 0.002, 0.09) }); return o; }],
  ['hit', 'impacts', 'מכה', 'Hit', () => { const o = buf(0.3); noise(o, { dur: 0.3, freq: 1200, q: 0.5, envelope: (t) => env(t, 0.001, 0.04) }); tone(o, { dur: 0.2, freq: (t) => 70 + 150 * Math.exp(-t * 40), envelope: (t) => env(t, 0.001, 0.06) }); return o; }],
  ['thud', 'impacts', 'חבטה', 'Thud', () => { const o = buf(0.4); tone(o, { dur: 0.4, freq: (t) => 50 + 60 * Math.exp(-t * 30), envelope: (t) => env(t, 0.003, 0.09) }); lowpass(o, 600); return o; }],
  ['glitch', 'impacts', 'גליץ׳', 'Glitch', () => { const o = buf(0.5); const r = rng(21); for (let i = 0; i < 14; i++) { const at = i * 0.034; const f = 200 + (r() + 1) * 2500; if (r() > -0.2) tone(o, { at, dur: 0.03, freq: f, amp: 0.6, shape: 'square' }); else noise(o, { at, dur: 0.03, freq: f * 2, q: 1, seed: i + 30 }); } return o; }],
  ['clap', 'impacts', 'מחיאת כף', 'Clap', () => { const o = buf(0.35); for (const [at, a] of [[0, 0.7], [0.011, 0.8], [0.023, 1]]) noise(o, { at, dur: 0.25, freq: 1500, q: 0.9, amp: a, envelope: (t) => env(t, 0.0005, at > 0.02 ? 0.06 : 0.008), seed: Math.round(at * 1000) + 40 }); return o; }],
  // מצחיקים
  ['boing', 'fun', 'בוינג', 'Boing', () => { const o = buf(0.8); tone(o, { dur: 0.8, freq: (t) => 160 + 110 * Math.exp(-t * 3) * Math.sin(TAU * 9 * t) + 90 * Math.exp(-t * 5), envelope: (t) => env(t, 0.004, 0.25), shape: 'tri' }); return o; }],
  ['slide-up', 'fun', 'שריקה עולה', 'Slide up', () => { const o = buf(0.5); tone(o, { dur: 0.5, freq: (t, k) => expo(400, 1900, k), envelope: (t, k) => hump(Math.min(1, k * 1.05)) ** 0.5 }); return o; }],
  ['slide-down', 'fun', 'שריקה יורדת', 'Slide down', () => { const o = buf(0.6); tone(o, { dur: 0.6, freq: (t, k) => expo(1900, 300, k), envelope: (t, k) => hump(Math.min(1, k * 1.05)) ** 0.5 }); return o; }],
  ['fail', 'fun', 'כישלון', 'Fail', () => { const o = buf(2); [58, 57, 56, 55].forEach((n, i) => tone(o, { at: i * 0.38, dur: i === 3 ? 0.85 : 0.34, freq: (t) => midi(n) * (1 + (i === 3 ? 0.012 * Math.sin(TAU * 6 * t) : 0)), amp: 0.6, shape: 'saw', envelope: (t, k) => Math.min(1, t / 0.02) * (1 - k ** 3) })); lowpass(o, 1500); return o; }],
  ['success', 'fun', 'הצלחה', 'Success', () => { const o = buf(1.5); [72, 76, 79, 84].forEach((n, i) => bell(o, i * 0.09, midi(n), 0.8, 0.3)); return o; }],
  ['coin', 'fun', 'מטבע', 'Coin', () => { const o = buf(0.7); tone(o, { dur: 0.08, freq: 988, amp: 0.6, shape: 'square', envelope: (t) => env(t, 0.002, 0.2) }); tone(o, { at: 0.08, dur: 0.55, freq: 1319, amp: 0.6, shape: 'square', envelope: (t) => env(t, 0.002, 0.16) }); return o; }],
  ['drumroll', 'fun', 'תיפוף מתח', 'Drum roll', () => { const o = buf(2.1); for (let t = 0; t < 1.7; t += 0.045) snare(o, t, 0.25 + 0.3 * (t / 1.7), Math.round(t * 1000) + 60); snare(o, 1.75, 1, 99); noise(o, { at: 1.75, dur: 0.35, freq: 7000, q: 0.5, amp: 0.6, envelope: (t) => env(t, 0.001, 0.09), seed: 77 }); return o; }],
  // מוזיקה
  ['music-lofi', 'music', 'לו-פיי רגוע (לופ)', 'Lo-fi chill (loop)', () => loop({ bpm: 78, bars: 8, style: 'lofi', prog: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]] })],
  ['music-upbeat', 'music', 'קצבי ושמח (לופ)', 'Upbeat (loop)', () => loop({ bpm: 120, bars: 8, style: 'upbeat', prog: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]] })],
  ['music-calm', 'music', 'שקט ורך (לופ)', 'Calm pad (loop)', () => loop({ bpm: 64, bars: 8, style: 'calm', prog: [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 55]] })],
];

export const SFX_CATEGORIES = [
  { id: 'transitions', he: 'מעברים', en: 'Transitions' },
  { id: 'ui', he: 'ממשק', en: 'UI' },
  { id: 'impacts', he: 'מכות', en: 'Impacts' },
  { id: 'fun', he: 'מצחיקים', en: 'Fun' },
  { id: 'music', he: 'מוזיקה', en: 'Music' },
];

function wav(samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + samples.length * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return data;
}

const VERSION = 'v1';
export const SFX = LIB.map(([id, category, he, en, make]) => ({ id, category, he, en, file: `${id}.${VERSION}.wav`, make }));

// יוצר את הקבצים שחסרים ומחזיר את הרשימה (עם משך)
export function ensureSfx() {
  for (const s of SFX) {
    const file = path.join(DIRS.sfx, s.file);
    if (!fs.existsSync(file)) fs.writeFileSync(file, wav(s.category === 'music' ? s.make() : finish(s.make())));
    s.duration = Math.round(((fs.statSync(file).size - 44) / 2 / SR) * 1000) / 1000;
  }
  return SFX;
}

export const publicSfx = () => SFX.map(({ make, ...s }) => ({ ...s, url: `/sfx/${s.file}` }));

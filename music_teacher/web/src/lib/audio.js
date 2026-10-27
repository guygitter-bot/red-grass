// שמע: מיתר שנוצר ב-Karplus-Strong. מתחיל רק אחרי נגיעה של המשתמש/ת.
import { STRINGS, fretFreq } from './notes.js';

let ac = null;
let chain = null; // { input, type }
const cache = new Map();

export function audioReady() {
  return !!ac;
}

export function getAudioContext() {
  return ac;
}

// קוראים לזה בתוך אירוע נגיעה/לחיצה
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    if (!ac) ac = new AC();
    if (ac.state === 'suspended') ac.resume();
    return true;
  } catch {
    return false;
  }
}

// הד קצר מסונתז (בלי קבצים)
function impulse(seconds, decay) {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function softClipCurve(drive) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return c;
}

// שרשרת צליל לפי סוג הגיטרה
function buildChain(type) {
  const input = ac.createGain();
  const out = ac.createGain();
  out.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor();
  const verb = ac.createConvolver();
  const wet = ac.createGain();
  if (type === 'electric') {
    // מגבר עדין: עיוות רך + הד קצר
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const shaper = ac.createWaveShaper();
    shaper.curve = softClipCurve(2.6);
    shaper.oversample = '2x';
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    input.connect(hp);
    hp.connect(shaper);
    shaper.connect(lp);
    lp.connect(out);
    verb.buffer = impulse(1.1, 3);
    wet.gain.value = 0.2;
    lp.connect(verb);
  } else {
    // גוף עץ חם: הדגשה נמוכה וחיתוך גבוהים
    const body = ac.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 200;
    body.gain.value = 3;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    input.connect(body);
    body.connect(lp);
    lp.connect(out);
    verb.buffer = impulse(0.6, 3.5);
    wet.gain.value = 0.12;
    lp.connect(verb);
  }
  verb.connect(wet);
  wet.connect(out);
  out.connect(comp);
  comp.connect(ac.destination);
  return { input, type };
}

function getChain(type) {
  if (!chain || chain.type !== type) chain = buildChain(type);
  return chain;
}

// Karplus-Strong: קלאסית = רכה וחמה; חשמלית = בהירה עם סאסטיין ארוך
function ksBuffer(freq, type, dur) {
  const sr = ac.sampleRate;
  const N = Math.max(2, Math.floor(sr / freq - 0.5));
  const line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1;
  const passes = type === 'classical' ? 4 : 1; // פריטה רכה = פחות הרמוניות גבוהות בהתחלה
  for (let p = 0; p < passes; p++) for (let i = 1; i < N; i++) line[i] = 0.5 * line[i] + 0.5 * line[i - 1];
  const decay = type === 'classical' ? 0.9965 : 0.9992;
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);
  let idx = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const y = line[idx];
    const nx = line[(idx + 1) % N];
    line[idx] = decay * 0.5 * (y + nx);
    out[i] = y;
    idx = (idx + 1) % N;
    if (Math.abs(y) > peak) peak = Math.abs(y);
  }
  const fade = Math.floor(sr * 0.25);
  for (let i = 0; i < len; i++) {
    const e = i > len - fade ? (len - i) / fade : 1;
    out[i] = (out[i] / (peak || 1)) * 0.9 * e;
  }
  // התקפה רכה בקלאסית
  if (type === 'classical') {
    const a = Math.floor(sr * 0.006);
    for (let i = 0; i < a; i++) out[i] *= i / a;
  }
  const b = ac.createBuffer(1, len, sr);
  b.copyToChannel(out, 0);
  return b;
}

/** מנגן מיתר (אחרי unlockAudio). when = זמן בשעון השמע. */
export function playString(type, string, { fret = 0, gain = 0.5, when = 0, pan = 0 } = {}) {
  if (!ac) return false;
  const freq = fretFreq(string, fret);
  const key = `${type}:${freq.toFixed(2)}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = ksBuffer(freq, type, type === 'classical' ? 2.6 : 3.4);
    cache.set(key, buf);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g);
  let node = g;
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    node = p;
  }
  node.connect(getChain(type).input);
  src.start(when || ac.currentTime);
  return true;
}

// מנגן מיתר פתוח לפי מספר
export function playOpen(type, string, opts = {}) {
  return playString(type, string, { pan: (3.5 - string) * 0.1, ...opts });
}

// צליל ארוך וברור לכוונון "על פי האוזן"
let ref = null;
export function stopReference() {
  if (!ref) return;
  try {
    ref.gain.gain.cancelScheduledValues(ac.currentTime);
    ref.gain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    ref.osc.forEach((o) => o.stop(ac.currentTime + 0.4));
  } catch {
    // כבר נעצר
  }
  ref = null;
}
export function playReference(string, seconds = 3) {
  if (!ac) return;
  stopReference();
  const t = ac.currentTime;
  const f = STRINGS[string].freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.28, t + 0.04);
  gain.gain.setTargetAtTime(0, t + seconds - 0.4, 0.15);
  const o1 = ac.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  const o2 = ac.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2;
  const g2 = ac.createGain();
  g2.gain.value = 0.25;
  o1.connect(gain);
  o2.connect(g2);
  g2.connect(gain);
  gain.connect(ac.destination);
  o1.start(t);
  o2.start(t);
  o1.stop(t + seconds);
  o2.stop(t + seconds);
  ref = { gain: { gain }, osc: [o1, o2] };
}

// צליל מרגיש/טיק קצר למטרונום
export function playTick(accent = false) {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.value = accent ? 1500 : 1000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g);
  g.connect(ac.destination);
  o.start(t);
  o.stop(t + 0.06);
}

// צלילים קצרים עם WebAudio, בלי קובצי שמע. ההקשר נוצר רק אחרי לחיצה של המשתמש.
const KEY = 'ch_sound';
let ctx = null;
let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== 'off';
} catch {
  enabled = true;
}

export function soundOn() {
  return enabled;
}

export function setSound(on) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // אין אחסון
  }
}

function getCtx() {
  if (ctx) return ctx;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(c, freq, start, dur, type = 'sine', vol = 0.15) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

const SOUNDS = {
  correct: (c) => {
    tone(c, 660, 0, 0.14);
    tone(c, 880, 0.12, 0.2);
  },
  wrong: (c) => {
    tone(c, 220, 0, 0.22, 'triangle', 0.18);
    tone(c, 165, 0.16, 0.28, 'triangle', 0.18);
  },
  win: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.12, 0.25));
  },
  tap: (c) => tone(c, 520, 0, 0.07, 'sine', 0.1),
  spin: (c) => {
    for (let i = 0; i < 6; i++) tone(c, 300 + i * 40, i * 0.08, 0.06, 'square', 0.05);
  },
};

// kind: correct | wrong | win | tap | spin. קוראים מתוך מטפל לחיצה (מחווה של המשתמש)
export function play(kind) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    if (SOUNDS[kind]) SOUNDS[kind](c);
  } catch {
    // לא קריטי
  }
}

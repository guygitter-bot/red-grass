// השמעת השירים. הקטע (30 שניות) מגיע דרך השרת שלנו (/audio), נטען מראש בזמן הספירה לאחור,
// ומתנגן בדיוק כמה שניות שצריך (5, או 10 עם הארכה) – עם Web Audio.
// בטלפונים צריך "לפתוח" את השמע בנגיעה של המשתמש – לכן unlockAudio נקרא בכל לחיצה (main.jsx).
import { API } from './api';

let ctx = null;
const buffers = new Map(); // מקור -> Promise<AudioBuffer>
let current = null;
const listeners = new Set();

export function unlockAudio() {
  try {
    // באייפון: לנגן גם כשהטלפון על "שקט"
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().then(notify, () => {});
    notify();
  } catch {
    // אין שמע בדפדפן הזה
  }
}

// האם צריך עוד נגיעה כדי שיהיה קול
export const audioLocked = () => !ctx || ctx.state !== 'running';

// מי שרוצה לדעת מתי מתחיל/נגמר ניגון (האקולייזר על המסך)
export function onAudioChange(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify() {
  for (const fn of listeners) fn();
}
export const isPlaying = () => !!current;

export const songUrl = (src) => `${API}/audio?s=${encodeURIComponent(src)}`;

const decode = (data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));

// טעינה מראש (פעם אחת לכל שיר; זוכרים רק את האחרונים)
export function loadSong(src) {
  if (!src) return Promise.reject(new Error('אין שיר'));
  if (!buffers.has(src)) {
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return Promise.reject(new Error('אין שמע בדפדפן הזה'));
    }
    const p = fetch(songUrl(src))
      .then((res) => {
        if (!res.ok) throw new Error('השיר לא נטען');
        return res.arrayBuffer();
      })
      .then(decode);
    p.catch(() => buffers.delete(src));
    buffers.set(src, p);
    while (buffers.size > 4) buffers.delete(buffers.keys().next().value);
  }
  return buffers.get(src);
}

export function stopSong() {
  if (!current) return;
  const { node, gain } = current;
  current = null;
  try {
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    node.stop(ctx.currentTime + 0.2);
  } catch {
    // כבר נעצר
  }
  notify();
}

// מנגן seconds שניות מתוך השיר, החל מ-offset. מחזיר false אם לא הצליח
export async function playSong(src, offset, seconds) {
  stopSong();
  let buffer;
  try {
    buffer = await loadSong(src);
  } catch {
    return false;
  }
  if (!ctx || ctx.state !== 'running') return false;
  stopSong();
  const start = Math.min(offset, Math.max(0, buffer.duration - 1));
  const length = Math.min(seconds, buffer.duration - start);
  const node = ctx.createBufferSource();
  const gain = ctx.createGain();
  node.buffer = buffer;
  const t = ctx.currentTime + 0.02;
  // כניסה ויציאה רכות, כדי שלא יהיה "קליק"
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(1, t + 0.08);
  gain.gain.setValueAtTime(1, t + length - 0.3);
  gain.gain.linearRampToValueAtTime(0, t + length);
  node.connect(gain).connect(ctx.destination);
  const me = { node, gain };
  node.onended = () => {
    if (current === me) {
      current = null;
      notify();
    }
  };
  node.start(t, start, length);
  current = me;
  notify();
  return true;
}

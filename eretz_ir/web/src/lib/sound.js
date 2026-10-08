// צלצול נעים (פעמון קטן בשני צלילים) – נוצר בדפדפן, בלי קובץ שמע.
// בטלפונים צריך "לפתוח" את השמע בנגיעה ראשונה של המשתמש – לכן unlockAudio נקרא בכל לחיצה.
let ctx = null;

export function unlockAudio() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    // אין שמע בדפדפן הזה
  }
}

function bell(freq, start, length = 1.2) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length);
}

export function chime() {
  try {
    unlockAudio();
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    bell(880, t); // לה
    bell(1318.5, t + 0.18); // מי – למעלה
  } catch {
    // לא נורא
  }
}

// כלים למסכי הלילה: מסך שלא נכבה, צלצול עדין והקראה בקול.

// מסך דולק (Wake Lock). כשחוזרים לאפליקציה – מבקשים שוב.
export function keepAwake() {
  let lock = null;
  let on = true;
  const ask = async () => {
    try {
      if (on && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
      }
    } catch {
      // לא נתמך / נדחה – ממשיכים בלי
    }
  };
  const onVis = () => {
    ask();
  };
  document.addEventListener('visibilitychange', onVis);
  ask();
  return () => {
    on = false;
    document.removeEventListener('visibilitychange', onVis);
    try {
      lock?.release();
    } catch {
      // כבר שוחרר
    }
  };
}

let ctx = null;
function audio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// צלצול רך (כמו קערה טיבטית) – בלי קבצים
export function chime(volume = 0.25) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  for (const [f, v] of [[528, 1], [792, 0.4], [1056, 0.2]]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume * v, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 3.6);
  }
}

// קול בעברית, אם יש במכשיר
export function hebrewVoice() {
  try {
    const vs = window.speechSynthesis?.getVoices() || [];
    return vs.find((v) => /^he|^iw/i.test(v.lang)) || null;
  } catch {
    return null;
  }
}

// הקראה שקטה ואיטית. מחזיר false אם אין קול עברי (אז מסתפקים בצלצול ובטקסט על המסך).
export function speak(text) {
  const v = hebrewVoice();
  if (!v || !text) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v;
    u.lang = v.lang;
    u.rate = 0.8;
    u.pitch = 0.9;
    u.volume = 0.7;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // אין
  }
}

// רטט קצר (אנדרואיד)
export function buzz(ms = 40) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // אין
  }
}

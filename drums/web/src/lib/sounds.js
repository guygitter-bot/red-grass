// הצלילים: דגימות אמיתיות של סט תופים אקוסטי (public/samples, Virtuosity Drums, CC0) שמנוגנות דרך Web Audio.
// הסינתזה (synth.js) נשארת רק גיבוי: בזמן שהדגימות נטענות או אם הטעינה נכשלה – לא קורסים ולא שותקים.
// voice = כוונון הסט (ראו DEFAULT_VOICE ב-kit.js) והופך את אותן דגימות לצלילים שונים (כוונון, קיצור, עמעום).
// ה-AudioContext נוצר בנגיעה הראשונה ('interactive' = השהיה מינימלית).
import { PIECES, DEFAULT_VOICE } from './kit';
import { allSampleFiles, pieceSample, pickFile, NATURAL } from './samples';
import { createSynth } from './synth';

let ctx = null;
let master = null;
let synth = null;
let volume = 0.8;

// ---- טעינת הדגימות ----
const raw = new Map(); // שם קובץ -> ArrayBuffer (הורד, עוד לא פוענח)
const buffers = new Map(); // שם קובץ -> AudioBuffer
let status = 'idle'; // idle | loading | ready | error
let fetching = null;
const listeners = new Set();

function setStatus(s) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

export function getSamplesStatus() {
  return status;
}

// מאזין לשינוי מצב הטעינה (מחזיר פונקציית ביטול)
export function onSamplesStatus(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// פענוח עם נפילה לצורת ה-callback (ספארי ישן לא מחזיר Promise)
function decode(buf) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(buf, resolve, reject);
    if (p && typeof p.catch === 'function') p.catch(reject);
  });
}

// מפענח את מה שהורד ויש כבר AudioContext. כל קובץ שנכשל פשוט נשאר בלי דגימה (הגיבוי ינגן במקומו)
async function decodeAll() {
  if (!ctx) return;
  const names = [...raw.keys()].filter((n) => !buffers.has(n));
  await Promise.all(
    names.map(async (n) => {
      try {
        buffers.set(n, await decode(raw.get(n).slice(0)));
      } catch {
        /* דגימה בעייתית – הגיבוי ינגן */
      }
    }),
  );
  if (fetching === null && buffers.size > 0) setStatus('ready');
}

// מוריד את כל הדגימות (פעם אחת). לא צריך AudioContext, אז אפשר להתחיל כבר בפתיחת האפליקציה
export function preloadSamples() {
  if (fetching || status === 'ready') return;
  setStatus('loading');
  const base = new URL('samples/', document.baseURI).href;
  fetching = Promise.all(
    allSampleFiles().map(async (name) => {
      try {
        const res = await fetch(base + name);
        if (!res.ok) throw new Error(String(res.status));
        raw.set(name, await res.arrayBuffer());
      } catch {
        /* קובץ שלא ירד – הגיבוי ינגן */
      }
    }),
  ).then(async () => {
    fetching = null;
    if (raw.size === 0) {
      setStatus('error');
      return;
    }
    await decodeAll();
    if (!ctx && status === 'loading') setStatus('ready'); // יפוענחו בנגיעה הראשונה
  });
}

export function ensureAudio() {
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      ctx = new AC();
    }
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor(); // מונע עיוות כשמכים הרבה יחד
    master.connect(comp);
    comp.connect(ctx.destination);
    synth = createSynth(ctx, master);
    preloadSamples();
    decodeAll();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setMasterVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
}

// ---- ניגון דגימה ----
const rrCounters = {}; // מונה סבבים לכל קבוצה, כדי שמכות חוזרות לא יישמעו כמו מכונה
let openHat = null; // { src, gain } – היי-האט פתוח שמתנגן כרגע (נחנק כשסוגרים)

function chokeOpenHat(t) {
  if (!openHat) return;
  try {
    openHat.gain.gain.cancelScheduledValues(t);
    openHat.gain.gain.setTargetAtTime(0, t, 0.008);
    openHat.src.stop(t + 0.08);
  } catch {
    /* כבר נעצר */
  }
  openHat = null;
}

// מנגן דגימה לפי המפרט מ-pieceSample. מחזיר false אם אין דגימה (אז מנגנים בסינתזה)
function playSample(group, s, strength, t) {
  const file = pickFile(group, strength, (rrCounters[group] = (rrCounters[group] || 0) + 1));
  const buffer = file && buffers.get(file);
  if (!buffer) return null;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = s.rate;
  const g = ctx.createGain();
  g.gain.value = s.gain * (0.7 + 0.3 * strength);
  let node = src;
  const chain = (n) => {
    node.connect(n);
    node = n;
  };
  if (s.highpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = s.highpass;
    chain(f);
  }
  if (s.peak) {
    const f = ctx.createBiquadFilter();
    f.type = 'peaking';
    f.frequency.value = 3800;
    f.Q.value = 0.8;
    f.gain.value = s.peak;
    chain(f);
  }
  if (s.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = s.lowpass;
    chain(f);
  }
  chain(g);
  g.connect(master);
  // סט "מחונק" (למשל רינגו): הצליל נחתך מוקדם בדעיכה חלקה
  const natural = (NATURAL[group] || 1) / s.rate;
  if (s.decay < 0.98) {
    const end = Math.max(0.06, natural * s.decay);
    g.gain.setValueAtTime(g.gain.value, t + end * 0.25);
    g.gain.setTargetAtTime(0, t + end * 0.25, end * 0.22);
    src.stop(t + end * 1.6);
  }
  src.start(t);
  return { src, gain: g };
}

// מנגן חלק אחד של הסט. strength (0..1, לא חובה) = עוצמת המכה; בלי זה – קצת אקראי, בעיקר בינוני-חזק
// when (לא חובה) = זמן עתידי בשעון האודיו (audioTime) – למצב הלימוד, שמתזמן מכות מראש
export function playPiece(id, voice, strength, when) {
  const spec = PIECES[id];
  if (!spec || !ensureAudio()) return;
  const v = { ...DEFAULT_VOICE, ...(voice || {}) };
  const t = typeof when === 'number' ? Math.max(when, ctx.currentTime + 0.001) : ctx.currentTime + 0.001;
  const power = typeof strength === 'number' ? strength : 0.5 + Math.random() * 0.5;
  const s = pieceSample(id, v);
  const isHat = spec.type === 'hihat' || spec.type === 'hihatOpen';
  // סגירה חונקת את הפתוח (בכל מצב, גם בגיבוי)
  if (isHat) {
    chokeOpenHat(t);
    synth.choke(t);
  }
  let played = null;
  try {
    played = s && buffers.size > 0 ? playSample(s.group, s, power, t) : null;
  } catch {
    played = null;
  }
  if (!played) {
    synth.play(id, v, t);
    return;
  }
  if (spec.type === 'hihatOpen') openHat = played;
}

// ---- שעון האודיו (למצב לימוד) ----
// הזמן הנוכחי בשעון האודיו, או 0 אם עוד אין הקשר אודיו
export function audioTime() {
  return ctx ? ctx.currentTime : 0;
}
// השהיית היציאה בשניות (בין "מנגן" ל"נשמע") – כדי ליישר חזותית ודירוג לצליל שנשמע
export function audioLatency() {
  if (!ctx) return 0;
  const l = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  return Number.isFinite(l) ? Math.min(l, 0.3) : 0;
}
// קליק של מטרונום בזמן מדויק (שעון האודיו)
export function playClick(when, accent) {
  if (!ensureAudio()) return;
  synth.click(Math.max(when, ctx.currentTime), !!accent);
}

// ---- מטרונום: מתזמן קדימה בדיוק של שעון האודיו (הקליק מסונתז) ----
const metro = { timer: null, bpm: 100, next: 0, beat: 0 };

export function startMetronome(bpm) {
  if (!ensureAudio() || metro.timer) return;
  metro.bpm = bpm;
  metro.beat = 0;
  metro.next = ctx.currentTime + 0.05;
  metro.timer = setInterval(() => {
    while (metro.next < ctx.currentTime + 0.12) {
      synth.click(metro.next, metro.beat % 4 === 0);
      metro.next += 60 / metro.bpm;
      metro.beat += 1;
    }
  }, 25);
}

export function setMetronomeBpm(bpm) {
  metro.bpm = bpm;
}

export function stopMetronome() {
  if (metro.timer) clearInterval(metro.timer);
  metro.timer = null;
}

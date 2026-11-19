// סינתזה ב-Web Audio – הגיבוי כשהדגימות האמיתיות (samples.js) עוד נטענות או לא נטענו.
// גם הקליק של המטרונום מגיע מכאן. voice = כוונון הסט (ראו DEFAULT_VOICE ב-kit.js).
import { PIECES } from './kit';

// גובה הטום לפי המספר (טום 1 הגבוה ביותר)
const TOM_PITCH = { tom1: 210, tom2: 170, tom3: 145, tom4: 125, floor1: 100, floor2: 80 };

export function createSynth(ctx, master) {
  // שנייה ומחצה של רעש לבן, משמשת את כל הצלילים
  const noise = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  let openHat = null; // היי-האט פתוח שמתנגן כרגע (נחנק כשסוגרים)

  // מעטפת עוצמה: קפיצה מהירה למעלה וגמר אקספוננציאלי
  function env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function osc(type, freq, t, dur) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  function noiseSrc(t, dur) {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    n.start(t, Math.random() * 0.4);
    n.stop(t + dur + 0.05);
    return n;
  }

  function filter(type, freq, q = 0.7) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  function gain(v = 1) {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  }

  // בס: סינוס שצלילו צונח מהר + נקישה קצרה של רעש
  function kick(t, v, detune = 1) {
    const f = 52 * v.kickTune * detune;
    const dur = 0.38 * v.kickDecay;
    const o = osc('sine', f * 3.2, t, dur);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    const g = gain(0);
    env(g, t, 1, dur);
    o.connect(g).connect(master);
    if (v.kickClick > 0.01) {
      const n = noiseSrc(t, 0.02);
      const hp = filter('highpass', 2500);
      const ng = gain(0);
      env(ng, t, 0.5 * v.kickClick, 0.015);
      n.connect(hp).connect(ng).connect(master);
    }
  }

  // סנר: גוף (שני צלילים) + רעש מסונן (החוטים)
  function snare(t, v) {
    const f = 185 * v.snareTune;
    const dur = 0.16 * v.snareDecay;
    for (const [mul, level] of [[1, 0.55], [1.7, 0.25]]) {
      const o = osc('triangle', f * mul * 1.25, t, dur);
      o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.04);
      const g = gain(0);
      env(g, t, level, dur * 0.7);
      o.connect(g).connect(master);
    }
    const n = noiseSrc(t, dur * 1.5);
    const hp = filter('highpass', 1400);
    const bp = filter('peaking', 4500, 0.8);
    bp.gain.value = 5;
    const ng = gain(0);
    env(ng, t, 0.7 * v.snareSnap, dur * 1.4);
    n.connect(hp).connect(bp).connect(ng).connect(master);
  }

  // טום וטום רצפה: סינוס עם צניחה קלה + נקישה
  function tom(t, v, base, floor) {
    const f = base * v.tomTune;
    const dur = (floor ? 0.55 : 0.4) * v.tomDecay;
    const o = osc('sine', f * 1.5, t, dur);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    const g = gain(0);
    env(g, t, 0.95, dur);
    o.connect(g).connect(master);
    const n = noiseSrc(t, 0.03);
    const bp = filter('bandpass', f * 6, 1);
    const ng = gain(0);
    env(ng, t, 0.25, 0.025);
    n.connect(bp).connect(ng).connect(master);
  }

  // צליל מתכתי: ששה מרובעים בתדרים "לא הרמוניים" דרך מסנן, בצירוף רעש לנצנוץ
  const METAL = [2, 3, 4.16, 5.43, 6.79, 8.21];
  function metal(t, { base, dur, hp, level, noiseLevel = 0.3, bright }) {
    const g = gain(0);
    env(g, t, level, dur);
    const high = filter('highpass', hp * bright);
    const band = filter('bandpass', 9500 * bright, 0.6);
    high.connect(band).connect(g).connect(master);
    for (const r of METAL) osc('square', base * r, t, dur).connect(high);
    if (noiseLevel > 0) {
      const n = noiseSrc(t, dur);
      const ng = gain(noiseLevel);
      n.connect(ng).connect(high);
    }
    return g;
  }

  function hihat(t, v, open) {
    if (open) {
      if (openHat) openHat.gain.setTargetAtTime(0, t, 0.01);
      openHat = metal(t, { base: 40, dur: 0.5 * v.cymDecay, hp: 7000, level: 0.32, bright: v.cymBright });
    } else {
      // סגירה חונקת את הפתוח
      if (openHat) openHat.gain.setTargetAtTime(0, t, 0.008);
      openHat = null;
      metal(t, { base: 40, dur: 0.07 * v.cymDecay, hp: 7000, level: 0.38, bright: v.cymBright });
    }
  }

  function cymbal(t, v, type) {
    const d = v.cymDecay;
    const b = v.cymBright;
    if (type === 'crash') metal(t, { base: 32, dur: 1.7 * d, hp: 4500, level: 0.36, noiseLevel: 0.5, bright: b });
    else if (type === 'ride') {
      metal(t, { base: 36, dur: 1.2 * d, hp: 6000, level: 0.22, noiseLevel: 0.12, bright: b });
      // "פינג" של הרייד
      const o = osc('sine', 3100 * b, t, 0.35 * d);
      const g = gain(0);
      env(g, t, 0.16, 0.3 * d);
      o.connect(g).connect(master);
    } else if (type === 'china') metal(t, { base: 24, dur: 1.1 * d, hp: 2800, level: 0.38, noiseLevel: 0.7, bright: b });
    else if (type === 'splash') metal(t, { base: 46, dur: 0.55 * d, hp: 6500, level: 0.3, noiseLevel: 0.35, bright: b });
  }

  function cowbell(t, v) {
    const dur = 0.28 * v.cymDecay;
    const bp = filter('bandpass', 800 * v.cymBright, 1.4);
    const g = gain(0);
    env(g, t, 0.5, dur);
    bp.connect(g).connect(master);
    for (const f of [562, 845]) osc('square', f, t, dur).connect(bp);
  }

  // גובה הטום לפי המספר (טום 1 הגבוה ביותר)
  const TOM_PITCH = { tom1: 210, tom2: 170, tom3: 145, tom4: 125, floor1: 100, floor2: 80 };


  // חונק היי-האט פתוח (כשהיי-האט סגור / פדל מנגן)
  function choke(t) {
    if (openHat) openHat.gain.setTargetAtTime(0, t, 0.008);
    openHat = null;
  }

  // מנגן חלק אחד
  function play(id, v, t) {
    const spec = PIECES[id];
    if (!spec) return;
    switch (spec.type) {
      case 'kick': kick(t, v, id === 'kick2' ? 1.04 : 1); break;
      case 'snare': snare(t, v); break;
      case 'hihat': hihat(t, v, false); break;
      case 'hihatOpen': hihat(t, v, true); break;
      case 'tom': tom(t, v, TOM_PITCH[id], false); break;
      case 'floor': tom(t, v, TOM_PITCH[id], true); break;
      case 'cowbell': cowbell(t, v); break;
      default: cymbal(t, v, spec.type);
    }
  }

  // קליק של המטרונום
  function click(t, accent) {
    const o = osc('square', accent ? 1500 : 1000, t, 0.04);
    const g = gain(0);
    env(g, t, 0.25, 0.035);
    o.connect(g).connect(master);
  }

  return { play, click, choke };
}

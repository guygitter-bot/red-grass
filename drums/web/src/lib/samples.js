// מיפוי חלקי הסט לדגימות האמיתיות (public/samples, Virtuosity Drums, CC0). פונקציות טהורות – נבדקות ב-samples.test.js.
import { PIECES, DEFAULT_VOICE } from './kit';

// קבוצות דגימות: כל קבוצה = רשימת רמות עוצמה (חלש → חזק), ובכל רמה כמה "סבבים" (round-robin) שמתחלפים
const lv = (name, levels, rr) =>
  Array.from({ length: levels }, (_, l) =>
    Array.from({ length: rr }, (_, r) => (rr > 1 ? `${name}_v${l + 1}_${r + 1}.m4a` : `${name}_v${l + 1}.m4a`)),
  );

export const SAMPLE_GROUPS = {
  kick: lv('kick', 3, 2),
  snare: lv('snare', 3, 2),
  hhClosed: lv('hh_closed', 2, 2),
  hhOpen: lv('hh_open', 2, 2),
  hhPedal: [['hh_pedal_1.m4a']],
  htom: lv('htom', 3, 1),
  ltom: lv('ltom', 3, 1),
  crash: lv('crash', 2, 1),
  ride: lv('ride', 2, 1),
  bell: [['ride_bell.m4a']],
  cowbell: lv('cowbell', 2, 1),
};

// כל קובצי הדגימות (לטעינה)
export function allSampleFiles() {
  const out = [];
  for (const levels of Object.values(SAMPLE_GROUPS)) for (const rrs of levels) out.push(...rrs);
  return out;
}

// אורך טבעי בערך (שניות) של כל קבוצה – לקיצור כשהקול של הסט "מחונק"
export const NATURAL = {
  kick: 0.8, snare: 0.7, hhClosed: 0.3, hhOpen: 1.6, hhPedal: 0.3,
  htom: 1.1, ltom: 1.2, crash: 2.4, ride: 2.1, bell: 1.6, cowbell: 0.6,
};

// כוונון (מכפיל playbackRate) של כל טום, יחסית לדגימה שממנה הוא נגזר: ארבעה טומים ושני טומי רצפה, כל אחד בגובה שונה
const TOMS = {
  tom1: { group: 'htom', rate: 1.34 },
  tom2: { group: 'htom', rate: 1.12 },
  tom3: { group: 'htom', rate: 0.95 },
  tom4: { group: 'htom', rate: 0.82 },
  floor1: { group: 'ltom', rate: 1.05 },
  floor2: { group: 'ltom', rate: 0.86 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// מה לנגן עבור חלק בסט. מחזיר { group, rate, gain, lowpass, decay, highpass, peak } או null לחלק לא מוכר.
//  rate = כוונון · gain = עוצמה יחסית · lowpass (הרץ, 0 = בלי) · highpass · decay = מכפיל אורך (מתחת ל-1 = קיצור)
//  peak = הגברה סביב תדר "נוכחות" (דציבלים) שנותנת אופי לצ'יינה
export function pieceSample(id, voiceIn) {
  const spec = PIECES[id];
  if (!spec) return null;
  const v = { ...DEFAULT_VOICE, ...(voiceIn || {}) };
  const base = { lowpass: 0, highpass: 0, peak: 0, decay: 1 };
  const bright = clamp(v.cymBright, 0.5, 2);
  switch (spec.type) {
    case 'kick':
      return {
        ...base, group: 'kick', rate: clamp(v.kickTune, 0.5, 1.6) * (id === 'kick2' ? 1.03 : 1), gain: 1,
        // נקישה נמוכה = צליל חמים יותר
        lowpass: v.kickClick < 0.4 ? 2500 + v.kickClick * 6000 : 0, decay: v.kickDecay,
      };
    case 'snare':
      return {
        ...base, group: 'snare', rate: clamp(v.snareTune, 0.6, 1.6), gain: 0.9,
        lowpass: v.snareSnap < 0.8 ? 3000 + v.snareSnap * 4000 : 0, decay: v.snareDecay,
      };
    case 'hihat':
      return { ...base, group: 'hhClosed', rate: Math.pow(bright, 0.25), gain: 0.55 };
    case 'hihatOpen':
      return { ...base, group: 'hhOpen', rate: Math.pow(bright, 0.25), gain: 0.55, decay: v.cymDecay };
    case 'tom':
    case 'floor': {
      const t = TOMS[id] || TOMS.tom1;
      return { ...base, group: t.group, rate: t.rate * clamp(v.tomTune, 0.5, 1.6), gain: 0.95, decay: v.tomDecay };
    }
    case 'crash':
      return { ...base, group: 'crash', rate: (id === 'crash2' ? 1.1 : 1) * Math.pow(bright, 0.3), gain: 0.5, decay: v.cymDecay };
    case 'ride':
      return { ...base, group: 'ride', rate: Math.pow(bright, 0.3), gain: 0.5, decay: v.cymDecay };
    case 'china':
      // צ'יינה: קראש נמוך ועקוב עם הדגשת נוכחות, קצר יותר
      return { ...base, group: 'crash', rate: 0.78, gain: 0.5, peak: 7, highpass: 700, decay: Math.min(v.cymDecay, 1) * 0.65 };
    case 'splash':
      // ספלאש: קראש גבוה וקצר
      return { ...base, group: 'crash', rate: 1.65 * Math.pow(bright, 0.3), gain: 0.4, highpass: 900, decay: Math.min(v.cymDecay, 1) * 0.3 };
    case 'cowbell':
      return { ...base, group: 'cowbell', rate: Math.pow(bright, 0.3), gain: 0.8, decay: v.cymDecay };
    default:
      return null;
  }
}

// איזו רמת עוצמה לבחור: strength בין 0 ל-1
export function levelIndex(count, strength) {
  return clamp(Math.floor(clamp(strength, 0, 0.999) * count), 0, count - 1);
}

// איזה קובץ לנגן: רמה לפי strength, והסבבים מתחלפים (rrCounter עולה בכל מכה)
export function pickFile(group, strength, rrCounter) {
  const levels = SAMPLE_GROUPS[group];
  if (!levels) return null;
  const rrs = levels[levelIndex(levels.length, strength)];
  return rrs[rrCounter % rrs.length];
}

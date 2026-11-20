// אזורי הקשה: איפה על החלק פגעו (רדיוס מנורמל r: 0 = מרכז, 1 = שפה) משנה את הצליל, כמו בתוף אמיתי.
// פונקציות טהורות – נבדקות ב-zones.test.js. אין כאן אודיו ולא DOM. אותן דגימות (Virtuosity) – רק מסננים, עוצמה וכוונון.

// שם האזור לפי סוג החלק ורדיוס. בלי r (מקלדת, שיעור, גיבוי) – האזור הרגיל של החלק
export function zoneAt(type, r) {
  const ok = typeof r === 'number' && Number.isFinite(r);
  const x = ok ? Math.min(1, Math.max(0, r)) : null;
  switch (type) {
    case 'snare':
      return x === null || x < 0.62 ? 'center' : x < 0.86 ? 'edge' : 'rim';
    case 'tom':
    case 'floor':
      return x === null || x < 0.62 ? 'center' : 'edge';
    case 'hihat':
    case 'hihatOpen':
      return x === null || x < 0.68 ? 'center' : 'edge';
    case 'ride':
      return x === null ? 'bow' : x < 0.22 ? 'bell' : x < 0.8 ? 'bow' : 'edge';
    case 'crash':
    case 'china':
    case 'splash':
      return x === null ? 'mid' : x < 0.3 ? 'center' : x < 0.65 ? 'mid' : 'edge';
    default:
      return 'center';
  }
}

// מה משתנה בכל אזור: gain / rate / decay = מכפילים; peak (דציבל), highpass / lowpass (הרץ) = הוספה;
// vel = הטיה בעוצמת המכה (הדגימה הרכה / החזקה); group = דגימה אחרת (פעמון הרייד)
const TWEAKS = {
  snare: {
    edge: { gain: 0.82, rate: 1.03, highpass: 180, peak: 3, vel: -0.1 },
    // קרוב לחישוק = "רימשוט": חזק, בהיר ושמיעה קצרה יותר (אין דגימת קרוס־סטיק בחבילה, אז מסננים)
    rim: { gain: 1.18, rate: 1.07, peak: 7, decay: 0.75, vel: 0.14 },
  },
  tom: { edge: { gain: 0.8, rate: 1.04, highpass: 140, peak: 2, vel: -0.1 } },
  floor: { edge: { gain: 0.8, rate: 1.04, highpass: 140, peak: 2, vel: -0.1 } },
  hihat: { edge: { gain: 0.92, rate: 1.05, peak: 5, vel: 0.05 } },
  hihatOpen: { edge: { gain: 0.92, rate: 1.05, peak: 5, vel: 0.05 } },
  ride: {
    bell: { group: 'bell', gain: 1.0, rate: 1, vel: 0.05 },
    edge: { gain: 1.1, rate: 1.03, highpass: 500, peak: 4, decay: 1.2, vel: 0.08 },
  },
  crash: { center: { gain: 0.7, lowpass: 4800, rate: 0.97, vel: -0.15 }, edge: { gain: 1.15, peak: 2, vel: 0.1 } },
  china: { center: { gain: 0.7, lowpass: 4800, rate: 0.97, vel: -0.15 }, edge: { gain: 1.15, peak: 2, vel: 0.1 } },
  splash: { center: { gain: 0.7, lowpass: 5200, rate: 0.97, vel: -0.15 }, edge: { gain: 1.15, peak: 2, vel: 0.1 } },
};

const tweak = (type, zone) => (TWEAKS[type] && TWEAKS[type][zone]) || null;

// מפרט דגימה (מ-pieceSample) אחרי האזור. אזור רגיל / לא מוכר – אותו מפרט בדיוק
export function applyZone(s, type, zone) {
  const t = tweak(type, zone);
  if (!s || !t) return s;
  return {
    ...s,
    group: t.group || s.group,
    gain: s.gain * (t.gain ?? 1),
    rate: s.rate * (t.rate ?? 1),
    decay: s.decay * (t.decay ?? 1),
    peak: s.peak + (t.peak || 0),
    highpass: Math.max(s.highpass || 0, t.highpass || 0),
    lowpass: t.lowpass ? (s.lowpass ? Math.min(s.lowpass, t.lowpass) : t.lowpass) : s.lowpass,
  };
}

// הטיית עוצמה של האזור (נוספת לעוצמת המכה)
export function zoneVelBias(type, zone) {
  const t = tweak(type, zone);
  return t && typeof t.vel === 'number' ? t.vel : 0;
}

// תוויות בעברית לבדיקות ולמצב ניפוי
export const ZONE_LABEL = {
  center: 'מרכז', edge: 'שפה', rim: 'חישוק', bell: 'פעמון', bow: 'גוף', mid: 'אמצע',
};

// מיקום החלקים על הבמה, כמו שרואים את הסט מכיסא המתופף.
// x,y = מרכז החלק, s = קוטר; הכול ביחידות של "אחוז מרוחב הבמה" (y גם הוא באותה יחידה).
// שני מבנים: wide (טלפון לרוחב / מחשב) ו-tall (טלפון לאורך). הבדיקה ב-layout.test.js מוודאת שאין חפיפה.

export const STAGE_HEIGHT = { wide: 60, tall: 112 };

const FIXED = {
  wide: {
    kick: { x: 49, y: 49, s: 20 },
    snare: { x: 24, y: 42, s: 17 },
    hihat: { x: 9, y: 30, s: 15 },
    hihatOpen: { x: 9, y: 47, s: 12 },
    crash1: { x: 22, y: 11, s: 17 },
    crash2: { x: 80, y: 8, s: 14 },
    china: { x: 64, y: 7, s: 12 },
    splash: { x: 36, y: 6, s: 11 },
    cowbell: { x: 50, y: 8, s: 9 },
    ride: { x: 90, y: 24, s: 17 },
    floor1: { x: 74, y: 40, s: 16 },
    floor2: { x: 90, y: 45, s: 14 },
  },
  tall: {
    kick: { x: 50, y: 94, s: 32 },
    snare: { x: 40, y: 64, s: 26 },
    hihat: { x: 14, y: 58, s: 22 },
    hihatOpen: { x: 12, y: 80, s: 18 },
    crash1: { x: 17, y: 12, s: 21 },
    crash2: { x: 40, y: 9, s: 16 },
    china: { x: 60, y: 9, s: 16 },
    splash: { x: 50, y: 20, s: 12 },
    cowbell: { x: 32, y: 20, s: 11 },
    ride: { x: 82, y: 14, s: 22 },
    floor1: { x: 82, y: 60, s: 24 },
    floor2: { x: 86, y: 82, s: 20 },
  },
};
// כשיש שני בסים הם מתחלקים לשני צדדים
const DOUBLE_KICK = {
  wide: { kick: { x: 40.5, y: 49, s: 17 }, kick2: { x: 58.5, y: 49, s: 17 }, snare: { x: 24, y: 42, s: 17 } },
  tall: { kick: { x: 37, y: 97, s: 26 }, kick2: { x: 63, y: 97, s: 26 } },
};

// הטומים בשורה אחת, ממורכזים, בגודל שמתאים למספרם
function tomSlots(count, mode) {
  const out = {};
  const cfg = mode === 'wide'
    ? { cx: 50, y: 25, size: [15, 14, 14, 12.5], gap: 1.5 }
    : { cx: 50, y: 38, size: [23, 24, 22, 19], gap: 1 };
  const s = cfg.size[Math.max(0, count - 1)];
  const step = s + cfg.gap;
  for (let i = 0; i < count; i++) {
    out['tom' + (i + 1)] = { x: cfg.cx + (i - (count - 1) / 2) * step, y: cfg.y, s };
  }
  return out;
}

// רשימת {id,x,y,s} לכל חלקי הסט
export function layoutFor(pieces, mode = 'wide') {
  const m = mode === 'tall' ? 'tall' : 'wide';
  const toms = pieces.filter((id) => /^tom\d$/.test(id)).length;
  const slots = { ...FIXED[m], ...tomSlots(toms, m) };
  if (pieces.includes('kick2')) Object.assign(slots, DOUBLE_KICK[m]);
  return pieces.filter((id) => slots[id]).map((id) => ({ id, ...slots[id] }));
}

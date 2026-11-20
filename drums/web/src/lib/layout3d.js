// סידור הסט בתלת־ממד סביב כיסא המתופף + המצלמה שמתאימה ליחס המסך. פונקציות טהורות (בלי three) – נבדקות ב-layout3d.test.js.
// יחידות: מטרים. x = ימין המתופף, y = למעלה (0 = רצפת הבמה), z = לכיוון המתופף (הקהל ב-z שלילי).
// לכל חלק: pos = מרכז משטח הנגינה (בבס: מרכז המעטפת), axis = הכיוון שאליו העור/המצילה פונים, r = רדיוס,
// depth = עומק המעטפת (במצילה: עובי), kind = סוג (קובע איך בונים אותו), hitR = רדיוס אזור ההקשה.

export const SEAT = [0, 0.5, 0.64];
// גובה הידיים של המתופף – החלקים "מסתכלים" אליהן
const HANDS = [0, 1.0, 0.5];
// כמה רחוק אפשר להגיע מהכיסא (ידיים + מקל), במישור הרצפה
export const REACH = 1.3;

const KIND = {
  kick: 'kick', kick2: 'kick', snare: 'snare', hihat: 'hihat', hihatOpen: 'xhat',
  tom1: 'tom', tom2: 'tom', tom3: 'tom', tom4: 'tom', floor1: 'floor', floor2: 'floor',
  crash1: 'crash', crash2: 'crash', china: 'china', splash: 'splash', ride: 'ride', cowbell: 'cowbell',
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
export const vec = { sub, add, mul, dot, cross, len, norm };

// העור פונה למעלה, מוטה לכיוון הידיים במידה face (0 = שטוח, 1 = ישר אל הידיים)
function facing(pos, face) {
  const toHands = norm(sub(HANDS, pos));
  return norm(add(mul([0, 1, 0], 1 - face), mul(toHands, face)));
}

// הטומים על קשת סביב הידיים, משמאל (גבוה) לימין (נמוך). גודל לפי מספר הטומים
const TOM_R = { 1: [0.15], 2: [0.14, 0.155], 3: [0.12, 0.135, 0.15], 4: [0.105, 0.12, 0.135, 0.15] };
function tomSpots(n, tall) {
  if (!n) return {};
  const radii = TOM_R[n];
  const R = tall && n < 4 ? 0.7 : 0.74; // רדיוס הקשת סביב הידיים
  const gap = 0.035;
  // זוויות: מרווח לפי הקוטר, ממורכז מעט שמאלה (כמו בסט אמיתי – הטום הראשון מעל הבס, משמאל)
  const ang = [0];
  for (let i = 1; i < n; i++) ang.push(ang[i - 1] + (radii[i - 1] + radii[i] + gap) / R);
  const mid = (ang[0] + ang[n - 1]) / 2 + (n === 1 ? 0.12 : 0.02);
  const out = {};
  for (let i = 0; i < n; i++) {
    const a = ang[i] - mid;
    const pos = [R * Math.sin(a), 0.84 + (n >= 3 ? 0.02 : 0), HANDS[2] - R * Math.cos(a) - 0.02];
    out['tom' + (i + 1)] = { pos, r: radii[i], depth: radii[i] * 1.25, face: 0.42 };
  }
  return out;
}

// מקומות קבועים (wide = מסך רוחבי, tall = טלפון לאורך: הסט מכונס מעט לרוחב)
function fixedSpots(pieces, tall) {
  const many = pieces.filter((id) => /^tom\d$/.test(id)).length >= 3;
  const dk = pieces.includes('kick2');
  // tall: סידור קומפקטי יותר לרוחב (מכונס פנימה ועמוק יותר), כדי שהחלקים יהיו גדולים במסך צר
  const T = (w, t) => (tall ? t : w);
  const s = {
    kick: { pos: [dk ? -0.29 : 0, 0.27, -0.24], r: dk ? 0.26 : 0.28, depth: 0.42 },
    kick2: { pos: [0.29, 0.27, -0.24], r: 0.26, depth: 0.42 },
    snare: { pos: [dk ? -0.08 : T(-0.3, -0.27), 0.64, dk ? 0.26 : 0.22], r: 0.175, depth: 0.14, face: 0.12 },
    hihat: { pos: [many || dk ? -0.64 : T(-0.64, -0.56), 0.9, T(0.1, 0.16)], r: 0.18, depth: 0.03, face: 0.06 },
    hihatOpen: { pos: [T(-0.9, -0.7), 0.74, T(0.36, 0.52)], r: 0.15, depth: 0.03, face: 0.1 },
    floor1: { pos: [T(0.52, dk ? 0.56 : 0.47), 0.6, T(0.2, dk ? 0.3 : 0.26)], r: 0.21, depth: 0.4, face: 0.06 },
    floor2: { pos: [T(0.86, dk ? 0.8 : 0.66), 0.56, T(0.46, dk ? 0.68 : 0.62)], r: 0.19, depth: 0.38, face: 0.06 },
    crash1: { pos: [T(-0.5, -0.44), 1.24, -0.36], r: 0.23, depth: 0.02, face: 0.34 },
    crash2: { pos: [T(0.34, 0.3), 1.3, -0.5], r: 0.21, depth: 0.02, face: 0.34 },
    ride: { pos: [T(0.76, 0.66), many ? 1.06 : 1.0, T(-0.14, -0.06)], r: 0.27, depth: 0.025, face: 0.22 },
    china: { pos: [T(0.9, 0.78), 1.3, T(-0.22, -0.3)], r: 0.2, depth: 0.03, face: 0.3 },
    splash: { pos: [-0.12, 1.14, -0.56], r: 0.13, depth: 0.015, face: 0.4 },
    cowbell: { pos: [0.24, 1.08, -0.42], r: 0.07, depth: 0.16, face: 0.5 },
  };
  return s;
}

// הסידור המלא: רשימת חלקים (בסדר של kit.pieces) עם מיקום, כיוון, גודל ואזור הקשה
export function layout3d(kit, mode = 'wide') {
  const pieces = Array.isArray(kit) ? kit : kit.pieces;
  const tall = mode === 'tall';
  const toms = pieces.filter((id) => /^tom\d$/.test(id)).length;
  const spots = { ...fixedSpots(pieces, tall), ...tomSpots(toms, tall) };
  return pieces
    .filter((id) => spots[id] && KIND[id])
    .map((id) => {
      const s = spots[id];
      const kind = KIND[id];
      const axis = kind === 'kick' ? [0, 0, 1] : facing(s.pos, s.face || 0);
      const cym = ['crash', 'ride', 'china', 'splash', 'hihat', 'xhat'].includes(kind);
      // אזור ההקשה גדול מהחלק עצמו (נוח לאצבע), ובמצילות קטנות עוד יותר
      const hitR = Math.max(kind === 'cowbell' ? 0.2 : 0.17, s.r * (cym ? 1.1 : 1.15) + (s.r < 0.16 ? 0.05 : 0.02));
      // בבס מכים על העור האחורי (הפונה למתופף) – שם גם אזור ההקשה. בבס כפול: בצד החיצוני, שלא יוסתר בסנר
      const hitPos = kind === 'kick' ? [s.pos[0] * (tall ? (s.pos[0] < 0 ? 1.3 : 1) : 1.2), 0.2, s.pos[2] + s.depth / 2 + 0.06] : s.pos;
      return { id, kind, pos: s.pos, hitPos, axis, r: s.r, depth: s.depth, hitR };
    });
}

// ---- המצלמה ----
// מבט מהכיסא, מעט מלמעלה, מעל הסט אל הקהל. ברוחב: מבט נמוך יותר (רואים את הקהל), לאורך: יותר מלמעלה.
// fit: מוצאים מרחק והזזה כך שכל אזורי ההקשה בתוך המסך, ומשאירים את החלק העליון לקהל.

function project(cam, p) {
  const f = norm(sub(cam.target, cam.pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(p, cam.pos);
  const z = dot(d, f);
  const t = Math.tan((cam.fov * Math.PI) / 360);
  return { x: dot(d, r) / (z * t * cam.aspect), y: dot(d, u) / (z * t), z, scale: 1 / (z * t) };
}

// נקודה במסך (NDC: -1..1) + רדיוס בפיקסלים לכל חלק, לפי גובה המסך H
export function projectPieces(cam, layout, H) {
  return layout.map((p) => {
    const c = project(cam, p.hitPos);
    return { id: p.id, x: c.x, y: c.y, z: c.z, rPx: p.hitR * c.scale * (H / 2), visPx: p.r * c.scale * (H / 2) };
  });
}

export function cameraFor(layout, aspect) {
  // 0 = רוחב, 1 = לאורך
  const t = Math.min(1, Math.max(0, (1.3 - aspect) / (1.3 - 0.5)));
  const pitch = ((-30 - 12 * t) * Math.PI) / 180;
  const fov = 54 + 14 * t;
  // הפס העליון של המסך שמור לקהל ולאורות
  // במסך נמוך מאוד (טלפון לרוחב) הפס קטן יותר – כדי שהחלקים יישארו גדולים
  // לאורך: שפות המצילות החיצוניות יכולות לצאת מעט מהמסך – בתמורה כל הסט גדול יותר
  const bx = 0.96 + 0.1 * t;
  const band = { x0: -bx, x1: bx, y0: -0.98, y1: aspect > 1.9 ? 0.74 : 0.5 + 0.16 * t };
  const dir = [0, Math.sin(pitch), -Math.cos(pitch)];
  // מרכז התחלתי: מרכז הסט
  let target = [0, 0.8, -0.1];
  let dist = 3;
  for (let it = 0; it < 24; it++) {
    const cam = { pos: sub(target, mul(dir, dist)), target, fov, aspect };
    const f = norm(sub(target, cam.pos));
    const right = norm(cross(f, [0, 1, 0]));
    const up = cross(right, f);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of layout) {
      const c = project(cam, p.hitPos);
      const rx = p.hitR * c.scale / aspect;
      const ry = p.hitR * c.scale;
      x0 = Math.min(x0, c.x - rx); x1 = Math.max(x1, c.x + rx);
      y0 = Math.min(y0, c.y - ry); y1 = Math.max(y1, c.y + ry);
    }
    const s = Math.max((x1 - x0) / (band.x1 - band.x0), (y1 - y0) / (band.y1 - band.y0));
    // הזזה במישור המצלמה כדי למרכז את הסט בתוך הפס
    const dx = (x0 + x1) / 2 - (band.x0 + band.x1) / 2;
    // כשהרוחב הוא המגבלה – הסט יושב בתחתית, והמקום שנשאר למעלה הולך לקהל
    const wide = (x1 - x0) / (band.x1 - band.x0) >= (y1 - y0) / (band.y1 - band.y0);
    const dy = wide ? y0 - band.y0 : (y0 + y1) / 2 - (band.y0 + band.y1) / 2;
    const tz = Math.tan((fov * Math.PI) / 360) * dist;
    target = add(target, add(mul(right, dx * tz * aspect * 0.8), mul(up, dy * tz * 0.8)));
    dist *= 1 + (s - 1) * 0.8;
  }
  return { pos: sub(target, mul(dir, dist)), target, fov, aspect };
}

// מצב הסידור לפי יחס המסך
export function modeFor(aspect) {
  return aspect < 0.95 ? 'tall' : 'wide';
}

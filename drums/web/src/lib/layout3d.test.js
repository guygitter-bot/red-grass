import { describe, expect, it } from 'vitest';
import { KITS } from '../data/kits';
import { PIECE_IDS, buildPieces } from './kit';
import { cameraFor, layout3d, modeFor, projectPieces, REACH, SEAT, vec } from './layout3d';

// כל חלק כגליל: מרכז, ציר, רדיוס וחצי גובה (מצילה = דיסק דק + מרווח לתנודה)
function cylinder(p) {
  const cym = !['kick', 'snare', 'tom', 'floor', 'cowbell'].includes(p.kind);
  const half = cym ? 0.03 : p.depth / 2;
  const c = p.kind === 'kick' || cym ? p.pos : vec.sub(p.pos, vec.mul(p.axis, half));
  return { c, a: p.axis, r: p.r + (cym ? 0.015 : 0), half };
}

function inside(pt, cy) {
  const d = vec.sub(pt, cy.c);
  const h = vec.dot(d, cy.a);
  if (Math.abs(h) > cy.half) return false;
  return vec.len(vec.sub(d, vec.mul(cy.a, h))) < cy.r;
}

// נקודות בתוך הגליל (לבדיקת חפיפה)
function samples(cy) {
  const t = vec.norm(vec.cross(cy.a, Math.abs(cy.a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const b = vec.cross(cy.a, t);
  const out = [];
  for (const hf of [-1, -0.5, 0, 0.5, 1]) for (const rf of [0, 0.5, 0.97]) for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const off = vec.add(vec.mul(t, Math.cos(ang) * rf * cy.r), vec.mul(b, Math.sin(ang) * rf * cy.r));
    out.push(vec.add(vec.add(cy.c, vec.mul(cy.a, hf * cy.half)), off));
  }
  return out;
}

function problems3d(pieces, mode) {
  const L = layout3d(pieces, mode);
  const out = [];
  if (L.length !== pieces.length) out.push('חסר מקום לחלק');
  const cyl = L.map(cylinder);
  for (let i = 0; i < L.length; i++) {
    for (let j = 0; j < L.length; j++) {
      if (i === j) continue;
      if (samples(cyl[i]).some((pt) => inside(pt, cyl[j]))) out.push(`${L[i].id} חופף ל-${L[j].id}`);
    }
    const p = L[i].pos;
    const reach = Math.hypot(p[0] - SEAT[0], p[2] - SEAT[2]);
    if (reach > REACH) out.push(`${L[i].id} רחוק מדי (${reach.toFixed(2)})`);
  }
  return [...new Set(out)];
}

// מסכים לבדיקה: אזור הבמה בפועל (בלי התפריט והסרגל העליון)
const SCREENS = [
  { name: 'טלפון לאורך', W: 390, H: 640 },
  { name: 'טלפון לרוחב', W: 776, H: 336 },
  { name: 'מחשב', W: 1180, H: 700 },
  { name: 'מחשב עם פאנל לימוד', W: 790, H: 640 },
];

function problemsScreen(pieces, { W, H }) {
  const aspect = W / H;
  const L = layout3d(pieces, modeFor(aspect));
  const cam = cameraFor(L, aspect);
  const pr = projectPieces(cam, L, H);
  const out = [];
  for (const p of pr) {
    // כל אזור הקשה בתוך המסך, ובגודל אצבע (קוטר 52px לפחות)
    const px = ((p.x + 1) / 2) * W;
    const py = ((1 - p.y) / 2) * H;
    if (px < 0 || px > W || py < 0 || py > H) out.push(`${p.id} מחוץ למסך`);
    if (p.rPx < 26) out.push(`${p.id} קטן מדי (${p.rPx.toFixed(1)}px)`);
    if (p.z <= 0.3) out.push(`${p.id} מאחורי המצלמה`);
  }
  // מרכזי החלקים לא נופלים זה על זה
  for (let i = 0; i < pr.length; i++) for (let j = i + 1; j < pr.length; j++) {
    const a = pr[i];
    const b = pr[j];
    const d = Math.hypot(((a.x - b.x) * W) / 2, ((a.y - b.y) * H) / 2);
    if (d < 0.9 * Math.min(a.rPx, b.rPx)) out.push(`${a.id} ו-${b.id} צמודים מדי במסך`);
  }
  return out;
}

const BUILDER = [];
for (let t = 0; t <= 4; t++) for (let f = 0; f <= 2; f++) for (const dk of [false, true]) for (const c of [0, 2]) {
  BUILDER.push(buildPieces({ toms: t, floors: f, crashes: c, ride: true, china: true, splash: true, cowbell: true, doubleKick: dk }));
}

describe('סידור הסט בתלת־ממד', () => {
  for (const mode of ['wide', 'tall']) {
    it(`בלי חפיפות ובטווח הידיים – הסטים המפורסמים (${mode})`, () => {
      for (const k of KITS) expect(problems3d(k.pieces, mode), k.id).toEqual([]);
    });
    it(`בלי חפיפות – כל צירופי הבונה (${mode})`, () => {
      for (const p of BUILDER) expect(problems3d(p, mode), p.join(',')).toEqual([]);
    });
  }
  it('לכל חלק אפשרי יש מקום', () => {
    expect(layout3d(PIECE_IDS)).toHaveLength(PIECE_IDS.length);
  });
  it('הבס פונה למתופף, והתופים והמצילות פונים למעלה', () => {
    for (const p of layout3d(PIECE_IDS)) {
      if (p.kind === 'kick') expect(p.axis[2]).toBeGreaterThan(0.99);
      else expect(p.axis[1], p.id).toBeGreaterThan(0.6);
    }
  });
});

describe('המצלמה', () => {
  for (const s of SCREENS) {
    it(`כל החלקים במסך ובגודל אצבע – ${s.name}`, () => {
      for (const k of KITS) expect(problemsScreen(k.pieces, s), k.id).toEqual([]);
      for (const p of BUILDER) expect(problemsScreen(p, s), p.join(',')).toEqual([]);
    });
  }
  it('המצלמה מאחורי הסט ומעליו, מסתכלת אל הקהל', () => {
    for (const a of [0.6, 1.2, 2.3]) {
      const cam = cameraFor(layout3d(KITS[0]), a);
      expect(cam.pos[2]).toBeGreaterThan(SEAT[2]);
      expect(cam.pos[1]).toBeGreaterThan(1.2);
      expect(cam.target[2]).toBeLessThan(cam.pos[2]);
    }
  });
});

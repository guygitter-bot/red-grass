// גיטרות אמיתיות (GLB מ-Tripo): כיול מול הגיאומטריה המחושבת שלנו (מיתרים, שריגים, מיקום אצבעות).
// כל הקואורדינטות כאן הן במערכת של הדגם (y למעלה לכיוון הראש, z קדימה אל הצופה, x לרוחב), ביחידות הדגם (~מטר).
// N = נקודה על קו המיתר באום, B = נקודה על קו המיתר באוכף. מהן נגזרים כיוון הצוואר, הסקאלה והמיקום (ראו modelFrame).
import * as THREE from 'three';

const cache = new Map();
export function loadGuitarModel(url) {
  let c = cache.get(url);
  if (!c) {
    c = { gltf: null, promise: null };
    c.promise = import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
      .then((g) => {
        c.gltf = g;
        return g;
      });
    c.promise.catch(() => cache.delete(url));
    cache.set(url, c);
  }
  return c.promise;
}
export function loadedGuitarModel(url) {
  const c = cache.get(url);
  return c ? c.gltf : null;
}

export const MODEL_CAL = {
  classical: {
    file: 'guitars/classical.glb',
    N: [0, 0.801, 0.046],
    B: [0, 0.178, 0.081],
    // הדגם מונמך מתחת לקו המיתר (יחידות גיטרה), כך שהמיתרים שלנו מעל לוח האצבעות ולא בתוכו
    drop: 0.15,
    kw: 1,
    kt: 0.7,
    // מיתרים אפויים בדגם: משולשים שצפים מעל הדק (בין האוכף לחור הקול) נמחקים
    stringCut: { x: 0.06, y0: 0.188, y1: 0.362, zMin: 0.0615 },
    hideProcedural: 'all',
    // תיבות הדגשה בלתי נראות (מערכת הדגם): [חלק, צורה, מרכז, מידות, סיבוב x]
    proxies: [
      ['head', 'box', [0, 0.888, 0.012], [0.115, 0.176, 0.02], -0.28],
      ['pegs', 'box', [-0.064, 0.857, -0.008], [0.02, 0.026, 0.024]],
      ['pegs', 'box', [0.064, 0.857, -0.008], [0.02, 0.026, 0.024]],
      ['pegs', 'box', [-0.064, 0.897, -0.008], [0.02, 0.026, 0.024]],
      ['pegs', 'box', [0.064, 0.897, -0.008], [0.02, 0.026, 0.024]],
      ['pegs', 'box', [-0.064, 0.937, -0.008], [0.02, 0.026, 0.024]],
      ['pegs', 'box', [0.064, 0.937, -0.008], [0.02, 0.026, 0.024]],
      ['soundhole', 'disc', [0, 0.305, 0.0605], [0.062]],
      ['bridge', 'box', [0, 0.178, 0.078], [0.17, 0.04, 0.008]],
    ],
    // בורג הכוונון שאליו מגיע כל מיתר (פני הראש, מערכת הדגם). מיתרים 6-4 בצד x שלילי (z שלנו = -x)
    posts: {
      6: [-0.03, 0.845, 0.048], 5: [-0.03, 0.887, 0.04], 4: [-0.03, 0.935, 0.03],
      1: [0.03, 0.845, 0.048], 2: [0.03, 0.887, 0.04], 3: [0.03, 0.935, 0.03],
    },
    // עוגני תוויות (מערכת הדגם) ולאיזה צד התווית
    anchors: {
      head: [[0.0, 0.93, 0.02], 'up'],
      pegs: [[0.07, 0.9, 0.0], 'up'],
      soundhole: [[0.0, 0.365, 0.06], 'up'],
      body: [[0.15, 0.1, 0.06], 'down'],
      bridge: [[0.0, 0.2, 0.082], 'up'],
    },
    // מרכז לצורך מצלמה (במקום מרכז הגיאומטריה המחושבת)
    centers: { head: [0, 0.89, 0.02], body: [0, 0.2, 0.06], soundhole: [0, 0.305, 0.06], bridge: [0, 0.178, 0.075] },
    bodyPolygon: [[0.076, 0], [0.133, 0.02], [0.154, 0.04], [0.167, 0.06], [0.177, 0.08], [0.183, 0.1], [0.183, 0.12], [0.185, 0.14], [0.181, 0.16], [0.173, 0.18], [0.171, 0.2], [0.154, 0.22], [0.144, 0.24], [0.133, 0.26], [0.125, 0.28], [0.121, 0.3], [0.125, 0.32], [0.131, 0.34], [0.135, 0.36], [0.139, 0.38], [0.139, 0.4], [0.133, 0.42], [0.121, 0.44], [0.104, 0.46]],
  },
  electric: {
    file: 'guitars/electric.glb',
    // קו הצוואר של הדגם (המישור עובר דרך האוכף); האום וירטואלי (הצוואר שלנו) כדי שהגוף יצא בגודל טבעי
    N: [-0.005, 1.302, 0.0158],
    B: [-0.005, 0.255, 0.1205],
    drop: 0.3,
    kw: 1,
    kt: 0.55,
    // הצוואר של הדגם נחתך (בלי ראש) – משתמשים בצוואר ובראש המחושבים שלנו
    neckCut: { y: 0.58, x: 0.075 },
    stringCut: { x: 0.1, y0: 0.29, y1: 0.56, zAbove: 0.006 },
    hideProcedural: ['body', 'pickups', 'knobs', 'jack', 'bridge', 'extras'],
    proxies: [
      ['pickups', 'box', [0.002, 0.525, 0.108], [0.165, 0.066, 0.006]],
      ['pickups', 'box', [0.002, 0.356, 0.116], [0.165, 0.074, 0.006]],
      ['bridge', 'box', [0.003, 0.262, 0.123], [0.165, 0.07, 0.008]],
      ['knobs', 'disc3', [0.133, 0.247, 0.108], [0.03, 0.03]],
      ['knobs', 'disc3', [0.202, 0.26, 0.108], [0.03, 0.03]],
      ['knobs', 'disc3', [0.21, 0.19, 0.108], [0.03, 0.03]],
      ['knobs', 'disc3', [0.145, 0.16, 0.108], [0.03, 0.03]],
      ['jack', 'disc3', [0.15, 0.06, 0.074], [0.02, 0.02]],
    ],
    anchors: {
      pickups: [[0.0, 0.58, 0.114], 'up'],
      knobs: [[0.17, 0.12, 0.108], 'down'],
      jack: [[0.15, 0.06, 0.08], 'down'],
      bridge: [[0.0, 0.3, 0.125], 'up'],
      body: [[-0.2, 0.3, 0.1], 'up'],
    },
    centers: { body: [0, 0.3, 0.1], pickups: [0, 0.44, 0.113], knobs: [0.17, 0.2, 0.108], jack: [0.15, 0.06, 0.074], bridge: [-0.01, 0.255, 0.122] },
  },
};

// מסגרת: מתרגם נקודות של הדגם למערכת הצירים של הגיטרה (x לאורך הצוואר מהאום, y החוצה מהלוח, z לרוחב: מיתר 6 חיובי)
export function modelFrame(cal, S, stringRise) {
  const N = new THREE.Vector3(...cal.N);
  const B = new THREE.Vector3(...cal.B);
  const u = B.clone().sub(N);
  const len = u.length();
  u.divideScalar(len);
  const alpha = Math.atan(stringRise); // המיתר עולה מעל מישור הצוואר בשיפוע הזה
  const nu = new THREE.Vector3(0, 0, 1).addScaledVector(u, -u.z).normalize();
  const a = u.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(nu, -Math.sin(alpha));
  const n = u.clone().multiplyScalar(Math.sin(alpha)).addScaledVector(nu, Math.cos(alpha));
  const zl = new THREE.Vector3().crossVectors(a, n);
  const s = S / (B.clone().sub(N).dot(a));
  const y0 = 0.15; // גובה המיתר מעל לוח האצבעות באום (ys(0))
  const kt = cal.kt || 1; // דחיסת העובי (הדגמים של Tripo עבים מדי) סביב מישור הצוואר
  const O = N.clone().addScaledVector(n, -(y0 - (cal.drop || 0)) / (s * kt));
  const R = new THREE.Matrix4().makeBasis(a, n, zl).transpose();
  const M = new THREE.Matrix4()
    .makeScale(s, s * kt, s * (cal.kw || 1))
    .multiply(R)
    .multiply(new THREE.Matrix4().makeTranslation(-O.x, -O.y, -O.z));
  return { M, s };
}

// הכנת הדגם (פעם אחת לכל טעינה): מחיקת משולשים של מיתרים אפויים וצוואר חתוך. מחזיר גיאומטריה חדשה.
export function prepareGuitarGeometry(geom, cal) {
  const p = geom.attributes.position;
  const ix = geom.index;
  if (!ix) return geom;
  const keep = [];
  const tri = ix.count / 3;
  // מישור הצוואר (לצורך "מעל המישור")
  const sc = cal.stringCut;
  const nc = cal.neckCut;
  for (let f = 0; f < tri; f++) {
    const a = ix.getX(f * 3), b = ix.getX(f * 3 + 1), c = ix.getX(f * 3 + 2);
    const xs = [p.getX(a), p.getX(b), p.getX(c)];
    const ys = [p.getY(a), p.getY(b), p.getY(c)];
    const zs = [p.getZ(a), p.getZ(b), p.getZ(c)];
    const cy = (ys[0] + ys[1] + ys[2]) / 3;
    const cx = (xs[0] + xs[1] + xs[2]) / 3;
    let drop = false;
    if (nc && cy > nc.y && Math.abs(cx) < nc.x) drop = true;
    if (!drop && sc && xs.every((x) => Math.abs(x) < sc.x) && ys.every((y) => y > sc.y0 && y < sc.y1)) {
      if (sc.zMin != null && zs.every((z) => z > sc.zMin)) drop = true;
      if (sc.zAbove != null) {
        // מיתרים אפויים: רצועות דקות וארוכות שצפות מעל הפנים. נמחקות רק משולשים דקים (גובה קטן מאוד ביחס לאורך)
        const e = [Math.hypot(xs[1] - xs[0], ys[1] - ys[0], zs[1] - zs[0]), Math.hypot(xs[2] - xs[1], ys[2] - ys[1], zs[2] - zs[1]), Math.hypot(xs[0] - xs[2], ys[0] - ys[2], zs[0] - zs[2])];
        const L = Math.max(...e);
        const area2 = Math.hypot(
          (ys[1] - ys[0]) * (zs[2] - zs[0]) - (zs[1] - zs[0]) * (ys[2] - ys[0]),
          (zs[1] - zs[0]) * (xs[2] - xs[0]) - (xs[1] - xs[0]) * (zs[2] - zs[0]),
          (xs[1] - xs[0]) * (ys[2] - ys[0]) - (ys[1] - ys[0]) * (xs[2] - xs[0]),
        );
        const alt = area2 / L; // גובה מינימלי ~ 2*שטח/צלע ארוכה
        if (L > 0.025 && alt < 0.0045) drop = true;
      }
    }
    if (!drop) keep.push(a, b, c);
  }
  const g = geom.clone();
  g.setIndex(keep);
  return g;
}

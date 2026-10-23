// המורה: בובת חימר מסוגננת שיושבת על שרפרף ומנגנת בגיטרה.
//
// ממשק (כדי שאפשר יהיה להחליף בעתיד בדמות קנויה, glTF, בלי לגעת בשאר האפליקציה):
//   const t = createTeacher(guitar)      // guitar = תוצאת createGuitar
//   t.group                               // להוסיף לסצנה
//   t.setLeftHand(spec | null)            // spec = { fingers: [{ finger: 1..4, string: 1..6, fret: 0..n }] }
//   t.pluck(string)                       // פריטה של מיתר בודד; t.onRelease(string, amp) נקרא ברגע השחרור
//   t.strum('d' | 'u', strings, ms)       // פריטה על כמה מיתרים
//   t.wave(seconds)                       // נפנוף ידיים לשלום
//   t.setLookTarget(vec3 | null)          // לאן המורה מסתכל
//   t.update(dt, time)  /  t.dispose()
//   t.center                              // נקודת מבט כללית (עולם)
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

// ---------- עזרים ----------
export function twoBone(A, T, l1, l2, pole) {
  const AT = new THREE.Vector3().subVectors(T, A);
  const d = AT.length();
  const dd = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const dir = d > 1e-6 ? AT.clone().divideScalar(d) : pole.clone().normalize();
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const p = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (p.lengthSq() < 1e-8) p.set(dir.y, -dir.x, 0);
  p.normalize();
  const mid = A.clone().addScaledVector(dir, a).addScaledVector(p, h);
  const end = A.clone().addScaledVector(dir, dd);
  return { mid, end };
}

// קטע חלק בין שתי נקודות, עם כדורים בקצוות
class Limb {
  constructor(parent, mat, rA, rB) {
    this.cyl = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, 1, 14, 1), mat);
    this.a = new THREE.Mesh(new THREE.SphereGeometry(rA, 14, 10), mat);
    this.b = new THREE.Mesh(new THREE.SphereGeometry(rB, 14, 10), mat);
    parent.add(this.cyl, this.a, this.b);
  }
  set(A, B) {
    const d = new THREE.Vector3().subVectors(B, A);
    const L = Math.max(d.length(), 1e-4);
    this.cyl.position.copy(A).add(B).multiplyScalar(0.5);
    this.cyl.scale.set(1, L, 1);
    this.cyl.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(L));
    this.a.position.copy(A);
    this.b.position.copy(B);
  }
}

// אליפסואיד לפי שלושה צירים (באורכי הרדיוסים)
function setEllipsoid(mesh, c, ax, ay, az) {
  mesh.matrixAutoUpdate = false;
  mesh.matrix.makeBasis(ax, ay, az);
  mesh.matrix.setPosition(c);
  mesh.matrixWorldNeedsUpdate = true;
}

// ---------- היד ----------
const FINGERS = [
  { L: [2.7, 1.55, 1.2], r: [0.52, 0.48, 0.44] }, // מורה
  { L: [3.0, 1.75, 1.25], r: [0.54, 0.5, 0.45] }, // אמה
  { L: [2.75, 1.65, 1.2], r: [0.5, 0.46, 0.42] }, // קמיצה
  { L: [2.2, 1.25, 1.05], r: [0.45, 0.41, 0.38] }, // זרת
];
const THUMB = { L: [2.6, 2.1], r: [0.66, 0.58, 0.52] };

class Hand {
  constructor(parent, skin, nailMat) {
    this.g = new THREE.Group();
    parent.add(this.g);
    this.skin = skin;
    this.fingers = FINGERS.map((s) => this._chain(s, 3, nailMat));
    this.thumb = this._chain({ L: [...THUMB.L], r: THUMB.r }, 2, nailMat);
    this.palm = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), skin);
    this.g.add(this.palm);
    this.wrist = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), skin);
    this.g.add(this.wrist);
  }
  _chain(spec, n, nailMat) {
    const limbs = [];
    for (let i = 0; i < n; i++) {
      const rA = spec.r[Math.min(i, spec.r.length - 1)];
      const rB = i === n - 1 ? rA * 0.92 : spec.r[Math.min(i + 1, spec.r.length - 1)];
      limbs.push(new Limb(this.g, this.skin, rA, rB));
    }
    const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), nailMat);
    nail.matrixAutoUpdate = false;
    this.g.add(nail);
    return { spec, limbs, nail, tipR: spec.r[n === 3 ? 2 : 2] * 0.92 };
  }
  // שלדת אצבע: שורש -> קצה, עם שלושה קטעים
  finger(F, root, tip, pole, u) {
    const L = F.spec.L;
    const dip = tip.clone().addScaledVector(u, L[2]);
    const { mid, end } = twoBone(root, dip, L[0], L[1], pole);
    const dirT = new THREE.Vector3().subVectors(tip, end);
    if (dirT.lengthSq() < 1e-8) dirT.copy(u).negate();
    const tipC = end.clone().addScaledVector(dirT.normalize(), L[2]);
    F.limbs[0].set(root, mid);
    F.limbs[1].set(mid, end);
    F.limbs[2].set(end, tipC);
    this._nail(F, root, mid, end, tipC, pole);
    return tipC;
  }
  thumbChain(root, tip, pole) {
    const F = this.thumb;
    const L = F.spec.L;
    const { mid, end } = twoBone(root, tip, L[0], L[1], pole);
    const tipC = end.clone();
    F.limbs[0].set(root, mid);
    F.limbs[1].set(mid, tipC);
    this._nail(F, root, mid, mid, tipC, pole);
  }
  _nail(F, root, mid, end, tipC, pole) {
    const s = new THREE.Vector3().subVectors(tipC, end);
    if (s.lengthSq() < 1e-6) s.subVectors(tipC, mid);
    s.normalize();
    const chord = new THREE.Vector3().subVectors(end, root);
    const N = new THREE.Vector3().crossVectors(chord, pole);
    if (N.lengthSq() < 1e-8) N.set(0, 0, 1);
    N.normalize();
    const s0 = new THREE.Vector3().subVectors(mid, root).normalize();
    const sig = Math.sign(new THREE.Vector3().crossVectors(N, s0).dot(pole)) || 1;
    const dorsal = new THREE.Vector3().crossVectors(N, s).multiplyScalar(sig).normalize();
    const side = new THREE.Vector3().crossVectors(s, dorsal).normalize();
    const r = F.tipR;
    const c = tipC.clone().addScaledVector(s, -0.2).addScaledVector(dorsal, r * 0.8);
    setEllipsoid(F.nail, c, side.multiplyScalar(r * 0.62), s.clone().multiplyScalar(0.46), dorsal.multiplyScalar(0.12));
  }
  // כף היד: מרכז + כיוונים (קדימה לאצבעות, רוחב, ניצב)
  palmFrame(c, fwd, across, normal, wristPos) {
    setEllipsoid(this.palm, c, across.clone().multiplyScalar(3.0), normal.clone().multiplyScalar(1.15), fwd.clone().multiplyScalar(2.6));
    this.wrist.position.copy(wristPos);
  }
}

// שרפרף (וגם הדום לגיטרה קלאסית). seatY = מרכז המושב. משותף למורה הבובה ולמורה הדגם.
export function buildStool(group, classical, seatY = -3) {
  const FLOOR = -30;
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.7, metalness: 0 });
  const mats = [wood];
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1.6, 32), wood);
  seat.position.set(0, seatY, 4);
  group.add(seat);
  [[-6, -3], [6, -3], [0, 8]].forEach(([x, z]) => {
    const a = V(x * 0.8, seatY - 0.6, 4 + z * 0.8);
    const b = V(x * 1.35, FLOOR, 4 + z * 1.35);
    const l = new Limb(group, wood, 0.7, 0.55);
    l.set(a, b);
  });
  if (classical) {
    // הדום קטן לרגל שמאל – כמו שמנגנים בגיטרה קלאסית
    const fm = new THREE.MeshStandardMaterial({ color: 0x7b5232, roughness: 0.8, metalness: 0 });
    mats.push(fm);
    const fs = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 12), fm);
    fs.position.set(7, FLOOR + 4, 24);
    group.add(fs);
  }
  return mats;
}

// ---------- המורה ----------
export function createTeacher(guitar) {
  const type = guitar.type;
  const classical = type === 'classical';
  const group = new THREE.Group();
  group.name = 'teacher';

  const mat = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
  const skin = mat(0xe6b894, 0.8);
  const nailMat = mat(0xf2d6c0, 0.45);
  const shirt = mat(0x2f7a7e, 0.9);
  const pants = mat(0x3b4252, 0.9);
  const shoe = mat(0x2a2a2e, 0.7);
  const hairMat = mat(0x3a2a22, 0.9);
  const dark = mat(0x1b1613, 0.5);
  const wood = mat(0x9c6b3f, 0.7);

  const sphere = (r, m, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), m);
    o.scale.set(sx, sy, sz);
    return o;
  };

  // שרפרף
  const FLOOR = -30;
  const stool = buildStool(group, classical, -3);

  // גוף
  const body = new THREE.Group();
  group.add(body);
  const chest = sphere(1, shirt, 11.2, 10.5, 7.4);
  chest.position.set(0, 23, 0);
  const belly = sphere(1, shirt, 9.6, 9.5, 6.9);
  belly.position.set(0, 12, 0.3);
  const pelvis = sphere(1, pants, 10.2, 5, 7.6);
  pelvis.position.set(0, 3.2, 0.3);
  body.add(chest, belly, pelvis);
  const SH = { l: V(12.2, 30.5, 0), r: V(-12.2, 30.5, 0) };
  [SH.l, SH.r].forEach((p) => {
    const b = sphere(3.9, shirt);
    b.position.copy(p);
    body.add(b);
  });
  const neck = new Limb(body, skin, 2.2, 2.0);
  neck.set(V(0, 32, 0.4), V(0, 37.5, 1.0));

  // ראש
  const headG = new THREE.Group();
  headG.position.set(0, 37.5, 1.0);
  body.add(headG);
  const skull = sphere(1, skin, 6.7, 7.5, 6.9);
  skull.position.set(0, 6.0, 0.2);
  headG.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.64), hairMat);
  hair.scale.set(7.0, 7.9, 7.2);
  hair.position.set(0, 6.3, 0.1);
  hair.rotation.x = -0.6;
  headG.add(hair);
  [-1, 1].forEach((s) => {
    const ear = sphere(1.15, skin, 0.7, 1.1, 0.8);
    ear.position.set(s * 6.7, 6.0, 0.2);
    headG.add(ear);
  });
  const nose = sphere(0.85, skin, 1, 1.05, 1);
  nose.position.set(0, 5.1, 7.0);
  headG.add(nose);
  const eyes = [-1, 1].map((s) => {
    const e = sphere(1, dark, 0.55, 0.78, 0.3);
    e.position.set(s * 2.5, 6.9, 6.8);
    headG.add(e);
    return e;
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.2, 8, 24, Math.PI * 0.75), dark);
  smile.rotation.z = -Math.PI / 2 - (Math.PI * 0.75) / 2;
  smile.position.set(0, 4.0, 6.65);
  smile.scale.z = 0.6;
  headG.add(smile);

  // רגליים
  const legs = {};
  const knee = { r: V(-6, 2.6, 23), l: V(6, classical ? 7.5 : 2.6, 23) };
  const ankle = { r: V(-6.5, FLOOR + 3, 26), l: classical ? V(7, FLOOR + 11, 27) : V(6.5, FLOOR + 3, 26) };
  [['r', -5.2], ['l', 5.2]].forEach(([k, x]) => {
    const thigh = new Limb(group, pants, 3.9, 3.2);
    thigh.set(V(x, 3.0, 0), knee[k]);
    const shin = new Limb(group, pants, 3.1, 2.4);
    shin.set(knee[k], ankle[k]);
    const foot = sphere(1, shoe, 3.0, 2.2, 5.6);
    foot.position.set(ankle[k].x, ankle[k].y - 0.6, ankle[k].z + 2.2);
    group.add(foot);
    legs[k] = { thigh, shin, foot };
  });

  // ---------- הנחת הגיטרה בידי המורה ----------
  const place = classical
    ? { x: -1.5, y: 13.5, z: 16.5, tilt: 0.45 }
    : { x: -6, y: 14.5, z: 13.5, tilt: 0.3 };
  {
    const Bm = new THREE.Matrix4().makeBasis(V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0));
    const R = new THREE.Matrix4().makeRotationZ(place.tilt);
    const M = new THREE.Matrix4().multiplyMatrices(R, Bm);
    // נקודת הגוף (x מקומי 34) צריכה לנחות ב-place
    const off = V(34, 0, 0).applyMatrix4(M);
    M.setPosition(place.x - off.x, place.y - off.y, place.z - off.z);
    guitar.group.matrixAutoUpdate = false;
    guitar.group.matrix.copy(M);
    guitar.group.updateMatrixWorld(true);
  }
  const GW = guitar.group.matrixWorld;
  const L2W = (v) => v.clone().applyMatrix4(GW);
  const D2W = (v) => v.clone().transformDirection(GW);

  // ---------- זרועות ----------
  const UA = 17.4;
  const FA = 16.2;
  const armSkin = skin;
  const arms = {};
  ['l', 'r'].forEach((k) => {
    arms[k] = {
      upper: new Limb(group, shirt, 2.8, 2.3),
      fore: new Limb(group, armSkin, 2.0, 1.5),
      elbow: sphere(2.3, shirt),
      hand: new Hand(group, skin, nailMat),
    };
    group.add(arms[k].elbow);
  });

  // ---------- מצב ----------
  const st = {
    look: null,
    onRelease: null,
    // יד שמאל
    lh: { spec: null, xc: 3, rz: -2.4, tips: [null, null, null, null], thumb: V(3, -1.8, 0), init: false },
    // יד ימין
    rh: { hz: guitar.zS(3, guitar.pluckX), anim: null, wave: 0, waveT0: 0, waveDur: 0, park: 0, parkWanted: false, wakeUntil: 0 },
    head: { yaw: 0, pitch: 0 },
    blink: 0,
    queue: [],
  };

  const FR = 0.45; // רדיוס קצה אצבע
  const rx = guitar.pluckX;

  // ----- מיקומי יד שמאל (במערכת הגיטרה) -----
  function leftTargets(spec) {
    const pressed = {};
    ((spec && spec.fingers) || []).forEach((f) => (pressed[f.finger] = f));
    const xs = [];
    const zs = [];
    Object.values(pressed).forEach((f) => {
      const p = guitar.fretPoint(f.string, f.fret);
      xs.push(p.x);
      zs.push(p.z);
    });
    let xc = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : guitar.fretX((spec && spec.at) || 2) - 0.4;
    // היד נשארת באזור הקודם כשאין אצבעות לוחצות (אין קפיצות)
    const zc = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : 0.2;
    const hwx = guitar.hw(xc);
    const rz = clamp(zc - 2.9, -hwx - 1.35, -hwx - 0.55);
    return { pressed, xc, rz, zc };
  }

  const ROOT_OFF = [-1.95, -0.65, 0.65, 1.85];

  function solveLeft(dt) {
    const lh = st.lh;
    const tg = leftTargets(lh.spec);
    const k = lh.init ? 1 - Math.exp(-dt * 11) : 1;
    lh.init = true;
    lh.xc += (tg.xc - lh.xc) * k;
    lh.rz += (tg.rz - lh.rz) * k;

    const xc = lh.xc;
    const rz = lh.rz;
    const ry = -1.15;
    const roots = [];
    const tips = [];
    const poles = [];
    const us = [];
    for (let i = 0; i < 4; i++) {
      const root = V(xc + ROOT_OFF[i], ry, rz);
      roots.push(root);
      const f = tg.pressed[i + 1];
      let des;
      if (f) {
        des = guitar.fretPoint(f.string, f.fret);
        des.y += FR * 0.7;
      } else {
        // אצבע רפויה: מרחפת מעל הלוח בקשת
        const x = xc + ROOT_OFF[i] * 0.9 + 0.2;
        des = V(x, guitar.ys(x) + 1.55, clamp(tg.zc + 0.7 - i * 0.25, -1.4, 1.2));
      }
      if (!lh.tips[i]) lh.tips[i] = des.clone();
      lh.tips[i].lerp(des, k);
      const tip = lh.tips[i].clone();
      tips.push(tip);
      poles.push(V(0, 1, 0.05));
      const toRoot = V(root.x - tip.x, 0, root.z - tip.z);
      if (toRoot.lengthSq() < 1e-6) toRoot.set(0, 0, -1);
      toRoot.normalize();
      us.push(V(0, 1, 0).addScaledVector(toRoot, f ? 0.5 : 0.35).normalize());
    }
    // כף היד: מתחת לצוואר
    const rootC = V(xc + 0.0, ry, rz);
    const fwd = V(0.0, 0.42, 0.91).normalize();
    const across = V(1, 0, 0);
    const normal = new THREE.Vector3().crossVectors(fwd, across).normalize();
    const palmC = rootC.clone().addScaledVector(fwd, -2.5);
    const wristP = palmC.clone().addScaledVector(fwd, -2.5);
    // אגודל: מאחורי הצוואר
    const thumbRoot = palmC.clone().addScaledVector(across, -1.7).addScaledVector(fwd, 0.5).add(V(0, -0.1, 0));
    const tcx = xc - 0.9;
    const thumbTip = V(tcx, -1.3 - 0.62, clamp(tg.zc * 0.25, -0.8, 0.8) + 0.3);
    lh.thumb.lerp(thumbTip, k);

    return { roots, tips, poles, us, palmC, fwd, across, normal, wristP, thumbRoot, thumbTip: lh.thumb.clone(), thumbPole: V(0, -0.7, -0.5) };
  }

  // ----- יד ימין -----
  const OFFS = [0, -1.15, -2.3, -3.35]; // היסט z של האצבעות ביחס לאינדקס
  function fingerForString(s) {
    if (!classical) return 0; // חשמלית: קלף ביד האינדקס
    if (s === 3) return 0;
    if (s === 2) return 1;
    if (s === 1) return 2;
    return -1; // אגודל
  }
  function rightRest(dt, time) {
    const rh = st.rh;
    const base = { hz: rh.hz };
    // אנימציה פעילה
    let lift = [0.75, 0.8, 0.85, 0.9];
    let thumbLift = 0.7;
    let pull = 0;
    let tipDx = 0;
    let active = fingerForString(rh.anim ? rh.anim.string : 3);
    if (rh.anim) {
      const a = rh.anim;
      const t = (time - a.t0) / a.dur;
      if (a.type === 'pluck') {
        const slideEnd = 0.38;
        const pullEnd = 0.7;
        let h;
        if (t < slideEnd) {
          const e = ease(t / slideEnd);
          base.hz = a.hz0 + (a.hz1 - a.hz0) * e;
          h = 0.75 * (1 - e) + 0.05 * e;
        } else if (t < pullEnd) {
          const e = (t - slideEnd) / (pullEnd - slideEnd);
          base.hz = a.hz1;
          h = 0.05 - 1.35 * e;
          pull = e;
          tipDx = e * 0.5;
          guitar.pull(a.string, e, rx);
        } else {
          if (!a.released) {
            a.released = true;
            guitar.pull(a.string, 0, rx);
            guitar.pluck(a.string, a.amp, time);
            if (st.onRelease) st.onRelease(a.string, a.amp);
          }
          const e = clamp((t - pullEnd) / (1 - pullEnd), 0, 1);
          base.hz = a.hz1;
          h = -1.3 + (0.75 + 1.3) * ease(e);
          tipDx = 0.5 * (1 - e);
        }
        if (a.finger >= 0) lift[a.finger] = h;
        else thumbLift = h;
        if (t >= 1) {
          rh.hz = a.hz1;
          rh.anim = null;
        }
      } else if (a.type === 'strum') {
        const sweep = clamp(t / 0.85, 0, 1);
        base.hz = a.hz0 + (a.hz1 - a.hz0) * sweep;
        lift = [sweep < 1 ? 0.0 : 0.6, 0.15, 0.2, 0.3];
        // רגע שהאצבע חולפת על כל מיתר
        a.strings.forEach((s) => {
          if (a.done.includes(s)) return;
          const zs = guitar.zS(s, rx);
          const pos = (zs - a.hz0) / (a.hz1 - a.hz0);
          if (pos <= sweep + 0.001) {
            a.done.push(s);
            const amp = a.amp * (a.dir === 'd' ? 1 - 0.05 * a.done.length : 0.85);
            guitar.pluck(s, amp, time);
            if (st.onRelease) st.onRelease(s, amp);
          }
        });
        if (t >= 1) {
          rh.hz = a.hz1;
          rh.anim = null;
        }
        active = 0;
      }
    }
    return { hz: base.hz, lift, thumbLift, active, tipDx };
  }

  function solveRight(dt, time) {
    const rh = st.rh;
    const r = rightRest(dt, time);
    const hz = r.hz;
    const hy = 4.5;
    const rootX = rx + 1.15;
    const roots = [];
    const tips = [];
    const poles = [];
    const us = [];
    const pOff = V(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const z = hz + OFFS[i];
      roots.push(V(rootX, hy, z + 0.0));
      const x = rx - 0.1 + (r.active === i ? r.tipDx : 0);
      const y = guitar.ys(x) + FR * 0.8 + r.lift[i];
      tips.push(V(x, y, z));
      poles.push(V(-1, 0.55, 0));
      us.push(V(0.55, 1, 0).normalize());
    }
    const fwd = V(-0.12, -0.5, -0.86).normalize();
    const across = V(0, 0, -1);
    const normal = new THREE.Vector3().crossVectors(fwd, across).normalize();
    const rootC = roots[1].clone().add(roots[2]).multiplyScalar(0.5);
    const palmC = rootC.clone().addScaledVector(fwd, -2.5);
    const wristP = palmC.clone().addScaledVector(fwd, -2.5);
    const thumbRoot = palmC.clone().addScaledVector(across, -2.0).addScaledVector(fwd, 0.4);
    const thx = rx - 0.5 + (r.active === -1 ? r.tipDx : 0);
    let thumbTip = V(thx, guitar.ys(thx) + FR * 0.9 + r.thumbLift, hz + 1.6);
    if (!classical) {
      // קלף בין האגודל לאצבע המורה
      thumbTip = tips[0].clone().add(V(0.55, 0.5, 0.25));
    }
    return { roots, tips, poles, us, palmC, fwd, across, normal, wristP, thumbRoot, thumbTip, thumbPole: V(-1, 0.3, 0.2), pOff };
  }

  // יד פתוחה בעולם: נפנוף או מנוחה (פרק יד, כיוון האצבעות, כיוון רוחב היד)
  function openHand(wristP, fwd, across, reach, pole) {
    const normal = new THREE.Vector3().crossVectors(fwd, across).normalize();
    const palmC = wristP.clone().addScaledVector(fwd, 2.5);
    const rootC = palmC.clone().addScaledVector(fwd, 2.5);
    const roots = [];
    const tips = [];
    const poles = [];
    const us = [];
    const offs = [-1.95, -0.65, 0.65, 1.85];
    for (let i = 0; i < 4; i++) {
      const root = rootC.clone().addScaledVector(across, -offs[i]);
      roots.push(root);
      const len = FINGERS[i].L[0] + FINGERS[i].L[1] + FINGERS[i].L[2];
      tips.push(root.clone().addScaledVector(fwd, len * reach).addScaledVector(across, (i - 1.2) * 0.5));
      poles.push(pole.clone());
      us.push(fwd.clone());
    }
    const thumbRoot = palmC.clone().addScaledVector(across, 2.0).addScaledVector(fwd, 0.2);
    const thumbTip = thumbRoot.clone().addScaledVector(across, -3.2).addScaledVector(fwd, 1.6);
    return { roots, tips, poles, us, palmC, fwd, across, normal, wristP, thumbRoot, thumbTip, thumbPole: pole.clone() };
  }
  function waveConfig(time) {
    const sw = Math.sin(time * 9);
    return openHand(V(-17 + sw * 2.4, 41.5, 10.5), V(sw * 0.25 - 0.1, 1, 0.12).normalize(), V(-1, 0, 0), 0.93, V(0, 0, -1));
  }
  // יד מושכת לאחור בצד כשלא צריך אותה (כדי שלא תסתיר את הגיטרה)
  function parkConfig() {
    return openHand(V(-14.5, 25.5, 12.5), V(0.18, -0.3, 0.94).normalize(), V(-1, 0, 0), 0.86, V(0, 1, 0));
  }

  // המרה ממערכת הגיטרה לעולם
  function toWorld(c) {
    return {
      roots: c.roots.map(L2W), tips: c.tips.map(L2W), poles: c.poles.map(D2W), us: c.us.map(D2W),
      palmC: L2W(c.palmC), fwd: D2W(c.fwd), across: D2W(c.across), normal: D2W(c.normal), wristP: L2W(c.wristP),
      thumbRoot: L2W(c.thumbRoot), thumbTip: L2W(c.thumbTip), thumbPole: D2W(c.thumbPole),
    };
  }
  function blend(a, b, w) {
    const mix = (x, y) => x.clone().lerp(y, w);
    return {
      roots: a.roots.map((v, i) => mix(v, b.roots[i])), tips: a.tips.map((v, i) => mix(v, b.tips[i])),
      poles: a.poles.map((v, i) => mix(v, b.poles[i]).normalize()), us: a.us.map((v, i) => mix(v, b.us[i]).normalize()),
      palmC: mix(a.palmC, b.palmC), fwd: mix(a.fwd, b.fwd).normalize(), across: mix(a.across, b.across).normalize(),
      normal: mix(a.normal, b.normal).normalize(), wristP: mix(a.wristP, b.wristP),
      thumbRoot: mix(a.thumbRoot, b.thumbRoot), thumbTip: mix(a.thumbTip, b.thumbTip), thumbPole: mix(a.thumbPole, b.thumbPole).normalize(),
    };
  }

  function applyArm(k, cfg, pole) {
    const A = arms[k];
    const sh = SH[k];
    const { mid, end } = twoBone(sh, cfg.wristP, UA, FA, pole);
    A.upper.set(sh, mid);
    A.fore.set(mid, end);
    A.elbow.position.copy(mid);
    // היד מחוברת לפרק היד האמיתי (אחרי מתיחה)
    const shift = new THREE.Vector3().subVectors(end, cfg.wristP);
    const H = A.hand;
    const sh2 = (v) => v.clone().add(shift);
    cfg.roots.forEach((r, i) => H.finger(H.fingers[i], sh2(r), sh2(cfg.tips[i]), cfg.poles[i], cfg.us[i]));
    H.thumbChain(sh2(cfg.thumbRoot), sh2(cfg.thumbTip), cfg.thumbPole);
    H.palmFrame(sh2(cfg.palmC), cfg.fwd, cfg.across, cfg.normal, end);
  }

  // ---------- ממשק ----------
  const center = V(5, 14, 10);

  function update(dt, time) {
    dt = Math.min(dt, 0.05);
    // גוף נושם
    const br = Math.sin(time * 1.6) * 0.008;
    chest.scale.set(11.2 * (1 + br), 10.5 * (1 + br * 1.5), 7.4);
    // יד שמאל
    const L = toWorld(solveLeft(dt));
    applyArm('l', L, V(0.5, -1, -0.45));
    // יד ימין
    const rh = st.rh;
    const rest = toWorld(solveRight(dt, time));
    let w = 0;
    if (rh.wave > 0) {
      const t = time - rh.waveT0;
      w = ease(clamp(Math.min(t / 0.5, (rh.waveDur - t) / 0.5), 0, 1));
      if (t >= rh.waveDur) rh.wave = 0;
    }
    const pk = rh.park;
    const base = pk > 0.001 ? blend(rest, parkConfig(), ease(pk)) : rest;
    const cfgR = w > 0.001 ? blend(base, waveConfig(time), w) : base;
    applyArm('r', cfgR, V(-0.55, -1, -0.4));
    // היד חוזרת למקומה לפני פעולה, ונסוגה בצד כשלא צריך אותה
    const wantPark = rh.parkWanted && !rh.anim && !st.queue.length && time > rh.wakeUntil && rh.wave === 0;
    rh.park += ((wantPark ? 1 : 0) - rh.park) * (1 - Math.exp(-dt * 5));
    if (st.queue.length && !rh.anim && rh.park < 0.12) {
      const q = st.queue.shift();
      q();
    }
    // ראש: מסתכל על היעד, מצמוץ
    const target = st.look || V(0, 38, 100);
    const dx = target.x - 0;
    const dz = target.z - 1;
    const dy = target.y - 43;
    const yaw = clamp(Math.atan2(dx, dz), -0.7, 0.7);
    const pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.35, 0.35);
    const k = 1 - Math.exp(-dt * 6);
    st.head.yaw += (yaw - st.head.yaw) * k;
    st.head.pitch += (pitch - st.head.pitch) * k;
    headG.rotation.set(st.head.pitch + Math.sin(time * 0.9) * 0.02, st.head.yaw, w * -0.1 + Math.sin(time * 0.7) * 0.015);
    const bl = (time % 4.2) < 0.12 ? 0.1 : 1;
    eyes.forEach((e) => (e.scale.y = 0.78 * bl));
  }

  function nowT() {
    return performance.now() / 1000;
  }
  function pluck(s, opts = {}) {
    const start = () => {
      const rh = st.rh;
      const f = fingerForString(s);
      const hzTarget = guitar.zS(s, rx) - (f >= 0 ? OFFS[f] : -1.6);
      const reach = Math.abs(hzTarget - rh.hz);
      rh.anim = { type: 'pluck', string: s, finger: f, t0: nowT(), dur: 0.5 + Math.min(reach, 3) * 0.05, hz0: rh.hz, hz1: hzTarget, amp: opts.amp || 1, released: false };
    };
    st.queue.length = 0;
    st.rh.wakeUntil = nowT() + 3;
    if (st.rh.anim) {
      // מסיים את הפריטה הקודמת במהירות ואז ממשיך
      st.rh.anim.dur = Math.min(st.rh.anim.dur, 0.5);
      st.queue.push(start);
    } else start();
  }
  function strum(dir, strings, ms = 280, amp = 1) {
    const list = dir === 'd' ? strings.slice().sort((a, b) => b - a) : strings.slice().sort((a, b) => a - b);
    const zFirst = guitar.zS(list[0], rx);
    const zLast = guitar.zS(list[list.length - 1], rx);
    const pad = dir === 'd' ? 0.45 : -0.45;
    const hz0 = zFirst + pad;
    const hz1 = zLast - pad;
    st.queue.length = 0;
    const start = () => {
      st.rh.anim = { type: 'strum', dir, strings: list, t0: nowT(), dur: ms / 1000 * 1.18, hz0, hz1, amp, done: [] };
    };
    st.rh.wakeUntil = nowT() + 3;
    st.rh.anim = null;
    st.queue.push(start);
  }

  return {
    type,
    group,
    center,
    setLeftHand(spec) {
      st.lh.spec = spec || null;
    },
    pluck,
    strum,
    wave(seconds = 2.4) {
      st.rh.wave = 1;
      st.rh.waveT0 = nowT();
      st.rh.waveDur = seconds;
    },
    setLookTarget(v) {
      st.look = v;
    },
    setRightHand(mode) {
      st.rh.parkWanted = mode === 'park';
    },
    set onRelease(fn) {
      st.onRelease = fn;
    },
    update,
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      [skin, nailMat, shirt, pants, shoe, hairMat, dark, wood, ...stool].forEach((m) => m.dispose());
    },
    // לבדיקות/דיבוג
    _state: st,
  };
}

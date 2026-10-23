// המורה בדמות אמיתית: מודל GLB עם שלד (Mixamo), יושב על שרפרף ומנגן.
// אותו ממשק בדיוק כמו createTeacher ב-teacher.js (אפשר להחליף ביניהם בלי לגעת בשאר האפליקציה):
//   group, center, setLeftHand(spec|null), pluck(string), onRelease, strum(dir, strings, ms),
//   wave(seconds), setLookTarget(vec3|null), setRightHand('play'|'park'), update(dt, time), dispose()
// כל התנוחה מחושבת בקוד: IK של שתי עצמות לזרועות, CCD לאצבעות (כל קצה אצבע מגיע לנקודה שמאחורי השריג).
// אם הטעינה נכשלת – הבמה נשארת עם המורה הבובה (teacher.js).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { buildStool, twoBone } from './teacher.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

// ---------- טעינה (עצלה, עם מטמון) ----------
const cache = new Map();
export function loadTeacherModel(url) {
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
// אם הדגם כבר נטען – מחזיר אותו מיד (אחרת null)
export function loadedTeacherModel(url) {
  const c = cache.get(url);
  return c ? c.gltf : null;
}

// ---------- קבועים ----------
const FLOOR = -30;
const HIP_Z = 3.5; // מרכז האגן (מעל מרכז השרפרף)
const FR = 0.3; // כמה מעל המיתר נוחת מרכז קצה האצבע
const FINGER_NAMES = ['Index', 'Middle', 'Ring', 'Pinky'];
const OFFS = [0, -1.15, -2.3, -3.35]; // היסט z של אצבעות יד ימין ביחס לאצבע המורה (כמו אצל הבובה)

// ---------- עזרי סיבוב ----------
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
function worldQuat(o, out = new THREE.Quaternion()) {
  return o.getWorldQuaternion(out);
}
function worldPos(o, out = new THREE.Vector3()) {
  return o.getWorldPosition(out);
}
// קובע לעצם כיוון בעולם (ומעדכן את הצאצאים)
function setWorldQuat(b, qw) {
  const pq = worldQuat(b.parent, _q2).invert();
  b.quaternion.copy(pq.multiply(qw));
  b.updateMatrixWorld(true);
}
// מסובב עצם בעולם סביב ציר (המיקום שלה נשאר)
function rotW(b, axis, ang) {
  _q.setFromAxisAngle(axis, ang);
  const qw = _q.multiply(worldQuat(b));
  setWorldQuat(b, qw);
}
// מכוון את העצם כך שהכיוון אל הילד שלה יהיה dir
function aim(b, child, dir) {
  const cur = worldPos(child).sub(worldPos(b)).normalize();
  const d = dir.clone().normalize();
  const dq = new THREE.Quaternion().setFromUnitVectors(cur, d);
  setWorldQuat(b, dq.multiply(worldQuat(b)));
}
// זווית (בסימן) מ-a ל-b סביב ציר, אחרי הטלה על המישור שניצב לציר
function angleAbout(axis, a, b) {
  const pa = a.clone().addScaledVector(axis, -a.dot(axis));
  const pb = b.clone().addScaledVector(axis, -b.dot(axis));
  if (pa.lengthSq() < 1e-8 || pb.lengthSq() < 1e-8) return 0;
  return Math.atan2(axis.dot(new THREE.Vector3().crossVectors(pa, pb)), pa.dot(pb));
}

// fit (לכל דמות, מתוך lib/teachers.js): scale = קנה מידה (ברירת מחדל 1, הדגם הגברי ~98 יחידות לעומד),
// dx/dy/dz = הזזת הגיטרה ביחס לגוף (דמות עם זרועות קצרות – מקרבים את הגיטרה), shrug = כמה הכתף מתקדמת ליעד
export function createModelTeacher(guitar, gltf, fit = {}) {
  const SC = fit.scale || 1;
  const SHRUG = fit.shrug == null ? 0.35 : fit.shrug;
  const classical = guitar.type === 'classical';
  const group = new THREE.Group();
  group.name = 'teacher';

  // ---------- הדגם ----------
  const root = cloneSkinned(gltf.scene);
  root.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  group.add(root);
  // אור מילוי רך מצד המצלמה – כדי שהפנים והידיים לא יהיו כהים
  const fill = new THREE.DirectionalLight(0xfff2e4, 0.55);
  fill.position.set(-10, 40, 110);
  group.add(fill);
  const B = {};
  root.traverse((o) => {
    if (o.name && o.name.startsWith('mixamorig')) B[o.name.slice(9)] = o;
  });
  root.scale.setScalar(SC);
  root.updateMatrixWorld(true);
  const all = Object.values(B);
  const restQ = new Map();
  const restW = new Map();
  all.forEach((b) => {
    restQ.set(b, b.quaternion.clone());
    restW.set(b, worldQuat(b));
  });
  const restPos = (n) => worldPos(B[n]);
  const dist = (a, b) => restPos(a).distanceTo(restPos(b));
  const resetBones = (names) => {
    names.forEach((n) => B[n] && B[n].quaternion.copy(restQ.get(B[n])));
  };

  // ---------- מידות הדמות ----------
  const LEN = {
    thigh: dist('LeftUpLeg', 'LeftLeg'),
    shin: dist('LeftLeg', 'LeftFoot'),
    ankleH: restPos('LeftFoot').y - restPos('LeftToeBase').y,
    upper: dist('LeftArm', 'LeftForeArm'),
    fore: dist('LeftForeArm', 'LeftHand'),
  };
  const upLegDy = restPos('Hips').y - restPos('LeftUpLeg').y; // כמה מתחת לאגן מפרק הירך

  // גובה האגן: ירך כמעט אופקית, שוק כמעט אנכית, כף הרגל על הרצפה
  const thighDrop = 2.0;
  const ankleY = FLOOR + LEN.ankleH;
  const kneeY = ankleY + LEN.shin * 0.98;
  const hipJointY = kneeY + thighDrop;
  const hipsY = hipJointY + upLegDy;
  const seatTop = hipJointY - 6.2;
  const stool = buildStool(group, classical, seatTop - 0.8);

  // מניחים את הדגם כך שהאגן במקום
  {
    const p = restPos('Hips');
    root.position.set(-p.x, hipsY - p.y, HIP_Z - p.z);
    root.updateMatrixWorld(true);
  }

  // ---------- גיטרה בידי המורה ----------
  const place = classical
    ? { x: -1.5, y: hipJointY + 11.5, z: HIP_Z + 13.5, tilt: 0.45 }
    : { x: -6, y: hipJointY + 12.5, z: HIP_Z + 11, tilt: 0.3 };
  place.x += fit.dx || 0;
  place.y += fit.dy || 0;
  place.z += fit.dz || 0;
  {
    const Bm = new THREE.Matrix4().makeBasis(V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0));
    const R = new THREE.Matrix4().makeRotationZ(place.tilt);
    const M = new THREE.Matrix4().multiplyMatrices(R, Bm);
    const off = V(34, 0, 0).applyMatrix4(M);
    M.setPosition(place.x - off.x, place.y - off.y, place.z - off.z);
    guitar.group.matrixAutoUpdate = false;
    guitar.group.matrix.copy(M);
    guitar.group.updateMatrixWorld(true);
  }
  const GW = guitar.group.matrixWorld;
  const L2W = (v) => v.clone().applyMatrix4(GW);
  const D2W = (v) => v.clone().transformDirection(GW);

  // ---------- יד: מסגרת (כיוון אצבעות f, כיוון כף ידית p) ----------
  // במנוחה (T-pose) האצבעות לאורך ±x, האגודל למעלה, כף היד פונה קדימה (+z)
  const handInfo = {};
  ['Left', 'Right'].forEach((S) => {
    const left = S === 'Left';
    const hand = B[S + 'Hand'];
    const fRest = restPos(S + 'HandMiddle1').sub(restPos(S + 'Hand')).normalize();
    const tRest = restPos(S + 'HandIndex1').sub(restPos(S + 'HandPinky1'));
    tRest.addScaledVector(fRest, -tRest.dot(fRest)).normalize();
    const nRest = new THREE.Vector3().crossVectors(fRest, tRest);
    const frameRest = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fRest, tRest, nRest));
    const O = frameRest.clone().invert().multiply(restW.get(hand));
    // היסט מפרק היד -> שורש האצבעות האמצעיות, במערכת של העצם (לפני סיבוב)
    const mcp = B[S + 'HandMiddle1'].position.clone().add(B[S + 'HandRing1'].position).multiplyScalar(0.5 * SC);
    // היסט רוחבי של שורש כל אצבע ממרכז היד (חיובי = לכיוון האגודל)
    const mid = restPos(S + 'HandMiddle1').add(restPos(S + 'HandRing1')).multiplyScalar(0.5);
    const lat = FINGER_NAMES.map((nm) => restPos(`${S}Hand${nm}1`).sub(mid).dot(tRest));
    handInfo[S] = { left, O, mcp, hand, lat };
  });
  // f, p בעולם -> סיבוב העצם של היד
  function handQuat(S, f, p) {
    const info = handInfo[S];
    const ff = f.clone().normalize();
    const pp = p.clone().addScaledVector(ff, -p.dot(ff)).normalize();
    const n = info.left ? pp : pp.clone().negate();
    const t = new THREE.Vector3().crossVectors(n, ff);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ff, t, n));
    return q.multiply(info.O);
  }

  // ---------- אצבעות ----------
  const fingers = {};
  ['Left', 'Right'].forEach((S) => {
    const left = S === 'Left';
    const aRest = new THREE.Vector3().crossVectors(V(left ? 1 : -1, 0, 0), V(0, 0, 1)); // ציר הכיפוף (לכיוון כף היד)
    fingers[S] = FINGER_NAMES.map((nm) => {
      const bs = [1, 2, 3].map((j) => B[`${S}Hand${nm}${j}`]);
      const tip = B[`${S}Hand${nm}4`];
      const aLoc = bs.map((b) => aRest.clone().applyQuaternion(restW.get(b).clone().invert()));
      const pLoc = bs.map((b) => V(0, 0, 1).applyQuaternion(restW.get(b).clone().invert()));
      const len = restPos(`${S}Hand${nm}1`).distanceTo(restPos(`${S}Hand${nm}2`))
        + restPos(`${S}Hand${nm}2`).distanceTo(restPos(`${S}Hand${nm}3`))
        + restPos(`${S}Hand${nm}3`).distanceTo(restPos(`${S}Hand${nm}4`));
      return { bs, tip, aLoc, pLoc, th: [0.4, 0.6, 0.3], ab: 0, len };
    });
  });
  const LIM = [[-0.7, 1.5], [0, 1.95], [0, 1.5]];
  function applyFinger(F) {
    F.bs.forEach((b, j) => {
      b.quaternion.copy(restQ.get(b));
      if (j === 0) b.quaternion.multiply(_q.setFromAxisAngle(F.pLoc[0], F.ab));
      b.quaternion.multiply(_q.setFromAxisAngle(F.aLoc[j], F.th[j]));
    });
    F.bs[0].updateMatrixWorld(true);
  }
  function ccdFinger(F, target, iters = 16) {
    for (let it = 0; it < iters; it++) {
      for (let j = 2; j >= 0; j--) {
        const jp = worldPos(F.bs[j]);
        const tp = worldPos(F.tip);
        const aW = F.aLoc[j].clone().applyQuaternion(worldQuat(F.bs[j]));
        const d = angleAbout(aW, tp.clone().sub(jp), target.clone().sub(jp));
        F.th[j] = clamp(F.th[j] + d * (j === 2 ? 0.6 : 1), LIM[j][0], LIM[j][1]);
        applyFinger(F);
        if (j === 0) {
          const pW = F.pLoc[0].clone().applyQuaternion(worldQuat(F.bs[0]));
          const da = angleAbout(pW, worldPos(F.tip).sub(jp), target.clone().sub(jp));
          F.ab = clamp(F.ab + da, -0.55, 0.55);
          applyFinger(F);
        }
      }
    }
  }
  // אגודל: CCD חופשי יותר
  const thumbs = {};
  ['Left', 'Right'].forEach((S) => {
    thumbs[S] = { bs: [1, 2, 3].map((j) => B[`${S}HandThumb${j}`]), tip: B[`${S}HandThumb4`] };
  });
  function ccdThumb(T, target, iters = 14) {
    T.bs.forEach((b) => b.quaternion.copy(restQ.get(b)));
    T.bs[0].updateMatrixWorld(true);
    for (let it = 0; it < iters; it++) {
      for (let j = 2; j >= 0; j--) {
        const jp = worldPos(T.bs[j]);
        const v1 = worldPos(T.tip).sub(jp).normalize();
        const v2 = target.clone().sub(jp).normalize();
        const dq = new THREE.Quaternion().setFromUnitVectors(v1, v2);
        const ang = 2 * Math.acos(clamp(dq.w, -1, 1));
        if (ang > 0.4) dq.slerp(new THREE.Quaternion(), 1 - 0.4 / ang);
        setWorldQuat(T.bs[j], dq.multiply(worldQuat(T.bs[j])));
      }
    }
  }

  // ---------- זרוע: IK של שתי עצמות ----------
  const armBones = (S) => [S + 'Arm', S + 'ForeArm', S + 'Hand'];
  const handChain = (S) => {
    const l = [S + 'Hand'];
    FINGER_NAMES.concat(['Thumb']).forEach((nm) => [1, 2, 3].forEach((j) => l.push(`${S}Hand${nm}${j}`)));
    return l;
  };
  function armIK(S, W, pole, Qhand) {
    const sh = B[S + 'Arm'];
    const el = B[S + 'ForeArm'];
    const wr = B[S + 'Hand'];
    const A = worldPos(sh);
    const { mid, end } = twoBone(A, W, LEN.upper, LEN.fore, pole);
    aim(sh, el, mid.clone().sub(A));
    aim(el, wr, end.clone().sub(mid));
    // חלק מהפיתול של כף היד עובר לאמה (בלי "ממחטת" בעור)
    const axis = end.clone().sub(mid).normalize();
    const dq = Qhand.clone().multiply(worldQuat(wr).invert());
    if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
    const proj = V(dq.x, dq.y, dq.z).dot(axis);
    const twist = 2 * Math.atan2(proj, dq.w);
    rotW(el, axis, clamp(twist, -1.6, 1.6) * 0.55);
    setWorldQuat(wr, Qhand);
    return end.clone().sub(W); // כמה לא הגענו
  }

  // ---------- מצב ----------
  const st = {
    look: null,
    onRelease: null,
    lh: { spec: null, xc: 3, rz: -2.4, tips: [null, null, null, null], thumb: V(3, -1.8, 0), init: false, dirty: true, calm: 0 },
    rh: { hz: guitar.zS(3, guitar.pluckX), anim: null, wave: 0, waveT0: 0, waveDur: 0, park: 0, parkWanted: false, wakeUntil: 0, dirty: true },
    head: { yaw: 0, pitch: 0, cam: 0 },
    queue: [],
    reduced: false,
    reach: { Left: 0, Right: 0 },
  };
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const rx = guitar.pluckX;

  // ---------- יציבת ישיבה (פעם אחת) ----------
  function sit() {
    // עמוד שדרה: הטיה קלה קדימה
    ['Spine', 'Spine1', 'Spine2'].forEach((n) => rotW(B[n], V(1, 0, 0), 0.05));
    // רגליים
    const hip = (S) => worldPos(B[S + 'UpLeg']);
    const ank = (S) => {
      const x = S === 'Left' ? 6.6 : -6.6;
      const foot = classical && S === 'Left';
      return V(x, FLOOR + LEN.ankleH + (foot ? 8 : 0), foot ? HIP_Z + 20.5 : HIP_Z + 17.5);
    };
    ['Left', 'Right'].forEach((S) => {
      const up = B[S + 'UpLeg'];
      const kn = B[S + 'Leg'];
      const ft = B[S + 'Foot'];
      const A = hip(S);
      const T = ank(S);
      const { mid, end } = twoBone(A, T, LEN.thigh, LEN.shin, V(S === 'Left' ? 0.2 : -0.2, 0.3, 1));
      aim(up, kn, mid.clone().sub(A));
      aim(kn, ft, end.clone().sub(mid));
      setWorldQuat(ft, restW.get(ft)); // כף הרגל שטוחה על הרצפה
    });
  }
  sit();
  const bodyRestQ = new Map();
  all.forEach((b) => bodyRestQ.set(b, b.quaternion.clone()));
  // אחרי הישיבה "המנוחה" של הזרועות היא עדיין T-pose (restQ), הגוף הוא המצב הנוכחי

  // ---------- יד שמאל ----------
  function leftTargets(spec) {
    const pressed = {};
    ((spec && spec.fingers) || []).forEach((f) => (pressed[f.finger] = f));
    const xs = [];
    const zs = [];
    Object.values(pressed).forEach((f) => {
      const p = guitar.fretPoint(f.string, f.fret);
      // היד ממורכזת כך ששורש כל אצבע לוחצת יהיה מעל הנקודה שלה (האגודל לכיוון הקצה של הצוואר)
      xs.push(p.x + handInfo.Left.lat[f.finger - 1]);
      zs.push(p.z);
    });
    const xc = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : guitar.fretX((spec && spec.at) || 2) - 0.4;
    const zc = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : 0.2;
    return { pressed, xc, zc };
  }
  const LEFT_F = V(0, 0.25, 0.97);
  const LEFT_P = V(0, -0.97, 0.25);
  const LEFT_POLE = V(0.35, -1, -0.5);

  function solveLeft(dt) {
    const lh = st.lh;
    const tg = leftTargets(lh.spec);
    const k = lh.init && !st.reduced ? 1 - Math.exp(-dt * 11) : 1;
    lh.init = true;
    const hwx = guitar.hw(tg.xc);
    const rzT = clamp(tg.zc - 4.3, -hwx - 3.2, -hwx - 0.4);
    let moved = Math.abs(tg.xc - lh.xc) + Math.abs(rzT - lh.rz);
    lh.xc += (tg.xc - lh.xc) * k;
    lh.rz += (rzT - lh.rz) * k;
    const tips = [];
    for (let i = 0; i < 4; i++) {
      const f = tg.pressed[i + 1];
      let des;
      if (f) {
        des = guitar.fretPoint(f.string, f.fret);
        des.y += FR;
      } else {
        const x = lh.xc + (i - 1.5) * 0.9 + 0.2;
        des = V(x, guitar.ys(x) + 1.6, clamp(tg.zc + 0.7 - i * 0.25, -1.4, 1.2));
      }
      if (!lh.tips[i]) lh.tips[i] = des.clone();
      moved += lh.tips[i].distanceTo(des);
      lh.tips[i].lerp(des, k);
      tips.push(lh.tips[i].clone());
    }
    const thumbT = V(lh.xc - 0.9, -1.3 - 0.5, clamp(tg.zc * 0.25, -0.8, 0.8) + 0.3);
    moved += lh.thumb.distanceTo(thumbT);
    lh.thumb.lerp(thumbT, k);
    lh.dirty = moved > 0.002;

    // שורש האצבעות (מרכז) במערכת הגיטרה
    const rc = V(lh.xc, 1.0, lh.rz);
    applyLeft({ rc: L2W(rc), f: D2W(LEFT_F), p: D2W(LEFT_P), tips: tips.map(L2W), thumb: L2W(lh.thumb), pole: D2W(LEFT_POLE) });
  }

  // מפעיל זרוע+יד+אצבעות לפי תצורה בעולם
  function applyLimb(S, c) {
    resetBones(armBones(S).concat(handChain(S), [S + 'Shoulder']));
    B[S + 'Shoulder'].updateMatrixWorld(true);
    const Qd = handQuat(S, c.f, c.p);
    const W = c.rc.clone().sub(handInfo[S].mcp.clone().applyQuaternion(Qd));
    // הכתף נעה מעט לכיוון היעד – מרחיבה את הטווח של הזרוע
    {
      const cl = B[S + 'Shoulder'];
      const cp = worldPos(cl);
      const cur = worldPos(B[S + 'Arm']).sub(cp).normalize();
      const want = W.clone().sub(cp).normalize();
      aim(cl, B[S + 'Arm'], cur.lerp(want, SHRUG).normalize());
    }
    st.reach[S] = armIK(S, W, c.pole, Qd).length();
    fingers[S].forEach((F, i) => {
      applyFinger(F);
      ccdFinger(F, c.tips[i]);
    });
    ccdThumb(thumbs[S], c.thumb);
  }
  const applyLeft = (c) => applyLimb('Left', c);

  // ---------- יד ימין ----------
  function fingerForString(s) {
    if (!classical) return 0;
    if (s === 3) return 0;
    if (s === 2) return 1;
    if (s === 1) return 2;
    return -1;
  }
  function rightRest(dt, time) {
    const rh = st.rh;
    const base = { hz: rh.hz };
    let lift = [0.75, 0.8, 0.85, 0.9];
    let thumbLift = 0.7;
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

  const RIGHT_F = V(-0.3, -0.92, -0.25);
  const RIGHT_T = V(0, 0, 1);
  const RIGHT_POLE = V(-1, -0.5, 0.35);
  function rightPlay(r) {
    const hz = r.hz;
    const rc = V(rx + 1.5, 4.6, hz - 1.7);
    const tips = [];
    for (let i = 0; i < 4; i++) {
      const x = rx - 0.1 + (r.active === i ? r.tipDx : 0);
      tips.push(V(x, guitar.ys(x) + FR + r.lift[i], hz + OFFS[i]));
    }
    let thumb;
    if (classical) {
      const thx = rx - 0.5 + (r.active === -1 ? r.tipDx : 0);
      thumb = V(thx, guitar.ys(thx) + FR + r.thumbLift, hz + 1.6);
    } else {
      thumb = tips[0].clone().add(V(0.55, 0.6, 0.35));
    }
    const f = RIGHT_F.clone();
    const t = RIGHT_T.clone();
    const p = new THREE.Vector3().crossVectors(t, f);
    return { rc: L2W(rc), f: D2W(f), p: D2W(p), tips: tips.map(L2W), thumb: L2W(thumb), pole: D2W(RIGHT_POLE) };
  }
  // יד פתוחה בעולם (נפנוף / מנוחה)
  function openHand(rc, f, p, reach, pole, curl = 0) {
    const ff = f.clone().normalize();
    const pp = p.clone().addScaledVector(ff, -p.dot(ff)).normalize();
    const tt = new THREE.Vector3().crossVectors(pp, ff);
    const tips = fingers.Right.map((F, i) => rc.clone()
      .addScaledVector(ff, F.len * reach * (1 - curl * 0.45))
      .addScaledVector(pp, F.len * reach * curl * 0.8)
      .addScaledVector(tt, (1.5 - i) * 1.1));
    const thumb = rc.clone().addScaledVector(tt, 2.2).addScaledVector(ff, 1.2);
    return { rc, f: ff, p: pp, tips, thumb, pole };
  }
  function waveCfg(time) {
    const sw = st.reduced ? 0 : Math.sin(time * 9);
    const sh = worldPos(B.RightArm);
    return openHand(sh.clone().add(V(-5.5 + sw * 2.2, 23, 6)), V(sw * 0.3 - 0.15, 1, 0.1), V(0, 0.1, 1), 0.93, V(-0.5, -1, -0.3));
  }
  function parkCfg() {
    const sh = worldPos(B.RightArm);
    return openHand(sh.clone().add(V(-1.5, -17, 15)), V(0.1, -0.5, 0.85), V(0, 1, 0.2), 0.8, V(-1, -0.3, 0), 0.8);
  }
  function blend(a, b, w) {
    return {
      rc: a.rc.clone().lerp(b.rc, w),
      f: a.f.clone().lerp(b.f, w).normalize(),
      p: a.p.clone().lerp(b.p, w).normalize(),
      tips: a.tips.map((v, i) => v.clone().lerp(b.tips[i], w)),
      thumb: a.thumb.clone().lerp(b.thumb, w),
      pole: a.pole.clone().lerp(b.pole, w).normalize(),
    };
  }

  function solveRight(dt, time) {
    const rh = st.rh;
    const r = rightRest(dt, time);
    let w = 0;
    if (rh.wave > 0) {
      const t = time - rh.waveT0;
      w = ease(clamp(Math.min(t / 0.5, (rh.waveDur - t) / 0.5), 0, 1));
      if (t >= rh.waveDur) rh.wave = 0;
    }
    const pk = rh.park;
    let cfg = rightPlay(r);
    if (pk > 0.001) cfg = blend(cfg, parkCfg(), ease(pk));
    if (w > 0.001) cfg = blend(cfg, waveCfg(time), w);
    applyLimb('Right', cfg);
    const wantPark = rh.parkWanted && !rh.anim && !st.queue.length && time > rh.wakeUntil && rh.wave === 0;
    const target = wantPark ? 1 : 0;
    rh.park += (target - rh.park) * (st.reduced ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(target - rh.park) < 0.002) rh.park = target;
    rh.dirty = !!rh.anim || rh.wave > 0 || rh.park !== target;
    if (st.queue.length && !rh.anim && rh.park < 0.12) {
      const q = st.queue.shift();
      q();
      rh.dirty = true;
    }
  }

  // ---------- ראש ----------
  const fretLook = L2W(V(guitar.fretX(3), 0, 0));
  function solveHead(dt, time) {
    const hd = st.head;
    const camW = st.look;
    const wantCam = st.rh.wave > 0 ? 1 : camW ? 0.15 : 0;
    hd.cam += (wantCam - hd.cam) * (st.reduced ? 1 : 1 - Math.exp(-dt * 3));
    const tgt = fretLook.clone();
    if (camW) tgt.lerp(camW, hd.cam);
    const hp = worldPos(B.Head);
    const d = tgt.sub(hp);
    const yaw = clamp(Math.atan2(d.x, d.z), -0.9, 0.9);
    const pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.65);
    const k = st.reduced ? 1 : 1 - Math.exp(-dt * 6);
    hd.yaw += (yaw - hd.yaw) * k;
    hd.pitch += (pitch - hd.pitch) * k;
    const sway = st.reduced ? 0 : Math.sin(time * 0.9) * 0.02;
    // מחזירים את הצוואר והראש לתנוחת הישיבה ואז מסובבים
    ['Neck', 'Head'].forEach((n) => B[n].quaternion.copy(bodyRestQ.get(B[n])));
    B.Neck.updateMatrixWorld(true);
    rotW(B.Neck, V(0, 1, 0), hd.yaw * 0.4);
    rotW(B.Neck, V(1, 0, 0), hd.pitch * 0.4 + sway);
    rotW(B.Head, V(0, 1, 0), hd.yaw * 0.6);
    rotW(B.Head, V(1, 0, 0), hd.pitch * 0.6);
  }

  // ---------- ממשק ----------
  const center = V(5, 12, 10);
  let first = true;

  function update(dt, time) {
    dt = Math.min(dt, 0.05);
    st.reduced = !!(mq && mq.matches);
    const rh = st.rh;
    const wantPark = rh.parkWanted && !rh.anim && !st.queue.length && time > rh.wakeUntil && rh.wave === 0;
    if (first) {
      first = false;
      B.Hips.updateMatrixWorld(true);
      solveLeft(dt);
      solveRight(dt, time);
    } else {
      if (st.lh.dirty) solveLeft(dt);
      if (rh.dirty || rh.anim || rh.wave > 0 || st.queue.length || rh.park !== (wantPark ? 1 : 0)) solveRight(dt, time);
    }
    solveHead(dt, time);
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
      rh.dirty = true;
    };
    st.queue.length = 0;
    st.rh.wakeUntil = nowT() + 3;
    st.rh.dirty = true;
    if (st.rh.anim) {
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
      st.rh.anim = { type: 'strum', dir, strings: list, t0: nowT(), dur: (ms / 1000) * 1.18, hz0, hz1, amp, done: [] };
      st.rh.dirty = true;
    };
    st.rh.wakeUntil = nowT() + 3;
    st.rh.anim = null;
    st.rh.dirty = true;
    st.queue.push(start);
  }

  // בדיקה: המרחק (ביחידות הסצנה) בין כל קצה אצבע לנקודת היעד שלו
  function fingerErrors() {
    const out = [];
    const lh = st.lh;
    const tg = leftTargets(lh.spec);
    Object.values(tg.pressed).forEach((f) => {
      const des = guitar.fretPoint(f.string, f.fret);
      des.y += FR;
      const tip = worldPos(fingers.Left[f.finger - 1].tip);
      out.push({ finger: f.finger, string: f.string, fret: f.fret, dist: tip.distanceTo(L2W(des)) });
    });
    return out;
  }

  return {
    type: guitar.type,
    group,
    center,
    setLeftHand(spec) {
      st.lh.spec = spec || null;
      st.lh.dirty = true;
    },
    pluck,
    strum,
    wave(seconds = 2.4) {
      st.rh.wave = 1;
      st.rh.waveT0 = nowT();
      st.rh.waveDur = seconds;
      st.rh.dirty = true;
    },
    setLookTarget(v) {
      st.look = v;
    },
    setRightHand(mode) {
      st.rh.parkWanted = mode === 'park';
      st.rh.dirty = true;
    },
    set onRelease(fn) {
      st.onRelease = fn;
    },
    update,
    dispose() {
      // הגיאומטריה והחומרים של הדמות משותפים עם הדגם הטעון (מטמון) – משחררים רק את השרפרף
      stool.forEach((m) => m.dispose());
      group.children.forEach((c) => {
        if (c !== root) c.traverse((o) => o.geometry && o.geometry.dispose());
      });
      group.remove(root);
    },
    // לבדיקות/דיבוג
    _state: st,
    _debug: { fingerErrors, bones: B, fingers, L2W, worldPos, LEN, hipsY, hipJointY },
  };
}

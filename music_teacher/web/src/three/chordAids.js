// עזרי הוראה לאקורד על הצוואר: עיגולים ממוספרים וצבעוניים במקום כל אצבע, O ו-X ליד האום, הדגשת המיתרים הלחוצים,
// וטבעת צבעונית על קצה כל אצבע. הכול נגזר ממפרט האקורד (lib/chord.js) – אקורד חדש לא דורש קוד חדש.
import * as THREE from 'three';
import { chordMarkers, FINGER_COLORS } from '../lib/chord.js';

const ease = (t) => t * t * (3 - 2 * t);

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// עיגול צבעוני עם מספר (אותו מראה כמו בדיאגרמה בפאנל)
function numberTex(color, n) {
  return canvasTex(128, (g, s) => {
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.45, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    g.lineWidth = s * 0.07;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = `700 ${s * 0.62}px Rubik, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), s / 2, s / 2 + s * 0.04);
  });
}
// O (מיתר פתוח) ו-X (לא מנגנים): קו בהיר עם מסגרת כהה, כדי שייראו על כל רקע
function nutTex(kind) {
  return canvasTex(128, (g, s) => {
    const stroke = (w, col) => {
      g.lineWidth = w;
      g.strokeStyle = col;
      g.lineCap = 'round';
      g.beginPath();
      if (kind === 'open') g.arc(s / 2, s / 2, s * 0.26, 0, Math.PI * 2);
      else {
        g.moveTo(s * 0.26, s * 0.26);
        g.lineTo(s * 0.74, s * 0.74);
        g.moveTo(s * 0.74, s * 0.26);
        g.lineTo(s * 0.26, s * 0.74);
      }
      g.stroke();
    };
    stroke(s * 0.2, 'rgba(0,0,0,0.65)');
    stroke(s * 0.11, kind === 'open' ? '#ffffff' : '#ff6b5e');
  });
}

export function createChordAids(guitar) {
  const group = new THREE.Group(); // בצירי הגיטרה (נוסף ל-guitar.group)
  group.name = 'chord-aids';
  const rings = new THREE.Group(); // בצירי העולם (נוסף לסצנה)
  rings.name = 'chord-rings';
  const disposables = [];
  const keep = (o) => {
    disposables.push(o);
    return o;
  };
  let items = []; // { finger, marker, ribbon, k (0..1), want (0|1) }
  let fixed = []; // O / X
  let ringObjs = {}; // finger -> mesh

  const circle = keep(new THREE.CircleGeometry(0.31, 40).rotateX(-Math.PI / 2).rotateY(Math.PI));
  const ringGeo = keep(new THREE.TorusGeometry(0.5, 0.11, 10, 32));

  function clear() {
    items.forEach((it) => {
      group.remove(it.marker, it.ribbon);
    });
    fixed.forEach((s) => group.remove(s));
    Object.values(ringObjs).forEach((r) => rings.remove(r));
    items = [];
    fixed = [];
    ringObjs = {};
  }

  // spec = { fingers, open, muted }
  function setSpec(spec) {
    clear();
    if (!spec) return;
    const geom = { fretX: guitar.fretX, zS: guitar.zS, ys: guitar.ys };
    const m = chordMarkers(spec, geom, { lift: -0.1, nutLift: 0.75 });
    m.fingers.forEach((f) => {
      const tex = keep(numberTex(f.color, f.finger));
      const marker = new THREE.Mesh(circle, keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })));
      marker.position.set(f.x, f.y, f.z);
      marker.renderOrder = 9; // תמיד מעל היד (x-ray), כדי שהמספר יראה גם כשהאצבע מכסה
      marker.scale.setScalar(0.001);
      marker.visible = false;
      // הדגשת המיתר הלחוץ: סרט צבעוני דק מעל המיתר, מהאום ועד סוף האזור הנראה
      const x1 = guitar.fretX(Math.max(4, f.fret + 1));
      const w = 0.1;
      const r = guitar.spec.radii[f.string] + 0.03;
      const y0 = guitar.ys(0) + r;
      const y1 = guitar.ys(x1) + r;
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, y0, guitar.zS(f.string, 0) - w, 0, y0, guitar.zS(f.string, 0) + w, x1, y1, guitar.zS(f.string, x1) + w, x1, y1, guitar.zS(f.string, x1) - w]), 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const ribbon = new THREE.Mesh(geo, keep(new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })));
      ribbon.renderOrder = 5;
      group.add(ribbon, marker);
      items.push({ finger: f.finger, marker, ribbon, k: 0, want: 0 });
    });
    const nutSprite = (o) => {
      const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(nutTex(o.kind)), transparent: true, depthTest: false, depthWrite: false })));
      sp.position.set(o.x - 0.1, o.y, o.z);
      sp.scale.setScalar(0.62);
      sp.renderOrder = 8;
      group.add(sp);
      fixed.push(sp);
    };
    [...m.open, ...m.muted].forEach(nutSprite);
    // טבעת צבעונית על קצה כל אצבע באקורד
    m.fingers.forEach((f) => {
      const ring = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: FINGER_COLORS[f.finger] })));
      ring.renderOrder = 4;
      ring.visible = false;
      rings.add(ring);
      ringObjs[f.finger] = ring;
    });
  }

  // אילו אצבעות כבר למטה (רשימת מספרים); instant = בלי אנימציה
  function setDown(down, instant = false) {
    const set = new Set(down || []);
    items.forEach((it) => {
      it.want = set.has(it.finger) ? 1 : 0;
      if (instant) it.k = it.want;
    });
  }

  const _q = new THREE.Quaternion();
  const _z = new THREE.Vector3(0, 0, 1);
  // frames = [{ finger, tip (עולם), dir (מהמפרק אל הקצה, עולם) }] מהמורה
  function update(dt, frames) {
    items.forEach((it) => {
      const d = it.want - it.k;
      it.k = Math.abs(d) < 0.001 ? it.want : it.k + Math.sign(d) * Math.min(Math.abs(d), dt / 0.28);
      const e = ease(it.k);
      it.marker.visible = e > 0.01;
      // קפיצה קטנה בהופעה: מגדילים מעט ואז חוזרים
      it.marker.scale.setScalar(Math.max(0.001, e * (1 + 0.28 * Math.sin(Math.PI * Math.min(1, it.k)))));
      it.ribbon.material.opacity = 0.62 * e;
    });
    (frames || []).forEach((fr) => {
      const r = ringObjs[fr.finger];
      if (!r) return;
      r.visible = true;
      r.position.copy(fr.tip).addScaledVector(fr.dir, -0.55);
      r.quaternion.copy(_q.setFromUnitVectors(_z, fr.dir));
    });
  }

  function dispose() {
    clear();
    disposables.forEach((o) => o.dispose && o.dispose());
  }

  return { group, rings, setSpec, setDown, update, dispose, get count() { return items.length; }, get shown() { return items.map((i) => +i.k.toFixed(2)); } };
}

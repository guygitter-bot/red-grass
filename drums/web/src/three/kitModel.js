// בניית הסט בתלת־ממד מתוך layout3d: מעטפות, עורות, חישוקים, ברגים, מצילות מחרטה, סטנדים, דוושה, כיסא ושטיח.
// מחזיר group + מפה של חלקים (לאנימציית מכה, הדגשות לימוד ואזורי הקשה). חלקים קבועים מאוחדים לגאומטריה אחת (פחות קריאות ציור).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { layout3d, SEAT } from '../lib/layout3d';
import { beaterFelt, brass, chrome, contactShadowMaterial, darkMetal, felt, glowTexture, headMaterial, kickFrontMaterial, kickHoopMaterial, rugMaterial, shellMaterial } from './materials';

const Y = new THREE.Vector3(0, 1, 0);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// אוסף גאומטריות קבועות לפי חומר – מאוחדות בסוף לרשת אחת לכל חומר
class Batch {
  constructor() {
    this.parts = [];
  }
  add(geom, matrix) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g);
  }
  // צינור בין שתי נקודות
  tube(a, b, radius, seg = 10) {
    const A = a.isVector3 ? a : V(a);
    const B = b.isVector3 ? b : V(b);
    const d = B.clone().sub(A);
    const len = d.length();
    if (len < 1e-4) return;
    const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), new THREE.Vector3(radius, len, radius));
    this.add(UNIT_TUBE(seg), m);
  }
  mesh(material) {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return new THREE.Mesh(g, material);
  }
}

const tubeCache = {};
function UNIT_TUBE(seg) {
  if (!tubeCache[seg]) tubeCache[seg] = new THREE.CylinderGeometry(1, 1, 1, seg, 1, false);
  return tubeCache[seg];
}

const mat4 = (pos, quat, scale) => new THREE.Matrix4().compose(pos, quat || new THREE.Quaternion(), scale || new THREE.Vector3(1, 1, 1));

// ---- מצילה: פרופיל מחרטה (פעמון, קשת, שפה) ----
function cymbalProfile(r, type) {
  const bellR = r * (type === 'ride' ? 0.3 : type === 'splash' ? 0.26 : type === 'hat' ? 0.27 : 0.23);
  const bellH = type === 'ride' ? 0.034 : type === 'splash' ? 0.016 : type === 'hat' ? 0.02 : 0.028;
  const drop = type === 'ride' ? 0.03 : type === 'hat' ? 0.008 : type === 'splash' ? 0.014 : 0.026;
  const pts = [
    [0.008, bellH],
    [bellR * 0.45, bellH * 0.97],
    [bellR * 0.78, bellH * 0.78],
    [bellR * 0.96, bellH * 0.35],
    [bellR * 1.08, bellH * 0.06],
  ];
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    let y = -drop * Math.pow(t, 1.25);
    // צ'יינה: השפה מתהפכת כלפי מעלה
    if (type === 'china' && t > 0.8) y += ((t - 0.8) / 0.2) ** 2 * 0.03;
    pts.push([bellR * 1.08 + (r - bellR * 1.08) * t, y]);
  }
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}

const cymCache = new Map();
function cymbalGeometry(r, type) {
  const key = `${r.toFixed(3)}:${type}`;
  if (!cymCache.has(key)) cymCache.set(key, new THREE.LatheGeometry(cymbalProfile(r, type), 72));
  return cymCache.get(key);
}

// ---- טבעת הדגשה (לימוד) – שיידר: טבעת זוהרת או מקווקוות ----
function cueMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(3.2, 0.25, 1.4) }, uDash: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vPos;
      void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uDash; uniform float uTime; uniform float uAlpha; varying vec2 vUv; varying vec3 vPos;
      void main(){
        float a = atan(vPos.y, vPos.x);
        float rr = length(vPos.xy);
        float w = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float dash = mix(1.0, step(0.5, fract(a * 6.0 / 3.14159 + uTime * 0.6)), uDash);
        float pulse = mix(0.75 + 0.25 * sin(uTime * 14.0), 0.55, uDash);
        gl_FragColor = vec4(uColor * pow(w, 1.4) * dash * pulse * uAlpha, 1.0);
      }`,
  });
}

// טבעת שטוחה ב-UV רדיאלי (v=0 בפנים, 1 בחוץ)
function ringGeometry(inner, outer) {
  const g = new THREE.RingGeometry(inner, outer, 72, 1);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const rr = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, 0, (rr - inner) / (outer - inner));
  }
  return g;
}

function haloSprite() {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.visible = false;
  s.renderOrder = 10;
  return s;
}

// ---- תוף (סנר / טום / רצפה / בס) ----
function buildDrum(p, finishId, hw, dark) {
  const root = new THREE.Group();
  root.position.copy(V(p.pos));
  root.quaternion.setFromUnitVectors(Y, V(p.axis));
  const body = new THREE.Group();
  root.add(body);
  const kick = p.kind === 'kick';
  const r = p.r;
  const d = p.depth;
  // בבס: מרכז הגוף ב-0 והעור שפונה למתופף ב-+d/2. בשאר: העור העליון ב-0
  const top = kick ? d / 2 : 0;
  const bottom = top - d;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, 64, 1, true), shellMaterial(finishId));
  shell.position.y = (top + bottom) / 2;
  body.add(shell);

  const head = new THREE.Mesh(new THREE.CircleGeometry(1, 64), headMaterial(true));
  head.rotation.x = -Math.PI / 2;
  head.scale.set(r * 0.985, r * 0.985, 1);
  head.position.y = top + 0.003;
  body.add(head);
  const under = new THREE.Mesh(new THREE.CircleGeometry(1, 48), kick ? kickFrontMaterial(finishId) : headMaterial(false));
  under.rotation.x = Math.PI / 2;
  under.scale.set(r * 0.985, r * 0.985, 1);
  under.position.y = bottom - 0.003;
  if (kick) under.rotation.z = Math.PI;
  body.add(under);

  // חומרה מכרום: חישוקים, ברגים (לאגים) ומוטות מתיחה – מאוחדים לרשת אחת לתוף
  const metal = new Batch();
  const hoopT = kick ? 0.0 : 0.008;
  if (!kick) {
    for (const y of [top + 0.006, bottom - 0.006]) metal.add(new THREE.TorusGeometry(r + 0.004, hoopT, 8, 72), mat4(new THREE.Vector3(0, y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)));
  } else {
    // חישוקי עץ בצבע העטיפה עם פס כרום
    const wood = new Batch();
    for (const y of [top + 0.012, bottom - 0.012]) {
      wood.add(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.03, 72, 1, true), mat4(new THREE.Vector3(0, y, 0)));
      metal.add(new THREE.TorusGeometry(r + 0.013, 0.003, 6, 72), mat4(new THREE.Vector3(0, y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)));
    }
    const wm = wood.mesh(kickHoopMaterial(finishId));
    body.add(wm);
  }
  const lugs = Math.max(6, Math.min(10, Math.round(r * 46)));
  const rows = d > 0.3 && !kick ? [top - d * 0.22, bottom + d * 0.22] : [(top + bottom) / 2];
  const lugGeo = new THREE.CapsuleGeometry(0.009, 0.03, 3, 8);
  for (let i = 0; i < lugs; i++) {
    const a = ((i + 0.5) / lugs) * Math.PI * 2;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    for (const y of rows) metal.add(lugGeo, mat4(new THREE.Vector3(cx * (r + 0.008), y, cz * (r + 0.008))));
    const rr = r + 0.014;
    metal.tube([cx * rr, top + 0.004, cz * rr], [cx * rr, rows[0] + 0.02, cz * rr], 0.0028, 6);
    if (p.kind === 'snare' || kick || rows.length > 1) metal.tube([cx * rr, bottom - 0.004, cz * rr], [cx * rr, rows[rows.length - 1] - 0.02, cz * rr], 0.0028, 6);
  }
  if (p.kind === 'snare') {
    // מנגנון השחרור של הסנר
    metal.add(new THREE.BoxGeometry(0.03, 0.05, 0.02), mat4(new THREE.Vector3(r + 0.016, (top + bottom) / 2, 0)));
  }
  const mm = metal.mesh(chrome());
  body.add(mm);

  // רגליים / תושבות (קבועות – לא זזות במכה)
  const P = V(p.pos);
  const A = V(p.axis);
  if (p.kind === 'floor') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const att = P.clone().addScaledVector(A, -0.12).addScaledVector(side, r + 0.02);
      hw.tube(att.clone().add(new THREE.Vector3(0, 0.03, 0)), att.clone().addScaledVector(side, 0.08).setY(0.01), 0.0065);
      dark.add(new THREE.SphereGeometry(0.014, 8, 6), mat4(att.clone().addScaledVector(side, 0.08).setY(0.012)));
    }
  } else if (kick) {
    // דורבנות קדמיים
    for (const s of [-1, 1]) {
      const att = P.clone().add(new THREE.Vector3(s * (r + 0.01), 0, -d * 0.3));
      hw.tube(att, att.clone().add(new THREE.Vector3(s * 0.14, 0, -0.06)).setY(0.01), 0.007);
    }
  }
  return { root, body, head, under, kick };
}

// ---- סטנד מצילה (רגל משולשת, צינור ובום) ----
function cymbalStand(hw, dark, P, A, outward, height) {
  const under = P.clone().addScaledVector(A, -0.04);
  const base = new THREE.Vector3(P.x + outward.x, 0, P.z + outward.z);
  const mid = new THREE.Vector3(base.x, Math.max(0.5, Math.min(height, under.y - 0.18)), base.z);
  tripod(hw, dark, base, 0.24);
  hw.tube(base.clone().setY(0.2), mid, 0.011);
  hw.tube(mid, under, 0.008);
  dark.add(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10), mat4(mid));
}

function tripod(hw, dark, base, spread) {
  const top = base.clone().setY(0.24);
  hw.tube(base.clone().setY(0.02), top, 0.012);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const foot = base.clone().add(new THREE.Vector3(Math.cos(a) * spread, 0.012, Math.sin(a) * spread));
    hw.tube(top.clone().setY(0.18), foot, 0.0075);
    dark.add(new THREE.SphereGeometry(0.016, 8, 6), mat4(foot));
  }
}

// ---- בניית הסט כולו ----
export function buildKit(kit, finishId, mode = 'wide') {
  const layout = layout3d(kit, mode);
  const dk = (Array.isArray(kit) ? kit : kit.pieces).includes('kick2');
  const group = new THREE.Group();
  const hw = new Batch(); // כרום קבוע
  const dark = new Batch(); // מתכת כהה קבועה
  const pieces = new Map();
  const footprints = [];

  for (const p of layout) {
    const P = V(p.pos);
    const A = V(p.axis);
    const entry = { id: p.id, kind: p.kind, layout: p, anim: null, cue: null, flashT: 9, flashColor: new THREE.Color() };
    let staticRoot;
    if (['kick', 'snare', 'tom', 'floor'].includes(p.kind)) {
      const drum = buildDrum(p, finishId, hw, dark);
      group.add(drum.root);
      Object.assign(entry, { root: drum.root, body: drum.body, head: drum.head, under: drum.under });
      staticRoot = drum.root;
      footprints.push([p.pos[0], p.pos[2], p.r * (p.kind === 'kick' ? 1.1 : 0.8)]);
      if (p.kind === 'snare') {
        // סטנד סל
        const bottom = P.clone().addScaledVector(A, -p.depth - 0.02);
        const base = new THREE.Vector3(P.x, 0, P.z);
        tripod(hw, dark, base, 0.22);
        hw.tube(base.clone().setY(0.2), bottom, 0.011);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          hw.tube(bottom, P.clone().addScaledVector(A, -p.depth * 0.6).add(new THREE.Vector3(Math.cos(a) * p.r * 0.95, 0, Math.sin(a) * p.r * 0.95)), 0.005);
        }
        footprints.push([P.x, P.z, 0.25]);
      } else if (p.kind === 'tom') {
        // זרוע מהבס (סט רגיל) או סטנד נפרד
        const mount = P.clone().addScaledVector(A, -p.depth * 0.55);
        const kick = layout.find((q) => q.kind === 'kick');
        if (kick && !dk && Math.abs(P.x) < 0.42) {
          const kp = V(kick.pos).add(new THREE.Vector3(0, kick.r + 0.02, 0.02));
          const elbow = new THREE.Vector3(P.x * 0.7, kp.y + 0.12, (kp.z + mount.z) / 2);
          hw.tube(kp, elbow, 0.011);
          hw.tube(elbow, mount, 0.009);
          dark.add(new THREE.BoxGeometry(0.05, 0.03, 0.05), mat4(kp));
        } else {
          const base = new THREE.Vector3(P.x, 0, P.z - 0.12);
          tripod(hw, dark, base, 0.2);
          hw.tube(base.clone().setY(0.2), mount.clone().add(new THREE.Vector3(0, -0.05, -0.04)), 0.011);
          hw.tube(mount.clone().add(new THREE.Vector3(0, -0.05, -0.04)), mount, 0.009);
        }
      }
      if (p.kind === 'kick') {
        // דוושה: לוח רגל, מסגרת ומקל עם ראש לבד (המקל זז במכה)
        const fz = P.z + p.depth / 2;
        const foot = new THREE.Vector3(P.x, 0.035, fz + 0.2);
        dark.add(new THREE.BoxGeometry(0.085, 0.012, 0.26), mat4(foot, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.22)));
        dark.add(new THREE.BoxGeometry(0.11, 0.01, 0.07), mat4(new THREE.Vector3(foot.x, 0.006, fz + 0.04)));
        for (const s of [-1, 1]) hw.tube([foot.x + s * 0.05, 0.01, fz + 0.05], [foot.x + s * 0.05, 0.2, fz + 0.06], 0.006);
        hw.tube([foot.x - 0.05, 0.2, fz + 0.06], [foot.x + 0.05, 0.2, fz + 0.06], 0.006);
        const pivot = new THREE.Group();
        pivot.position.set(foot.x, 0.2, fz + 0.06);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6), chrome());
        shaft.position.y = 0.1;
        pivot.add(shaft);
        const beater = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 16), beaterFelt());
        beater.rotation.z = Math.PI / 2;
        beater.position.y = 0.19;
        pivot.add(beater);
        pivot.rotation.x = 0.55;
        group.add(pivot);
        entry.beater = pivot;
        footprints.push([foot.x, foot.z, 0.14]);
      }
    } else {
      // מצילות, היי-האט, פעמון: ציר (pivot) מתחת למרכז – המצילה מתנדנדת סביבו
      const pivot = new THREE.Group();
      pivot.position.copy(P);
      pivot.quaternion.setFromUnitVectors(Y, A);
      group.add(pivot);
      const swing = new THREE.Group();
      pivot.add(swing);
      entry.root = pivot;
      entry.body = swing;
      staticRoot = pivot;
      const outward = new THREE.Vector3(Math.sign(P.x || 1) * 0.1, 0, 0.06);
      if (p.kind === 'cowbell') {
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.15, 4, 1, false), darkMetal());
        bell.rotation.set(Math.PI / 2, Math.PI / 4, 0);
        swing.add(bell);
        cymbalStand(hw, dark, P.clone().add(new THREE.Vector3(0, -0.04, -0.05)), Y, outward, 0.9);
        footprints.push([P.x + outward.x, P.z + outward.z, 0.2]);
      } else if (p.kind === 'hihat' || p.kind === 'xhat') {
        const geo = cymbalGeometry(p.r, 'hat');
        const topC = new THREE.Mesh(geo, brass('hat'));
        const botC = new THREE.Mesh(geo, brass('hat'));
        botC.rotation.x = Math.PI;
        const gap = p.kind === 'xhat' ? 0.045 : 0.014;
        botC.position.y = -gap;
        swing.add(topC);
        swing.add(botC);
        entry.topCym = topC;
        entry.gap = gap;
        dark.add(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), mat4(P.clone().addScaledVector(A, 0.035)));
        if (p.kind === 'hihat') {
          const base = new THREE.Vector3(P.x, 0, P.z);
          tripod(hw, dark, base, 0.24);
          hw.tube(base.clone().setY(0.2), P.clone().addScaledVector(A, -gap - 0.02), 0.012);
          hw.tube(P, P.clone().addScaledVector(A, 0.06), 0.004);
          dark.add(new THREE.BoxGeometry(0.085, 0.012, 0.26), mat4(new THREE.Vector3(P.x + 0.04, 0.04, P.z + 0.28), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.22)));
          footprints.push([P.x, P.z, 0.28], [P.x + 0.04, P.z + 0.28, 0.12]);
        } else {
          cymbalStand(hw, dark, P.clone().addScaledVector(A, -gap), A, outward, 0.6);
          footprints.push([P.x + outward.x, P.z + outward.z, 0.24]);
        }
      } else {
        const type = p.kind === 'ride' ? 'ride' : p.kind === 'china' ? 'china' : p.kind === 'splash' ? 'splash' : 'crash';
        const cym = new THREE.Mesh(cymbalGeometry(p.r, type), brass(type === 'china' ? 'dark' : 'bright'));
        if (type === 'china') cym.rotation.x = Math.PI;
        swing.add(cym);
        // לבד אדום + אום כנף מעל הפעמון
        const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.018, 10), felt());
        nut.position.y = (type === 'china' ? 0.006 : 0.04);
        swing.add(nut);
        cymbalStand(hw, dark, P, A, outward, 1.0);
        footprints.push([P.x + outward.x, P.z + outward.z, 0.24]);
      }
    }

    // טבעת לימוד והילת מכה
    const ringR = p.kind === 'kick' ? p.hitR * 0.8 : p.r;
    const ring = new THREE.Mesh(ringGeometry(ringR * 1.05, ringR * 1.2), cueMaterial());
    ring.visible = false;
    ring.renderOrder = 9;
    if (p.kind === 'kick') {
      ring.position.set(p.hitPos[0], 0.012, p.hitPos[2]);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
    } else {
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = p.kind === 'tom' || p.kind === 'snare' || p.kind === 'floor' ? 0.012 : 0.05;
      staticRoot.add(ring);
    }
    entry.ring = ring;
    const halo = haloSprite();
    halo.position.copy(V(p.hitPos)).add(new THREE.Vector3(0, 0.03, 0));
    halo.scale.setScalar(p.r * 3.6);
    group.add(halo);
    entry.halo = halo;
    entry.haloBase = p.r * 3.6;

    // אזורי הקשה בלתי נראים: מדויק (בגודל החלק) ונדיב (hitR)
    const hitGeo = UNIT_TUBE(16);
    const exactR = p.kind === 'kick' ? p.hitR * 0.75 : p.r * 1.02;
    const mk = (rad, h) => {
      const m = new THREE.Mesh(hitGeo, HIT_MAT);
      m.visible = false;
      m.userData.pieceId = p.id;
      // יחס לרדיוס המדויק של החלק – כדי לחשב איפה על החלק פגעו (אזור הקשה)
      m.userData.rScale = rad / exactR;
      if (p.kind === 'kick') {
        m.position.copy(V(p.hitPos));
        m.scale.set(rad, 0.45, rad);
      } else {
        m.position.copy(P).addScaledVector(A, -h / 2 + 0.02);
        m.quaternion.setFromUnitVectors(Y, A);
        m.scale.set(rad, h, rad);
      }
      group.add(m);
      return m;
    };
    const cymLike = !['kick', 'snare', 'tom', 'floor'].includes(p.kind);
    entry.hitExact = mk(p.kind === 'kick' ? p.hitR * 0.75 : p.r * 1.02, cymLike ? 0.07 : Math.min(p.depth, 0.2));
    entry.hitWide = mk(p.hitR, cymLike ? 0.1 : Math.min(p.depth, 0.25));
    pieces.set(p.id, entry);
  }

  // הכיסא עצמו מחוץ לתמונה (המצלמה יושבת עליו) – רק הרגליים שלו על השטיח
  tripod(hw, dark, new THREE.Vector3(SEAT[0], 0, SEAT[2] + 0.1), 0.26);

  const hwMesh = hw.mesh(chrome());
  if (hwMesh) group.add(hwMesh);
  const darkMesh = dark.mesh(darkMetal());
  if (darkMesh) group.add(darkMesh);

  // שטיח + צללי מגע (טקסטורה אחת עם כתמים מתחת לכל חלק)
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.3), rugMaterial());
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.003, 0.05);
  group.add(rug);
  group.add(contactShadows(footprints));

  return { group, pieces, layout };
}

const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

function contactShadows(prints) {
  const g = new THREE.Group();
  const m = contactShadowMaterial();
  const geo = new THREE.PlaneGeometry(1, 1);
  // רשת אחת לכל כתם, אבל כולן חולקות חומר וגאומטריה; מאוחדות ל-InstancedMesh
  const im = new THREE.InstancedMesh(geo, m, prints.length);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  prints.forEach(([x, z, r], i) => {
    im.setMatrixAt(i, mat4(new THREE.Vector3(x, 0.006, z), q, new THREE.Vector3(r * 2.6, r * 2.6, 1)));
  });
  im.renderOrder = 1;
  g.add(im);
  return g;
}

export function disposeKit(model) {
  if (!model) return;
  model.group.traverse((o) => {
    if (o.isMesh || o.isSprite) {
      // גאומטריות משותפות (מצילות, צינור יחידה) נשארות במטמון
      if (o.geometry && !o.geometry.userData.shared && !Object.values(tubeCache).includes(o.geometry) && ![...cymCache.values()].includes(o.geometry)) o.geometry.dispose();
      if (o.material?.isShaderMaterial || o.isSprite || o.material?.userData?.dip) o.material.dispose();
    }
  });
}

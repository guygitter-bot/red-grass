// גיטרה בתלת־ממד (קלאסית / חשמלית).
// מערכת צירים של הגיטרה: x לאורך הצוואר (0 = האום, 40 = הגשר), y החוצה מהלוח (למעלה),
// z לרוחב: מיתר 6 (העבה) בצד חיובי, מיתר 1 (הדק) בצד שלילי. יחידה אחת ~ 16 מ"מ.
import * as THREE from 'three';

export const S = 40; // אורך המיתר הרוטט
const HL = new THREE.Color(0xffa11a); // צבע הדגשה

const SPECS = {
  classical: {
    sp0: 0.64, spk: 0.0045, hwExtra: 0.55, frets: 19, boardEnd: 27.4,
    radii: { 1: 0.085, 2: 0.1, 3: 0.12, 4: 0.12, 5: 0.14, 6: 0.16 }, plain: 3,
    dots: [3, 5, 7, 9, 12, 15, 17], rx: 31.6,
  },
  electric: {
    sp0: 0.5, spk: 0.0035, hwExtra: 0.42, frets: 21, boardEnd: 28.8,
    radii: { 1: 0.042, 2: 0.052, 3: 0.064, 4: 0.08, 5: 0.095, 6: 0.115 }, plain: 3,
    dots: [3, 5, 7, 9, 12, 15, 17, 19, 21], rx: 36.2,
  },
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// טקסטורת עץ מצוירת (רק בדפדפן)
function woodTex(base, dark, burst) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 150; i++) {
    const y = Math.random() * 512;
    g.strokeStyle = dark;
    g.globalAlpha = 0.04 + Math.random() * 0.1;
    g.lineWidth = 0.5 + Math.random() * 1.8;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y + (Math.random() - 0.5) * 8);
    g.stroke();
  }
  g.globalAlpha = 1;
  if (burst) {
    const r = g.createRadialGradient(170, 256, 20, 170, 256, 330);
    r.addColorStop(0, 'rgba(255,214,140,0.25)');
    r.addColorStop(0.5, 'rgba(0,0,0,0)');
    r.addColorStop(1, 'rgba(60,24,6,0.5)');
    g.fillStyle = r;
    g.fillRect(0, 0, 512, 512);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const std = (color, rough = 0.6, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

export function createGuitar(type = 'classical') {
  const sp = SPECS[type];
  const group = new THREE.Group();
  group.name = 'guitar-' + type;

  // פונקציות גיאומטריה של הצוואר
  const spacing = (x) => sp.sp0 + sp.spk * x;
  const zS = (i, x) => (i - 3.5) * spacing(x);
  const ys = (x) => 0.15 + 0.0085 * x;
  const hw = (x) => 2.5 * spacing(x) + sp.hwExtra;
  const fretX = (n) => S * (1 - Math.pow(2, -n / 12));

  // ---------- רישום חלקים להדגשה ----------
  const parts = {};
  function reg(name, mesh) {
    const p = (parts[name] ||= { meshes: [], mats: [], anchor: null, side: 'up' });
    p.meshes.push(mesh);
    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    ms.forEach((m) => {
      if (m && m.emissive && !p.mats.find((e) => e.m === m)) p.mats.push({ m, e0: m.emissive.clone(), i0: m.emissiveIntensity });
    });
    return mesh;
  }
  function add(parent, name, mesh) {
    parent.add(mesh);
    if (name) reg(name, mesh);
    return mesh;
  }

  function slab(x0, x1, hw0, hw1, th, ytop, mat) {
    const sh = new THREE.Shape();
    sh.moveTo(x0, -hw0);
    sh.lineTo(x1, -hw1);
    sh.lineTo(x1, hw1);
    sh.lineTo(x0, hw0);
    sh.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = ytop - th;
    return m;
  }
  function tube(a, b, r, mat, seg = 8) {
    const d = new THREE.Vector3().subVectors(b, a);
    const L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    return m;
  }
  // גוף מקו מתאר (נקודות x,z), נפרש מלמעלה
  function extrudeOutline(pts, depth, ytop, bevel, mats) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, -z, 0)), true, 'centripetal');
    const sh = new THREE.Shape(curve.getPoints(240).map((p) => new THREE.Vector2(p.x, p.y)));
    const g = new THREE.ExtrudeGeometry(sh, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 3, curveSegments: 12,
    });
    const m = new THREE.Mesh(g, mats);
    m.rotation.x = -Math.PI / 2;
    m.position.y = ytop - depth - bevel;
    return m;
  }
  const rollerGeo = (r, len) => {
    const g = new THREE.CylinderGeometry(r, r, len, 16);
    g.rotateX(Math.PI / 2); // ציר לאורך z
    return g;
  };

  // ---------- צוואר ולוח אצבעות ----------
  const classical = type === 'classical';
  const neckTex = woodTex(classical ? '#8c5a31' : '#d8a964', classical ? '#4a2a12' : '#9a6a2c');
  if (neckTex) neckTex.repeat.set(1 / 8, 1);
  const boardTex = woodTex(classical ? '#2b1b12' : '#4a2c1c', '#0c0604');
  if (boardTex) boardTex.repeat.set(1 / 6, 1);
  const neckEnd = sp.boardEnd + 0.8;

  const neckMesh = slab(-0.1, neckEnd, hw(0) - 0.1, hw(neckEnd) - 0.1, 1.0, -0.3, std(0xffffff, 0.6, 0, { map: neckTex, color: neckTex ? 0xffffff : classical ? 0x8c5a31 : 0xd8a964 }));
  group.add(neckMesh);
  add(group, 'fretboard', slab(0, sp.boardEnd, hw(0), hw(sp.boardEnd), 0.3, 0, std(0xffffff, 0.65, 0, { map: boardTex, color: boardTex ? 0xffffff : classical ? 0x2b1b12 : 0x4a2c1c })));

  for (let n = 1; n <= sp.frets; n++) {
    const x = fretX(n);
    add(group, 'frets', new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.085, hw(x) * 2), std(0xd9d4ca, 0.3, 0.6, { emissive: 0x000000 })));
    parts.frets.meshes[parts.frets.meshes.length - 1].position.set(x, 0.035, 0);
  }
  sp.dots.forEach((n) => {
    const xm = (fretX(n - 1) + fretX(n)) / 2;
    (n === 12 ? [-1.1, 1.1] : [0]).forEach((z) => {
      const d = add(group, 'dots', new THREE.Mesh(new THREE.CircleGeometry(0.21, 20), std(0xe9e0c8, 0.5)));
      d.rotation.x = -Math.PI / 2;
      d.position.set(xm, 0.014, z);
    });
  });
  const nut = add(group, 'nut', new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, hw(0) * 2 - 0.1), std(0xe8dfc8, 0.5)));
  nut.position.set(-0.05, 0.09, 0);

  // ---------- גוף ----------
  if (classical) buildClassicalBody();
  else buildElectricBody();

  function buildClassicalBody() {
    const half = [[0, 2.7], [2, 3.8], [5, 5.9], [8, 6.4], [11, 5.2], [13.2, 5.7], [16, 8.2], [20, 9.6], [23.4, 8.8], [25.4, 5.6], [26.2, 0]];
    const pts = [];
    for (let i = 0; i < half.length; i++) pts.push([21 + half[i][0], half[i][1]]);
    for (let i = half.length - 2; i >= 1; i--) pts.push([21 + half[i][0], -half[i][1]]);
    pts.push([21, -2.7]);
    const topTex = woodTex('#cd9650', '#7a4a1c', true);
    if (topTex) { topTex.repeat.set(1 / 26, 1 / 20); topTex.offset.set(0, 0.5); }
    const top = std(0xffffff, 0.5, 0, { map: topTex, color: topTex ? 0xffffff : 0xcd9650 });
    const side = std(0x5a3118, 0.5);
    add(group, 'body', extrudeOutline(pts, 4.4, -0.2, 0.22, [top, side]));
    // חור הקול ורוזטה
    const cx = 29;
    const mk = (geo, color, y) => {
      const m = add(group, 'soundhole', new THREE.Mesh(geo, std(color, 0.6)));
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, y, 0);
      return m;
    };
    mk(new THREE.RingGeometry(4.55, 4.75, 72), 0x2a170b, -0.185);
    mk(new THREE.RingGeometry(4.2, 4.55, 72), 0xe6dcc3, -0.184);
    mk(new THREE.RingGeometry(3.7, 4.2, 72), 0x8a5a2b, -0.183);
    mk(new THREE.RingGeometry(3.45, 3.7, 72), 0x2a170b, -0.182);
    mk(new THREE.CircleGeometry(3.45, 72), 0x0b0604, -0.181);
    // גשר: אבן עם אוכף וחורי קשירה
    const wood = () => std(0x2e1b10, 0.5);
    const bshape = new THREE.Shape();
    bshape.moveTo(39.2, -4.9);
    bshape.lineTo(43.3, -4.2);
    bshape.quadraticCurveTo(43.7, 0, 43.3, 4.2);
    bshape.lineTo(39.2, 4.9);
    bshape.quadraticCurveTo(38.8, 0, 39.2, -4.9);
    const bm = add(group, 'bridge', new THREE.Mesh(new THREE.ExtrudeGeometry(bshape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }), wood()));
    bm.rotation.x = -Math.PI / 2;
    bm.position.y = -0.2;
    const sd = add(group, 'bridge', new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 6.6), std(0xe8dfc8, 0.5)));
    sd.position.set(S, 0.44, 0);
    for (let i = 1; i <= 6; i++) {
      const h = add(group, 'bridge', new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), std(0x0b0604, 0.8)));
      h.position.set(42.4, 0.37, zS(i, 40));
    }
  }

  function buildElectricBody() {
    const color = 0xb3261e;
    const outline = [
      [22.2, 3.0], [20.8, 4.8], [19.6, 7.2], [20.6, 8.8], [23.6, 8.3], [27.5, 7.2], [30.5, 7.6], [35, 10.0], [40, 10.6], [44.5, 8.6], [47.2, 4.6], [47.8, 0],
      [47.2, -4.6], [44.5, -8.6], [40, -10.4], [35, -9.9], [31.6, -7.7], [28.8, -7.5], [26.2, -8.6], [23.6, -9.3], [22.0, -8.2], [21.8, -5.6], [22.2, -3.0],
    ];
    const mat = std(color, 0.35, 0.05, { emissive: 0x000000 });
    add(group, 'body', extrudeOutline(outline, 2.4, -0.3, 0.2, [mat, mat.clone()]));
    // לוח הגנה לבן
    const pg = [[25, 5.5], [27, 6.3], [32, 6.2], [37, 7.4], [41, 7.2], [41.8, 3], [42.4, -3], [41, -8.2], [35, -8.5], [30, -6.8], [26, -5.6], [24.6, -1.5]];
    const pgMesh = extrudeOutline(pg, 0.1, -0.05, 0.03, [std(0xf3efe6, 0.4, 0, { emissive: 0x000000 }), std(0xf3efe6, 0.4, 0, { emissive: 0x000000 })]);
    group.add(pgMesh);
    // פיקאפים
    [30, 34, 37.8].forEach((x, k) => {
      const p = add(group, 'pickups', new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 5.6), std(0xefe6cf, 0.45, 0, { emissive: 0x000000 })));
      p.position.set(x, 0.03, 0);
      p.scale.z = 1;
      for (let i = 1; i <= 6; i++) {
        const pole = add(group, 'pickups', new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 10), std(0xb9b9b4, 0.3, 0.8, { emissive: 0x000000 })));
        pole.position.set(x, 0.22, zS(i, x));
      }
      if (k === 2) p.rotation.y = 0.0;
    });
    // כפתורים: עוצמה, שני כפתורי צליל, ומתג בחירת פיקאפ
    [[33.4, -6.9], [35.9, -7.2], [38.4, -7.6]].forEach(([x, z]) => {
      const k = add(group, 'knobs', new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.8, 24), std(0xf3efe6, 0.35, 0, { emissive: 0x000000 })));
      k.position.set(x, 0.4, z);
      const cap = add(group, 'knobs', new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.18, 24), std(0xd9d4ca, 0.3, 0.6, { emissive: 0x000000 })));
      cap.position.set(x, 0.85, z);
    });
    const plate = add(group, 'knobs', new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 3.0), std(0x0b0b0b, 0.5, 0, { emissive: 0x000000 })));
    plate.position.set(31.6, 0.1, -6.5);
    const lever = add(group, 'knobs', new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.7), std(0xf3efe6, 0.4, 0, { emissive: 0x000000 })));
    lever.position.set(31.6, 0.4, -6.0);
    // שקע לכבל
    const jk = add(group, 'jack', new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 24), std(0xcfd0d2, 0.3, 0.8, { emissive: 0x000000 })));
    jk.position.set(43.3, 0.04, -5.2);
    const jh = add(group, 'jack', new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 16), std(0x050505, 0.8, 0, { emissive: 0x000000 })));
    jh.position.set(43.3, 0.08, -5.2);
    // גשר עם שישה אוכפים
    const bp = add(group, 'bridge', new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.3, 5.9), std(0xc7c8ca, 0.3, 0.8, { emissive: 0x000000 })));
    bp.position.set(40.4, 0.0, 0);
    for (let i = 1; i <= 6; i++) {
      const sd = add(group, 'bridge', new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, Math.min(0.78, spacing(S) * 0.9)), std(0xb8b9bb, 0.3, 0.85, { emissive: 0x000000 })));
      sd.position.set(39.55 + (7 - i) * 0.1, 0.3, zS(i, 39.6));
    }
  }

  // ---------- ראש הגיטרה ----------
  const head = new THREE.Group();
  group.add(head);
  const pegKnobs = [];
  const postPos = {}; // מיקום קצה המיתר בראש (מערכת צירים של הגיטרה)

  if (classical) {
    head.position.set(0, -0.12, 0);
    head.rotation.z = 0.24;
    const hshape = new THREE.Shape();
    const L = 10.4;
    hshape.moveTo(0, -2.35);
    hshape.lineTo(-L + 0.6, -3.0);
    hshape.quadraticCurveTo(-L - 0.4, -3.0, -L - 0.4, -2.2);
    hshape.lineTo(-L - 0.4, 2.2);
    hshape.quadraticCurveTo(-L - 0.4, 3.0, -L + 0.6, 3.0);
    hshape.lineTo(0, 2.35);
    hshape.closePath();
    [1, -1].forEach((s) => {
      const hole = new THREE.Path();
      const z0 = s > 0 ? 0.45 : -1.95;
      hole.moveTo(-8.8, z0);
      hole.lineTo(-1.3, z0);
      hole.lineTo(-1.3, z0 + 1.5);
      hole.lineTo(-8.8, z0 + 1.5);
      hole.closePath();
      hshape.holes.push(hole);
    });
    const hm = add(head, 'head', new THREE.Mesh(new THREE.ExtrudeGeometry(hshape, { depth: 0.75, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }), std(0x3a2214, 0.4)));
    hm.rotation.x = -Math.PI / 2;
    hm.position.y = -0.75 + 0.05 + 0.05;
    const xs = [-2.6, -5.0, -7.4];
    [1, -1].forEach((side) => {
      xs.forEach((x, k) => {
        const strIdx = side > 0 ? 6 - k : 1 + k;
        const roller = add(head, 'pegs', new THREE.Mesh(rollerGeo(0.26, 3.6), std(0xcfcab8, 0.3, 0.8, { emissive: 0x000000 })));
        roller.position.set(x, -0.3, side * 1.55);
        const edge = side * 3.15;
        const shaft = add(head, 'pegs', new THREE.Mesh(rollerGeo(0.12, 1.2), std(0xcfcab8, 0.3, 0.8, { emissive: 0x000000 })));
        shaft.position.set(x, -0.3, edge + side * 0.1);
        const btn = new THREE.Group();
        btn.position.set(x, -0.3, edge + side * 0.9);
        const disc = add(btn, 'pegs', new THREE.Mesh(rollerGeo(0.5, 0.22), std(0xf0ead8, 0.35, 0, { emissive: 0x000000 })));
        const tab = add(btn, 'pegs', new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.18), std(0xf0ead8, 0.35, 0, { emissive: 0x000000 })));
        tab.position.set(0, 0, 0);
        head.add(btn);
        pegKnobs.push(btn);
        head.updateMatrix();
        postPos[strIdx] = V(x, 0.0, side * 0.7).applyMatrix4(head.matrix);
      });
    });
  } else {
    head.position.set(0, -0.15, 0);
    const pts = [[0, 1.67], [-2.5, 1.85], [-6, 2.2], [-9, 2.7], [-11.4, 3.2], [-12.4, 2.2], [-12.2, 0.8], [-12.3, -1.0], [-12.0, -2.6], [-10, -2.5], [-6, -2.1], [-2.5, -1.85], [0, -1.67]];
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, -z, 0)), true, 'centripetal');
    const sh = new THREE.Shape(curve.getPoints(160).map((p) => new THREE.Vector2(p.x, p.y)));
    const hm = add(head, 'head', new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }), std(0xd8a964, 0.45, 0, { emissive: 0x000000 })));
    hm.rotation.x = -Math.PI / 2;
    hm.position.y = -0.6 - 0.06 + 0.0 + 0.02;
    for (let i = 1; i <= 6; i++) {
      const x = -2.2 - (i - 1) * 1.7;
      const post = add(head, 'pegs', new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.9, 16), std(0xcfd0d2, 0.3, 0.85, { emissive: 0x000000 })));
      post.position.set(x, 0.1, 0);
      const shaft = add(head, 'pegs', new THREE.Mesh(rollerGeo(0.1, 2.8), std(0xcfd0d2, 0.3, 0.85, { emissive: 0x000000 })));
      shaft.position.set(x, -0.2, 1.8);
      const btn = new THREE.Group();
      btn.position.set(x, -0.2, 3.4);
      add(btn, 'pegs', new THREE.Mesh(rollerGeo(0.5, 0.2), std(0xcfd0d2, 0.3, 0.85, { emissive: 0x000000 })));
      const tab = add(btn, 'pegs', new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.0, 0.18), std(0xcfd0d2, 0.3, 0.85, { emissive: 0x000000 })));
      tab.position.set(0, 0, 0);
      head.add(btn);
      pegKnobs.push(btn);
      head.updateMatrix();
      postPos[i] = V(x, 0.34, 0).applyMatrix4(head.matrix);
    }
    // מחזיק מיתרים קטן לשני המיתרים הדקים
    const tree = add(head, 'pegs', new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 10), std(0xcfd0d2, 0.3, 0.85, { emissive: 0x000000 })));
    tree.position.set(-2.6, 0.1, -0.2);
  }

  // ---------- מיתרים ----------
  const strings = {};
  const stringMeshes = [];
  const hitMeshes = [];
  const baseGroup = new THREE.Group();
  group.add(baseGroup);
  const HL_LEVEL = {};

  function strMat(i) {
    const wound = i > sp.plain;
    if (classical) {
      return wound
        ? std(0xc7cbd0, 0.35, 0.8, { emissive: 0xffa11a, emissiveIntensity: 0 })
        : std(0xefe8d2, 0.3, 0.1, { emissive: 0xffa11a, emissiveIntensity: 0, transparent: true, opacity: 0.93 });
    }
    return wound
      ? std(0xb7b2a6, 0.38, 0.85, { emissive: 0xffa11a, emissiveIntensity: 0 })
      : std(0xe2e3e4, 0.25, 0.95, { emissive: 0xffa11a, emissiveIntensity: 0 });
  }

  for (let i = 1; i <= 6; i++) {
    const r = sp.radii[i];
    const g = new THREE.CylinderGeometry(1, 1, 1, 6, 64, true);
    g.rotateZ(-Math.PI / 2);
    const pos = g.attributes.position;
    const n = pos.count;
    const base = new Float32Array(n * 3);
    const xsA = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const x = (pos.getX(k) + 0.5) * S;
      base[k * 3] = x;
      base[k * 3 + 1] = ys(x) + pos.getY(k) * r;
      base[k * 3 + 2] = zS(i, x) + pos.getZ(k) * r;
      xsA[k] = x;
      pos.setXYZ(k, base[k * 3], base[k * 3 + 1], base[k * 3 + 2]);
    }
    const mat = strMat(i);
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.userData.string = i;
    group.add(mesh);
    reg('strings', mesh);
    stringMeshes.push(mesh);

    // סרט הדגשה מתחת למיתר
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffa11a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const gg = new THREE.BufferGeometry();
    const w = 0.28;
    const y0 = ys(0) - 0.06;
    const y1 = ys(S) - 0.06;
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, y0, zS(i, 0) - w, 0, y0, zS(i, 0) + w, S, y1, zS(i, S) + w, S, y1, zS(i, S) - w]), 3));
    gg.setIndex([0, 1, 2, 0, 2, 3]);
    const glow = new THREE.Mesh(gg, glowMat);
    glow.renderOrder = 2;
    group.add(glow);

    // אזור לחיצה (שקוף)
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(S, 0.7, Math.max(0.45, spacing(20) * 0.92)),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.position.set(S / 2, ys(S / 2), zS(i, S / 2));
    hit.userData.string = i;
    group.add(hit);
    hitMeshes.push(hit);

    // קטע מהאום לראש
    const from = V(0, ys(0), zS(i, 0));
    const to = postPos[i];
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 1, 8), std(mat.color.getHex(), 0.4, mat.metalness));
    const dvec = new THREE.Vector3().subVectors(to, from);
    stub.scale.y = dvec.length();
    stub.position.copy(from).add(to).multiplyScalar(0.5);
    stub.quaternion.setFromUnitVectors(V(0, 1, 0), dvec.normalize());
    group.add(stub);
    reg('strings', stub);
    // קטע מהאוכף לקצה הגשר
    const a2 = V(S, ys(S), zS(i, S));
    const b2 = classical ? V(42.4, 0.37, zS(i, 40)) : V(41.9, 0.05, zS(i, S));
    const stub2 = tube(a2, b2, r * 0.9, std(mat.color.getHex(), 0.4, mat.metalness));
    group.add(stub2);
    reg('strings', stub2);

    strings[i] = {
      i, geom: g, base, xs: xsA, mat, glowMat, glow,
      amp: 0, t0: 0, tau: 0.9 + (6 - i) * 0.15, f: 7 + (6 - i) * 2.2, // תדר חזותי (לא הצליל)
      pull: 0, pullX: 30, hl: 0, hlT: 0, dirty: false, r,
    };
  }

  // ---------- עוגנים לתוויות ומצלמות ----------
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  Object.keys(parts).forEach((k) => {
    box.makeEmpty();
    parts[k].meshes.forEach((m) => box.expandByObject(m));
    parts[k].anchor = box.getCenter(new THREE.Vector3());
    parts[k].center = parts[k].anchor.clone();
    parts[k].size = box.getSize(new THREE.Vector3());
  });
  // עוגנים מותאמים לתוויות (שלא יתנגשו ביניהם)
  const setAnchor = (name, v, side = 'up') => {
    parts[name].anchor = v;
    parts[name].side = side;
  };
  setAnchor('fretboard', V(fretX(10.6), 0.1, hw(fretX(10.6))), 'up');
  setAnchor('frets', V(fretX(5), 0.12, -hw(fretX(5))), 'down');
  setAnchor('dots', V((fretX(6) + fretX(7)) / 2, 0.05, 0), 'up');
  setAnchor('nut', V(0, 0.25, hw(0)), 'up');
  setAnchor('strings', V(14, ys(14), 0), 'up');
  if (classical) setAnchor('soundhole', V(29, 0, 4.7), 'up');
  if (classical) setAnchor('body', V(33.5, 0, -8.6), 'down');
  if (!classical) setAnchor('body', V(26, 0, 8.5), 'up');
  if (!classical) {
    setAnchor('pickups', V(34, 0.3, 3.0), 'up');
    setAnchor('knobs', V(35.9, 1.0, -7.6), 'down');
    setAnchor('jack', V(43.3, 0.1, -5.9), 'down');
  }
  setAnchor('bridge', V(40.5, 0.5, classical ? 4.9 : 3.0), 'up');
  parts.head.anchor = classical ? V(-5, 1.5, 3) : V(-6, 0.5, 3);
  parts.pegs.anchor = classical ? V(-4.9, 1.2, 4.6) : V(-6.4, 0.5, 3.4);
  parts.pegs.anchor = parts.pegs.anchor.clone().applyMatrix4(head.matrix);
  parts.head.anchor = parts.head.anchor.clone().applyMatrix4(head.matrix);
  if (!classical) parts.head.center = parts.head.center.clone();

  // ---------- פונקציות לשימוש המורה והבמה ----------
  const partsOf = (names) => names.filter((n) => parts[n]);

  // נקודה על המיתר (מערכת צירים של הגיטרה)
  function stringPoint(i, x) {
    return V(x, ys(x), zS(i, x));
  }
  // נקודה ממש מאחורי שריג (מצד האום), כך שהאצבע לא עומדת על המתכת
  function fretPoint(i, fret) {
    if (fret <= 0) return stringPoint(i, 0.2);
    const x = fretX(fret) - 0.3 * (fretX(fret) - fretX(fret - 1));
    return stringPoint(i, x);
  }

  let hlParts = [];
  let hlMix = 0;
  function setHighlight(names) {
    hlParts = partsOf(names || []);
  }
  function setStringHighlight(i) {
    for (let k = 1; k <= 6; k++) strings[k].hlT = k === i ? 1 : 0;
  }
  // רעידת מיתר (לאחר שחרור)
  function pluck(i, amp = 1, t = performance.now() / 1000) {
    const s = strings[i];
    s.pull = 0;
    s.amp = amp;
    s.t0 = t;
    s.dirty = true;
  }
  // מתיחת המיתר בזמן הפריטה (0..1)
  function pull(i, v, x = 31) {
    const s = strings[i];
    s.pull = v;
    s.pullX = x;
    if (v > 0) s.dirty = true;
  }

  const tmpColor = new THREE.Color();
  function update(dt, t) {
    // הדגשת חלקים
    const pulse = 0.25 + 0.1 * Math.sin(t * 4.2);
    Object.keys(parts).forEach((k) => {
      if (k === 'strings') return;
      const on = hlParts.includes(k);
      parts[k].hl = (parts[k].hl || 0) + ((on ? 1 : 0) - (parts[k].hl || 0)) * Math.min(1, dt * 10);
      const h = parts[k].hl;
      if (h < 0.01 && !on && !parts[k].lit) return;
      parts[k].lit = h >= 0.01;
      parts[k].mats.forEach(({ m, e0, i0 }) => {
        m.emissive.copy(e0).lerp(tmpColor.copy(HL), h * 0.45);
        m.emissiveIntensity = i0 + h * pulse;
      });
    });
    const stringsOn = hlParts.includes('strings');
    // מפתחות מסתובבים כשהם מודגשים
    if (hlParts.includes('pegs')) pegKnobs.forEach((b) => (b.rotation.z += dt * 1.6));
    hlMix += ((stringsOn ? 1 : 0) - hlMix) * Math.min(1, dt * 10);

    for (let i = 1; i <= 6; i++) {
      const s = strings[i];
      s.hl += (s.hlT - s.hl) * Math.min(1, dt * 12);
      const hh = Math.max(s.hl, hlMix * 0.7);
      s.mat.emissiveIntensity = hh * (0.4 + 0.15 * Math.sin(t * 5));
      s.glowMat.opacity = s.hl * 0.55;
      // רעידה
      let live = s.dirty;
      if (!live) continue;
      const age = t - s.t0;
      let env = 0;
      let osc = 0;
      const pulling = s.pull > 0;
      if (!pulling) {
        env = s.amp * Math.exp(-age / s.tau);
        osc = Math.cos(2 * Math.PI * s.f * age);
        if (env < 0.003) {
          s.dirty = false;
          env = 0;
        }
      }
      const pos = s.geom.attributes.position;
      const A = 0.5;
      const ph2 = Math.cos(2 * Math.PI * s.f * 2 * age);
      for (let k = 0; k < pos.count; k++) {
        const x = s.xs[k];
        let dy = 0;
        let dz = 0;
        if (pulling) {
          const u = s.pullX / S;
          const q = x / S;
          const tri = q < u ? q / u : (1 - q) / (1 - u);
          dy = s.pull * tri * 0.9;
        } else {
          const sh = Math.sin((Math.PI * x) / S) * osc + 0.3 * Math.sin((2 * Math.PI * x) / S) * ph2;
          dy = env * A * sh;
          dz = env * A * 0.35 * Math.sin((Math.PI * x) / S) * Math.sin(2 * Math.PI * s.f * age);
        }
        pos.setXYZ(k, s.base[k * 3], s.base[k * 3 + 1] + dy, s.base[k * 3 + 2] + dz);
      }
      pos.needsUpdate = true;
    }
  }

  function dispose() {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
  }

  return {
    type, group, parts, strings, hitMeshes, spec: sp, S,
    zS, ys, hw, fretX, spacing, stringPoint, fretPoint,
    pluckX: sp.rx,
    postPos,
    setHighlight, setStringHighlight, pluck, pull, update, dispose,
  };
}

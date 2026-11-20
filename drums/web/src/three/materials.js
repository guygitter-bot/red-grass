// ספריית החומרים והטקסטורות של הבמה – הכול נוצר בקוד (canvas), בלי תמונות.
// כל חומר נוצר פעם אחת ומשותף לכל החלקים באותו תפקיד (כרום, פליז, עור...). dispose() משחרר הכול.
import * as THREE from 'three';
import { FINISH_COLORS } from '../lib/finish';

const cache = new Map();
function once(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// מספרים אקראיים קבועים (כדי שכל טעינה תיראה אותו דבר)
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

const hex = (h) => new THREE.Color(h);
function mixHex(a, b, t) {
  return hex(a).lerp(hex(b), t);
}

// ---- עטיפת המעטפת: נצנצים (פתיתי מתכת בזוויות אקראיות מתחת ללכה), פנינה, לכה או כרום ----
function finishTextures(id) {
  return once('finish-tex:' + id, () => {
    const f = FINISH_COLORS[id] || FINISH_COLORS.midnight;
    const N = 256;
    const [cc, cx] = canvas(N, N);
    const [nc, nx] = canvas(N, N);
    const r = rng(id.length * 977 + 13);
    cx.fillStyle = f.a;
    cx.fillRect(0, 0, N, N);
    nx.fillStyle = 'rgb(128,128,255)';
    nx.fillRect(0, 0, N, N);
    if (f.kind === 'pearl') {
      // פנינה: פסים גליים רכים בין שני הגוונים
      for (let i = 0; i < 70; i++) {
        const y0 = r() * N;
        cx.strokeStyle = mixHex(f.a, f.b, 0.3 + r() * 0.7).getStyle();
        cx.globalAlpha = 0.18 + r() * 0.3;
        cx.lineWidth = 2 + r() * 9;
        cx.beginPath();
        for (let x = -10; x <= N + 10; x += 8) cx.lineTo(x, y0 + Math.sin(x * 0.045 + i) * 14 + Math.sin(x * 0.11 + i * 2) * 5);
        cx.stroke();
      }
      cx.globalAlpha = 1;
    }
    // פתיתים: צבע בהיר יותר ונורמל נטוי – כל פתית מחזיר אור בזווית אחרת ולכן "מנצנץ" תחת הפנסים
    const flakes = Math.round(4200 * f.sp);
    for (let i = 0; i < flakes; i++) {
      const x = Math.floor(r() * N);
      const y = Math.floor(r() * N);
      const s = r() < 0.8 ? 1 : 2;
      cx.fillStyle = mixHex(f.a, f.b, 0.35 + r() * 0.65).getStyle();
      cx.fillRect(x, y, s, s);
      const ax = 128 + (r() - 0.5) * 210;
      const ay = 128 + (r() - 0.5) * 210;
      nx.fillStyle = `rgb(${ax | 0},${ay | 0},${200 + ((r() * 55) | 0)})`;
      nx.fillRect(x, y, s, s);
    }
    const map = tex(cc, { repeat: [5, 1.4] });
    const normal = tex(nc, { srgb: false, repeat: [5, 1.4] });
    normal.anisotropy = 1;
    return { map, normal, f };
  });
}

export function shellMaterial(finishId) {
  return once('shell:' + finishId, () => {
    const { map, normal, f } = finishTextures(finishId);
    if (f.kind === 'chrome') {
      return new THREE.MeshPhysicalMaterial({ color: 0xdfe3ee, metalness: 1, roughness: 0.14, map, normalMap: normal, normalScale: new THREE.Vector2(0.15, 0.15), clearcoat: 0.6, clearcoatRoughness: 0.05 });
    }
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map,
      normalMap: f.sp > 0 ? normal : null,
      normalScale: new THREE.Vector2(0.9, 0.9),
      // הנצנצים הם מתכת (מחזירים את צבע הפנסים); לכה = צבע אחיד ומבריק
      metalness: f.kind === 'sparkle' ? 0.55 : f.kind === 'pearl' ? 0.25 : 0.05,
      roughness: f.kind === 'sparkle' ? 0.32 : 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.045,
      envMapIntensity: 1.1,
    });
  });
}

// חישוק עץ של הבס (בצבע העטיפה, עם פס כרום באמצע – ראו kitModel)
export function kickHoopMaterial(finishId) {
  return once('kickhoop:' + finishId, () => {
    const f = FINISH_COLORS[finishId] || FINISH_COLORS.midnight;
    return new THREE.MeshPhysicalMaterial({ color: hex(f.a).multiplyScalar(f.kind === 'chrome' ? 0.5 : 1), metalness: 0.1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  });
}

// ---- עור מצופה: לבן-קרם עם גרגר עדין, מרכז שחוק מהמקלות וטבעת "צוואר" ליד השפה ----
function headTexture(worn) {
  return once('head-tex:' + worn, () => {
    const N = 512;
    const [c, x] = canvas(N, N);
    x.fillStyle = '#ece8dd';
    x.fillRect(0, 0, N, N);
    const r = rng(7 + worn);
    for (let i = 0; i < 26000; i++) {
      const v = r();
      x.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(120,110,90,0.13)';
      x.fillRect(r() * N, r() * N, 1.4, 1.4);
    }
    if (worn) {
      // אזור הנגינה: מעט אפור, עם סימני מקלות קטנים
      const g = x.createRadialGradient(N * 0.47, N * 0.55, 0, N * 0.47, N * 0.55, N * 0.3);
      g.addColorStop(0, 'rgba(110,100,85,0.28)');
      g.addColorStop(1, 'rgba(110,100,85,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, N, N);
      for (let i = 0; i < 260; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.pow(r(), 0.7) * N * 0.17;
        x.fillStyle = `rgba(70,60,45,${0.08 + r() * 0.18})`;
        x.beginPath();
        x.ellipse(N * 0.47 + Math.cos(a) * d, N * 0.55 + Math.sin(a) * d, 1.5 + r() * 2.5, 1 + r() * 1.5, r() * 3, 0, Math.PI * 2);
        x.fill();
      }
    }
    // הצוואר: טבעת כהה מעט ליד השפה
    x.strokeStyle = 'rgba(90,80,60,0.18)';
    x.lineWidth = N * 0.025;
    x.beginPath();
    x.arc(N / 2, N / 2, N * 0.475, 0, Math.PI * 2);
    x.stroke();
    return tex(c);
  });
}

// עור תוף: חומר נפרד לכל תוף (שקיעה במכה – uDip), אבל אותה תוכנית שיידר לכולם
export function headMaterial(worn = true) {
  const m = new THREE.MeshStandardMaterial({ map: headTexture(worn ? 1 : 0), roughness: 0.62, metalness: 0, envMapIntensity: 0.5, emissive: 0x000000 });
  const uDip = { value: 0 };
  m.userData.dip = uDip;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDip = uDip;
    // העור שוקע במרכז (פרבולה) – רק בציר z המקומי של העיגול
    shader.vertexShader = 'uniform float uDip;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float hr = clamp(length(position.xy) / 1.0, 0.0, 1.0);
       transformed.z -= uDip * (1.0 - hr * hr);`,
    );
  };
  m.customProgramCacheKey = () => 'drum-head-dip';
  return m;
}

// עור קדמי של הבס (פונה לקהל): שחור עם לוגו טבעות בצבע הסט וחור אוורור
export function kickFrontMaterial(finishId) {
  return once('kickfront:' + finishId, () => {
    const f = FINISH_COLORS[finishId] || FINISH_COLORS.midnight;
    const N = 512;
    const [c, x] = canvas(N, N);
    x.fillStyle = '#0d0c10';
    x.fillRect(0, 0, N, N);
    const cxp = N / 2;
    for (const [rad, w, col] of [[0.42, 10, f.b], [0.36, 3, '#e9e4d6'], [0.2, 6, f.b]]) {
      x.strokeStyle = col;
      x.lineWidth = w;
      x.beginPath();
      x.arc(cxp, cxp, N * rad, 0, Math.PI * 2);
      x.stroke();
    }
    // כוכב בסגנון לוגו להקה
    x.fillStyle = '#e9e4d6';
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? N * 0.06 : N * 0.15;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      x.lineTo(cxp + Math.cos(a) * rr, cxp + Math.sin(a) * rr);
    }
    x.fill();
    return new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.55, metalness: 0 });
  });
}

// ---- מתכות ----
export const chrome = () => once('chrome', () => new THREE.MeshStandardMaterial({ color: 0xe8ebf2, metalness: 1, roughness: 0.13, envMapIntensity: 1.25 }));
export const darkMetal = () => once('darkmetal', () => new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.75, roughness: 0.42 }));
export const rubber = () => once('rubber', () => new THREE.MeshStandardMaterial({ color: 0x0b0b0d, metalness: 0, roughness: 0.9, envMapIntensity: 0.3 }));
export const felt = () => once('felt', () => new THREE.MeshStandardMaterial({ color: 0x8c1d2a, roughness: 1, metalness: 0 }));
export const beaterFelt = () => once('beater', () => new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.95 }));
export const seatVinyl = () => once('seat', () => new THREE.MeshPhysicalMaterial({ color: 0x111014, roughness: 0.45, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3 }));

// ---- פליז מחרטה: טבעות מעגליות (במרחב ה-UV של LatheGeometry: v לאורך הפרופיל, מהפעמון לשפה) ----
// צבע: פסים בהירים/כהים ברוחב משתנה (כמו חריטה אמיתית), פעמון חלק מעט כהה יותר. חספוס: אותם פסים.
function grooveTextures() {
  return once('grooves', () => {
    const H = 512;
    const [c, x] = canvas(4, H);
    const [rc, rx] = canvas(4, H);
    const r = rng(99);
    let band = 0;
    let tone = 1;
    for (let y = 0; y < H; y++) {
      if (band-- <= 0) {
        band = 2 + Math.floor(r() * 9);
        tone = 0.78 + r() * 0.3;
      }
      const bell = y < H * 0.24;
      const fine = Math.sin(y * 2.3) * 0.05;
      const v = bell ? 0.86 + fine * 0.3 : tone + fine;
      const col = Math.min(255, v * 235);
      x.fillStyle = `rgb(${col | 0},${(col * 0.97) | 0},${(col * 0.92) | 0})`;
      x.fillRect(0, y, 4, 1);
      const rough = bell ? 150 : 90 + (1.08 - tone) * 260 + fine * 300;
      rx.fillStyle = `rgb(${rough | 0},${rough | 0},${rough | 0})`;
      rx.fillRect(0, y, 4, 1);
    }
    const map = tex(c);
    const rough = tex(rc, { srgb: false });
    for (const t of [map, rough]) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = 8;
    }
    return { map, rough };
  });
}

// סוגי פליז: רגיל (זהוב), כהה (צ'יינה), היי-האט
export function brass(kind = 'bright') {
  return once('brass:' + kind, () => {
    const g = grooveTextures();
    const color = kind === 'dark' ? 0x9a7038 : kind === 'hat' ? 0xc4a066 : 0xd6b073;
    return new THREE.MeshPhysicalMaterial({
      color,
      map: g.map,
      metalness: 1,
      roughness: 0.62,
      roughnessMap: g.rough,
      bumpMap: g.rough,
      bumpScale: 1.2,
      // ברק אניזוטרופי לאורך החריצים המעגליים – הברק נמשך לקו רדיאלי, כמו מצילה תחת זרקור
      anisotropy: 0.7,
      side: THREE.DoubleSide,
      envMapIntensity: 0.6,
    });
  });
}

// ---- רצפה, שטיח ובמה ----
export function stageFloor() {
  return once('floor', () => {
    const N = 512;
    const [c, x] = canvas(N, N);
    const r = rng(3);
    x.fillStyle = '#121114';
    x.fillRect(0, 0, N, N);
    // קרשים צבועים שחור, שחוקים מעט, עם סימני טייפ ישנים
    for (let i = 0; i < 8; i++) {
      const y = i * (N / 8);
      x.fillStyle = `rgba(${30 + r() * 12},${28 + r() * 10},${30 + r() * 12},0.6)`;
      x.fillRect(0, y + 1, N, N / 8 - 2);
      x.fillStyle = 'rgba(0,0,0,0.85)';
      x.fillRect(0, y, N, 1.5);
      for (let k = 0; k < 2; k++) x.fillRect(r() * N, y, 1.5, N / 8);
    }
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.18)';
      x.fillRect(r() * N, r() * N, 2 + r() * 6, 1);
    }
    const map = tex(c, { repeat: [10, 10] });
    return new THREE.MeshStandardMaterial({ map, roughness: 0.32, metalness: 0.0, color: 0x9a9a9a });
  });
}

// שטיח תופים: בורדו עם עיטור – מתחת לסט
export function rugMaterial() {
  return once('rug', () => {
    const N = 512;
    const [c, x] = canvas(N, N);
    const r = rng(11);
    x.fillStyle = '#4a0f17';
    x.fillRect(0, 0, N, N);
    const band = (inset, w, col) => {
      x.strokeStyle = col;
      x.lineWidth = w;
      x.strokeRect(inset, inset, N - inset * 2, N - inset * 2);
    };
    band(14, 16, '#1d0a10');
    band(34, 6, '#b8873a');
    band(48, 10, '#20304a');
    band(64, 3, '#b8873a');
    // מדליון מרכזי
    x.save();
    x.translate(N / 2, N / 2);
    for (let i = 0; i < 16; i++) {
      x.rotate(Math.PI / 8);
      x.fillStyle = i % 2 ? '#7a1b26' : '#2a3a5a';
      x.beginPath();
      x.ellipse(0, -60, 18, 64, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = '#b8873a';
    x.beginPath();
    x.arc(0, 0, 26, 0, Math.PI * 2);
    x.fill();
    x.restore();
    for (let i = 0; i < 30000; i++) {
      x.fillStyle = r() > 0.5 ? 'rgba(255,220,200,0.05)' : 'rgba(0,0,0,0.12)';
      x.fillRect(r() * N, r() * N, 1.5, 1.5);
    }
    return new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.97, metalness: 0 });
  });
}

// גריל רמקול (מוניטורים ומגברים)
export function grilleMaterial() {
  return once('grille', () => {
    const N = 128;
    const [c, x] = canvas(N, N);
    x.fillStyle = '#121214';
    x.fillRect(0, 0, N, N);
    x.fillStyle = '#26262b';
    for (let i = 0; i < N; i += 4) for (let j = 0; j < N; j += 4) x.fillRect(i + ((j / 4) % 2) * 2, j, 2, 2);
    return new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [6, 6] }), roughness: 0.85, metalness: 0.2 });
  });
}

export const blackBox = () => once('blackbox', () => new THREE.MeshStandardMaterial({ color: 0x0e0e11, roughness: 0.7, metalness: 0.1 }));

// טקסטורת זוהר עגולה רכה (הילות, ערפל, נורות)
export function glowTexture() {
  return once('glow', () => {
    const N = 128;
    const [c, x] = canvas(N, N);
    const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, N, N);
    return tex(c);
  });
}

// צל מגע מתחת לחלק (במקום מפת צללים)
export function contactShadowMaterial() {
  return once('contact', () => {
    const N = 128;
    const [c, x] = canvas(N, N);
    const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, N, N);
    return new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  });
}

// ---- סביבת השתקפות: "אולם" חשוך עם פסי אור צבעוניים, כדי שהכרום והמצילות יחזירו אורות במה ----
export function buildEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030206);
  const panel = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    scene.add(m);
  };
  panel(14, 0.5, 0xfff0d8, 4, [0, 6, -3], [0, 0, 0]); // פס פנסים לבנים מעל
  panel(3, 3, 0xff2a8a, 5, [-6, 4, -5], [0, 0, 0]); // ג'ל מגנטה
  panel(3, 3, 0x2a6bff, 5, [6, 4, -5], [0, 0, 0]); // ג'ל כחול
  panel(4, 1.2, 0xffa630, 4, [0, 3, 7], [0, 0, 0]); // אור אחורי ענברי
  panel(10, 3, 0x6a5cff, 0.6, [0, -1, -12], [0, 0, 0]); // הקהל המואר מעט
  panel(2, 2, 0xffffff, 3.5, [-2, 7, 4], [0, 0, 0]); // ספוט חם
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return rt;
}

export function disposeMaterials() {
  for (const v of cache.values()) {
    if (v?.dispose) v.dispose();
    if (v?.map) v.map.dispose?.();
    if (v?.normal) v.normal.dispose?.();
  }
  cache.clear();
}

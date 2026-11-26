// המשרד התלת־ממדי: קומה במגדל בלילה, משרד זכוכית לכל בוט ומשרד גדול למנהל בסוף המסדרון.
// כל בוט הוא דמות (person.js) שיושבת ליד השולחן. בוט שעובד מקליד והמסך שלו זז; בוט שהעביר לו עבודה (from)
// קם, הולך במסדרון למשרד שלו ומדבר איתו, וכשהעבודה נגמרת חוזר. בוט פנוי קם מדי פעם להסתכל מהחלון.
// createOffice(canvas, { onFrame }) -> { setAgents, dispose, project } ; הסצנה נבנית פעם אחת, והסטטוס נדחף אליה.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPerson, posePerson } from './person.js';
import { lookOf } from './looks.js';
import { desk, floorPlan, HALL, pathBetween, pathLength, pointAt, seat, visitorSpot, windowSpot } from './layout.js';

const H = 2.6; // גובה התקרה (אין תקרה – רואים מלמעלה)
const WALK = 1.35; // מטר לשנייה

const box = (w, h, d, m, x = 0, y = 0, z = 0, shadow = true) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
};

// טקסטורה של חלונות דולקים לבניינים בחוץ
function windowsTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0a1024';
  g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) {
    for (let x = 4; x < 64; x += 8) {
      const r = Math.random();
      g.fillStyle = r > 0.62 ? (r > 0.9 ? '#9fd0ff' : '#ffcf7a') : '#111a33';
      g.fillRect(x, y, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// העיר מסביב: בניינים למטה (אנחנו בקומה גבוהה), כמה מגדלים גבוהים, ונהר
function buildCity(scene, plan) {
  const tex = windowsTexture();
  const bm = new THREE.MeshStandardMaterial({ color: '#0d1430', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.6 });
  const n = 160;
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bm, n);
  const m4 = new THREE.Matrix4();
  const cx = 0;
  const cz = -plan.depth / 2;
  let i = 0;
  while (i < n) {
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 80;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (z > 10 && Math.abs(x) < 25) continue; // לא מול המצלמה
    const w = 4 + Math.random() * 7;
    const tall = Math.random() < 0.12;
    const h = tall ? 55 + Math.random() * 25 : 15 + Math.random() * 35;
    m4.compose(new THREE.Vector3(x, -60 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w));
    inst.setMatrixAt(i++, m4);
  }
  scene.add(inst);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: '#04060f' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -60;
  scene.add(ground);
}

// מסך של מחשב: קנבס שמצויר מחדש כשהבוט עובד (שורות קוד / גרף זזים)
function screenTexture(hue) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const draw = (busy, time) => {
    const g = c.getContext('2d');
    g.fillStyle = busy ? '#0d1530' : '#090d1c';
    g.fillRect(0, 0, 128, 80);
    if (!busy) {
      g.fillStyle = `hsl(${hue} 70% 55% / 0.5)`;
      g.beginPath();
      g.arc(64 + Math.sin(time * 0.5) * 30, 40 + Math.cos(time * 0.4) * 15, 6, 0, Math.PI * 2);
      g.fill();
    } else {
      const off = Math.floor(time * 6);
      for (let i = 0; i < 8; i++) {
        const w = 20 + ((i * 37 + off * 13) % 70);
        g.fillStyle = i % 3 ? `hsl(${hue} 80% 70%)` : '#e8ecff';
        g.fillRect(8 + (i % 2) * 8, 6 + i * 8, w, 3);
      }
      g.strokeStyle = `hsl(${(hue + 40) % 360} 90% 65%)`;
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= 40; x++) g.lineTo(84 + x, 60 - Math.abs(Math.sin(x * 0.3 + time * 3)) * 18);
      g.stroke();
    }
    t.needsUpdate = true;
  };
  draw(false, 0);
  return { t, draw };
}

function plant(m1, m2) {
  const g = new THREE.Group();
  g.add(box(0.32, 0.36, 0.32, m1, 0, 0.18, 0));
  const leaves = new THREE.Group();
  leaves.position.y = 0.36;
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m2);
    const a = (i / 7) * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.12, 0.25 + (i % 3) * 0.12, Math.sin(a) * 0.12);
    l.scale.set(0.8, 1.4, 0.8);
    l.castShadow = true;
    leaves.add(l);
  }
  g.add(leaves);
  g.userData.leaves = leaves;
  return g;
}

// משרד אחד: רצפה, קירות זכוכית, שולחן, כיסא, מחשב, מנורה, עציץ, מדף
function buildRoom(scene, room, hue, M) {
  const g = new THREE.Group();
  scene.add(g);
  const neon = new THREE.Color().setHSL(hue / 360, 0.85, 0.6);
  const { x, z, w, d } = room;
  // רצפת עץ
  g.add(box(w, 0.04, d, M.wood, x, 0.02, z, false));
  // שטיח בצבע הבוט
  const rug = box(w * 0.55, 0.012, d * 0.45, new THREE.MeshStandardMaterial({ color: neon.clone().multiplyScalar(0.35), roughness: 1 }), x, 0.045, z + (room.side === 0 ? 0.4 : 0.6), false);
  g.add(rug);

  // קירות: הקיר החיצוני – חלון גבוה; בין משרדים – קיר נמוך + זכוכית; לכיוון המסדרון – זכוכית עם דלת
  const glass = M.glass;
  const frame = M.frame;
  const wall = (wx, wz, len, alongX, door = false) => {
    const half = len / 2;
    const segs = door ? [[-half, -0.55], [0.55, half]] : [[-half, half]];
    for (const [a, b] of segs) {
      const L = b - a;
      const mid = (a + b) / 2;
      const px = alongX ? wx + mid : wx;
      const pz = alongX ? wz : wz + mid;
      const [bw, bd] = alongX ? [L, 0.06] : [0.06, L];
      g.add(box(bw, 0.5, bd, M.wall, px, 0.25, pz));
      const gl = new THREE.Mesh(new THREE.BoxGeometry(bw, H - 0.5, bd), glass);
      gl.position.set(px, 0.5 + (H - 0.5) / 2, pz);
      g.add(gl);
      g.add(box(alongX ? L : 0.07, 0.05, alongX ? 0.07 : L, frame, px, H, pz, false));
    }
  };
  const left = x - w / 2;
  const right = x + w / 2;
  const back = z - d / 2;
  const front = z + d / 2;
  if (room.side === 0) {
    wall(x, back, w, true);
    wall(left, z, d, false);
    wall(right, z, d, false);
    wall(x, front, w, true, true);
  } else {
    const inner = room.side < 0 ? right : left;
    const outer = room.side < 0 ? left : right;
    wall(inner, z, d, false, true);
    wall(outer, z, d, false);
    wall(x, back, w, true);
    wall(x, front, w, true);
  }
  // פס ניאון בצבע הבוט לאורך הקיר שפונה למסדרון
  const stripM = new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 0.6 });
  const strip = room.side === 0 ? box(w, 0.04, 0.04, stripM, x, H + 0.03, front, false) : box(0.04, 0.04, d, stripM, room.side < 0 ? right : left, H + 0.03, z, false);
  g.add(strip);

  // שולחן
  const dk = desk(room);
  const deskG = new THREE.Group();
  deskG.position.set(dk.x, 0, dk.z);
  deskG.rotation.y = dk.rot;
  g.add(deskG);
  deskG.add(box(dk.w, 0.05, dk.d, M.deskTop, 0, 0.74, 0));
  for (const sx of [-1, 1]) deskG.add(box(0.05, 0.72, dk.d * 0.9, M.metal, sx * (dk.w / 2 - 0.06), 0.36, 0));
  // מחשב נייד מול הבוט (נמוך – לא מסתיר את הפנים), ומסך גדול על הקיר מאחוריו
  const scr = screenTexture(hue);
  const laptop = new THREE.Group();
  laptop.position.set(0, 0.765, -0.12);
  deskG.add(laptop);
  laptop.add(box(0.4, 0.02, 0.27, M.dark, 0, 0, 0));
  const lid = new THREE.Group();
  lid.position.set(0, 0.01, 0.13);
  lid.rotation.x = 0.35;
  laptop.add(lid);
  lid.add(box(0.4, 0.26, 0.015, M.metal, 0, 0.13, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), new THREE.MeshBasicMaterial({ map: scr.t, toneMapped: false }));
  screen.position.set(0, 0.13, -0.009);
  screen.rotation.y = Math.PI;
  lid.add(screen);
  // מסך על הקיר האחורי, מעל הבוט
  const wallTv = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.75), new THREE.MeshBasicMaterial({ map: scr.t, toneMapped: false }));
  wallTv.position.set(room.side === 0 ? x - 1.0 : x + room.side * 0.35, 1.75, z - d / 2 + 0.07);
  g.add(wallTv);
  g.add(box(1.38, 0.83, 0.04, M.dark, wallTv.position.x, 1.75, z - d / 2 + 0.04));
  deskG.add(box(0.07, 0.09, 0.07, M.mug, 0.45, 0.81, -0.1));
  // מנורת שולחן
  const lampM = new THREE.MeshStandardMaterial({ color: '#ffd59a', emissive: '#ffcf80', emissiveIntensity: 0.3 });
  deskG.add(box(0.03, 0.35, 0.03, M.metal, -dk.w / 2 + 0.15, 0.93, 0.15));
  const shade = box(0.16, 0.08, 0.16, lampM, -dk.w / 2 + 0.15, 1.12, 0.15);
  deskG.add(shade);
  // אור חם מהמנורה (בטלפון בלי – חוסך עבודה למעבד הגרפי)
  const lamp = M.lights ? new THREE.PointLight('#ffc98a', 1.2, 4.5, 1.6) : { intensity: 0 };
  if (M.lights) {
    lamp.position.set(dk.x, 1.6, dk.z);
    g.add(lamp);
  }

  // כיסא
  const st = seat(room);
  const chair = new THREE.Group();
  chair.position.set(st.x, 0, st.z);
  chair.rotation.y = st.face;
  g.add(chair);
  chair.add(box(0.5, 0.08, 0.48, M.chair, 0, 0.47, -0.02));
  chair.add(box(0.5, 0.62, 0.07, M.chair, 0, 0.85, -0.27));
  chair.add(box(0.06, 0.42, 0.06, M.metal, 0, 0.22, 0));
  chair.add(box(0.5, 0.03, 0.06, M.metal, 0, 0.03, 0));
  chair.add(box(0.06, 0.03, 0.5, M.metal, 0, 0.03, 0));

  // עציץ, מדף ספרים
  const pl = plant(M.pot, M.leaf);
  const wsp = windowSpot(room);
  pl.position.set(room.side === 0 ? x + w / 2 - 0.5 : x + room.side * (w / 2 - 0.4), 0, room.side === 0 ? back + 0.5 : back + 0.45);
  g.add(pl);
  const shelf = new THREE.Group();
  // מדף נמוך לאורך הקיר החיצוני (לא מסתיר את הדמות)
  shelf.position.set(room.side === 0 ? x - w / 2 + 0.35 : x + room.side * (w / 2 - 0.2), 0, room.side === 0 ? z + 0.2 : z + 0.1);
  shelf.rotation.y = room.side === 0 ? Math.PI / 2 : -room.side * Math.PI / 2;
  g.add(shelf);
  shelf.add(box(1.0, 0.8, 0.3, M.deskTop, 0, 0.4, 0));
  const bookColors = ['#c0504d', '#4f81bd', '#9bbb59', '#f2c14e', '#8064a2'];
  for (let r = 0; r < 2; r++) for (let b = 0; b < 6; b++) shelf.add(box(0.1, 0.24, 0.2, new THREE.MeshStandardMaterial({ color: bookColors[(b + r) % 5], roughness: 0.8 }), -0.38 + b * 0.15, 0.22 + r * 0.38, 0.06, false));

  if (room.big) {
    // פינת ישיבות ומסך גדול במשרד המנהל
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 28), M.deskTop);
    table.position.set(x - 1.7, 0.74, z + 0.6);
    table.castShadow = true;
    g.add(table);
    g.add(box(0.08, 0.72, 0.08, M.metal, x - 1.7, 0.36, z + 0.6));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.add(box(0.4, 0.45, 0.4, M.chair, x - 1.7 + Math.cos(a) * 0.95, 0.23, z + 0.6 + Math.sin(a) * 0.95));
    }
  }
  void wsp;
  return { group: g, screen: scr, strip: stripM, lamp, lampM, leaves: pl.userData.leaves, neon };
}

export function createOffice(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050916');
  scene.fog = new THREE.Fog('#070c1f', 40, 120);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.25;

  const keys = opts.keys || [];
  const plan = floorPlan(keys);
  const M = {
    wood: new THREE.MeshStandardMaterial({ color: '#5b3d2b', roughness: 0.55 }),
    hall: new THREE.MeshStandardMaterial({ color: '#1c2033', roughness: 0.25, metalness: 0.3 }),
    wall: new THREE.MeshStandardMaterial({ color: '#2a2f45', roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#9fc4ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: '#8a93a8', roughness: 0.3, metalness: 0.8 }),
    deskTop: new THREE.MeshStandardMaterial({ color: '#7a5038', roughness: 0.45 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa1b1', roughness: 0.3, metalness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: '#111522', roughness: 0.4, metalness: 0.4 }),
    chair: new THREE.MeshStandardMaterial({ color: '#232838', roughness: 0.6 }),
    mug: new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.4 }),
    pot: new THREE.MeshStandardMaterial({ color: '#3a3f55', roughness: 0.7 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#2f7a4f', roughness: 0.8 }),
    lights: !coarse,
  };

  // מסדרון + רצפת הקומה
  const floor = box(plan.width + 1, 0.3, plan.depth + 2, M.hall, 0, -0.15, -plan.depth / 2 + 0.6, false);
  scene.add(floor);
  // פסי אור ברצפת המסדרון
  for (let zz = -1; zz > plan.hallEnd; zz -= 2.2) {
    scene.add(box(0.06, 0.01, 1.2, new THREE.MeshBasicMaterial({ color: '#6f86d6' }), -HALL / 2 + 0.15, 0.005, zz, false));
    scene.add(box(0.06, 0.01, 1.2, new THREE.MeshBasicMaterial({ color: '#6f86d6' }), HALL / 2 - 0.15, 0.005, zz, false));
  }
  buildCity(scene, plan);

  // תאורה: ירח (עם צללים), שמיים, אור חם מהמנורות
  scene.add(new THREE.HemisphereLight('#7f9cff', '#2a1d18', coarse ? 0.9 : 0.55));
  const moon = new THREE.DirectionalLight('#cfe0ff', 1.3);
  moon.position.set(-8, 18, 6);
  moon.target.position.set(0, 0, -plan.depth / 2);
  moon.castShadow = true;
  moon.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  const span = Math.max(plan.width, plan.depth) / 2 + 2;
  Object.assign(moon.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 60 });
  moon.shadow.bias = -0.0005;
  scene.add(moon, moon.target);
  const hallLight = new THREE.PointLight('#bcd0ff', 2, 30, 1.2);
  hallLight.position.set(0, 3, -plan.depth / 2);
  scene.add(hallLight);

  // משרדים ודמויות
  const rooms = {};
  const people = {};
  plan.rooms.forEach((room, i) => {
    const hue = opts.hues?.[room.key] ?? (i * 47) % 360;
    rooms[room.key] = { room, ...buildRoom(scene, room, hue, M) };
    const p = buildPerson(lookOf(room.key));
    const st = seat(room);
    p.root.position.set(st.x, 0, st.z);
    p.root.rotation.y = st.face;
    p.sit = 1;
    scene.add(p.root);
    people[room.key] = {
      p,
      key: room.key,
      at: { kind: 'desk', room: room.key },
      walk: null,
      wanderAt: 8 + Math.random() * 20,
      hold: 0,
    };
  });

  // מצלמה: מבט מלמעלה באלכסון; כיוון לפי צורת המסך (בטלפון המסדרון לאורך, במחשב לרוחב)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
  const target = new THREE.Vector3(0, 0.8, -plan.depth / 2);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minZoom = 0.8;
  controls.maxZoom = 4;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.2;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  // אצבע אחת למעלה-למטה גוללת את הדף; לרוחב מסובבת את המשרד; שתי אצבעות – זום והזזה
  canvas.style.touchAction = 'pan-y';

  let W = 1;
  let Hh = 1;
  let az = null;
  function fit() {
    const aspect = W / Hh;
    const a = aspect < 0.8 ? 0.18 : aspect < 1.2 ? 0.4 : 0.6;
    const el = aspect < 1 ? 0.66 : 0.7;
    const R = 40;
    if (az !== a) {
      az = a;
      camera.position.set(target.x + Math.sin(a) * Math.cos(el) * R, target.y + Math.sin(el) * R, target.z + Math.cos(a) * Math.cos(el) * R);
      camera.lookAt(target);
      controls.target.copy(target);
      controls.minAzimuthAngle = a - 0.9;
      controls.maxAzimuthAngle = a + 0.9;
    }
    camera.updateMatrixWorld();
    // מתאימים את המסגרת כך שכל הקומה בפנים
    const inv = camera.matrixWorldInverse;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const x of [-plan.width / 2 - 0.3, plan.width / 2 + 0.3]) {
      for (const z of [0.6, -plan.depth - 0.3]) {
        for (const y of [0, H + 0.4]) {
          const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
        }
      }
    }
    let w = maxX - minX;
    let h = maxY - minY;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    Object.assign(camera, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 });
    camera.updateProjectionMatrix();
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    Hh = Math.max(1, r.height);
    renderer.setSize(W, Hh, false);
    fit();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // סטטוס מהשרת
  let agents = [];
  const motion = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function setAgents(list) {
    agents = list || [];
  }

  // לאן כל דמות צריכה להיות עכשיו
  function wanted(key, t) {
    const me = agents.find((a) => a.key === key);
    if (!me?.busy) {
      const host = agents.find((a) => a.busy && a.from === key && rooms[a.key]);
      if (host) return { kind: 'visit', room: host.key };
    }
    const c = people[key];
    if (!me?.busy && motion && t > c.wanderAt) return { kind: 'window', room: key };
    return { kind: 'desk', room: key };
  }

  function spotOf(dest) {
    const room = rooms[dest.room].room;
    if (dest.kind === 'desk') return seat(room);
    if (dest.kind === 'window') return windowSpot(room);
    return visitorSpot(room);
  }

  const same = (a, b) => a.kind === b.kind && a.room === b.room;

  function stepPerson(c, t, dt) {
    const p = c.p;
    const want = wanted(c.key, t);
    const me = agents.find((a) => a.key === c.key);
    let st = { sitTarget: false, walking: false, typing: false, talking: false, looking: false };
    if (c.walk) {
      // הולך: מחכים שיקום מהכיסא, ואז מתקדמים במסלול
      if (p.sit > 0.02) {
        st.sitTarget = false;
      } else {
        c.walk.dist += dt * WALK;
        const pt = pointAt(c.walk.pts, c.walk.dist);
        p.root.position.x = pt.x;
        p.root.position.z = pt.z;
        let dy = pt.face - p.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        p.root.rotation.y += dy * Math.min(1, dt * 8);
        st.walking = !pt.done;
        if (pt.done || c.walk.dist >= c.walk.len) {
          c.at = c.walk.dest;
          c.walk = null;
          c.hold = t;
        }
      }
    } else if (!same(c.at, want)) {
      // יוצאים לדרך (מהחלון חוזרים רק אחרי שהסתכלו קצת)
      if (c.at.kind === 'window' && want.kind === 'desk' && t - c.hold < 5) {
        st.looking = true;
      } else {
        const from = spotOf(c.at);
        const to = spotOf(want);
        const pts = pathBetween(rooms[c.at.room].room, rooms[want.room].room, { x: p.root.position.x, z: p.root.position.z }, to);
        void from;
        c.walk = { pts, dist: 0, len: pathLength(pts), dest: want };
        if (want.kind === 'window') c.wanderAt = t + 25 + Math.random() * 35;
      }
    }
    if (!c.walk) {
      if (c.at.kind === 'desk') {
        const s = seat(rooms[c.at.room].room);
        st.sitTarget = true;
        st.typing = Boolean(me?.busy);
        // מתיישבים בדיוק על הכיסא
        p.root.position.x += (s.x - p.root.position.x) * Math.min(1, dt * 6);
        p.root.position.z += (s.z - p.root.position.z) * Math.min(1, dt * 6);
        let dy = s.face - p.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        p.root.rotation.y += dy * Math.min(1, dt * 6);
      } else if (c.at.kind === 'visit') {
        // עומד ליד השולחן של המארח ומדבר איתו
        const host = rooms[c.at.room].room;
        const s = seat(host);
        const face = Math.atan2(s.x - p.root.position.x, s.z - p.root.position.z);
        let dy = face - p.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        p.root.rotation.y += dy * Math.min(1, dt * 5);
        st.talking = true;
      } else {
        // ליד החלון: מסתכל החוצה
        const room = rooms[c.at.room].room;
        const face = room.side === 0 ? Math.PI : room.side > 0 ? Math.PI / 2 : -Math.PI / 2;
        let dy = face - p.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        p.root.rotation.y += dy * Math.min(1, dt * 4);
        st.looking = true;
      }
    }
    if (!motion) {
      st.walking = false;
    }
    posePerson(p, st, t, dt);
  }

  // לולאה (נעצרת כשהדף מוסתר או כשהמשרד לא על המסך)
  let lineup = false;
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let visible = true;
  let screenAt = 0;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  });
  io.observe(canvas);
  const onVis = () => {
    if (!document.hidden) loop();
  };
  document.addEventListener('visibilitychange', onVis);

  function frame() {
    const now = performance.now();
    // בבדיקות (window.__officeFast) הזמן רץ מהר יותר – הדפדפן שם איטי
    const dt = Math.min(window.__officeFast ? 0.6 : 0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    controls.update();
    const busySet = new Set(agents.filter((a) => a.busy).map((a) => a.key));
    const drawScreens = clock - screenAt > 0.2;
    if (drawScreens) screenAt = clock;
    for (const [key, r] of Object.entries(rooms)) {
      const busy = busySet.has(key);
      r.strip.emissiveIntensity = busy ? 1.6 + Math.sin(clock * 3) * 0.4 : 0.35;
      r.lampM.emissiveIntensity = busy ? 1.2 : 0.35;
      r.lamp.intensity = busy ? 2.6 : 1.0;
      if (motion) r.leaves.rotation.z = Math.sin(clock * 0.8 + r.room.z) * 0.05;
      if (drawScreens && (busy || Math.floor(clock * 5) % 10 === 0)) r.screen.draw(busy, clock);
    }
    if (lineup) {
      // לבדיקות: כל הדמויות בשורה במסדרון, מול המצלמה
      Object.values(people).forEach((c, i) => {
        c.p.root.position.set((i % 2 ? 0.45 : -0.45), 0, -0.6 - i * 0.9);
        c.p.root.rotation.y = az;
        posePerson(c.p, { sitTarget: false, talking: i % 3 === 0 }, clock, dt);
      });
    } else for (const c of Object.values(people)) stepPerson(c, clock, dt);
    renderer.render(scene, camera);
    opts.onFrame?.();
  }
  function loop() {
    cancelAnimationFrame(raf);
    const tick = () => {
      if (!visible || document.hidden) return;
      frame();
      raf = requestAnimationFrame(tick);
    };
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  loop();

  // מיקום על המסך של ראש הדמות (לתוויות HTML)
  const v = new THREE.Vector3();
  function project(key) {
    const c = people[key];
    if (!c) return null;
    c.p.head.getWorldPosition(v);
    v.y += 0.42;
    v.project(camera);
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * Hh };
  }

  // לחיצה על דמות או על משרד
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const onDown = (e) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(floor, false)[0] || null;
    const pt = hit?.point || ray.intersectObjects(Object.values(rooms).map((x) => x.group), true)[0]?.point;
    if (!pt) return;
    const room = plan.rooms.find((rm) => Math.abs(pt.x - rm.x) < rm.w / 2 && Math.abs(pt.z - rm.z) < rm.d / 2);
    if (room) opts.onPick?.(room.key);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  function dispose() {
    cancelAnimationFrame(raf);
    visible = false;
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    controls.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        m.map?.dispose?.();
        m.emissiveMap?.dispose?.();
        m.dispose?.();
      }
    });
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  return { setAgents, dispose, project, lineup: (zoom = 3.2) => {
      lineup = true;
      // מתקרבים לשורה
      const d = new THREE.Vector3(0, 0.9, -5).sub(controls.target);
      controls.target.add(d);
      camera.position.add(d);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }, keys: plan.rooms.map((r) => r.key), people, agents: () => agents };
}

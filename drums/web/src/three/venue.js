// האולם: במה ובמת תופים (רייזר) עם פס לדים, מוניטורים, סטנד מיקרופון, גדר, קיר אחורי והקהל.
// הקהל = צלליות על כרטיסים (InstancedBufferGeometry אחת) עם ידיים מורמות, טלפונים דולקים ונדנוד איטי.
import * as THREE from 'three';
import { blackBox, chrome, darkMetal, glowTexture, grilleMaterial, rng, stageFloor } from './materials';

export const RISER_H = 0.45;
export const STAGE_FRONT = -5.0;
export const PIT_Y = -2.0;

// ---- צלליות הקהל: אטלס של 8 דמויות (אדום = גוף, ירוק = מסך טלפון) ----
function crowdAtlas() {
  const CW = 128;
  const CH = 256;
  const c = document.createElement('canvas');
  c.width = CW * 8;
  c.height = CH;
  const x = c.getContext('2d');
  const body = 'rgb(255,0,0)';
  const arm = (cx, sx, sy, ex, ey, hx, hy) => {
    x.strokeStyle = body;
    x.lineCap = 'round';
    x.lineWidth = 15;
    x.beginPath();
    x.moveTo(cx + sx, sy);
    x.quadraticCurveTo(cx + ex, ey, cx + hx, hy);
    x.stroke();
    x.fillStyle = body;
    x.beginPath();
    x.arc(cx + hx, hy, 10, 0, Math.PI * 2);
    x.fill();
  };
  for (let i = 0; i < 8; i++) {
    const cx = i * CW + CW / 2;
    x.fillStyle = body;
    // כתפיים וגוף
    x.beginPath();
    x.moveTo(cx - 46, CH);
    x.quadraticCurveTo(cx - 50, 150, cx - 26, 140);
    x.lineTo(cx + 26, 140);
    x.quadraticCurveTo(cx + 50, 150, cx + 46, CH);
    x.fill();
    // ראש (חלק עם שיער ארוך / כובע)
    x.beginPath();
    x.ellipse(cx, 116, 20, 25, 0, 0, Math.PI * 2);
    x.fill();
    if (i === 5) {
      x.beginPath();
      x.ellipse(cx, 132, 26, 30, 0, 0, Math.PI * 2);
      x.fill();
    }
    if (i === 3) x.fillRect(cx - 28, 92, 56, 8);
    // ידיים
    if (i === 1) arm(cx, 26, 150, 52, 90, 40, 26);
    if (i === 2) {
      arm(cx, 26, 150, 50, 92, 34, 24);
      arm(cx, -26, 150, -50, 92, -34, 24);
    }
    if (i === 3) {
      arm(cx, 26, 150, 54, 96, 44, 34);
      // "קרניים" של רוק
      x.lineWidth = 6;
      x.strokeStyle = body;
      x.beginPath();
      x.moveTo(cx + 40, 30);
      x.lineTo(cx + 34, 10);
      x.moveTo(cx + 50, 30);
      x.lineTo(cx + 56, 10);
      x.stroke();
    }
    if (i === 4 || i === 7) {
      arm(cx, -26, 150, -44, 100, -24, 58);
      // טלפון מורם: מסך מואר
      x.fillStyle = 'rgb(0,255,0)';
      x.fillRect(cx - 31, 36, 13, 20);
    }
    if (i === 6) arm(cx, -26, 150, -52, 92, -38, 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function crowdMaterial(atlas) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas },
      uTime: { value: 0 },
      uWash: { value: new THREE.Color(0.5, 0.2, 0.8) },
      uFog: { value: new THREE.Color(0x0a0612) },
      uFogDensity: { value: 0.035 },
      uPulse: { value: 0 },
      uMotion: { value: 1 },
      uHouse: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aOffset; attribute float aScale; attribute float aCell; attribute float aPhase; attribute float aShade;
      uniform float uTime; uniform float uPulse; uniform float uMotion;
      varying vec2 vUv; varying float vDepth; varying float vShade; varying float vFront; varying float vPhase;
      void main(){
        vec3 p = position * aScale;
        float h = position.y / 1.45;
        p.x += sin(uTime * 1.6 + aPhase * 6.28) * 0.05 * h * uMotion;
        p.y += max(0.0, sin(uTime * 2.4 + aPhase * 9.0)) * 0.035 * uMotion + uPulse * 0.07 * step(0.5, fract(aPhase * 3.7));
        vec4 mv = modelViewMatrix * vec4(aOffset + p, 1.0);
        vUv = vec2((aCell + uv.x) / 8.0, uv.y);
        vDepth = -mv.z; vShade = aShade; vPhase = aPhase;
        vFront = exp((aOffset.z + 6.5) * 0.09);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uAtlas; uniform vec3 uWash; uniform vec3 uFog; uniform float uFogDensity; uniform float uTime; uniform float uHouse;
      varying vec2 vUv; varying float vDepth; varying float vShade; varying float vFront; varying float vPhase;
      void main(){
        vec4 t = texture2D(uAtlas, vUv);
        if (t.a < 0.45) discard;
        float body = t.r; float screen = t.g;
        // בגדים בגוונים שונים (כהים) – כדי שהקהל לא ייראה כמו גוש אחד
        float k = fract(vPhase * 7.13);
        vec3 cloth = k < 0.25 ? vec3(0.55, 0.16, 0.16) : k < 0.5 ? vec3(0.16, 0.24, 0.55) : k < 0.75 ? vec3(0.4, 0.4, 0.42) : vec3(0.18, 0.4, 0.26);
        vec3 col = vec3(0.010, 0.008, 0.016) * (0.6 + vShade) + cloth * 0.006 * body;
        // אור הבמה נופל על השורות הקדמיות ועל הראשים
        float top = smoothstep(0.35, 0.9, vUv.y);
        col += uWash * vFront * (0.006 + 0.05 * top) * body;
        col += (cloth * 0.09 + 0.02) * uHouse * (0.5 + 0.5 * vShade) * body;
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        col = mix(col, uFog, f * 0.92);
        float flick = 0.75 + 0.25 * sin(uTime * 3.0 + vPhase * 40.0);
        col += vec3(0.65, 0.8, 1.0) * screen * 1.6 * flick * (1.0 - f * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function buildCrowd() {
  const r = rng(42);
  const base = new THREE.PlaneGeometry(0.78, 1.45);
  base.translate(0, 0.725, 0);
  const offsets = [];
  const scales = [];
  const cells = [];
  const phases = [];
  const shades = [];
  const phones = [];
  for (let z = -6.9; z > -32; z -= 0.52 + (-z - 6) * 0.012) {
    const half = 6 + (-z - 6) * 0.55;
    const step = 0.5 + (-z - 6) * 0.01;
    for (let x = -half; x < half; x += step) {
      if (r() < 0.06) continue;
      const jx = x + (r() - 0.5) * step * 0.8;
      const jz = z + (r() - 0.5) * 0.3;
      const s = 0.92 + r() * 0.2;
      // במרכז ובקדימה יותר ידיים מורמות
      const hype = 0.42 - (-z - 7) * 0.012 - Math.abs(jx) * 0.02;
      const roll = r();
      let cell = roll < hype * 0.35 ? 2 : roll < hype * 0.6 ? 1 : roll < hype * 0.75 ? 3 : roll < hype * 0.9 ? 6 : 0;
      if (r() < 0.07) cell = r() < 0.5 ? 4 : 7;
      if (cell === 0 && r() < 0.3) cell = 5;
      offsets.push(jx, PIT_Y + (r() - 0.5) * 0.12 - 0.25, jz);
      scales.push(s);
      cells.push(cell);
      phases.push(r());
      shades.push(r());
      if (r() < 0.035) phones.push(jx + (r() - 0.5) * 0.3, PIT_Y + 1.6 * s + r() * 0.3, jz);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.attributes.position = base.attributes.position;
  g.attributes.uv = base.attributes.uv;
  g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3));
  g.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array(scales), 1));
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(cells), 1));
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
  g.setAttribute('aShade', new THREE.InstancedBufferAttribute(new Float32Array(shades), 1));
  g.instanceCount = scales.length;
  const mat = crowdMaterial(crowdAtlas());
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;

  // ים של אורות טלפון: נקודות זוהרות קטנות
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(phones, 3));
  const ph = new Float32Array(phones.length / 3).map(() => r());
  pg.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMap: { value: glowTexture() }, uScale: { value: 300 } },
    vertexShader: `attribute float aPhase; uniform float uTime; uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * 0.09 / -mv.z; vA = 0.55 + 0.45 * sin(uTime * (1.5 + aPhase * 2.0) + aPhase * 30.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying float vA;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a * vA * 2.2, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(pg, pm);
  points.frustumCulled = false;
  return { mesh, points, count: scales.length };
}

function wedge(group, x, z, rotY) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.62, 0);
  s.lineTo(0.62, 0.16);
  s.lineTo(0.18, 0.4);
  s.lineTo(0, 0.4);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  g.translate(-0.31, 0, -0.275);
  const m = new THREE.Mesh(g, blackBox());
  m.rotation.y = rotY;
  m.position.set(x, -RISER_H, z);
  group.add(m);
  // גריל על הפאה המשופעת (פונה לבמה)
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.48), grilleMaterial());
  gr.position.set(0.4, 0.29, 0);
  gr.rotation.set(0, Math.PI / 2, 0);
  gr.rotateX(-0.5);
  m.add(gr);
}

function sprite(color, opacity, scale, pos, group) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  s.scale.set(scale[0], scale[1], 1);
  s.position.set(...pos);
  group.add(s);
  return s;
}

export function buildVenue() {
  const group = new THREE.Group();
  // רייזר התופים: משטח הסט (y=0) מעל רצפת הבמה
  const riser = new THREE.Mesh(new THREE.BoxGeometry(4.4, RISER_H, 3.6), stageFloor());
  riser.position.set(0, -RISER_H / 2, 0.1);
  group.add(riser);
  // פס לדים בחזית הרייזר
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.45, 0.08).multiplyScalar(1.6), toneMapped: false });
  const led = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.012, 0.03), ledMat);
  led.position.set(0, 0.004, 0.1 - 1.8 + 0.02);
  group.add(led);
  // רצפת הבמה
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), stageFloor());
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -RISER_H, STAGE_FRONT + 6);
  group.add(floor);
  // שפת הבמה + פס תאורה דק בצבע ציאן
  const lip = new THREE.Mesh(new THREE.BoxGeometry(22, PIT_Y * -1 - RISER_H, 0.2), blackBox());
  lip.position.set(0, (PIT_Y - RISER_H) / 2, STAGE_FRONT - 0.1);
  group.add(lip);
  const lipLed = new THREE.Mesh(new THREE.BoxGeometry(22, 0.012, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.75, 1.0).multiplyScalar(2.2), toneMapped: false }));
  lipLed.position.set(0, -RISER_H + 0.004, STAGE_FRONT + 0.03);
  group.add(lipLed);
  // רצפת הקהל
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), new THREE.MeshStandardMaterial({ color: 0x0a090c, roughness: 0.9 }));
  pit.rotation.x = -Math.PI / 2;
  pit.position.set(0, PIT_Y, -25);
  group.add(pit);
  // גדר מתכת לפני הקהל
  const bar = new THREE.Mesh(new THREE.BoxGeometry(20, 1.05, 0.08), darkMetal());
  bar.position.set(0, PIT_Y + 0.52, STAGE_FRONT - 1.4);
  group.add(bar);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 20, 8), chrome());
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, PIT_Y + 1.06, STAGE_FRONT - 1.4);
  group.add(rail);
  // מוניטורים לזמרים ולגיטריסטים + סטנד מיקרופון במרכז
  wedge(group, -2.1, STAGE_FRONT + 0.7, -Math.PI / 2 - 0.15);
  wedge(group, 0.15, STAGE_FRONT + 0.7, -Math.PI / 2);
  wedge(group, 2.3, STAGE_FRONT + 0.7, -Math.PI / 2 + 0.15);
  const mic = new THREE.Group();
  const mt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.55, 8), chrome());
  mt.position.y = 0.78;
  mic.add(mt);
  const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 20), darkMetal());
  mic.add(mb);
  const mh = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 10), darkMetal());
  mh.position.set(0, 1.58, -0.06);
  mh.rotation.x = 1.1;
  mic.add(mh);
  mic.position.set(0.1, -RISER_H, STAGE_FRONT + 1.2);
  group.add(mic);
  // כבלים על רצפת הבמה (מהמוניטורים אל הרייזר) וסימוני טייפ
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.55 });
  const cr = rng(17);
  for (let i = 0; i < 6; i++) {
    const x0 = -2.6 + i * 1.05 + (cr() - 0.5) * 0.4;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(new THREE.Vector3(x0 + Math.sin(t * 5 + i) * 0.35 + (cr() - 0.5) * 0.2, -RISER_H + 0.012, STAGE_FRONT + 0.9 + t * 2.1));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 5), cableMat);
    group.add(tube);
  }
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.8 });
  for (const [x, z, a] of [[-1.9, -3.4, 0.2], [0.3, -3.9, -0.1], [2.2, -3.3, 0.4], [-0.9, -2.6, 1.2]]) {
    for (const r2 of [0, Math.PI / 2]) {
      const tp = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.045), tapeMat);
      tp.rotation.set(-Math.PI / 2, 0, a + r2);
      tp.position.set(x, -RISER_H + 0.004, z);
      group.add(tp);
    }
  }

  // הקיר האחורי של האולם, אורות במת הסאונד, שלטי יציאה וזרקורי עקיבה רחוקים
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshBasicMaterial({ color: 0x07050c }));
  wall.position.set(0, 8, -36);
  group.add(wall);
  const glows = new THREE.Group();
  sprite(0xfff1d6, 0.95, [3.2, 3.2], [-4.5, 6.5, -33], glows);
  sprite(0xfff1d6, 0.95, [3.2, 3.2], [4.8, 6.4, -33], glows);
  sprite(0xffb066, 0.6, [2.4, 1.2], [0, -0.6, -21], glows);
  sprite(0x22ff88, 0.7, [0.9, 0.5], [-15, 1.5, -26], glows);
  sprite(0x22ff88, 0.7, [0.9, 0.5], [15, 1.5, -26], glows);
  group.add(glows);

  const crowd = buildCrowd();
  group.add(crowd.mesh);
  group.add(crowd.points);

  // ערפל במה: כתמי זוהר גדולים ושקופים שנעים לאט
  const haze = [];
  const hr = rng(5);
  for (let i = 0; i < 9; i++) {
    const s = sprite(i % 3 === 0 ? 0xff3d9a : i % 3 === 1 ? 0x4f6bff : 0xffa040, 0.07, [10 + hr() * 8, 5 + hr() * 3], [(hr() - 0.5) * 18, 0.5 + hr() * 3, -7 - hr() * 16], group);
    s.userData.base = s.position.clone();
    s.userData.phase = hr() * 10;
    s.userData.op = 0.012 + hr() * 0.02;
    haze.push(s);
  }

  return { group, crowd, haze, led: ledMat, glows };
}

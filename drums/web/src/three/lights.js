// התאורה של ההופעה: פנס מפתח חם מאחורי המתופף, פנסי ג'ל צבעוניים מהטראס, אור אחורי מהקהל (ברק על שפות המצילות),
// וקרני אור נראות (קונוסים שקופים עם דעיכה רכה) שזזות לאט ומחליפות צבע. במכה חזקה (קראש / בס) הכול מתעצם לרגע.
import * as THREE from 'three';
import { PIT_Y } from './venue';

// הפלטה של התאורה: מגנטה, כחול, ענבר, ציאן, אדום
const GELS = [new THREE.Color(1.0, 0.12, 0.55), new THREE.Color(0.18, 0.32, 1.0), new THREE.Color(1.0, 0.55, 0.1), new THREE.Color(0.1, 0.85, 1.0), new THREE.Color(1.0, 0.08, 0.12)];

function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color() }, uI: { value: 1 }, uTime: { value: 0 }, uLen: { value: 14 } },
    vertexShader: `uniform float uLen; varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vAlong = -position.y / uLen; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = -mv.xyz; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; uniform float uTime; varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float along = smoothstep(0.0, 0.06, vAlong) * pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.4);
        float haze = 0.7 + 0.3 * sin(vW.y * 1.7 + vW.x * 0.9 + uTime * 0.7) * sin(vW.z * 1.3 - uTime * 0.5);
        gl_FragColor = vec4(uColor * edge * along * haze * uI * 0.15, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildLights(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const hemi = new THREE.HemisphereLight(0x4a3a70, 0x080610, 0.5);
  group.add(hemi);

  // פנס מפתח חם מלמעלה-מאחור (מאיר את העורות והמצילות מכיוון המתופף)
  const key = new THREE.SpotLight(0xffd6a6, 9, 9, 0.62, 0.7, 1.6);
  key.position.set(0.4, 4.2, 2.6);
  key.target.position.set(0, 0.6, -0.2);
  group.add(key, key.target);
  // אור מילוי נמוך מאחור: מאיר את צד המעטפות שפונה למתופף (שם רואים את הנצנצים)
  const fill = new THREE.SpotLight(0xffc89a, 4, 6, 0.7, 0.9, 1.4);
  fill.position.set(-0.3, 1.5, 2.4);
  fill.target.position.set(0, 0.45, -0.1);
  group.add(fill, fill.target);

  // שלושה פנסי ג'ל מהטראס הקדמי
  const gels = [];
  for (const [i, x] of [[0, -3.2], [1, 3.2], [2, 0]]) {
    const s = new THREE.SpotLight(GELS[i], 14, 14, 0.3, 0.7, 1.5);
    s.position.set(x, 5.2, -3.6);
    s.target.position.set(x * 0.08, 0.7, -0.1);
    group.add(s, s.target);
    gels.push(s);
  }
  // אור אחורי לבן-קר מהקהל: נותן את השפה הבוהקת למצילות ולחישוקים
  const rim = new THREE.SpotLight(0xdfe8ff, 12, 16, 0.3, 0.8, 1.3);
  rim.position.set(-1.5, 3.4, -9);
  rim.target.position.set(0, 1.0, 0);
  group.add(rim, rim.target);

  // קרני אור נראות: מהטראס הקדמי (מעל הבמה) ומהטראס האחורי (מאחורי המתופף, יורות אל הקהל)
  const beams = [];
  const LEN = 16;
  const geo = new THREE.CylinderGeometry(0.05, 0.85, LEN, 40, 1, true);
  geo.translate(0, -LEN / 2, 0);
  const spots = [
    { p: [-4.5, 6.2, -4.2], aim: [-6, PIT_Y, -14], c: 0 },
    { p: [-1.6, 6.4, -4.4], aim: [-2, PIT_Y, -16], c: 1 },
    { p: [1.6, 6.4, -4.4], aim: [2.5, PIT_Y, -16], c: 0 },
    { p: [4.5, 6.2, -4.2], aim: [6, PIT_Y, -14], c: 1 },
    { p: [-3.4, 6.8, 3.2], aim: [-4, PIT_Y, -12], c: 2 },
    { p: [0, 7.0, 3.6], aim: [0, PIT_Y, -13], c: 3 },
    { p: [3.4, 6.8, 3.2], aim: [4, PIT_Y, -12], c: 2 },
  ];
  spots.forEach((s, i) => {
    const m = new THREE.Mesh(geo, beamMaterial());
    m.position.set(...s.p);
    m.userData = { aim: new THREE.Vector3(...s.aim), c: s.c, phase: i * 1.7 };
    m.material.uniforms.uLen.value = LEN;
    m.frustumCulled = false;
    m.renderOrder = 5;
    group.add(m);
    beams.push(m);
  });

  const tmp = new THREE.Vector3();
  const sweep = new THREE.Vector3();
  const colA = new THREE.Color();
  const state = { energy: 0, day: 0 };

  // t = זמן בשניות, motion = 0 כשהמשתמש ביקש פחות תנועה
  function update(t, dt, motion) {
    state.energy = Math.max(0, state.energy - dt * 3.2);
    const e = state.energy;
    const night = 1 - state.day;
    // החלפת צבעים איטית של הג'לים
    gels.forEach((s, i) => {
      const k = motion ? (t * 0.05 + i * 0.37) % 1 : i / 3;
      const a = Math.floor(k * GELS.length);
      colA.copy(GELS[a % GELS.length]).lerp(GELS[(a + 1) % GELS.length], (k * GELS.length) % 1);
      s.color.copy(colA);
      s.intensity = (11 + (motion ? 4 * Math.sin(t * 0.8 + i * 2) : 0)) * (1 + e * 1.4) * (0.35 + 0.65 * night);
    });
    key.intensity = 9 * (1 + e * 0.6) + state.day * 8;
    rim.intensity = 12 * (1 + e) * (0.5 + 0.5 * night);
    hemi.intensity = 0.35 + state.day * 1.6;
    beams.forEach((m, i) => {
      const u = m.userData;
      const sw = motion ? Math.sin(t * 0.35 + u.phase) : 0;
      const sw2 = motion ? Math.cos(t * 0.27 + u.phase * 1.3) : 0;
      tmp.copy(u.aim).add(sweep.set(sw * 3.2, 0, sw2 * 3));
      m.lookAt(tmp);
      m.rotateX(-Math.PI / 2);
      const c = motion ? GELS[(u.c + Math.floor(t / 8 + i * 0.5)) % GELS.length] : GELS[u.c];
      m.material.uniforms.uColor.value.copy(c);
      m.material.uniforms.uI.value = (0.85 + (motion ? 0.25 * Math.sin(t * 1.1 + u.phase) : 0)) * (1 + e * 2.2) * (0.25 + 0.75 * night);
      m.material.uniforms.uTime.value = t;
    });
  }

  return {
    group,
    update,
    flash(k) {
      state.energy = Math.min(1.4, state.energy + k);
    },
    setDay(d) {
      state.day = d;
    },
    get wash() {
      return gels[0].color;
    },
    dispose() {
      geo.dispose();
      beams.forEach((b) => b.material.dispose());
      group.removeFromParent();
    },
  };
}

// הבמה: סצנה, מצלמה, תאורה, תוויות והדגשות. עוטף את הגיטרה והמורה.
import * as THREE from 'three';
import { createGuitar } from './guitar.js';
import { layoutLabels } from './labels.js';
import { MODEL_CAL, loadGuitarModel, loadedGuitarModel } from './guitarModels.js';
import { createTeacher } from './teacher.js';
import { createModelTeacher, loadTeacherModel, loadedTeacherModel } from './teacherModel.js';
import { teacherById, teacherUrl } from '../lib/teachers.js';
import { PRESETS, PART_NAMES } from '../lib/parts.js';
import { playString, unlockAudio } from '../lib/audio.js';
import { createChordAids } from './chordAids.js';
import { fingersDownAt, handSpec } from '../lib/chord.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TIERS, TOP, startTier, forcedTier, createGovernor } from './quality.js';
import { createLookPass } from './lookPass.js';

const ease = (t) => t * t * (3 - 2 * t);
const rad = Math.PI / 180;

// רקע הסטודיו: מעבר רדיאלי רך כהה (אותו דבר בשני המצבים; הממשק מסביב ממשיך לפי הנושא)
function studioBackground() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 190, 20, 256, 230, 400);
  gr.addColorStop(0, '#3d332b');
  gr.addColorStop(0.45, '#221c17');
  gr.addColorStop(1, '#0a0807');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// כתם רך (צל מזויף / שולי הרצפה)
function softDisc(inner, alpha) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, inner * 64, 64, 64, 62);
  gr.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createStage(canvas, labelsEl, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = studioBackground();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);

  // תאורת סטודיו: מפתח (עם צל רך) משמאל-למעלה-מלפנים, מילוי קר חלש מימין, וקונטור מאחור שמפריד מהרקע
  const hemi = new THREE.HemisphereLight(0xfff0e0, 0x2a1f17, 0.25);
  const key = new THREE.DirectionalLight(0xffe6c8, 1.9);
  key.position.set(-42, 78, 96);
  key.target.position.set(6, 6, 8);
  key.shadow.camera.left = -52;
  key.shadow.camera.right = 52;
  key.shadow.camera.top = 56;
  key.shadow.camera.bottom = -50;
  key.shadow.camera.near = 40;
  key.shadow.camera.far = 260;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.12;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xbdd0ff, 0.55);
  fill.position.set(70, 30, 70);
  const rim = new THREE.DirectionalLight(0xffd9b0, 1.5);
  rim.position.set(-30, 60, -80);
  scene.add(hemi, key, key.target, fill, rim);

  // סביבת סטודיו להחזרים (HDRI של Poly Haven, CC0); עד שנטענת (או אם נכשלה) – סביבת חדר מחושבת
  scene.environmentIntensity = 0.35;
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const fallback = () => {
      if (scene.environment || !alive) return;
      const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = rt.texture;
      envTex = rt.texture;
    };
    new EXRLoader()
      .setDataType(THREE.HalfFloatType)
      .load(
        `${import.meta.env.BASE_URL}env/studio.exr`,
        (tex) => {
          if (!alive) {
            tex.dispose();
            return;
          }
          tex.mapping = THREE.EquirectangularReflectionMapping;
          const rt = pmrem.fromEquirectangular(tex);
          tex.dispose();
          envTex = rt.texture;
          scene.environment = rt.texture;
        },
        undefined,
        fallback,
      );
    setTimeout(fallback, 6000);
  }
  let envTex = null;

  // רצפה בלי החזרי סביבה (אחרת ה-HDRI הבהיר מבריק עליה): סביבה שחורה משלה
  const blackEnv = pmrem.fromScene(new THREE.Scene(), 0).texture;
  // רצפת סטודיו: דיסק כהה ורך שמתמזג עם הרקע, מקבל את הצל האמיתי
  const floorFade = softDisc(0.15, 1);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x211b16, roughness: 0.85, metalness: 0, alphaMap: floorFade, transparent: true, envMap: blackEnv, envMapIntensity: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(8, -30.05, 12);
  floor.receiveShadow = true;
  scene.add(floor);
  // צל מזויף רק מתחת לשרפרף (ובמכשירים בלי צל אמיתי – הוא היחיד)
  const blobTex = softDisc(0.05, 0.55);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex, transparent: true, depthWrite: false });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(2, -30.0, 18);
  scene.add(blob);

  // ----- איכות מתכווננת (ראו quality.js) -----
  const forced = forcedTier(typeof window !== 'undefined' && window.__MT_QUALITY != null ? window.__MT_QUALITY : opts.quality);
  let tier = forced != null ? forced : startTier({
    coarse: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
    cores: navigator.hardwareConcurrency || 8,
    memory: navigator.deviceMemory || 8,
  });
  let composer = null;
  let gtao = null;
  let look = null;
  let size = { w: 1, h: 1 };
  let lookAmount = 0; // 0 = מצלמה רחבה, 1 = תקריב (דעיכה חלקה)
  let lookGoal = 0;
  const governor = createGovernor({
    onDrop: () => {
      if (tier > 0) setTier(tier - 1);
    },
  });
  function markShadowFlags() {
    // כל גוף חשוב מטיל ומקבל צל; מיתרים, עזרי הוראה ותיבות פגיעה לא (דקים מדי ויוצרים רעש)
    const skip = new Set();
    if (guitar) guitar.stringMeshes && guitar.stringMeshes.forEach((m) => skip.add(m));
    scene.traverse((o) => {
      if (!o.isMesh || o === floor || o === blob) return;
      const isAid = aids && (isUnder(o, aids.group) || isUnder(o, aids.rings));
      const thin = skip.has(o) || (guitar && guitar.hitMeshes && guitar.hitMeshes.includes(o)) || isAid;
      o.castShadow = !thin;
      o.receiveShadow = !isAid;
    });
  }
  function isUnder(o, root) {
    for (let p = o; p; p = p.parent) if (p === root) return true;
    return false;
  }
  function setTier(t) {
    const prev = tier;
    tier = Math.max(0, Math.min(TOP, t));
    const T = TIERS[tier];
    const wantShadow = T.shadows > 0;
    const hadShadow = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = wantShadow;
    key.castShadow = wantShadow;
    if (wantShadow && key.shadow.mapSize.x !== T.shadows) {
      key.shadow.mapSize.set(T.shadows, T.shadows);
      if (key.shadow.map) {
        key.shadow.map.dispose();
        key.shadow.map = null;
      }
    }
    blob.visible = !wantShadow;
    blobMat.opacity = 1;
    if (wantShadow !== hadShadow) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    if (T.ao && !composer) buildComposer();
    if (!T.ao && composer) disposeComposer();
    governor.reset();
    resize();
    if (opts.onQuality) opts.onQuality(tier, TIERS[tier].name, prev);
  }
  function buildComposer() {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 4, 4);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.95;
    gtao.updateGtaoMaterial({ radius: 3.2, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    // עזרי ההוראה (סימונים, טבעות) הם מישורים צפים: בלי להסתיר אותם, שלב העומק שלהם יוצר "כתמי צל" מרובעים סביבם
    const gtaoRender = gtao.render.bind(gtao);
    gtao.render = (...args) => {
      const g = aids && aids.group;
      const r = aids && aids.rings;
      const vg = g && g.visible;
      const vr = r && r.visible;
      if (g) g.visible = false;
      if (r) r.visible = false;
      gtaoRender(...args);
      if (g) g.visible = vg;
      if (r) r.visible = vr;
    };
    composer.addPass(gtao);
    look = createLookPass();
    look.uniforms.tDepth.value = gtao.depthTexture;
    composer.addPass(look);
    composer.addPass(new OutputPass());
  }
  function disposeComposer() {
    composer.passes.forEach((p) => p.dispose && p.dispose());
    composer.dispose();
    composer = null;
    gtao = null;
    look = null;
  }

  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mq && mq.matches);

  // ----- גיטרה + מורה -----
  let type = opts.type || 'classical';
  let teacherId = teacherById(opts.teacher).id;
  let rightMode = 'play';
  let camName = 'wide';
  let buildToken = 0;
  let guitarToken = 0;
  let waveEnd = 0; // עד מתי המורה מנופף (כדי שלא יאבד בהחלפה מבובה לדגם)
  let guitar = null;
  let teacher = null;
  let leftSpec = null;
  let aids = null; // עזרי הוראה לאקורד (סימונים, טבעות)
  let chord = null; // { spec, t0 }: אקורד מוצג עם אנימציית הנחה
  let ghost = false; // יד שקופה
  let focus = { parts: [], labels: [] };
  let badges = false;
  let activeString = 0;
  const lookTarget = new THREE.Vector3();

  function soundFor(string, amp) {
    const fret = ((leftSpec && leftSpec.fingers.find((f) => f.string === string)) || {}).fret || 0;
    if (opts.onSound) opts.onSound(string, amp, fret);
    playString(type, string, { fret, gain: 0.5 * amp, pan: (3.5 - string) * 0.1 });
    flashString(string);
  }
  let flashTimer = 0;
  function flashString(i) {
    activeString = i;
    if (guitar) guitar.setStringHighlight(i);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      activeString = 0;
      if (guitar) guitar.setStringHighlight(0);
    }, 1400);
    updateBadgeClasses();
  }

  // אקורד עם אנימציית הנחה: האצבעות יורדות לפי הסדר (1, 2, 3...), ולכל אחת מופיע סימון. הפחתת תנועה = הכול מיד
  function stepChord(nowMs) {
    if (!chord || !teacher || !aids) return;
    const down = fingersDownAt(chord.spec, (nowMs - chord.t0) / 1000, { reduced: reduced() });
    const key = down.join(',');
    if (key === chord.key) return;
    chord.key = key;
    leftSpec = handSpec(chord.spec, down);
    teacher.setLeftHand(leftSpec);
    aids.setDown(down, reduced());
    if (opts.onChordDown) opts.onChordDown(down);
  }

  // מורה דגם (GLB); אם נכשל – המורה הבובה
  function makeTeacher(gltf) {
    const fit = teacherById(teacherId).fit;
    if (gltf) {
      try {
        return createModelTeacher(guitar, gltf, fit);
      } catch (e) {
        console.warn('teacher model failed', e);
      }
    }
    return createTeacher(guitar);
  }
  function adopt(t) {
    teacher = t;
    scene.add(teacher.group);
    teacher.onRelease = soundFor;
    teacher.setLeftHand(leftSpec);
    teacher.setRightHand(rightMode);
    teacher.setGhost(ghost);
    const left = (waveEnd - performance.now()) / 1000;
    if (left > 0.3) teacher.wave(left);
    guitar.group.updateMatrixWorld(true);
    teacher.update(0.016, performance.now() / 1000);
    markShadowFlags();
  }

  function build() {
    if (teacher) {
      scene.remove(teacher.group);
      teacher.dispose();
    }
    if (aids) {
      scene.remove(aids.rings);
      aids.dispose();
      aids = null;
    }
    if (guitar) {
      scene.remove(guitar.group);
      guitar.dispose();
    }
    guitar = createGuitar(type);
    scene.add(guitar.group);
    aids = createChordAids(guitar);
    guitar.group.add(aids.group);
    scene.add(aids.rings);
    if (chord) {
      aids.setSpec(chord.spec);
      chord.key = null; // מחשבים מחדש אילו אצבעות למטה (הסימונים נוצרו מחדש)
    }
    // גיטרה אמיתית (GLB): אם כבר נטענה – מחברים מיד; אחרת נטענת ברקע וה"מחושבת" נשארת עד אז (או אם נכשל)
    const gUrl = `${import.meta.env.BASE_URL}${MODEL_CAL[type].file}`;
    const gReady = loadedGuitarModel(gUrl);
    if (gReady) guitar.attachModel(gReady);
    else {
      const gg = guitar;
      const gtok = ++guitarToken;
      loadGuitarModel(gUrl)
        .then((gltf) => {
          if (!alive || gtok !== guitarToken || gg !== guitar) return;
          gg.attachModel(gltf);
          markShadowFlags();
          gg.setHighlight(focus.parts);
          buildLabels();
          setCamera(camName, { instant: true });
        })
        .catch(() => {
          /* נשארים עם הגיטרה המחושבת */
        });
    }
    const url = teacherUrl(teacherById(teacherId));
    const ready = loadedTeacherModel(url);
    adopt(makeTeacher(ready));
    guitar.setHighlight(focus.parts);
    buildLabels();
    // הדגם עוד לא נטען: בינתיים הבובה, ואז מחליפים (המצלמה מחושבת מחדש כי הגיטרה זזה)
    if (!ready) {
      const tok = ++buildToken;
      const g = guitar;
      loadTeacherModel(url)
        .then((gltf) => {
          if (!alive || tok !== buildToken || g !== guitar) return;
          scene.remove(teacher.group);
          teacher.dispose();
          adopt(makeTeacher(gltf));
          buildLabels();
          setCamera(camName, { instant: true });
        })
        .catch(() => {
          /* נשארים עם הבובה */
        });
    } else buildToken++;
  }

  // ----- תוויות -----
  let labelObjs = [];
  let badgeObjs = [];
  const tmp = new THREE.Vector3();
  function clearLabels() {
    labelObjs.forEach((l) => l.el.remove());
    badgeObjs.forEach((l) => l.el.remove());
    labelObjs = [];
    badgeObjs = [];
  }
  function buildLabels() {
    clearLabels();
    labelObjs = focus.labels
      .filter((l) => guitar.parts[l.part])
      .map((l) => {
        const el = document.createElement('div');
        el.className = 'lb on';
        const inner = document.createElement('div');
        inner.className = 'lb-text';
        inner.textContent = l.text;
        inner.style.transform = 'translate(-50%, -50%)';
        el.appendChild(inner);
        labelsEl.appendChild(el);
        return { el, inner, down: guitar.parts[l.part].side === 'down', local: guitar.parts[l.part].anchor.clone(), w: 0, h: 0 };
      });
    if (opts.onLabels) opts.onLabels(labelObjs.length);
    if (badges) {
      for (let i = 1; i <= 6; i++) {
        const el = document.createElement('div');
        el.className = 'lb on';
        const inner = document.createElement('div');
        inner.className = 'lb-badge';
        inner.textContent = String(i);
        el.appendChild(inner);
        labelsEl.appendChild(el);
        const x = 5 + (6 - i) * 3.4;
        badgeObjs.push({ el, inner, i, local: guitar.stringPoint(i, x) });
      }
      updateBadgeClasses();
    }
  }
  function updateBadgeClasses() {
    badgeObjs.forEach((b) => b.inner.classList.toggle('hot', b.i === activeString));
  }
  function placeLabels(w, h) {
    const place = (o) => {
      tmp.copy(o.local).applyMatrix4(guitar.group.matrixWorld).project(camera);
      o.vis = tmp.z < 1;
      o.x = (tmp.x * 0.5 + 0.5) * w;
      o.y = (-tmp.y * 0.5 + 0.5) * h;
      o.el.style.display = o.vis ? 'block' : 'none';
    };
    labelObjs.forEach(place);
    badgeObjs.forEach((o) => {
      place(o);
      o.el.style.transform = `translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px)`;
    });
    // תוויות טקסט: נשארות בתוך הבמה ולא נערמות זו על זו
    const live = labelObjs.filter((o) => o.vis);
    live.forEach((o) => {
      if (!o.w) {
        o.w = o.inner.offsetWidth || 90;
        o.h = o.inner.offsetHeight || 26;
      }
      // מרכז התווית (לא העוגן): מעל העוגן או מתחתיו, לפי הצד
      o.cx = o.x;
      o.cy = o.y + (o.down ? 4 + o.h / 2 : -4 - o.h / 2);
    });
    layoutLabels(live, w, h);
    live.forEach((o) => {
      o.el.style.transform = `translate(${o.cx.toFixed(1)}px, ${o.cy.toFixed(1)}px)`;
    });
  }

  // ----- מצלמה -----
  const rig = { target: new THREE.Vector3(6, 14, 8), dist: 118, az: 8 * rad, el: 6 * rad, k: 1, up: new THREE.Vector3(0, 1, 0), inset: 0 };
  let insetFrac = 0; // כמה מגובה הבמה תפוס בתחתית (שכבת האקורד) – מסגרים את הצוואר בחלק העליון
  const UP = new THREE.Vector3(0, 1, 0);
  let from = null;
  let to = null;
  let tStart = 0;
  const drag = { az: 0, el: 0 };

  // מסגור אוטומטי: המורה והגיטרה ממלאים p.fit מגובה הבמה (וגם נכנסים לרוחב) – בטלפון ובמחשב
  const fitCam = new THREE.PerspectiveCamera(30, 1, 1, 1000);
  function sceneBounds() {
    guitar.group.updateMatrixWorld(true);
    const box = new THREE.Box3().expandByObject(guitar.group);
    box.union(teacher.bounds ? teacher.bounds() : new THREE.Box3().setFromObject(teacher.group));
    return box;
  }
  function fitView(box, az, el, fill) {
    const c = box.getCenter(new THREE.Vector3());
    const pts = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
    fitCam.aspect = size.w / Math.max(size.h, 1);
    fitCam.updateProjectionMatrix();
    const v = new THREE.Vector3();
    const place = (d) => {
      fitCam.position.set(c.x + d * Math.sin(az) * Math.cos(el), c.y + d * Math.sin(el), c.z + d * Math.cos(az) * Math.cos(el));
      fitCam.lookAt(c);
      fitCam.updateMatrixWorld(true);
    };
    const extent = (d) => {
      place(d);
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      pts.forEach((p) => {
        v.copy(p).project(fitCam);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      });
      return { w: (x1 - x0) / 2, h: (y1 - y0) / 2, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 30;
    let hi = 900;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const e = extent(mid);
      if (e.h > fill || e.w > 0.94) lo = mid;
      else hi = mid;
    }
    const e = extent(hi);
    // מזיזים את היעד כך שהקופסה תהיה במרכז הבמה
    const halfH = hi * Math.tan((fitCam.fov * rad) / 2);
    const up = new THREE.Vector3().setFromMatrixColumn(fitCam.matrixWorld, 1);
    const right = new THREE.Vector3().setFromMatrixColumn(fitCam.matrixWorld, 0);
    const target = c.clone().addScaledVector(up, e.cy * halfH).addScaledVector(right, e.cx * halfH * fitCam.aspect);
    return { target, dist: hi };
  }
  // מסגור נקודות (בעולם) ממבט נתון: dir = מהיעד אל המצלמה, up = כיוון "למעלה" במסך
  function fitPoints(pts, dir, up, maxW, maxH) {
    const c = new THREE.Vector3();
    pts.forEach((p) => c.add(p));
    c.divideScalar(pts.length);
    fitCam.aspect = size.w / Math.max(size.h, 1);
    fitCam.updateProjectionMatrix();
    fitCam.up.copy(up);
    const v = new THREE.Vector3();
    const extent = (d) => {
      fitCam.position.copy(c).addScaledVector(dir, d);
      fitCam.lookAt(c);
      fitCam.updateMatrixWorld(true);
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      pts.forEach((p) => {
        v.copy(p).project(fitCam);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      });
      return { w: (x1 - x0) / 2, h: (y1 - y0) / 2, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 5;
    let hi = 400;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const e = extent(mid);
      if (e.h > maxH || e.w > maxW) lo = mid;
      else hi = mid;
    }
    const e = extent(hi);
    const halfH = hi * Math.tan((fitCam.fov * rad) / 2);
    const upV = new THREE.Vector3().setFromMatrixColumn(fitCam.matrixWorld, 1);
    const rightV = new THREE.Vector3().setFromMatrixColumn(fitCam.matrixWorld, 0);
    const target = c.clone().addScaledVector(upV, e.cy * halfH).addScaledVector(rightV, e.cx * halfH * fitCam.aspect);
    return { target, dist: hi };
  }
  // תקריב אקורד: מבט מלמעלה על פני הלוח, מהאום ועד שריג p.frets, כל ששת המיתרים נראים
  function boardView(p) {
    guitar.group.updateMatrixWorld(true);
    const L = (x, y, z) => guitar.group.localToWorld(new THREE.Vector3(x, y, z));
    const D = (x, y, z) => new THREE.Vector3(x, y, z).transformDirection(guitar.group.matrixWorld);
    const x0 = -1.0;
    const x1 = guitar.fretX(p.frets || 4) + 0.8;
    const hwx = guitar.hw(x1) + 0.35;
    const pts = [];
    // מרווח נוסף בצד של היד (z שלילי) כדי שהיד לא תמלא את הבמה: רואים את האצבעות עולות אל הצוואר
    for (const x of [x0, x1]) for (const z of [-hwx - 2.8, hwx]) for (const y of [0, 0.9]) pts.push(L(x, y, z));
    const phi = (p.phi || 40) * rad;
    const psi = (p.psi || 0) * rad;
    const dir = D(0, 1, 0).multiplyScalar(Math.cos(phi) * Math.cos(psi)).addScaledVector(D(0, 0, 1), Math.sin(phi)).addScaledVector(D(1, 0, 0), -Math.sin(psi) * Math.cos(phi)).normalize();
    const up = D(0, 0, 1);
    // הטיית מצלמה (roll): הצוואר באלכסון כמו בצילום וידאו של שיעור, בלי לאבד קריאות
    const upR = up.clone().applyAxisAngle(dir, (p.roll || 0) * rad);
    const f = fitPoints(pts, dir, upR, 0.9, 0.94 * (1 - insetFrac));
    return { target: f.target, dist: f.dist, az: Math.atan2(dir.x, dir.z), el: Math.asin(dir.y), k: 1, up: upR, inset: insetFrac };
  }
  function resolve(name) {
    const p0 = (PRESETS[type] || PRESETS.classical)[name] || PRESETS[type].wide;
    if (p0.board) return boardView(p0);
    return { ...resolveOrbit(name), up: UP.clone(), inset: 0 };
  }
  function resolveOrbit(name) {
    const p = (PRESETS[type] || PRESETS.classical)[name] || PRESETS[type].wide;
    let target;
    if (p.fit) {
      const f = fitView(sceneBounds(), p.az * rad, p.el * rad, p.fit);
      return { target: f.target, dist: f.dist, az: p.az * rad, el: p.el * rad, k: 1 };
    }
    if (p.x != null) {
      target = guitar.group.localToWorld(new THREE.Vector3(p.x, 0, 0));
    } else if (p.part && guitar.parts[p.part]) {
      target = guitar.parts[p.part].center.clone().applyMatrix4(guitar.group.matrixWorld);
    } else {
      target = teacher.center.clone();
    }
    return { target, dist: p.dist, az: p.az * rad, el: p.el * rad, k: fitFactor() };
  }
  function fitFactor() {
    const a = size.w / Math.max(size.h, 1);
    return Math.max(1, Math.pow(1.3 / a, 0.85));
  }
  function setCamera(name, o = {}) {
    if (!guitar) return;
    camName = name;
    lookGoal = name === 'wide' ? 0 : 1;
    if (canvas.parentElement) canvas.parentElement.dataset.look = name === 'wide' ? 'wide' : 'close';
    const goal = resolve(name);
    to = goal;
    if (o.instant || reduced()) {
      rig.target.copy(goal.target);
      rig.dist = goal.dist;
      rig.k = goal.k;
      rig.az = goal.az;
      rig.el = goal.el;
      rig.up.copy(goal.up);
      rig.inset = goal.inset;
      from = null;
      to = null;
      drag.az = drag.el = 0;
      return;
    }
    from = { target: rig.target.clone(), dist: rig.dist, az: rig.az, el: rig.el, k: rig.k, up: rig.up.clone(), inset: rig.inset };
    tStart = performance.now();
    drag.az = drag.el = 0;
  }

  function applyCamera() {
    if (from && to) {
      const t = Math.min(1, (performance.now() - tStart) / 1000);
      const e = ease(t);
      rig.target.lerpVectors(from.target, to.target, e);
      rig.dist = from.dist + (to.dist - from.dist) * e;
      rig.k = from.k + (to.k - from.k) * e;
      rig.az = from.az + (to.az - from.az) * e;
      rig.el = from.el + (to.el - from.el) * e;
      rig.up.lerpVectors(from.up, to.up, e).normalize();
      rig.inset = from.inset + (to.inset - from.inset) * e;
      if (t >= 1) {
        from = null;
        to = null;
      }
    }
    const az = rig.az + drag.az;
    const el = rig.el + drag.el;
    const d = rig.dist * rig.k;
    camera.position.set(
      rig.target.x + d * Math.sin(az) * Math.cos(el),
      rig.target.y + d * Math.sin(el),
      rig.target.z + d * Math.cos(az) * Math.cos(el),
    );
    camera.up.copy(rig.up);
    camera.lookAt(rig.target);
    // הזזת התמונה כלפי מעלה כדי לפנות מקום לשכבת האקורד בתחתית (בלי לשנות את קנה המידה)
    if (rig.inset > 0.002) camera.setViewOffset(size.w, size.h, 0, Math.round(rig.inset * size.h * 0.5), size.w, size.h);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  }

  // ----- גרירה ולחיצה -----
  const ray = new THREE.Raycaster();
  let ptr = null;
  canvas.addEventListener('pointerdown', (e) => {
    ptr = { x: e.clientX, y: e.clientY, az: drag.az, el: drag.el, moved: false, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* לא קריטי */ }
    unlockAudio();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptr) return;
    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    if (Math.abs(dx) + Math.abs(dy) > 6 && !ptr.moved) {
      ptr.moved = true;
      if (opts.onDrag) opts.onDrag();
    }
    if (ptr.moved) {
      drag.az = Math.max(-0.45, Math.min(0.45, ptr.az - dx * 0.006));
      drag.el = Math.max(-0.2, Math.min(0.3, ptr.el + dy * 0.004));
    }
  });
  const end = (e) => {
    if (!ptr) return;
    const was = ptr;
    ptr = null;
    if (was.moved || e.type === 'pointercancel') return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(guitar.hitMeshes, false)[0];
    if (hit && opts.onPick) opts.onPick(hit.object.userData.string);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // ----- גודל -----
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    size = { w, h };
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (composer) composer.setPixelRatio(dpr), composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // שינוי גודל (סיבוב מסך וכו'): מחשבים מחדש את המסגור, אלא אם באמצע מעבר
    if (guitar && teacher && !to) {
      const g = resolve(camName);
      rig.target.copy(g.target);
      rig.dist = g.dist;
      rig.k = g.k;
      rig.az = g.az;
      rig.el = g.el;
      rig.up.copy(g.up);
      rig.inset = g.inset;
    }
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ----- לולאת ציור -----
  let raf = 0;
  let last = performance.now();
  let frames = 0;
  const perf = { n: 0, sum: 0, max: 0 }; // מדידת זמן ציור (לבדיקות)
  let alive = true;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const rawMs = now - last;
    const dt = Math.min(0.05, rawMs / 1000);
    last = now;
    if (forced == null) governor.push(rawMs);
    frames++;
    const t = performance.now() / 1000;
    if (guitar && teacher) {
      applyCamera();
      lookTarget.copy(camera.position);
      teacher.setLookTarget(lookTarget);
      stepChord(now);
      teacher.update(dt, t);
      guitar.update(dt, t);
      if (aids) aids.update(dt, chord ? teacher.tipFrames() : null);
      placeLabels(size.w, size.h);
    }
    // טשטוש עומק שדה: רק בתקריב ורק במדרגה הגבוהה
    lookAmount += (lookGoal - lookAmount) * Math.min(1, dt * 4);
    const tr0 = performance.now();
    if (composer) {
      const u = look.uniforms;
      const focus = rig.dist * rig.k;
      u.focus.value = focus;
      u.range.value = focus * 0.3;
      u.near.value = camera.near;
      u.far.value = camera.far;
      u.amount.value = TIERS[tier].dof ? lookAmount : 0;
      const pr = renderer.getPixelRatio();
      u.texel.value.set(1 / (size.w * pr), 1 / (size.h * pr));
      u.maxBlur.value = 3.2 * pr;
      composer.render(dt);
    } else renderer.render(scene, camera);
    if (opts.measure || (typeof window !== 'undefined' && window.__MT_MEASURE)) {
      renderer.getContext().finish();
      const ms = performance.now() - tr0;
      perf.n++;
      perf.sum += ms;
      perf.max = Math.max(perf.max, ms);
    }
  }

  setTier(tier);
  build();
  setCamera('wide', { instant: true });
  raf = requestAnimationFrame(frame);

  // ----- ממשק -----
  return {
    setGuitarType(t) {
      if (t === type) return;
      type = t;
      build();
      setCamera('wide', { instant: true });
    },
    setTeacher(id) {
      const next = teacherById(id).id;
      if (next === teacherId) return;
      teacherId = next;
      build();
      setCamera(camName, { instant: true });
    },
    setCamera,
    setFocus(f) {
      focus = { parts: f.parts || [], labels: f.labels || [] };
      guitar.setHighlight(focus.parts);
      buildLabels();
    },
    showBadges(on) {
      badges = !!on;
      buildLabels();
    },
    highlightString(i) {
      flashString(i);
    },
    setLeftHand(spec) {
      chord = null;
      if (aids) aids.setSpec(null);
      leftSpec = spec;
      teacher.setLeftHand(spec);
    },
    // אקורד מלא (fingers, open, muted) עם סימונים וטבעות; animate=false: הכול מונח מיד
    showChord(spec, { animate = true } = {}) {
      chord = { spec, t0: performance.now() - (animate ? 0 : 1e7), key: null };
      aids.setSpec(spec);
      aids.setDown([], true);
      leftSpec = handSpec(spec, []);
      teacher.setLeftHand(leftSpec);
    },
    replayChord() {
      if (!chord) return;
      chord.t0 = performance.now();
      chord.key = null;
      aids.setDown([], reduced());
      leftSpec = handSpec(chord.spec, []);
      teacher.setLeftHand(leftSpec);
      if (opts.onChordDown) opts.onChordDown([]);
    },
    hideChord() {
      chord = null;
      if (opts.onChordDown) opts.onChordDown([]);
      if (aids) aids.setSpec(null);
    },
    // כמה מגובה הבמה תפוס בתחתית (שכבת האקורד); המצלמה במצב תקריב לוח מסגרת את הצוואר מעליה
    setInset(frac) {
      const f = Math.max(0, Math.min(0.6, frac || 0));
      if (Math.abs(f - insetFrac) < 0.005) return;
      insetFrac = f;
      if (camName === 'chord') setCamera('chord');
    },
    setQuality(t) {
      setTier(t);
    },
    get quality() { return { tier, name: TIERS[tier].name, frames, perf }; },
    setGhost(on) {
      ghost = !!on;
      teacher.setGhost(ghost);
    },
    setRightHand(mode) {
      rightMode = mode;
      teacher.setRightHand(mode);
    },
    pluck(i, amp = 1) {
      unlockAudio();
      teacher.pluck(i, { amp });
    },
    strum(dir, strings, ms = 280, amp = 1) {
      unlockAudio();
      teacher.strum(dir, strings, ms, amp);
    },
    wave(sec) {
      waveEnd = performance.now() + sec * 1000;
      teacher.wave(sec);
    },
    // לבדיקות
    _teacherById: teacherById,
    _presets: PRESETS,
    get teacher() { return teacher; },
    get aids() { return aids; },
    get guitar() { return guitar; },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(flashTimer);
      ro.disconnect();
      clearLabels();
      if (aids) {
        scene.remove(aids.rings);
        aids.dispose();
      }
      if (teacher) teacher.dispose();
      if (guitar) guitar.dispose();
      if (composer) disposeComposer();
      floor.geometry.dispose();
      floorMat.dispose();
      floorFade.dispose();
      blob.geometry.dispose();
      blobMat.dispose();
      blobTex.dispose();
      scene.background.dispose();
      if (envTex) envTex.dispose();
      blackEnv.dispose();
      pmrem.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* לא קריטי */ }
    },
  };
}

export { PART_NAMES };

// מנוע הבמה התלת־ממדית: רנדרר, מצלמה מכיסא המתופף, האולם, התאורה, הסט, bloom, לולאת ציור והתאמת איכות לפי מהירות המכשיר.
// ה-API (createStage) קטן: setKit, resize, hit, flash, cues, pick, anchors, setDark, setMotion, dispose.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { finishOf } from '../lib/finish';
import { cameraFor, modeFor } from '../lib/layout3d';
import { setCue, startFlash, startHit, stepPiece } from './hitfx';
import { buildKit, disposeKit } from './kitModel';
import { buildLights } from './lights';
import { buildEnvironment } from './materials';
import { buildVenue } from './venue';

// רמות איכות: [יחס פיקסלים מקסימלי, bloom]. יורדים רמה כשהפריימים איטיים
const LEVELS = [
  [2, true],
  [1.5, true],
  [1.25, false],
  [1, false],
];

const NIGHT = { bg: new THREE.Color(0x05030a), fog: new THREE.Color(0x0b0716), density: 0.034, exposure: 1.0 };
const DAY = { bg: new THREE.Color(0x2a2730), fog: new THREE.Color(0x3a3640), density: 0.022, exposure: 1.25 };

export function createStage(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  // מונים לכל הפריים (כל המעברים יחד) – לאבחון ביצועים
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.background = NIGHT.bg.clone();
  scene.fog = new THREE.FogExp2(NIGHT.fog.clone(), NIGHT.density);
  const env = buildEnvironment(renderer);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 140);
  const venue = buildVenue();
  scene.add(venue.group);
  const lights = buildLights(scene);

  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const locked = opts.quality === 'high';
  let level = locked ? 0 : coarse ? 1 : 0;
  let composer = null;
  let bloom = null;
  let size = { w: 1, h: 1 };
  let model = null;
  let kitKey = '';
  let kitRef = null;
  let motion = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let dark = true;
  let dayT = 0;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let dirty = true;
  let disposed = false;
  let slow = 0;
  let frames = 0;
  let frameSum = 0;
  const fps = { avg: 0 };

  function setupComposer() {
    const [, useBloom] = LEVELS[level];
    if (composer) {
      composer.dispose();
      composer = null;
      bloom = null;
    }
    if (!useBloom) return;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    // רק אורות, לדים והברקים החזקים של המתכת זוהרים (סף גבוה)
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  function applySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, LEVELS[level][0]);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size.w, size.h, false);
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(size.w, size.h);
      // ה-bloom בחצי רזולוציה – זול יותר ונראה אותו דבר
      bloom.setSize((size.w * dpr) / 2, (size.h * dpr) / 2);
    }
    dirty = true;
  }

  function frameCamera() {
    if (!model) return;
    const cam = cameraFor(model.layout, size.w / size.h);
    camera.position.set(...cam.pos);
    camera.fov = cam.fov;
    camera.aspect = size.w / size.h;
    camera.lookAt(...cam.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    dirty = true;
  }

  function setKit(kit) {
    kitRef = kit;
    // עוד לא ידוע גודל המסך – הסט ייבנה ב-resize
    if (size.w <= 1) return;
    const mode = modeFor(size.w / size.h);
    const finish = finishOf(kit);
    const key = `${kit.pieces.join(',')}|${finish}|${mode}`;
    if (key === kitKey) return;
    kitKey = key;
    if (model) {
      scene.remove(model.group);
      disposeKit(model);
    }
    model = buildKit(kit, finish, mode);
    scene.add(model.group);
    frameCamera();
  }

  function resize(w, h) {
    size = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
    applySize();
    if (kitRef) {
      const before = kitKey;
      setKit(kitRef);
      if (before === kitKey) frameCamera();
    }
  }

  function setDark(d) {
    dark = d;
    dirty = true;
  }

  // ---- לולאת הציור ----
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    clock += dt;
    // מעבר רך בין יום ללילה
    const want = dark ? 0 : 1;
    if (Math.abs(dayT - want) > 0.001) {
      dayT += Math.sign(want - dayT) * Math.min(Math.abs(want - dayT), dt * 2.5);
      dirty = true;
    }
    let busy = false;
    let cueOn = false;
    if (model) {
      for (const e of model.pieces.values()) {
        busy = stepPiece(e, dt, !motion) || busy;
        if (e.cue) cueOn = true;
      }
    }
    if (!motion && !busy && !cueOn && !dirty) return;
    dirty = false;

    lights.setDay(dayT);
    lights.update(clock, dt, motion);
    scene.background.copy(NIGHT.bg).lerp(DAY.bg, dayT);
    scene.fog.color.copy(NIGHT.fog).lerp(DAY.fog, dayT);
    scene.fog.density = NIGHT.density + (DAY.density - NIGHT.density) * dayT;
    renderer.toneMappingExposure = NIGHT.exposure + (DAY.exposure - NIGHT.exposure) * dayT;
    const cu = venue.crowd.mesh.material.uniforms;
    cu.uTime.value = clock;
    cu.uMotion.value = motion ? 1 : 0;
    cu.uHouse.value = dayT;
    cu.uFog.value.copy(scene.fog.color);
    cu.uFogDensity.value = scene.fog.density;
    cu.uWash.value.copy(lights.wash);
    cu.uPulse.value = Math.max(0, cu.uPulse.value - dt * 5);
    venue.crowd.points.material.uniforms.uTime.value = clock;
    venue.crowd.points.material.uniforms.uScale.value = size.h * renderer.getPixelRatio();
    for (const s of venue.haze) {
      const u = s.userData;
      if (motion) s.position.set(u.base.x + Math.sin(clock * 0.07 + u.phase) * 1.5, u.base.y + Math.sin(clock * 0.11 + u.phase) * 0.4, u.base.z);
      s.material.opacity = u.op * (1 - dayT * 0.6);
    }
    if (model) {
      for (const e of model.pieces.values()) if (e.cue) e.ring.material.uniforms.uTime.value = clock;
    }

    renderer.info.reset();
    if (composer) composer.render();
    else renderer.render(scene, camera);

    // התאמת איכות: אם הממוצע איטי מ-24ms (בערך 40 פריימים בשנייה) במשך כשתי שניות – יורדים רמה
    frames++;
    frameSum += dt;
    if (frameSum > 1) {
      fps.avg = frames / frameSum;
      if (!locked && fps.avg < 42 && level < LEVELS.length - 1) {
        slow++;
        if (slow >= 2) {
          level++;
          slow = 0;
          setupComposer();
          applySize();
        }
      } else slow = 0;
      frames = 0;
      frameSum = 0;
    }
  }

  function start() {
    if (!raf && !disposed) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  const onVis = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVis);

  // ---- בחירת חלק לפי נקודה במסך: קודם הקשה ישירה על החלק, אחר כך אזור נדיב, ולבסוף החלק הקרוב במסך ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  function pick(clientX, clientY) {
    if (!model) return null;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = [...model.pieces.values()];
    for (const key of ['hitExact', 'hitWide']) {
      const hits = ray.intersectObjects(list.map((e) => e[key]), false);
      if (hits.length) return hits[0].object.userData.pieceId;
    }
    let best = null;
    let bestD = Infinity;
    for (const e of list) {
      tmp.set(...e.layout.hitPos).project(camera);
      const dx = ((tmp.x - ndc.x) * rect.width) / 2;
      const dy = ((tmp.y - ndc.y) * rect.height) / 2;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = e.id;
      }
    }
    return bestD < Math.max(60, rect.width * 0.08) ? best : null;
  }

  // נקודות לתוויות: מתחת למרכז כל חלק, בפיקסלים של הקנבס
  function anchors() {
    if (!model) return [];
    return [...model.pieces.values()].map((e) => {
      const p = e.layout;
      tmp.set(...p.hitPos);
      if (p.kind !== 'kick') tmp.y -= p.kind === 'tom' || p.kind === 'snare' || p.kind === 'floor' ? 0.0 : 0.02;
      tmp.project(camera);
      const r = p.kind === 'kick' ? 0 : p.r;
      // רדיוס החלק במסך – התווית יושבת על השפה הקרובה
      const edge = new THREE.Vector3(...p.hitPos).add(new THREE.Vector3(0, 0, r)).project(camera);
      // התווית נשארת בתוך המסך גם כשהחלק נחתך בשפה
      const x = Math.min(size.w - 36, Math.max(36, ((tmp.x + 1) / 2) * size.w));
      const y = Math.min(size.h - 26, ((1 - edge.y) / 2) * size.h);
      return { id: e.id, x, y };
    });
  }

  function hit(id, amp = 1) {
    const e = model?.pieces.get(id);
    if (!e) return;
    startHit(e, amp);
    startFlash(e, 'hit', amp);
    if (e.kind === 'kick') {
      lights.flash(0.45 * amp);
      venue.crowd.mesh.material.uniforms.uPulse.value = 1;
    } else if (e.kind === 'crash' || e.kind === 'china' || e.kind === 'splash') lights.flash(0.9 * amp);
    else if (e.kind === 'snare') lights.flash(0.15 * amp);
    dirty = true;
  }

  function flash(id, cls) {
    const e = model?.pieces.get(id);
    if (!e) return;
    if (cls === 'hit') hit(id, 0.6);
    else startFlash(e, cls, 1.2);
    dirty = true;
  }

  function cues(now, soon) {
    if (!model) return;
    for (const e of model.pieces.values()) setCue(e, now.has(e.id) ? 'now' : soon.has(e.id) ? 'soon' : null);
    dirty = true;
  }

  function stats() {
    const i = renderer.info;
    return { fps: Math.round(fps.avg), level, dpr: renderer.getPixelRatio(), bloom: !!composer, calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }

  function dispose() {
    disposed = true;
    stop();
    document.removeEventListener('visibilitychange', onVis);
    if (model) disposeKit(model);
    lights.dispose();
    composer?.dispose();
    env.dispose();
    scene.traverse((o) => {
      if (o.isMesh || o.isPoints) {
        o.geometry?.dispose?.();
        if (o.material?.isShaderMaterial) o.material.dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  setupComposer();
  start();
  return { setKit, resize, hit, flash, cues, pick, anchors, setDark, setMotion: (m) => { motion = m; dirty = true; }, stats, dispose, renderer };
}

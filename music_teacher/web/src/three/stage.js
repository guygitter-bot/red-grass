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

const ease = (t) => t * t * (3 - 2 * t);
const rad = Math.PI / 180;

export function createStage(canvas, labelsEl, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);

  const hemi = new THREE.HemisphereLight(0xfff3e2, 0x4a3828, 0.9);
  const key = new THREE.DirectionalLight(0xffe9cc, 1.0);
  key.position.set(-20, 70, 70);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 0.35);
  rim.position.set(40, 30, -50);
  const warm = new THREE.PointLight(0xffa640, 0.4, 200, 1.6);
  warm.position.set(10, 25, 40);
  scene.add(hemi, key, rim, warm);

  // רצפה וצל רך מתחת לשרפרף
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(48, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(8, -30.05, 12);
  scene.add(floor);
  let shadowTex = null;
  {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(2, -30.0, 18);
    scene.add(sh);
  }

  // ----- נושא (בהיר / כהה) -----
  let dark = false;
  function readTheme() {
    dark = document.documentElement.classList.contains('dark');
    const cs = getComputedStyle(document.documentElement);
    const c = cs.getPropertyValue('--color-scene').trim() || '#d9d3ca';
    const col = new THREE.Color(c);
    renderer.setClearColor(col, 1);
    floorMat.color.copy(col).multiplyScalar(dark ? 1.35 : 0.9);
    hemi.intensity = dark ? 0.75 : 0.95;
    key.intensity = dark ? 0.95 : 0.9;
    warm.intensity = dark ? 0.7 : 0.35;
  }
  readTheme();
  const mo = new MutationObserver(readTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
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
    const left = (waveEnd - performance.now()) / 1000;
    if (left > 0.3) teacher.wave(left);
    guitar.group.updateMatrixWorld(true);
    teacher.update(0.016, performance.now() / 1000);
  }

  function build() {
    if (teacher) {
      scene.remove(teacher.group);
      teacher.dispose();
    }
    if (guitar) {
      scene.remove(guitar.group);
      guitar.dispose();
    }
    guitar = createGuitar(type);
    scene.add(guitar.group);
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
  const rig = { target: new THREE.Vector3(6, 14, 8), dist: 118, az: 8 * rad, el: 6 * rad, k: 1 };
  let from = null;
  let to = null;
  let tStart = 0;
  const drag = { az: 0, el: 0 };
  let size = { w: 1, h: 1 };

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
  function resolve(name) {
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
    const goal = resolve(name);
    to = goal;
    if (o.instant || reduced()) {
      rig.target.copy(goal.target);
      rig.dist = goal.dist;
      rig.k = goal.k;
      rig.az = goal.az;
      rig.el = goal.el;
      from = null;
      to = null;
      drag.az = drag.el = 0;
      return;
    }
    from = { target: rig.target.clone(), dist: rig.dist, az: rig.az, el: rig.el, k: rig.k };
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
    camera.lookAt(rig.target);
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
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // שינוי גודל (סיבוב מסך וכו'): מחשבים מחדש את המסגור, אלא אם באמצע מעבר
    if (guitar && teacher && !to) {
      const g = resolve(camName);
      rig.target.copy(g.target);
      rig.dist = g.dist;
      rig.k = g.k;
    }
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ----- לולאת ציור -----
  let raf = 0;
  let last = performance.now();
  let alive = true;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = performance.now() / 1000;
    if (guitar && teacher) {
      applyCamera();
      lookTarget.copy(camera.position);
      teacher.setLookTarget(lookTarget);
      teacher.update(dt, t);
      guitar.update(dt, t);
      placeLabels(size.w, size.h);
    }
    renderer.render(scene, camera);
  }

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
      leftSpec = spec;
      teacher.setLeftHand(spec);
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
    get guitar() { return guitar; },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(flashTimer);
      ro.disconnect();
      mo.disconnect();
      clearLabels();
      if (teacher) teacher.dispose();
      if (guitar) guitar.dispose();
      shadowTex && shadowTex.dispose();
      floor.geometry.dispose();
      floorMat.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* לא קריטי */ }
    },
  };
}

export { PART_NAMES };

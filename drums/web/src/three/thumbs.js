// תמונות קטנות של כל סט לכרטיסי הסטים: מצלמים כל סט פעם אחת מצד הקהל (רואים את העור הקדמי של הבס),
// ברנדרר אחד מחוץ למסך, ושומרים כ-dataURL בזיכרון לכל זמן השימוש.
import * as THREE from 'three';
import { finishOf } from '../lib/finish';
import { buildKit, disposeKit } from './kitModel';
import { buildEnvironment, stageFloor } from './materials';

const cache = new Map();

export function cachedThumb(kit) {
  return cache.get(thumbKey(kit)) || null;
}

function thumbKey(kit) {
  return `${kit.pieces.join(',')}|${finishOf(kit)}`;
}

// kits = רשימת סטים; onThumb(kit, url) נקרא לכל תמונה מוכנה. מחזיר פונקציית ביטול
export function renderThumbs(kits, onThumb, { w = 420, h = 280 } = {}) {
  let cancelled = false;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch {
    return () => {};
  }
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07050b);
  scene.fog = new THREE.Fog(0x07050b, 4, 9);
  const env = buildEnvironment(renderer);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.6;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), stageFloor());
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.HemisphereLight(0x5a4a80, 0x080610, 0.5));
  const key = new THREE.SpotLight(0xffe2bf, 22, 10, 0.55, 0.6, 1.5);
  key.position.set(-1.6, 3.6, -2.6);
  key.target.position.set(0, 0.5, 0);
  const pink = new THREE.SpotLight(0xff2d87, 18, 10, 0.5, 0.7, 1.5);
  pink.position.set(2.6, 2.8, 0.8);
  pink.target.position.set(0, 0.6, -0.2);
  const amber = new THREE.SpotLight(0xffa020, 14, 10, 0.5, 0.7, 1.5);
  amber.position.set(-2.4, 2.2, 1.6);
  amber.target.position.set(0, 0.6, 0);
  scene.add(key, key.target, pink, pink.target, amber, amber.target);
  const camera = new THREE.PerspectiveCamera(33, w / h, 0.1, 30);
  camera.position.set(-0.55, 1.32, -2.9);
  camera.lookAt(-0.12, 0.64, 0.05);

  const queue = kits.filter((k) => !cache.has(thumbKey(k)));
  const next = () => {
    if (cancelled) return;
    const kit = queue.shift();
    if (!kit) {
      finish();
      return;
    }
    const model = buildKit(kit, finishOf(kit), 'wide');
    scene.add(model.group);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/jpeg', 0.84);
    scene.remove(model.group);
    disposeKit(model);
    cache.set(thumbKey(kit), url);
    onThumb(kit, url);
    // תמונה אחת בכל פעם, בלי לתקוע את המסך
    setTimeout(next, 30);
  };
  let done = false;
  function finish() {
    if (done) return;
    done = true;
    env.dispose();
    floor.geometry.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  setTimeout(next, 60);
  return () => {
    if (cancelled) return;
    cancelled = true;
    finish();
  };
}

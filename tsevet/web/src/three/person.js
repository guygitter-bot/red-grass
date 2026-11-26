// דמות של בוט במשרד: גוף עם מפרקים (ירכיים, ברכיים, כתפיים, מרפקים, ראש) שבנוי מצורות פשוטות,
// ותנוחות שמחושבות בכל פריים: הליכה, עמידה, ישיבה, הקלדה, דיבור. המראה (שיער, בגדים, אביזרים) – מ-looks.js.
// הדמות פונה ל-+z; root.rotation.y קובע לאן היא מסתכלת.
import * as THREE from 'three';

const mats = new Map();
function mat(color, opts = {}) {
  const k = `${color}|${opts.rough ?? 0.75}|${opts.metal ?? 0}|${opts.emissive || ''}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0, ...(opts.emissive ? { emissive: opts.emissive, emissiveIntensity: 0.6 } : {}) }));
  return mats.get(k);
}

const geo = {
  cap: (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14),
  ball: (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h),
};

function mesh(g, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

// מסת שיער לפי סגנון
function buildHair(head, look) {
  const m = mat(look.hairColor, { rough: 0.85 });
  const R = 0.128;
  const cap = (theta, sx = 1.07, sy = 1.08, sz = 1.08, tilt = -0.3) => {
    const o = mesh(new THREE.SphereGeometry(R, 24, 16, 0, Math.PI * 2, 0, theta), m, 0, 0.012, -0.008);
    o.scale.set(sx, sy, sz);
    o.rotation.x = tilt;
    head.add(o);
    return o;
  };
  // מעטפת סביב הראש, פתוחה מלפנים (לפנים)
  const shell = (theta, open, sy, y) => {
    const o = mesh(new THREE.SphereGeometry(R * 1.1, 24, 18, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, theta), m, 0, y, -0.01);
    o.scale.set(1.04, sy, 1.06);
    o.material.side = THREE.DoubleSide;
    head.add(o);
  };
  switch (look.hair) {
    case 'short':
      cap(Math.PI * 0.55);
      break;
    case 'pixie':
      cap(Math.PI * 0.5, 1.06, 1.06, 1.07, -0.15);
      head.add(mesh(geo.ball(0.05), m, 0.05, 0.1, 0.09));
      break;
    case 'messy':
      cap(Math.PI * 0.55);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        head.add(mesh(geo.ball(0.042, 10, 8), m, Math.cos(a) * 0.07, 0.12 + (i % 3) * 0.012, Math.sin(a) * 0.06 + 0.02));
      }
      break;
    case 'curly': {
      cap(Math.PI * 0.5);
      const n = look.female ? 46 : 26;
      for (let i = 0; i < n; i++) {
        const u = (i * 0.618) % 1;
        const v = i / n;
        const theta = (look.female ? 0.05 + v * 0.62 : 0.05 + v * 0.42) * Math.PI;
        const phi = u * Math.PI * 2;
        const x = Math.sin(theta) * Math.cos(phi);
        const z = Math.sin(theta) * Math.sin(phi);
        // לא על הפנים
        if (z > 0.45 && theta > 0.3 * Math.PI) continue;
        head.add(mesh(geo.ball(0.04 + (i % 3) * 0.008, 10, 8), m, x * 0.14, Math.cos(theta) * 0.15 + 0.01, z * 0.14 - 0.01));
      }
      break;
    }
    case 'bob':
      cap(Math.PI * 0.55);
      shell(Math.PI * 0.72, 0.55, 1.05, 0.0);
      break;
    case 'straight':
      cap(Math.PI * 0.55, 1.07, 1.08, 1.08, -0.1);
      shell(Math.PI * 0.82, 0.62, 1.35, 0.03);
      break;
    case 'long': {
      cap(Math.PI * 0.55);
      shell(Math.PI * 0.8, 0.6, 1.3, 0.02);
      const back = mesh(geo.cap(0.1, 0.22), m, 0, -0.17, -0.07);
      back.scale.set(1.35, 1, 0.6);
      head.add(back);
      break;
    }
    default:
      cap(Math.PI * 0.5);
  }
}

function buildFace(head, look) {
  const skin = mat(look.skin, { rough: 0.6 });
  const dark = mat('#1a1416', { rough: 0.4 });
  const white = mat('#f4f1ec', { rough: 0.4 });
  for (const s of [-1, 1]) {
    head.add(mesh(geo.ball(0.019, 12, 10), white, s * 0.043, 0.01, 0.106));
    head.add(mesh(geo.ball(0.012, 10, 8), dark, s * 0.043, 0.01, 0.12));
    const brow = mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), mat(look.hairColor), s * 0.044, 0.045, 0.117);
    brow.rotation.z = s * -0.12;
    head.add(brow);
    head.add(mesh(geo.ball(0.026, 10, 8), skin, s * 0.125, -0.005, 0));
  }
  head.add(mesh(geo.ball(0.02, 10, 8), skin, 0, -0.018, 0.128));
  const mouth = mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), mat('#8c4a46'), 0, -0.058, 0.113);
  head.add(mouth);
  return mouth;
}

function buildExtras(p, look) {
  const { head, chest } = p;
  const ex = look.extra || [];
  if (ex.includes('glasses')) {
    const m = mat('#2b2b30', { rough: 0.3, metal: 0.4 });
    for (const s of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 20), m, s * 0.044, 0.01, 0.125);
      head.add(ring);
    }
    head.add(mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), m, 0, 0.015, 0.128));
  }
  if (ex.includes('beard') || ex.includes('stubble')) {
    const b = mesh(new THREE.SphereGeometry(0.126, 20, 12, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.4), mat(look.hairColor, { rough: 0.95 }), 0, 0.005, 0.012);
    b.scale.set(1.02, 1.05, 1.06);
    if (ex.includes('stubble')) {
      b.material = new THREE.MeshStandardMaterial({ color: look.hairColor, roughness: 1, transparent: true, opacity: 0.35 });
    }
    head.add(b);
  }
  if (ex.includes('headphones')) {
    const m = mat('#151518', { rough: 0.4 });
    const band = mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 24, Math.PI), m, 0, 0.02, -0.01);
    head.add(band);
    for (const s of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 18), m, s * 0.145, 0.0, -0.005);
      cup.rotation.z = Math.PI / 2;
      head.add(cup);
    }
    // אוזניות מוצבות על הצוואר אצל המתכנת? פשוט על הראש
  }
  if (ex.includes('cap')) {
    const m = mat('#4b5a3a', { rough: 0.9 });
    const dome = mesh(new THREE.SphereGeometry(0.138, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m, 0, 0.03, -0.005);
    head.add(dome);
    const brim = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.014, 20, 1, false, -Math.PI / 2, Math.PI), m, 0, 0.04, 0.11);
    brim.scale.set(1.25, 1, 1.1);
    head.add(brim);
  }
  if (ex.includes('scarf')) {
    const colors = ['#d94f3d', '#2e8b8b', '#e6b23a'];
    colors.forEach((c, i) => {
      const t = mesh(new THREE.TorusGeometry(0.085 - i * 0.004, 0.025, 8, 20), mat(c, { rough: 0.9 }), 0, 0.47 - i * 0.03, 0.005);
      t.rotation.x = Math.PI / 2;
      chest.add(t);
    });
    chest.add(mesh(new THREE.BoxGeometry(0.06, 0.18, 0.03), mat('#d94f3d', { rough: 0.9 }), 0.04, 0.33, 0.15));
  }
  if (ex.includes('stethoscope')) {
    const m = mat('#3a3d44', { rough: 0.4, metal: 0.3 });
    const t = mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 24, Math.PI * 1.2), m, 0, 0.4, 0.05);
    t.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI * 0.9);
    chest.add(t);
    chest.add(mesh(geo.ball(0.022), mat('#c7ccd4', { metal: 0.6, rough: 0.3 }), 0.05, 0.25, 0.16));
  }
  if (ex.includes('tie')) {
    const tie = mesh(new THREE.BoxGeometry(0.035, 0.2, 0.012), mat('#7a1f2b', { rough: 0.6 }), 0, 0.33, 0.158);
    chest.add(tie);
  }
}

// בונה דמות. מחזיר אובייקט עם המפרקים ומצב התנועה
export function buildPerson(look) {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);
  const pants = mat(look.pants, { rough: 0.85 });
  const topM = mat(look.top, { rough: 0.8 });
  const outer = look.jacket ? mat(look.jacket, { rough: 0.7 }) : topM;
  const skin = mat(look.skin, { rough: 0.6 });
  const shoe = mat('#1b1b20', { rough: 0.5 });
  const sw = look.female ? 0.9 : 1;

  const pelvis = mesh(geo.cap(0.13, 0.1), pants, 0, 0.0, 0);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.scale.set(1, 1, 0.8);
  hips.add(pelvis);

  const chest = new THREE.Group();
  chest.position.y = 0.03;
  hips.add(chest);
  const torso = mesh(geo.cap(0.16, 0.28), outer, 0, 0.27, 0);
  torso.scale.set(1.2 * sw, 1, 0.78);
  chest.add(torso);
  if (look.jacket) {
    // חולצה מתחת לז'קט (משולש מלפנים)
    const shirt = mesh(new THREE.CylinderGeometry(0.06, 0.005, 0.16, 3), topM, 0, 0.4, 0.112);
    shirt.rotation.y = Math.PI;
    shirt.scale.set(1, 1, 0.35);
    chest.add(shirt);
  }
  chest.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 12), skin, 0, 0.5, 0));

  const head = new THREE.Group();
  head.position.y = 0.68;
  // ראש קצת גדול (סגנון משחק) – רואים את הפנים גם מלמעלה
  head.scale.setScalar(1.18);
  chest.add(head);
  const skull = mesh(geo.ball(0.125, 26, 20), skin);
  skull.scale.set(0.93, 1.08, 1);
  head.add(skull);
  const mouth = buildFace(head, look);
  buildHair(head, look);

  const arm = (s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.215 * sw, 0.43, 0);
    chest.add(sh);
    sh.add(mesh(geo.ball(0.07), outer, 0, 0, 0));
    sh.add(mesh(geo.cap(0.052, 0.2), outer, 0, -0.15, 0));
    const el = new THREE.Group();
    el.position.y = -0.29;
    sh.add(el);
    el.add(mesh(geo.cap(0.046, 0.19), look.jacket ? outer : skin, 0, -0.12, 0));
    el.add(mesh(geo.ball(0.048), skin, 0, -0.27, 0.01));
    return { sh, el };
  };
  const leg = (s) => {
    const hp = new THREE.Group();
    hp.position.set(s * 0.09, -0.02, 0);
    hips.add(hp);
    hp.add(mesh(geo.cap(0.072, 0.3), pants, 0, -0.21, 0));
    const kn = new THREE.Group();
    kn.position.y = -0.44;
    hp.add(kn);
    kn.add(mesh(geo.cap(0.06, 0.3), pants, 0, -0.2, 0));
    const foot = mesh(geo.cap(0.05, 0.1), shoe, 0, -0.43, 0.05);
    foot.rotation.x = Math.PI / 2;
    kn.add(foot);
    return { hp, kn };
  };

  const p = { root, hips, chest, head, mouth, L: arm(-1), R: arm(1), LL: leg(-1), RL: leg(1), look, sit: 0, phase: Math.random() * 6, seed: Math.random() * 100 };
  buildExtras(p, look);
  return p;
}

const lerp = (a, b, k) => a + (b - a) * k;

// תנוחה לפריים. st = { walking, speed, sitTarget, typing, talking, looking } ; t = זמן בשניות ; dt = זמן מהפריים הקודם
export function posePerson(p, st, t, dt) {
  const { hips, chest, head, L, R, LL, RL } = p;
  // קימה / ישיבה הדרגתית
  const k = Math.min(1, dt * 3.2);
  // קימה / ישיבה בקצב קבוע (בערך חצי שנייה)
  const goal = st.sitTarget ? 1 : 0;
  p.sit += Math.sign(goal - p.sit) * Math.min(Math.abs(goal - p.sit), dt * 2.2);
  const s = p.sit;
  const tt = t + p.seed;

  if (st.walking) p.phase += dt * (st.speed || 1.3) * 5.2;
  const ph = p.phase;
  const w = st.walking ? 1 : 0;

  // רגליים: הליכה / ישיבה / עמידה
  const swing = Math.sin(ph) * 0.55 * w;
  LL.hp.rotation.x = lerp(swing, -Math.PI / 2, s);
  RL.hp.rotation.x = lerp(-swing, -Math.PI / 2, s);
  LL.kn.rotation.x = lerp(Math.max(0, -Math.sin(ph - 0.9)) * 0.9 * w, Math.PI / 2 - 0.05, s);
  RL.kn.rotation.x = lerp(Math.max(0, Math.sin(ph - 0.9)) * 0.9 * w, Math.PI / 2 - 0.05, s);

  // גובה הירכיים: נשימה, קפיצה קטנה בהליכה, ישיבה על הכיסא
  const breathe = Math.sin(tt * 1.6) * 0.004;
  hips.position.y = lerp(0.92 + Math.abs(Math.cos(ph)) * 0.025 * w + breathe, 0.5, s);
  hips.position.z = lerp(0, -0.05, s);
  hips.rotation.y = Math.sin(ph) * 0.08 * w;

  // גוו
  const typing = st.typing && s > 0.6;
  const lean = typing ? 0.16 : s > 0.6 ? -0.06 + Math.sin(tt * 0.4) * 0.03 : 0.03 * w;
  chest.rotation.x = lerp(chest.rotation.x, lean, k);
  chest.rotation.y = -Math.sin(ph) * 0.1 * w;
  chest.scale.y = 1 + Math.sin(tt * 1.6) * 0.008;

  // ידיים
  let lsh = Math.sin(ph) * -0.45 * w;
  let rsh = Math.sin(ph) * 0.45 * w;
  let lel = -0.25 - 0.2 * w;
  let rel = -0.25 - 0.2 * w;
  let lz = 0.08;
  let rz = -0.08;
  if (typing) {
    lsh = -0.95;
    rsh = -0.95;
    lel = -0.75 + Math.sin(tt * 19) * 0.07;
    rel = -0.75 + Math.sin(tt * 17 + 1.3) * 0.07;
    lz = 0.18;
    rz = -0.18;
  } else if (s > 0.6) {
    // יושב בנחת: יד אחת על השולחן, מדי פעם לוגם קפה
    const sip = Math.max(0, Math.sin(tt * 0.22)) > 0.93;
    lsh = -0.55;
    lel = -0.9;
    rsh = sip ? -1.1 : -0.5;
    rel = sip ? -2.1 : -0.8;
    lz = 0.12;
    rz = -0.12;
  } else if (st.talking) {
    // מדבר עם בוט אחר: תנועות ידיים
    rsh = -0.5 + Math.sin(tt * 2.1) * 0.25;
    rel = -1.2 + Math.sin(tt * 3.3) * 0.3;
    lsh = -0.15 + Math.sin(tt * 1.7 + 1) * 0.1;
    lel = -0.4;
    rz = -0.25;
  }
  L.sh.rotation.x = lerp(L.sh.rotation.x, lsh, typing ? 1 : k * 2);
  R.sh.rotation.x = lerp(R.sh.rotation.x, rsh, typing ? 1 : k * 2);
  L.el.rotation.x = lerp(L.el.rotation.x, lel, typing ? 1 : k * 2);
  R.el.rotation.x = lerp(R.el.rotation.x, rel, typing ? 1 : k * 2);
  L.sh.rotation.z = lerp(L.sh.rotation.z, -lz, k);
  R.sh.rotation.z = lerp(R.sh.rotation.z, -rz, k);

  // ראש: מסתכל על המסך / מסביב / מהנהן כשמדבר
  let hy = Math.sin(tt * 0.35) * 0.45 + Math.sin(tt * 0.13) * 0.2;
  let hx = Math.sin(tt * 0.5) * 0.05;
  if (typing) {
    hy = Math.sin(tt * 0.6) * 0.12;
    hx = 0.18 + Math.sin(tt * 2.5) * 0.02;
  } else if (st.talking) {
    hy = Math.sin(tt * 0.9) * 0.15;
    hx = Math.sin(tt * 4.2) * 0.07;
  } else if (st.walking) {
    hy = 0;
    hx = 0.05;
  } else if (st.looking) {
    hy = Math.sin(tt * 0.25) * 0.6;
    hx = -0.08;
  }
  head.rotation.y = lerp(head.rotation.y, hy, k);
  head.rotation.x = lerp(head.rotation.x, hx, k);
  // פה זז כשמדבר
  p.mouth.scale.y = st.talking ? 1 + Math.abs(Math.sin(tt * 11)) * 3 : 1;
}

// גלריה לדוגמה לדפדפן (ולבדיקות): תמונות מצוירות, עם כפולות, רצפים, מטושטשות, חשוכות וצילומי מסך
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 1, 12);

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SCENES = [
  { emoji: '🍕', label: 'Food', bg: ['#f59e0b', '#b45309'], bucket: 'Camera' },
  { emoji: '🥗', label: 'Dish', bg: ['#84cc16', '#3f6212'], bucket: 'WhatsApp Images' },
  { emoji: '🐶', label: 'Dog', bg: ['#a3e635', '#65a30d'], bucket: 'Camera' },
  { emoji: '🐱', label: 'Cat', bg: ['#fbbf24', '#92400e'], bucket: 'Camera' },
  { emoji: '🙂', label: 'Selfie', bg: ['#f9a8d4', '#be185d'], bucket: 'Camera' },
  { emoji: '👨‍👩‍👧', label: 'Smile', bg: ['#fda4af', '#9f1239'], bucket: 'WhatsApp Images' },
  { emoji: '⛰️', label: 'Mountain', bg: ['#7dd3fc', '#0369a1'], bucket: 'Camera' },
  { emoji: '🌊', label: 'Sea', bg: ['#38bdf8', '#1e3a8a'], bucket: 'Camera' },
  { emoji: '🌸', label: 'Flower', bg: ['#f0abfc', '#86198f'], bucket: 'Camera' },
  { emoji: '🧾', label: 'Receipt', bg: ['#e5e7eb', '#9ca3af'], bucket: 'Camera' },
  { emoji: '📄', label: 'Paper', bg: ['#f3f4f6', '#d1d5db'], bucket: 'Download' },
  { emoji: '🏙️', label: 'Building', bg: ['#94a3b8', '#334155'], bucket: 'Camera' },
  { emoji: '🚗', label: 'Car', bg: ['#fca5a5', '#7f1d1d'], bucket: 'Camera' },
  { emoji: '🎂', label: 'Party', bg: ['#c4b5fd', '#5b21b6'], bucket: 'WhatsApp Images' },
  { emoji: '😂', label: 'Fun', bg: ['#fde68a', '#ca8a04'], bucket: 'WhatsApp Images' },
];

function hex16(r) {
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}

function flip(hash, bits, r) {
  let a = BigInt('0x' + hash);
  for (let i = 0; i < bits; i++) a ^= 1n << BigInt(Math.floor(r() * 64));
  return a.toString(16).padStart(16, '0');
}

let built = null;

function build() {
  if (built) return built;
  const r = rng(7);
  const photos = [];
  const feats = {};
  const art = {};
  let id = 1000;
  const add = (scene, date, extra = {}) => {
    const pid = String(id++);
    const p = {
      id: pid,
      name: extra.name || `IMG_${new Date(date).toISOString().slice(0, 10).replace(/-/g, '')}_${pid}.jpg`,
      date,
      mod: date,
      size: extra.size || Math.round((1.5 + r() * 3.5) * 1024 * 1024),
      w: extra.w || 4000,
      h: extra.h || 3000,
      bucket: extra.bucket || scene.bucket,
      path: extra.bucket === 'Screenshots' ? 'Pictures/Screenshots/' : `DCIM/${extra.bucket || scene.bucket}/`,
      mime: 'image/jpeg',
      fav: !!extra.fav,
    };
    photos.push(p);
    feats[pid] = {
      hash: extra.hash || hex16(r),
      sharp: extra.sharp ?? 180 + r() * 400,
      bright: extra.bright ?? 90 + r() * 90,
      labels: extra.labels || [[scene.label, 0.82]],
    };
    art[pid] = { scene, dx: extra.dx || 0, blur: extra.blur || 0, dark: !!extra.dark, shot: !!extra.shot };
    return pid;
  };
  for (let i = 0; i < 70; i++) {
    const scene = SCENES[Math.floor(r() * SCENES.length)];
    const date = NOW - Math.floor(r() * 400) * DAY - Math.floor(r() * DAY);
    const roll = r();
    if (roll < 0.22) {
      // רצף של 3–5 צילומים כמעט זהים
      const base = hex16(r);
      const k = 3 + Math.floor(r() * 3);
      for (let j = 0; j < k; j++) {
        add(scene, date + j * 4000, { hash: j ? flip(base, 3 + Math.floor(r() * 5), r) : base, dx: j * 6, sharp: j === 1 ? 600 : 150 + r() * 300 });
      }
    } else if (roll < 0.32) {
      // אותה תמונה פעמיים (נשמרה שוב מוואטסאפ)
      const h = hex16(r);
      add(scene, date, { hash: h });
      add(scene, date + 20 * DAY, { hash: flip(h, 1, r), bucket: 'WhatsApp Images', size: 300 * 1024, w: 1600, h: 1200 });
    } else if (roll < 0.4) {
      add(scene, date, { sharp: 4 + r() * 6, blur: 6 });
    } else if (roll < 0.45) {
      add(scene, date, { bright: 8 + r() * 10, dark: true, sharp: 3 });
    } else {
      add(scene, date, { fav: r() < 0.08 });
    }
  }
  for (let i = 0; i < 14; i++) {
    const date = NOW - Math.floor(r() * 300) * DAY;
    add(SCENES[10], date, {
      bucket: 'Screenshots',
      name: `Screenshot_${pid8(i)}.png`,
      w: 1080,
      h: 2400,
      size: 400 * 1024 + Math.round(r() * 600 * 1024),
      labels: [['Text', 0.7]],
      shot: true,
    });
  }
  photos.sort((a, b) => b.date - a.date);
  built = { photos, feats, art };
  return built;
}

function pid8(i) {
  return String(20250000 + i * 37);
}

export async function list() {
  return build().photos.map((p) => ({ ...p }));
}

export async function analyze(ids) {
  const { feats } = build();
  await new Promise((r) => setTimeout(r, 40));
  return ids.map((id) => ({ id, ...(feats[id] || { err: true }) }));
}

export async function trash(ids) {
  const b = build();
  const gone = new Set(ids);
  b.photos = b.photos.filter((p) => !gone.has(p.id));
  return true;
}

// ציור התמונה (רק בדפדפן)
export async function thumb(id, size) {
  const { art, photos } = build();
  const a = art[id];
  const p = photos.find((x) => x.id === id);
  if (!a || !p || typeof document === 'undefined') return null;
  const ratio = p.h / p.w;
  const w = ratio > 1 ? Math.round(size / ratio) : size;
  const h = ratio > 1 ? size : Math.round(size * ratio);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (a.shot) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, w, h * 0.08);
    ctx.fillStyle = '#cbd5e1';
    for (let y = h * 0.14; y < h * 0.9; y += h * 0.07) ctx.fillRect(w * 0.08, y, w * (0.5 + ((y * 7) % 30) / 100), h * 0.025);
    return c.toDataURL('image/jpeg', 0.8);
  }
  if (a.blur) ctx.filter = `blur(${Math.max(2, Math.round((a.blur * size) / 200))}px)`;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a.scene.bg[0]);
  g.addColorStop(1, a.scene.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, w + 40, h + 40);
  ctx.font = `${Math.round(Math.min(w, h) * 0.55)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(a.scene.emoji, w / 2 + (a.dx * size) / 200, h / 2);
  if (a.dark) {
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, w, h);
  }
  return c.toDataURL('image/jpeg', 0.8);
}

// התצוגה המקדימה: מנגנת את ציר הזמן בדפדפן – וידאו, תמונות, אודיו, טקסטים וכתוביות – מסונכרנים לשעון אחד.
// הטקסטים מצוירים ב-CSS כך שייראו כמו בייצוא (server/ass.js) – שינוי כאן מחייב שינוי שם.
import { S, on, emit, h, t, total, clipEnd, mediaOf, trackOf, clamp, api, select, seek } from './state.js';

const stage = () => document.getElementById('stage');
const pool = new Map(); // קטע -> אלמנט מדיה
const overlays = new Map(); // קטע טקסט -> אלמנט
let capEl = null;
let clock = null; // { at: זמן בציר, now: performance.now() }
let actx = null;
const gains = new WeakMap();

export const fontFactor = (family) => S.meta.fonts.find((f) => f.family === family)?.factor || 1.4;

const rgba = (hex, a) => {
  const n = parseInt((hex || '#000000').slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// קו מתאר עגול סביב האותיות (כמו ב-libass) בעזרת טבעת של צללים
function ring(w, color) {
  if (w < 0.4) return [];
  const out = [];
  const steps = w > 6 ? 28 : 18;
  for (const r of w > 3 ? [w, w * 0.55] : [w]) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      out.push(`${(Math.cos(a) * r).toFixed(2)}px ${(Math.sin(a) * r).toFixed(2)}px 0 ${color}`);
    }
  }
  return out;
}

// סגנון טקסט -> CSS. px = גודל האות בפיקסלים של התצוגה.
export function textCss(s, px) {
  const css = {
    fontFamily: `"${s.font}", "Heebo", sans-serif`, fontSize: `${px}px`, lineHeight: String(fontFactor(s.font)),
    color: s.color, whiteSpace: 'pre', textAlign: 'center', background: 'none', padding: '0', textShadow: 'none',
  };
  if (s.box) {
    css.background = rgba(s.boxColor, s.boxOpacity ?? 0.75);
    css.padding = `${px * 0.22}px`;
  } else {
    const sh = ring((px * (s.outline || 0)) / 100, s.outlineColor || '#000');
    if (s.shadow) sh.push(`${px * 0.05}px ${px * 0.05}px 0 rgba(0,0,0,0.55)`);
    if (sh.length) css.textShadow = sh.join(',');
  }
  return css;
}

function audioGraph(el) {
  if (!actx || gains.has(el)) return gains.get(el);
  try {
    const g = actx.createGain();
    actx.createMediaElementSource(el).connect(g).connect(actx.destination);
    gains.set(el, g);
    return g;
  } catch { return null; }
}

function setVolume(el, v) {
  const g = audioGraph(el);
  if (g) { el.volume = 1; g.gain.value = v; } else el.volume = clamp(v, 0, 1);
}

function fadeFactor(c, local) {
  let k = 1;
  if (c.fadeIn > 0) k = Math.min(k, local / c.fadeIn);
  if (c.fadeOut > 0) k = Math.min(k, (c.duration - local) / c.fadeOut);
  return clamp(k, 0, 1);
}

function makeEl(c, m) {
  const src = `/media/${encodeURIComponent(m.proxy || m.file)}`;
  let el;
  if (c.type === 'image') el = h('img.lay', { src, draggable: false });
  else if (c.type === 'audio') el = h('audio', { src, preload: 'auto' });
  else el = h('video.lay', { src, preload: 'auto', playsInline: true });
  if (c.type !== 'image') {
    el.setAttribute('playsinline', '');
    el.addEventListener('seeked', () => { if (!S.playing) sync(); });
    el.addEventListener('loadeddata', () => { if (!S.playing) sync(); });
  }
  stage().querySelector('.lays').append(el);
  return el;
}

// מביא את כל האלמנטים למצב שמתאים לזמן הנוכחי
export function sync() {
  const p = S.project;
  if (!p) return;
  const now = S.time;
  const st = stage();
  const H = st.clientHeight, W = st.clientWidth;
  const live = new Set();
  const trackIndex = Object.fromEntries(p.tracks.map((x, i) => [x.id, i]));

  for (const c of p.clips) {
    if (!c.mediaId) continue;
    const local = now - c.start;
    // קטע שעומד להתחיל נטען מראש, כדי שהמעבר יהיה חלק
    if (local < (S.playing ? -1.2 : 0) || local >= c.duration - 0.001) continue;
    const m = mediaOf(c);
    const tr = trackOf(c);
    if (!m || m.status !== 'ready' || !tr) continue;
    live.add(c.id);
    let el = pool.get(c.id);
    if (!el) { el = makeEl(c, m); pool.set(c.id, el); }
    const active = local >= 0;
    if (c.type !== 'audio') {
      const s = c.scale || 1;
      Object.assign(el.style, {
        visibility: active && !tr.hidden ? 'visible' : 'hidden', zIndex: 100 - trackIndex[c.trackId],
        width: `${s * 100}%`, height: `${s * 100}%`, left: `${(c.x ?? 0.5) * 100}%`, top: `${(c.y ?? 0.5) * 100}%`,
        objectFit: c.fit === 'cover' ? 'cover' : 'contain',
      });
    }
    if (c.type === 'image') continue;
    const want = (c.offset || 0) + Math.max(0, local);
    setVolume(el, active && !tr.muted && m.hasAudio ? (c.volume ?? 1) * fadeFactor(c, local) : 0);
    if (active && S.playing) {
      if (el.paused) { if (Math.abs(el.currentTime - want) > 0.05) el.currentTime = want; el.play().catch(() => {}); }
      else if (Math.abs(el.currentTime - want) > 0.3) el.currentTime = want;
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - want) > 0.02 && !el.seeking) el.currentTime = want;
    }
  }
  for (const [id, el] of pool) {
    if (!live.has(id)) { if (el.pause) el.pause(); el.removeAttribute('src'); el.remove(); pool.delete(id); }
  }

  // טקסטים
  const ovs = st.querySelector('.ovs');
  const seen = new Set();
  for (const c of p.clips) {
    if (c.type !== 'text') continue;
    const local = now - c.start;
    if (local < 0 || local >= c.duration || trackOf(c)?.hidden) continue;
    seen.add(c.id);
    let el = overlays.get(c.id);
    if (!el) {
      el = h('div.ov', { dir: 'auto', 'data-id': c.id });
      el.addEventListener('pointerdown', (e) => dragText(e, c.id));
      overlays.set(c.id, el);
      ovs.append(el);
    }
    const key = JSON.stringify([c, H, S.sel.has(c.id)]);
    if (el._key !== key) {
      el._key = key;
      el.textContent = c.text;
      Object.assign(el.style, textCss(c, (c.size / 100) * H), { left: `${c.x * 100}%`, top: `${c.y * 100}%`, zIndex: 300 - trackIndex[c.trackId] });
      el.classList.toggle('sel', S.sel.has(c.id));
    }
    // אנימציית הכניסה
    const d = Math.min(0.28, c.duration / 2);
    const k = clamp(local / d, 0, 1);
    let op = 1, tf = '';
    if (c.anim === 'fade') op = Math.min(k, clamp((c.duration - local) / d, 0, 1));
    else if (c.anim === 'slide') { op = k; tf = ` translateY(${(1 - k) * H * 0.05}px)`; }
    else if (c.anim === 'pop') { op = clamp(local / (d / 2), 0, 1); tf = ` scale(${0.4 + 0.6 * k})`; }
    else if (c.anim === 'zoom') { op = k; tf = ` scale(${1.5 - 0.5 * k})`; }
    el.style.opacity = op;
    el.style.transform = `translate(-50%,-50%)${tf}`;
  }
  for (const [id, el] of overlays) if (!seen.has(id)) { el.remove(); overlays.delete(id); }

  // הכתובית הפעילה
  const cs = p.captionStyle;
  const cap = p.clips.find((c) => c.type === 'caption' && now >= c.start && now < clipEnd(c) && !trackOf(c)?.hidden);
  if (!cap) { if (capEl) { capEl.remove(); capEl = null; } }
  else {
    if (!capEl) { capEl = h('div.ov.cap', { dir: 'auto' }); ovs.append(capEl); }
    const words = cap.words || [];
    let idx = 0;
    words.forEach((w, i) => { if (now - cap.start >= w.s) idx = i; });
    const key = JSON.stringify([cap.id, cap.text, cs, H, cs.mode === 'none' ? 0 : idx]);
    if (capEl._key !== key) {
      capEl._key = key;
      Object.assign(capEl.style, textCss(cs, (cs.size / 100) * H), { left: '50%', top: `${cs.y * 100}%`, transform: 'translate(-50%,-50%)', zIndex: 400 });
      capEl.replaceChildren();
      if (cs.mode === 'none' || !words.length) capEl.textContent = cap.text;
      else if (cs.mode === 'single') capEl.textContent = words[idx].w;
      else {
        words.forEach((w, i) => {
          const lit = cs.mode === 'karaoke' ? i <= idx : i === idx;
          capEl.append(h('span', { style: { color: lit ? cs.highlight : cs.color } }, w.w), i < words.length - 1 ? ' ' : '');
        });
      }
    }
  }
  st.classList.toggle('empty', !p.clips.length);
  void W;
}

// גרירת טקסט על המסך כדי למקם אותו
function dragText(e, id) {
  if (S.playing) return;
  e.preventDefault();
  select(id);
  const c = S.project.clips.find((x) => x.id === id);
  const r = stage().getBoundingClientRect();
  const x0 = c.x, y0 = c.y, px = e.clientX, py = e.clientY;
  let moved = false;
  const move = (ev) => {
    moved = true;
    c.x = clamp(x0 + (ev.clientX - px) / r.width, 0, 1);
    c.y = clamp(y0 + (ev.clientY - py) / r.height, 0, 1);
    // נצמד למרכז
    if (Math.abs(c.x - 0.5) < 0.015) c.x = 0.5;
    sync();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (moved) api('update_clip', { clipId: id, patch: { x: +c.x.toFixed(4), y: +c.y.toFixed(4) } }).catch(() => {});
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function tick() {
  if (!S.playing) return;
  const end = total();
  S.time = clock.at + (performance.now() - clock.now) / 1000;
  if (S.time >= end) { S.time = end; pause(); emit('time'); return; }
  emit('time');
  requestAnimationFrame(tick);
}

export function play() {
  if (S.playing || !total()) return;
  if (S.time >= total() - 0.02) S.time = 0;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { actx = null; }
  S.playing = true;
  clock = { at: S.time, now: performance.now() };
  emit('playing');
  requestAnimationFrame(tick);
}

export function pause() {
  if (!S.playing) return;
  S.playing = false;
  emit('playing');
  sync();
}

export const toggle = () => (S.playing ? pause() : play());

export function step(frames) {
  pause();
  const fps = S.project.settings.fps;
  seek(Math.round(S.time * fps + frames) / fps);
}

// גודל הבמה לפי יחס הפריים של הפרויקט
export function layoutStage() {
  const st = stage();
  const box = st.parentElement.getBoundingClientRect();
  const { width, height } = S.project.settings;
  const k = Math.min(box.width / width, box.height / height);
  st.style.width = `${Math.floor(width * k)}px`;
  st.style.height = `${Math.floor(height * k)}px`;
  sync();
}

export function initPlayer() {
  on('time', () => {
    if (S.playing && clock && Math.abs(S.time - (clock.at + (performance.now() - clock.now) / 1000)) > 0.05) clock = { at: S.time, now: performance.now() };
    sync();
  });
  on('project', layoutStage);
  on('sel', sync);
  on('lang', sync);
  new ResizeObserver(layoutStage).observe(stage().parentElement);
  document.fonts?.addEventListener?.('loadingdone', () => { for (const el of overlays.values()) el._key = ''; if (capEl) capEl._key = ''; sync(); });
  stage().addEventListener('pointerdown', (e) => { if (e.target === stage() || e.target.classList.contains('lay')) select([]); });
}

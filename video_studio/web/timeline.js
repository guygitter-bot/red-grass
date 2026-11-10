// ציר הזמן: שכבות, קטעים, גרירה, קיצוץ, זום, סמן, סימון טווח ושתיקות.
// הציר תמיד משמאל לימין (גם בעברית), כמו בכל תוכנת עריכה.
import { S, on, emit, h, t, icon, fmt, api, total, clipEnd, mediaOf, clamp, seek, select, label, isMobile } from './state.js';

const HEAD = () => (isMobile() ? 44 : 76);
const MIN_ZOOM = 1.5, MAX_ZOOM = 400;
const peaksCache = new Map();
let scroller, inner, playhead, rangeEl;

const x2t = (clientX) => {
  const r = inner.getBoundingClientRect();
  return Math.max(0, (clientX - r.left - HEAD()) / S.zoom);
};

function loadPeaks(m) {
  if (!m?.peaks) return null;
  if (!peaksCache.has(m.id)) {
    peaksCache.set(m.id, null);
    fetch(`/media/${m.peaks}`).then((r) => r.json()).then((p) => { peaksCache.set(m.id, p); render(); }).catch(() => {});
  }
  return peaksCache.get(m.id);
}

// גל הקול של הקטע (50 דגימות לשנייה במקור)
function drawWave(canvas, c, peaks, color) {
  const w = Math.min(4000, Math.max(1, Math.round(c.duration * S.zoom)));
  const hgt = canvas.clientHeight || 40;
  canvas.width = w; canvas.height = hgt;
  const g = canvas.getContext('2d');
  g.fillStyle = color;
  const vol = Math.min(1.6, c.volume ?? 1);
  for (let x = 0; x < w; x++) {
    const a = Math.floor(((c.offset || 0) + (x / w) * c.duration) * 50);
    const b = Math.max(a + 1, Math.floor(((c.offset || 0) + ((x + 1) / w) * c.duration) * 50));
    let v = 0;
    for (let i = a; i < b && i < peaks.length; i++) if (peaks[i] > v) v = peaks[i];
    const bar = Math.max(1, (v / 100) * hgt * vol);
    g.fillRect(x, (hgt - bar) / 2, 1, bar);
  }
}

function clipLabel(c) {
  if (c.type === 'text' || c.type === 'caption') return c.text.replace(/\n/g, ' ');
  const m = mediaOf(c);
  return m ? label(m.label) || m.name : '?';
}

function clipNode(c) {
  const m = c.mediaId ? mediaOf(c) : null;
  const el = h(`div.clip.k-${c.type}`, {
    'data-id': c.id, class: S.sel.has(c.id) ? 'sel' : '', title: clipLabel(c),
    style: { left: `${c.start * S.zoom}px`, width: `${Math.max(3, c.duration * S.zoom)}px` },
  });
  if ((c.type === 'video' || c.type === 'image') && m?.thumb) el.append(h('img.th', { src: `/media/${m.thumb}`, draggable: false, loading: 'lazy' }));
  if (m?.hasAudio && c.type !== 'image') {
    const peaks = loadPeaks(m);
    if (peaks) {
      const cv = h('canvas.wave');
      el.append(cv);
      requestAnimationFrame(() => drawWave(cv, c, peaks, c.type === 'video' ? 'rgba(255,255,255,.75)' : 'rgba(6,95,70,.55)'));
    }
  }
  el.append(h('span.nm', { dir: 'auto' }, clipLabel(c)), h('i.hl'), h('i.hr'));
  el.addEventListener('pointerdown', (e) => clipDown(e, c));
  el.addEventListener('click', (e) => { e.stopPropagation(); if (!el._dragged) select(c.id, e.shiftKey || e.ctrlKey || e.metaKey); });
  return el;
}

function ruler(width) {
  const el = h('div.ruler', { style: { width: `${width}px` } });
  const steps = [1 / 30, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = steps.find((s) => s * S.zoom >= 64) || 600;
  const end = (width - HEAD()) / S.zoom;
  for (let s = 0; s <= end; s += step) {
    el.append(h('span.tick', { style: { left: `${HEAD() + s * S.zoom}px` } }, step < 1 ? `${fmt(s)}.${String(Math.round((s % 1) * 100)).padStart(2, '0')}` : fmt(s)));
  }
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const t0 = x2t(e.clientX);
    const ranging = e.shiftKey;
    const move = (ev) => {
      const now = x2t(ev.clientX);
      if (ranging) { S.range = { a: Math.min(t0, now), b: Math.max(t0, now) }; drawMarks(); }
      seek(now);
    };
    move(e);
    el.onpointermove = move;
    el.onpointerup = () => { el.onpointermove = null; if (ranging) emit('range'); };
  });
  return el;
}

const KIND_ICON = { video: 'film', audio: 'music', text: 'type', caption: 'captions' };

function trackNode(tr, width) {
  const p = S.project;
  const btn = (name, ic, field) => h(`button.tb${tr[field] ? '.on' : ''}`, {
    title: t(name), 'aria-label': t(name), 'aria-pressed': String(!!tr[field]),
    onclick: (e) => { e.stopPropagation(); api('update_track', { trackId: tr.id, [field]: !tr[field] }).catch(() => {}); },
  }, icon(ic, 14));
  const removable = p.tracks.filter((x) => x.kind === tr.kind).length > 1 || tr.kind === 'caption';
  const head = h('div.thead', { style: { width: `${HEAD()}px` } },
    h('span.tn', {}, icon(KIND_ICON[tr.kind], 13), tr.name),
    h('span.tbs', {},
      tr.kind === 'audio' || tr.kind === 'video' ? btn('mute', tr.muted ? 'muted' : 'volume', 'muted') : null,
      tr.kind !== 'audio' ? btn('hide', tr.hidden ? 'eyeOff' : 'eye', 'hidden') : null,
      removable && !isMobile() ? h('button.tb', { title: t('delTrack'), 'aria-label': t('delTrack'), onclick: () => api('delete_track', { trackId: tr.id }).catch(() => {}) }, icon('x', 13)) : null));
  const lane = h('div.lane', { 'data-track': tr.id, 'data-kind': tr.kind });
  for (const c of p.clips) if (c.trackId === tr.id) lane.append(clipNode(c));
  // גרירה של קובץ מספריית המדיה אל השכבה
  lane.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/studio-media')) { e.preventDefault(); lane.classList.add('over'); } });
  lane.addEventListener('dragleave', () => lane.classList.remove('over'));
  lane.addEventListener('drop', (e) => {
    lane.classList.remove('over');
    const mediaId = e.dataTransfer.getData('text/studio-media');
    if (!mediaId) return;
    e.preventDefault();
    const m = p.media.find((x) => x.id === mediaId);
    const kind = m.kind === 'audio' ? 'audio' : 'video';
    api('add_clip', { mediaId, start: +x2t(e.clientX).toFixed(3), trackId: tr.kind === kind ? tr.id : undefined }).then((c) => select(c.id)).catch(() => {});
  });
  return h(`div.track.t-${tr.kind}${tr.hidden ? '.hidden' : ''}${tr.muted ? '.muted' : ''}`, { style: { width: `${width}px` } }, head, lane);
}

export function render() {
  const p = S.project;
  if (!p || !inner) return;
  const width = HEAD() + Math.max(scroller.clientWidth - HEAD(), (total() + 4) * S.zoom + 200);
  const left = scroller.scrollLeft;
  inner.style.width = `${width}px`;
  inner.replaceChildren(ruler(width), h('div.tracks', {}, p.tracks.map((tr) => trackNode(tr, width))),
    rangeEl = h('div.marks'), playhead = h('div.playhead', {}, h('i')));
  if (!p.clips.length) inner.append(h('div.tl-empty', {}, t('emptyTimeline')));
  scroller.scrollLeft = left;
  drawMarks();
  placeHead();
}

// הטווח המסומן והשתיקות שזוהו
function drawMarks() {
  if (!rangeEl) return;
  rangeEl.replaceChildren();
  const box = (a, b, cls) => rangeEl.append(h(`div.${cls}`, { style: { left: `${HEAD() + a * S.zoom}px`, width: `${Math.max(1, (b - a) * S.zoom)}px` } }));
  for (const [a, b] of S.silences || []) box(a, b, 'sil');
  if (S.range) box(S.range.a, S.range.b, 'rng');
}

function placeHead(follow) {
  if (!playhead) return;
  const x = HEAD() + S.time * S.zoom;
  playhead.style.transform = `translateX(${x}px)`;
  if (follow) {
    const view = scroller.clientWidth;
    if (x > scroller.scrollLeft + view - 40 || x < scroller.scrollLeft + HEAD()) scroller.scrollLeft = x - HEAD() - 40;
  }
}

// נקודות הצמדה: הסמן, ההתחלה, והקצוות של שאר הקטעים
function snapPoints(ignoreId) {
  const pts = [0, S.time];
  for (const c of S.project.clips) if (c.id !== ignoreId) pts.push(c.start, clipEnd(c));
  if (S.range) pts.push(S.range.a, S.range.b);
  return pts;
}
function snap(v, pts) {
  const tol = 7 / S.zoom;
  let best = v, d = tol;
  for (const p of pts) if (Math.abs(p - v) < d) { d = Math.abs(p - v); best = p; }
  return best;
}

function clipDown(e, c) {
  if (e.button > 0) return;
  const el = e.currentTarget;
  el._dragged = false;
  // במגע: גוררים רק קטע שכבר נבחר, כדי שאפשר יהיה לגלול את הציר באצבע
  if (e.pointerType === 'touch' && !S.sel.has(c.id)) return;
  if (S.project.tracks.find((x) => x.id === c.trackId)?.locked) return;
  const mode = e.target.classList.contains('hl') ? 'l' : e.target.classList.contains('hr') ? 'r' : 'move';
  const x0 = e.clientX;
  const orig = { start: c.start, duration: c.duration, offset: c.offset || 0, trackId: c.trackId };
  const m = c.mediaId ? mediaOf(c) : null;
  const limited = m && c.type !== 'image' && m.duration;
  const pts = snapPoints(c.id);
  const others = (trackId) => S.project.clips.filter((o) => o.trackId === trackId && o.id !== c.id);
  let next = { ...orig };
  e.stopPropagation();

  const move = (ev) => {
    const dx = ev.clientX - x0;
    if (!el._dragged && Math.abs(dx) < 4 && Math.abs(ev.clientY - e.clientY) < 8) return;
    if (!el._dragged) { el._dragged = true; el.classList.add('drag'); if (!S.sel.has(c.id)) select(c.id); }
    const dt = dx / S.zoom;
    if (mode === 'move') {
      let s = Math.max(0, orig.start + dt);
      const s1 = snap(s, pts), s2 = snap(s + orig.duration, pts) - orig.duration;
      s = Math.abs(s1 - s) <= Math.abs(s2 - s) ? s1 : s2;
      next.start = Math.max(0, s);
      const lane = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList?.contains('lane'));
      const mine = el.parentElement.dataset.kind;
      if (lane && lane.dataset.kind === mine && lane !== el.parentElement) { lane.append(el); next.trackId = lane.dataset.track; }
    } else if (mode === 'l') {
      const prevEnd = Math.max(0, ...others(orig.trackId).filter((o) => clipEnd(o) <= orig.start + 1e-3).map(clipEnd));
      let s = snap(orig.start + dt, pts);
      s = clamp(s, Math.max(prevEnd, limited ? orig.start - orig.offset : 0), orig.start + orig.duration - 0.1);
      next = { ...orig, start: s, duration: orig.duration - (s - orig.start), offset: m ? Math.max(0, orig.offset + (s - orig.start)) : 0 };
    } else {
      const nextStart = Math.min(Infinity, ...others(orig.trackId).filter((o) => o.start >= orig.start + orig.duration - 1e-3).map((o) => o.start));
      let en = snap(orig.start + orig.duration + dt, pts);
      en = clamp(en, orig.start + 0.1, Math.min(nextStart, limited ? orig.start + m.duration - orig.offset : Infinity));
      next = { ...orig, duration: en - orig.start };
    }
    el.style.left = `${next.start * S.zoom}px`;
    el.style.width = `${Math.max(3, next.duration * S.zoom)}px`;
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!el._dragged) return;
    el.classList.remove('drag');
    const r = (v) => +v.toFixed(3);
    const patch = mode === 'move'
      ? { start: r(next.start), ...(next.trackId !== orig.trackId ? { trackId: next.trackId } : {}) }
      : mode === 'l' ? { start: r(next.start), duration: r(next.duration), offset: r(next.offset) } : { duration: r(next.duration) };
    api('update_clip', { clipId: c.id, patch }).catch(render);
    setTimeout(() => { el._dragged = false; }, 0);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

export function setZoom(z, anchorX) {
  const view = scroller.clientWidth;
  const ax = anchorX ?? Math.min(view / 2, HEAD() + S.time * S.zoom - scroller.scrollLeft);
  const at = (scroller.scrollLeft + ax - HEAD()) / S.zoom;
  S.zoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
  render();
  scroller.scrollLeft = at * S.zoom + HEAD() - ax;
  emit('zoom');
}

export function zoomFit() {
  const view = scroller.clientWidth - HEAD() - 40;
  S.zoom = clamp(view / Math.max(3, total()), MIN_ZOOM, MAX_ZOOM);
  scroller.scrollLeft = 0;
  render();
  emit('zoom');
}

export const zoomSlider = { toValue: (z) => Math.log(z / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM), toZoom: (v) => MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, v) };

export function initTimeline() {
  scroller = document.getElementById('tlScroll');
  inner = h('div.tl-inner');
  scroller.append(inner);
  let hadClips = false;
  on('project', () => {
    // בחירה של קטע שכבר לא קיים מתנקה
    for (const id of [...S.sel]) if (!S.project.clips.some((c) => c.id === id)) S.sel.delete(id);
    const has = S.project.clips.length > 0;
    if (has && !hadClips) zoomFit(); else render();
    hadClips = has;
  });
  on('sel', render);
  on('lang', render);
  on('marks', drawMarks);
  on('time', () => placeHead(S.playing));
  window.addEventListener('resize', render);
  // לחיצה על מקום ריק: מזיזה את הסמן ומבטלת בחירה
  scroller.addEventListener('click', (e) => {
    if (e.target.closest('.clip, .thead, .ruler')) return;
    select([]);
    seek(x2t(e.clientX));
  });
  // Ctrl + גלגלת = זום סביב העכבר
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(S.zoom * Math.exp(-e.deltaY * 0.0025), e.clientX - scroller.getBoundingClientRect().left);
  }, { passive: false });
}

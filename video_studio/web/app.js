// נקודת הכניסה: סרגל עליון, נגן, סרגל ציר הזמן, חלונות (ייצוא, API, קיצורים), מקלדת ועדכונים חיים מהשרת.
import { S, on, emit, h, t, icon, fmt, api, toast, setLang, total, selected, seek, select, clamp, isMobile } from './state.js';
import { initPlayer, play, pause, toggle, step, layoutStage } from './player.js';
import { initTimeline, setZoom, zoomFit, zoomSlider, render as renderTimeline } from './timeline.js';
import { initPanels, renderSide, uploadFiles, shortcutList, prefs } from './panels.js';

const $ = (id) => document.getElementById(id);
// replaceChildren בלי ערכים ריקים (null היה נכתב כטקסט)
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(9).filter((k) => k != null && k !== false));
const ib = (ic, name, onclick, extra = {}) => h('button.ibtn', { title: t(name), 'aria-label': t(name), onclick, ...extra }, icon(ic));

// ---------- פקודות עריכה ----------
const cmd = {
  split() {
    const ids = selected().filter((c) => S.time > c.start && S.time < c.start + c.duration).map((c) => c.id);
    api('split', { time: +S.time.toFixed(3), ...(ids.length ? { clipIds: ids } : {}) }).catch(() => {});
  },
  delete() {
    if (S.sel.size) api('delete_clips', { clipIds: [...S.sel] }).then(() => select([])).catch(() => {});
    else if (S.range) cmd.delRange();
  },
  delRange() {
    if (!S.range || S.range.b - S.range.a < 0.02) return;
    const { a, b } = S.range;
    api('delete_range', { from: +a.toFixed(3), to: +b.toFixed(3) }).then(() => { S.range = null; emit('range'); emit('marks'); seek(a); }).catch(() => {});
  },
  markIn() { S.range = { a: S.time, b: Math.max(S.range?.b ?? total(), S.time) }; emit('range'); emit('marks'); },
  markOut() { S.range = { a: Math.min(S.range?.a ?? 0, S.time), b: S.time }; emit('range'); emit('marks'); },
  clearRange() { S.range = null; S.silences = null; emit('range'); emit('marks'); },
  undo: () => api('undo').catch(() => {}),
  redo: () => api('redo').catch(() => {}),
};

// ---------- סרגל עליון ----------
function renderTop() {
  fill($('top'), 
    h('div.brand', {}, h('img', { src: '/icon.svg', alt: '', width: 26, height: 26 }), h('b', {}, t('app'))),
    ib('undo', 'undo', cmd.undo, { disabled: !S.canUndo }), ib('redo', 'redo', cmd.redo, { disabled: !S.canRedo }),
    h('span.grow'),
    h('button.btn.ghost.keysBtn', { title: t('shortcuts'), 'aria-label': t('shortcuts'), onclick: shortcutsDialog }, icon('keyboard'), h('span.lbl', {}, t('shortcuts'))),
    h('button.btn.ghost', { onclick: apiDialog }, icon('plug'), h('span', { dir: 'ltr' }, 'API · MCP')),
    h('button.btn.ghost.lang', { 'aria-label': 'עברית / English', onclick: () => setLang(S.lang === 'he' ? 'en' : 'he') },
      h('span', { class: S.lang === 'he' ? 'cur' : '' }, 'עב'), ' / ', h('span', { class: S.lang === 'en' ? 'cur' : '' }, 'EN')),
    h('button.btn.pri.exportBtn', { onclick: exportDialog }, icon('download'), t('export')));
}

function renderTransport() {
  fill($('transport'), 
    h('span.time', { dir: 'ltr' }, h('b#tNow', {}, fmt(S.time, true)), ' / ', h('span', {}, fmt(total(), true))),
    h('div.tbtns', { dir: 'ltr' },
      ib('start', 'toStart', () => { pause(); seek(0); }), ib('prev', 'prevFrame', () => step(-1)),
      h('button.playBtn', { title: t(S.playing ? 'pause' : 'play'), 'aria-label': t(S.playing ? 'pause' : 'play'), onclick: toggle }, icon(S.playing ? 'pause' : 'play', 22)),
      ib('next', 'nextFrame', () => step(1)), ib('end', 'toEnd', () => { pause(); seek(total()); })),
    h('span.frame', { dir: 'ltr' }, `${S.project.settings.width}×${S.project.settings.height} · ${S.project.settings.fps}fps`));
  document.querySelector('.stage-empty').textContent = t('emptyStage');
}

// ---------- סרגל ציר הזמן ----------
function renderBar() {
  const r = S.range;
  const tb = (ic, name, fn, extra = {}) => h('button.btn.tool', { title: t(name), onclick: fn, ...extra }, icon(ic, 17), h('span.lbl', {}, t(name)));
  fill($('tlBar'), 
    tb('scissors', 'split', cmd.split), tb('trash', 'del', cmd.delete, { disabled: !S.sel.size && !r }),
    h('i.sep'),
    tb('in', 'markIn', cmd.markIn), tb('out', 'markOut', cmd.markOut),
    r ? h('button.btn.tool.danger', { onclick: cmd.delRange }, icon('trash', 17), h('span', {}, `${t('delRange')} (${(r.b - r.a).toFixed(1)} ${t('sec')})`)) : null,
    r || S.silences ? ib('x', 'clearRange', cmd.clearRange) : null,
    h('i.sep'),
    tb('wave', 'silences', silenceDialog),
    h('label.rip', { title: t('rippleHint') }, h('input', { type: 'checkbox', checked: S.project.settings.ripple, onchange: (e) => api('set_project', { ripple: e.target.checked }).catch(() => {}) }), h('span', {}, t('ripple'))),
    h('span.grow'),
    h('div.addtr', {}, tb('layers', 'addTrack', (e) => e.currentTarget.parentElement.classList.toggle('open')),
      h('div.menu', {}, [['video', 'trackVideo'], ['audio', 'trackAudio'], ['text', 'trackText']].map(([k, n]) => h('button', { onclick: (e) => { e.currentTarget.closest('.addtr').classList.remove('open'); api('add_track', { kind: k }).catch(() => {}); } }, t(n))))),
    h('div.zoom', { dir: 'ltr' }, ib('minus', 'zoomOut', () => setZoom(S.zoom / 1.4)),
      h('input#zoomR', { type: 'range', min: 0, max: 1, step: 0.005, value: zoomSlider.toValue(S.zoom), 'aria-label': t('k_zoom'), oninput: (e) => setZoom(zoomSlider.toZoom(+e.target.value)) }),
      ib('plus', 'zoomIn', () => setZoom(S.zoom * 1.4)), ib('fit', 'zoomFit', zoomFit)));
}

// ---------- חלונות ----------
function modal(title, body, { wide } = {}) {
  const m = $('modal');
  const close = () => { m.hidden = true; m.replaceChildren(); m.onclose?.(); m.onclose = null; };
  m.replaceChildren(h(`div.dlg${wide ? '.wide' : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', {}, h('h2', {}, title), h('button.ibtn', { 'aria-label': t('close'), onclick: close }, icon('x'))), h('div.dbody', {}, body)));
  m.hidden = false;
  m.onclick = (e) => { if (e.target === m) close(); };
  m.querySelector('.dbody button, .dbody input')?.focus();
  return close;
}

function shortcutsDialog() { modal(t('shortcuts'), shortcutList()); }

function silenceDialog() {
  const p = prefs.sil;
  const body = h('div');
  let busy = false;
  const draw = () => {
    const sl = (name, key, min, max, stepv, show) => {
      const out = h('b', {}, show(p[key]));
      return h('label.f', {}, h('span.fl', {}, name, out), h('input', { type: 'range', min, max, step: stepv, value: p[key], oninput: (e) => { p[key] = +e.target.value; out.textContent = show(p[key]); } , onchange: detect }));
    };
    const n = S.silences?.length;
    fill(body,
      sl(t('threshold'), 'thresholdDb', -60, -15, 1, (v) => `${v} dB`),
      sl(t('minSilence'), 'minDuration', 0.2, 3, 0.05, (v) => `${v.toFixed(2)} ${t('sec')}`),
      sl(t('padding'), 'padding', 0, 0.3, 0.01, (v) => `${v.toFixed(2)} ${t('sec')}`),
      S.sel.size ? h('p.hint', {}, t('silSel')) : null,
      h('p.result', { class: n ? 'ok' : '' }, busy ? t('detecting') : n == null ? '' : n ? t('silFound', { n, s: S.silences.reduce((x, [a, b]) => x + b - a, 0).toFixed(1) }) : t('silNone')),
      h('div.rowb', {},
        h('button.btn', { disabled: busy, onclick: detect }, icon('wave'), t('detect')),
        h('button.btn.pri#silGo', { disabled: busy || !n, onclick: remove }, icon('scissors'), t('silRemove', { n: n || 0 }))),
      h('p.hint', {}, t('silHint')));
  };
  const args = () => ({ ...p, padding: Math.min(p.padding, p.minDuration / 2 - 0.02), ...(S.sel.size ? { clipIds: [...S.sel] } : {}) });
  async function detect() {
    busy = true; draw();
    try { S.silences = (await api('detect_silences', args())).ranges; } catch { S.silences = null; }
    busy = false; emit('marks'); renderBar(); draw();
  }
  async function remove() {
    busy = true; draw();
    try { const r = await api('remove_silences', { ranges: S.silences }); toast(`${t('silRemove', { n: r.removed })} · −${r.secondsRemoved} ${t('sec')}`); } catch { /* */ }
    S.silences = null; emit('marks'); renderBar(); close();
  }
  const close = modal(t('silences'), body);
  draw();
  detect();
}

function exportDialog() {
  const body = h('div.exp');
  let jobId = null;
  let quality = 'max';
  const names = { '9:16': 'vertical', '16:9': 'horizontal', '4:5': 'portrait45', '1:1': 'square', '4k': 'horizontal' };
  const draw = () => {
    const st = S.project.settings;
    const job = jobId && S.jobs[jobId];
    const cur = Object.entries(S.meta.sizes).find(([, [w, hh]]) => w === st.width && hh === st.height)?.[0];
    if (job?.status === 'running') {
      return fill(body, h('p.big', {}, t('exporting')), h('div.bar.lg', { role: 'progressbar', 'aria-valuenow': Math.round(job.progress * 100) }, h('i', { style: { width: `${job.progress * 100}%` } })),
        h('p.pct', { dir: 'ltr' }, `${Math.round(job.progress * 100)}%`), h('button.btn', { onclick: () => api('cancel_job', { jobId }).catch(() => {}) }, t('cancel')));
    }
    if (job?.status === 'done') {
      return fill(body, h('p.big.ok', {}, icon('check', 22), t('exportDone')),
        h('video.result', { src: job.url, controls: true, playsInline: true }),
        h('p.hint', { dir: 'ltr' }, `${job.file} · ${(job.bytes / 1e6).toFixed(1)} MB`),
        h('div.rowb', {}, h('a.btn.pri', { href: `${job.url}?download`, download: job.file }, icon('download'), t('download')), h('button.btn', { onclick: () => { jobId = null; draw(); } }, t('exportAgain'))));
    }
    fill(body,
      job?.status === 'error' ? h('p.errbox', { dir: 'auto' }, `${t('error')}: ${job.error}`) : null,
      h('h3', {}, t('frame')),
      h('div.sizes', {}, Object.entries(S.meta.sizes).map(([k, [w, hh]]) => h(`button.sizeCard${cur === k ? '.on' : ''}`, { 'aria-pressed': String(cur === k), onclick: () => api('set_project', { size: k }).then(draw).catch(() => {}) },
        h('span.shape', {}, h('i', { style: { aspectRatio: `${w} / ${hh}`, [w >= hh ? 'width' : 'height']: '100%' } })),
        h('b', {}, k === '4k' ? '4K' : k), h('span', { dir: 'ltr' }, `${w}×${hh}`), h('small', {}, t(names[k]))))),
      h('h3', {}, t('fps')),
      h('div.chips', {}, S.meta.fps.map((f) => h(`button.chip${st.fps === f ? '.on' : ''}`, { 'aria-pressed': String(st.fps === f), onclick: () => api('set_project', { fps: f }).then(draw).catch(() => {}) }, f))),
      h('h3', {}, t('quality')),
      h('select', { 'aria-label': t('quality'), onchange: (e) => { quality = e.target.value; } }, ['max', 'high', 'draft'].map((q) => h('option', { value: q, selected: q === quality }, t(`q_${q}`)))),
      h('p.hint', { dir: 'ltr' }, t('exportInfo', { w: st.width, h: st.height, fps: st.fps, d: fmt(total()) })),
      h('button.btn.pri.wide.lg#exportGo', { disabled: !total(), onclick: async () => { pause(); try { jobId = (await api('export', { quality, wait: false })).id; draw(); } catch { /* */ } } }, icon('download'), total() ? t('startExport') : t('exportEmpty')));
  };
  const onJob = () => { if (!$('modal').hidden) draw(); };
  on('jobs', onJob);
  on('project', onJob);
  modal(t('exportTitle'), body);
  draw();
}

function apiDialog() {
  const base = location.origin;
  const local = `http://localhost:${S.meta.port}`;
  const code = (text) => h('div.code', { dir: 'ltr' }, h('pre', {}, text), h('button.btn.sm', { onclick: (e) => { navigator.clipboard?.writeText(text); e.currentTarget.textContent = t('copied'); } }, t('copy')));
  const row = (method, path, desc) => h('div.ep', {}, h('code', { dir: 'ltr' }, h('b', {}, method), ` ${path}`), h('span', { dir: 'auto' }, desc));
  modal(t('apiTitle'), [
    h('p', {}, t('apiIntro')),
    h('h3', {}, t('mcpConnect')), code(`claude mcp add --transport http video-studio ${local}/mcp`),
    h('h3', {}, t('mcpJson')), code(JSON.stringify({ mcpServers: { 'video-studio': { type: 'http', url: `${local}/mcp` } } }, null, 2)),
    h('h3', {}, t('apiExample')), code(`curl -X POST ${base}/api/split -H "Content-Type: application/json" -d '{"time": 3.5}'`),
    h('h3', {}, `${t('apiList')} · ${S.meta.actions.length + 4}`),
    h('div.eps', {},
      row('GET', '/api/project', t('apiState')), row('GET', '/api/events', t('apiEvents')), row('POST', '/api/upload?name=clip.mp4', t('apiUpload')), row('POST', '/mcp', 'MCP (Streamable HTTP)'),
      S.meta.actions.map((a) => h('details.ep', {}, h('summary', {}, h('code', { dir: 'ltr' }, h('b', {}, 'POST'), ` /api/${a.name}`)),
        h('p', { dir: 'ltr' }, a.description),
        Object.keys(a.params).length ? h('ul', { dir: 'ltr' }, Object.entries(a.params).map(([k, v]) => h('li', {}, h('code', {}, k), ` ${v.type}${v.required ? ' · required' : ''} – ${v.description || ''}`))) : null))),
  ], { wide: true });
}

// ---------- מקלדת ----------
function keys(e) {
  const a = document.activeElement;
  if (a && (/TEXTAREA|SELECT/.test(a.tagName) || (a.tagName === 'INPUT' && !/range|checkbox|color/.test(a.type)))) return;
  const mod = e.ctrlKey || e.metaKey;
  const done = () => e.preventDefault();
  if (!$('modal').hidden) { if (e.key === 'Escape') { $('modal').hidden = true; $('modal').replaceChildren(); } return; }
  if (mod && e.code === 'KeyZ') { done(); return e.shiftKey ? cmd.redo() : cmd.undo(); }
  if (mod && e.code === 'KeyY') { done(); return cmd.redo(); }
  if (mod || e.altKey) return;
  switch (e.code) {
    case 'Space': done(); a?.blur?.(); return toggle();
    case 'KeyS': done(); return cmd.split();
    case 'Delete': case 'Backspace': done(); return cmd.delete();
    case 'ArrowLeft': done(); return e.shiftKey ? (pause(), seek(S.time - 1)) : step(-1);
    case 'ArrowRight': done(); return e.shiftKey ? (pause(), seek(S.time + 1)) : step(1);
    case 'KeyI': return cmd.markIn();
    case 'KeyO': return cmd.markOut();
    case 'Home': done(); pause(); return seek(0);
    case 'End': done(); pause(); return seek(total());
    case 'Equal': case 'NumpadAdd': return setZoom(S.zoom * 1.4);
    case 'Minus': case 'NumpadSubtract': return setZoom(S.zoom / 1.4);
    case 'Escape': select([]); return cmd.clearRange();
    default:
  }
}

// ---------- הפעלה ----------
async function boot() {
  setLang(S.lang);
  S.meta = await (await fetch('/api/meta')).json();
  // הגופנים של הטקסטים (אותם קבצים שמשמשים בייצוא)
  document.head.append(h('style', {}, S.meta.fonts.map((f) => `@font-face{font-family:"${f.family}";src:url("/fonts/${f.file}");font-display:swap}`).join('')));
  S.meta.fonts.forEach((f) => document.fonts.load(`20px "${f.family}"`, 'אב'));
  const first = await (await fetch('/api/project')).json();
  Object.assign(S, { project: first.project, canUndo: first.canUndo, canRedo: first.canRedo });
  initPlayer(); initTimeline(); initPanels();
  const all = () => { renderTop(); renderTransport(); renderBar(); };
  on('project', all); on('lang', () => { all(); document.title = S.lang === 'he' ? 'סטודיו – עריכת וידאו' : 'Studio – video editor'; });
  on('sel', renderBar); on('range', renderBar); on('playing', renderTransport);
  on('zoom', () => { const z = $('zoomR'); if (z) z.value = zoomSlider.toValue(S.zoom); });
  on('time', () => { const el = $('tNow'); if (el) el.textContent = fmt(S.time, true); });
  on('cmd', (name) => cmd[name]?.());
  emit('project'); emit('lang');

  const es = new EventSource('/api/events');
  es.addEventListener('project', (e) => {
    const d = JSON.parse(e.data);
    Object.assign(S, { project: d.project, canUndo: d.canUndo, canRedo: d.canRedo });
    if (S.time > total()) S.time = total();
    emit('project');
  });
  es.addEventListener('job', (e) => {
    const j = JSON.parse(e.data);
    const was = S.jobs[j.id]?.status;
    S.jobs[j.id] = j;
    if (j.type === 'transcribe' && was === 'running' && j.status === 'done') toast(t('trDone', { n: j.captions }));
    if (j.type === 'transcribe' && j.status === 'error') toast(`${t('error')}: ${j.error}`, 'err');
    emit('jobs');
  });

  window.addEventListener('keydown', keys);
  document.addEventListener('click', (e) => { if (!e.target.closest('.addtr')) document.querySelector('.addtr.open')?.classList.remove('open'); });
  // גרירת קבצים מהמחשב לכל מקום בחלון
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; $('dropVeil').textContent = t('dropAnywhere'); $('dropVeil').classList.add('on'); } });
  window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; $('dropVeil').classList.remove('on'); } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; $('dropVeil').classList.remove('on'); uploadFiles([...e.dataTransfer.files]); });
  window.addEventListener('resize', () => { layoutStage(); renderTimeline(); });
  void clamp; void isMobile; void play; void renderSide;
}

boot().catch((e) => { document.body.append(h('p.fatal', {}, String(e.message || e))); });

// הפאנל הצדדי (מדיה, טקסט, כתוביות, סאונד) ופאנל המאפיינים של הקטע שנבחר.
import { S, on, emit, h, t, icon, fmt, api, toast, label, selected, mediaOf, clipEnd, select, seek, total, isMobile } from './state.js';
import { textCss, sync } from './player.js';

const TABS = [['media', 'film'], ['text', 'type'], ['captions', 'captions'], ['sound', 'music'], ['props', 'sliders']];
const prefs = { lang: 'he', model: 'balanced', sfxCat: 'all', sil: { thresholdDb: -35, minDuration: 0.5, padding: 0.08 } };
export { prefs };
let previewAudio = null;

// ---------- העלאה ----------
export function uploadFiles(files) {
  for (const file of files) {
    const up = { name: file.name, progress: 0 };
    S.uploads.push(up);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload?name=${encodeURIComponent(file.name)}`);
    xhr.upload.onprogress = (e) => { up.progress = e.loaded / e.total; renderSide(); };
    xhr.onloadend = () => {
      S.uploads = S.uploads.filter((u) => u !== up);
      if (xhr.status !== 200) { let msg = xhr.statusText; try { msg = JSON.parse(xhr.responseText).error; } catch { /* */ } toast(`${file.name}: ${msg || t('failed')}`, 'err'); }
      renderSide();
    };
    xhr.send(file);
  }
  S.tab = 'media';
  renderSide();
}

// ---------- שדות טופס קטנים ----------
const field = (name, control, value) => h('label.f', {}, h('span.fl', {}, name, value != null ? h('b', {}, value) : null), control);

// מחוון: משנה את התצוגה מיד, ושומר (פעולה אחת לביטול) כשמשחררים
function slider({ name, min, max, step, value, show, live, commit }) {
  const out = h('b', {}, show(value));
  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': name });
  input.addEventListener('input', () => { out.textContent = show(+input.value); live?.(+input.value); });
  input.addEventListener('change', () => commit(+input.value));
  return h('label.f', {}, h('span.fl', {}, name, out), input);
}
const select_ = (name, options, value, onchange) => field(name, h('select', { onchange: (e) => onchange(e.target.value) },
  options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l))));
const color = (name, value, onchange) => h('label.f.fc', {}, h('span.fl', {}, name), h('input', { type: 'color', value, onchange: (e) => onchange(e.target.value) }));
const check = (name, value, onchange) => h('label.f.fk', {}, h('input', { type: 'checkbox', checked: !!value, onchange: (e) => onchange(e.target.checked) }), h('span', {}, name));
const pct = (v) => `${Math.round(v * 100)}%`;
const secs = (v) => `${(+v).toFixed(1)} ${t('sec')}`;

// ---------- מדיה ----------
function mediaTab() {
  const p = S.project;
  const input = h('input', { type: 'file', multiple: true, accept: 'video/*,audio/*,image/*', hidden: true, id: 'fileInput', onchange: (e) => { uploadFiles([...e.target.files]); e.target.value = ''; } });
  const drop = h('button.drop', { onclick: () => input.click() }, icon('upload', 26), h('b', {}, t('dropHere')), h('span', {}, t('dropKinds')));
  const cards = p.media.filter((m) => !m.source).map((m) => {
    const ready = m.status === 'ready';
    const add = () => api('add_clip', { mediaId: m.id, ...(m.kind === 'audio' ? { start: +S.time.toFixed(3) } : {}) }).then((c) => select(c.id)).catch(() => {});
    return h(`div.mcard${ready ? '' : '.busy'}`, {
      draggable: ready, title: m.name,
      ondragstart: (e) => { e.dataTransfer.setData('text/studio-media', m.id); e.dataTransfer.effectAllowed = 'copy'; },
      ondblclick: () => ready && add(),
    },
    h('div.mth', {}, m.thumb ? h('img', { src: `/media/${m.thumb}`, alt: '', draggable: false }) : icon(m.kind === 'audio' ? 'music' : m.kind === 'image' ? 'image' : 'film', 26),
      m.kind !== 'image' && ready ? h('span.dur', {}, fmt(m.duration)) : null,
      m.status === 'processing' ? h('span.st', {}, h('i.spin'), t('processing')) : m.status === 'error' ? h('span.st.err', {}, t('failed')) : null),
    h('div.mnm', { dir: 'auto' }, m.name),
    h('div.mact', {},
      h('button.ibtn.add', { disabled: !ready, title: t('addToTimeline'), 'aria-label': t('addToTimeline'), onclick: add }, icon('plus', 16)),
      h('button.ibtn', { title: t('remove'), 'aria-label': t('remove'), onclick: () => { if (confirm(t('confirmDeleteMedia'))) api('delete_media', { mediaId: m.id }).catch(() => {}); } }, icon('trash', 15))));
  });
  const ups = S.uploads.map((u) => h('div.up', {}, h('span', { dir: 'auto' }, `${t('uploading')} ${u.name}`), h('div.bar', {}, h('i', { style: { width: pct(u.progress) } }))));
  return [input, drop, ups, cards.length ? h('div.mgrid', {}, cards) : (ups.length ? null : h('p.hint', {}, t('emptyMedia')))];
}

// ---------- טקסט ----------
function textTab() {
  const sample = S.lang === 'he' ? 'טקסט' : 'Text';
  return [h('h3', {}, t('textPresets')), h('p.hint', {}, t('textHint')),
    h('div.pgrid', {}, S.meta.textPresets.map((pr) => h('button.preset', {
      title: label(pr),
      onclick: () => api('add_text', { text: t('defaultText'), preset: pr.id, start: +S.time.toFixed(3) }).then((c) => { select(c.id); if (isMobile()) { S.tab = 'props'; renderSide(); } }).catch(() => {}),
    }, h('span.smp', {}, h('span', { style: textCss({ ...pr.style }, Math.min(30, 150 / pr.style.size * 1.1 + 8)) }, sample)), h('span.pn', {}, label(pr)))))];
}

// ---------- כתוביות ----------
function captionsTab() {
  const p = S.project;
  const cs = p.captionStyle;
  const caps = p.clips.filter((c) => c.type === 'caption').sort((a, b) => a.start - b.start);
  const job = Object.values(S.jobs).find((j) => j.type === 'transcribe' && j.status === 'running');
  const set = (style) => api('set_caption_style', { style }).catch(() => {});
  const live = (k) => (v) => { cs[k] = v; sync(); };
  const sample = S.lang === 'he' ? ['זה', 'נראה', 'ככה'] : ['Looks', 'like', 'this'];

  const auto = h('section.card', {}, h('h3', {}, t('autoCaptions')),
    h('div.row2', {},
      select_(t('language'), [['he', t('he')], ['en', t('en')], ['auto', t('auto')]], prefs.lang, (v) => { prefs.lang = v; }),
      select_(t('accuracy'), S.meta.models.map((m) => [m, t(m)]), prefs.model, (v) => { prefs.model = v; })),
    job
      ? h('div.job', {}, h('span', {}, job.message === 'download' ? t('downloadingModel') : job.message === 'model' ? t('loadingModel') : t('transcribing')),
        h('div.bar', {}, h('i', { style: { width: pct(job.progress || 0.02) } })),
        h('button.btn.sm', { onclick: () => api('cancel_job', { jobId: job.id }).catch(() => {}) }, t('cancel')))
      : h('button.btn.pri.wide', { onclick: () => api('transcribe', { language: prefs.lang, model: prefs.model, wait: false }).catch(() => {}) }, icon('captions'), t('transcribe')),
    h('p.hint', {}, t('trHint')),
    h('div.rowb', {},
      h('button.btn.sm', { onclick: () => srtInput.click() }, t('importSrt')),
      caps.length ? h('a.btn.sm', { href: '/api/captions.srt', download: 'captions.srt' }, t('exportSrt')) : null,
      caps.length ? h('button.btn.sm', { onclick: () => api('clear_captions').catch(() => {}) }, t('clearCaptions')) : null));
  const srtInput = h('input', { type: 'file', accept: '.srt,text/plain', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (f) api('import_srt', { srt: await f.text() }).catch(() => {}); } });

  const styles = h('section.card', {}, h('h3', {}, t('captionStyle')),
    h('div.pgrid', {}, S.meta.captionPresets.map((pr) => h(`button.preset${cs.preset === pr.id ? '.on' : ''}`, {
      title: label(pr), 'aria-pressed': String(cs.preset === pr.id), onclick: () => api('set_caption_style', { preset: pr.id }).catch(() => {}),
    }, h('span.smp', {}, h('span', { dir: 'auto', style: textCss({ boxColor: '#000000', boxOpacity: 0.7, ...pr.style }, pr.style.mode === 'single' ? 24 : 15) },
      pr.style.mode === 'single' ? sample[1] : sample.map((w, i) => [h('span', { style: { color: (pr.style.mode === 'karaoke' ? i <= 1 : i === 1) && pr.style.mode !== 'none' ? pr.style.highlight : pr.style.color } }, w), i < 2 ? ' ' : '']))),
    h('span.pn', {}, label(pr))))),
    h('div.row2', {},
      select_(t('font'), S.meta.fonts.map((f) => [f.family, f.family]), cs.font, (v) => set({ font: v })),
      select_(t('mode'), S.meta.captionModes.map((m) => [m, t(`mode_${m}`)]), cs.mode, (v) => set({ mode: v }))),
    slider({ name: t('size'), min: 2, max: 14, step: 0.2, value: cs.size, show: (v) => v.toFixed(1), live: live('size'), commit: (v) => set({ size: v }) }),
    slider({ name: t('posY'), min: 0.05, max: 0.95, step: 0.01, value: cs.y, show: pct, live: live('y'), commit: (v) => set({ y: v }) }),
    h('div.row2', {}, color(t('color'), cs.color, (v) => set({ color: v })), color(t('highlight'), cs.highlight, (v) => set({ highlight: v }))));

  const list = h('section.card', {}, h('h3', {}, `${t('captionList')}${caps.length ? ` · ${caps.length}` : ''}`),
    caps.length ? h('div.caps', {}, caps.map((c) => h(`div.cap${S.time >= c.start && S.time < clipEnd(c) ? '.now' : ''}`, { 'data-id': c.id },
      h('button.ct', { onclick: () => { seek(c.start + 0.01); select(c.id); } }, fmt(c.start)),
      h('input', { dir: 'auto', value: c.text, 'aria-label': t('clipCaption'), onchange: (e) => (e.target.value.trim() ? api('update_clip', { clipId: c.id, patch: { text: e.target.value.trim() } }) : api('delete_clips', { clipIds: [c.id], ripple: false })).catch(() => {}) }),
      h('button.ibtn', { title: t('remove'), 'aria-label': t('remove'), onclick: () => api('delete_clips', { clipIds: [c.id], ripple: false }).catch(() => {}) }, icon('x', 14)))))
      : h('p.hint', {}, t('noCaptions')),
    h('button.btn.sm', { onclick: () => api('set_captions', { captions: [{ start: +S.time.toFixed(2), duration: 2, text: t('defaultText') }], replace: false }).catch(() => {}) }, icon('plus', 14), t('addCaption')));
  return [auto, srtInput, styles, list];
}

// ---------- סאונד ----------
function soundTab() {
  const cats = [{ id: 'all', he: t('all'), en: t('all') }, ...S.meta.sfxCategories];
  const list = S.meta.sfx.filter((s) => prefs.sfxCat === 'all' || s.category === prefs.sfxCat);
  const listen = (s, btn) => {
    const same = previewAudio && previewAudio._id === s.id && !previewAudio.paused;
    previewAudio?.pause();
    document.querySelectorAll('.srow .playing').forEach((b) => b.classList.remove('playing'));
    if (same) return;
    previewAudio = new Audio(s.url);
    previewAudio._id = s.id;
    previewAudio.play();
    btn.classList.add('playing');
    previewAudio.onended = () => btn.classList.remove('playing');
  };
  return [h('div.chips', {}, cats.map((c) => h(`button.chip${prefs.sfxCat === c.id ? '.on' : ''}`, { 'aria-pressed': String(prefs.sfxCat === c.id), onclick: () => { prefs.sfxCat = c.id; renderSide(); } }, label(c)))),
    h('p.hint', {}, t('soundHint')),
    h('div.slist', {}, list.map((s) => h('div.srow', {},
      h('button.ibtn.ply', { title: t('play'), 'aria-label': `${t('play')} ${label(s)}`, onclick: (e) => listen(s, e.currentTarget) }, icon('play', 15)),
      h('span.sn', {}, label(s)), h('span.sd', {}, secs(s.duration)),
      h('button.ibtn.add', { title: t('addToTimeline'), 'aria-label': `${t('addToTimeline')}: ${label(s)}`, onclick: () => api('add_sound', { soundId: s.id, start: +S.time.toFixed(3) }).then((c) => select(c.id)).catch(() => {}) }, icon('plus', 16)))))];
}

// ---------- מאפיינים ----------
export function inspector() {
  const p = S.project;
  const sel = selected();
  if (sel.length > 1) return [h('h3', {}, t('nSelected', { n: sel.length })), h('button.btn.wide', { onclick: () => emit('cmd', 'delete') }, icon('trash'), t('del'))];
  if (!sel.length) {
    const st = p.settings;
    const cur = Object.entries(S.meta.sizes).find(([, [w, hh]]) => w === st.width && hh === st.height)?.[0];
    return [h('h3', {}, t('project')),
      field(t('frame'), h('div.chips', {}, Object.entries(S.meta.sizes).map(([k, [w, hh]]) => h(`button.chip${cur === k ? '.on' : ''}`, { title: `${w}×${hh}`, 'aria-pressed': String(cur === k), onclick: () => api('set_project', { size: k }).catch(() => {}) }, k === '4k' ? '4K' : k)))),
      select_(t('fps'), S.meta.fps.map((f) => [f, f]), st.fps, (v) => api('set_project', { fps: +v }).catch(() => {})),
      h('p.hint', {}, t('nothingSel')),
      h('h3', {}, t('shortcuts')), shortcutList()];
  }
  const c = sel[0];
  const m = c.mediaId ? mediaOf(c) : null;
  const save = (patch) => api('update_clip', { clipId: c.id, patch }).catch(() => {});
  const live = (k) => (v) => { c[k] = v; sync(); };
  const sl = (name, key, min, max, step, show) => slider({ name, min, max, step, value: c[key] ?? 0, show, live: live(key), commit: (v) => save({ [key]: v }) });
  const title = { video: 'clipVideo', audio: 'clipAudio', image: 'clipImage', text: 'clipText', caption: 'clipCaption' }[c.type];
  const out = [h('h3', {}, t(title)), m ? h('p.hint.nm', { dir: 'auto' }, label(m.label) || m.name) : null];

  if (c.type === 'text' || c.type === 'caption') {
    out.push(h('textarea', { dir: 'auto', rows: c.type === 'text' ? 3 : 2, value: c.text, 'aria-label': t('text'),
      oninput: (e) => { if (c.type === 'text') { c.text = e.target.value; sync(); } },
      onchange: (e) => save({ text: e.target.value }) }));
  }
  if (c.type === 'caption') out.push(h('p.hint', {}, t('capStyleNote')));
  if (c.type === 'text') {
    out.push(
      h('div.row2', {}, select_(t('font'), S.meta.fonts.map((f) => [f.family, f.family]), c.font, (v) => save({ font: v })),
        select_(t('anim'), S.meta.anims.map((a) => [a, t(`anim_${a}`)]), c.anim, (v) => save({ anim: v }))),
      sl(t('size'), 'size', 2, 25, 0.2, (v) => v.toFixed(1)),
      h('div.row2', {}, color(t('color'), c.color, (v) => save({ color: v })), check(t('shadow'), c.shadow, (v) => save({ shadow: v }))),
      sl(t('outline'), 'outline', 0, 20, 0.5, (v) => v.toFixed(1)),
      c.outline > 0 ? color(t('outline'), c.outlineColor, (v) => save({ outlineColor: v })) : null,
      h('div.row2', {}, check(t('box'), c.box, (v) => save({ box: v })), c.box ? color(t('color'), c.boxColor, (v) => save({ boxColor: v })) : null),
      c.box ? sl(t('opacity'), 'boxOpacity', 0, 1, 0.05, pct) : null,
      sl(t('posX'), 'x', 0, 1, 0.01, pct), sl(t('posY'), 'y', 0, 1, 0.01, pct));
  }
  if ((c.type === 'video' && m?.hasAudio) || c.type === 'audio') {
    out.push(sl(t('volume'), 'volume', 0, 2, 0.01, pct), sl(t('fadeIn'), 'fadeIn', 0, 5, 0.1, secs), sl(t('fadeOut'), 'fadeOut', 0, 5, 0.1, secs));
  }
  if (c.type === 'video' || c.type === 'image') {
    out.push(select_(t('fit'), [['contain', t('contain')], ['cover', t('cover')]], c.fit || 'contain', (v) => save({ fit: v })),
      sl(t('scale'), 'scale', 0.1, 3, 0.01, pct), sl(t('posX'), 'x', 0, 1, 0.01, pct), sl(t('posY'), 'y', 0, 1, 0.01, pct));
  }
  if (c.type !== 'video' && c.type !== 'audio') {
    out.push(field(t('duration'), h('input', { type: 'number', min: 0.1, step: 0.1, value: +c.duration.toFixed(2), onchange: (e) => save({ duration: Math.max(0.1, +e.target.value || 1) }) })));
  }
  out.push(h('div.rowb', {},
    h('button.btn.sm', { onclick: () => emit('cmd', 'split') }, icon('scissors', 15), t('split')),
    h('button.btn.sm', { onclick: () => emit('cmd', 'delete') }, icon('trash', 15), t('del'))));
  return out;
}

export function shortcutList() {
  const ctrl = /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const rows = [[['Space'], 'k_space'], [['S'], 'k_s'], [['Del'], 'k_del'], [[ctrl, 'Z'], 'k_undo'], [[ctrl, 'Y'], 'k_redo'], [[ctrl, t('wheel')], 'k_zoom'],
    [['←', '→'], 'k_frame'], [['I', 'O'], 'k_io'], [['Home', 'End'], 'k_home'], [['Esc'], 'k_esc']];
  return h('dl.keys', {}, rows.map(([keys, name]) => h('div', {}, h('dt', { dir: 'ltr' }, keys.map((k) => h('kbd', {}, k))), h('dd', {}, t(name)))));
}

// ---------- ציור ----------
export function renderSide() {
  if (!S.project || !S.meta) return;
  const tabs = document.getElementById('tabs');
  const mtabs = document.getElementById('mtabs');
  const body = document.getElementById('panel');
  const mk = ([id, ic]) => h(`button.tab.tab-${id}${S.tab === id && (!isMobile() || S.sheet) ? '.on' : ''}`, {
    role: 'tab', 'aria-selected': String(S.tab === id),
    onclick: () => { if (isMobile() && S.sheet && S.tab === id) S.sheet = false; else { S.tab = id; S.sheet = true; } renderSide(); },
  }, icon(ic, 20), h('span', {}, t(id)));
  tabs.replaceChildren(...TABS.map(mk));
  mtabs.replaceChildren(...TABS.map(mk));
  if (!isMobile() && S.tab === 'props') S.tab = 'media';
  const keep = body.dataset.tab === S.tab ? body.scrollTop : 0;
  const content = { media: mediaTab, text: textTab, captions: captionsTab, sound: soundTab, props: inspector }[S.tab]();
  body.replaceChildren(h('div.sheet-head', {}, h('b', {}, t(S.tab)), h('button.ibtn', { 'aria-label': t('close'), onclick: () => { S.sheet = false; renderSide(); } }, icon('x'))), ...[content].flat(9).filter(Boolean));
  body.dataset.tab = S.tab;
  body.scrollTop = keep;
  document.getElementById('side').classList.toggle('open', S.sheet);
  document.getElementById('insp').replaceChildren(...inspector().flat(9).filter(Boolean));
}

export function initPanels() {
  // עדכון בזמן הקלדה היה מוחק את מה שמקלידים – מציירים מחדש רק כשלא באמצע עריכה של שדה
  const safe = () => { const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('#side, #insp') && a.type !== 'range' && a.type !== 'checkbox' && a.type !== 'color') return; renderSide(); };
  on('project', safe);
  on('sel', renderSide);
  on('lang', renderSide);
  on('jobs', () => { if (S.tab === 'captions') safe(); });
  let lastCap = null;
  on('time', () => {
    if (S.tab !== 'captions') return;
    const now = S.project.clips.find((c) => c.type === 'caption' && S.time >= c.start && S.time < clipEnd(c))?.id || null;
    if (now === lastCap) return;
    lastCap = now;
    document.querySelectorAll('.cap.now').forEach((e) => e.classList.remove('now'));
    if (now) document.querySelector(`.cap[data-id="${now}"]`)?.classList.add('now');
  });
  window.matchMedia('(max-width: 899px)').addEventListener('change', renderSide);
  void total;
}

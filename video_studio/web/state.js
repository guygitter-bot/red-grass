// המצב המשותף של הממשק, התרגומים (עברית / אנגלית) וכלי עזר קטנים.

export const S = {
  project: null, canUndo: false, canRedo: false, meta: null,
  time: 0, playing: false, zoom: 60, sel: new Set(), range: null, silences: null,
  tab: 'media', sheet: false, uploads: [], jobs: {},
  lang: localStorage.getItem('studio.lang') || 'he',
};

const listeners = {};
export const on = (ev, fn) => { (listeners[ev] ||= []).push(fn); };
export const emit = (ev, data) => { for (const fn of listeners[ev] || []) fn(data); };

const STR = {
  app: ['סטודיו', 'Studio'],
  export: ['ייצוא', 'Export'], undo: ['ביטול', 'Undo'], redo: ['חזרה', 'Redo'], shortcuts: ['קיצורי מקלדת', 'Keyboard shortcuts'],
  media: ['מדיה', 'Media'], text: ['טקסט', 'Text'], captions: ['כתוביות', 'Captions'], sound: ['סאונד', 'Sound'], props: ['מאפיינים', 'Properties'],
  dropHere: ['גררו לכאן קבצים או לחצו לבחירה', 'Drop files here or click to choose'],
  dropKinds: ['וידאו · אודיו · תמונות', 'Video · audio · images'],
  dropAnywhere: ['שחררו כדי להעלות', 'Drop to upload'],
  emptyMedia: ['עדיין אין קבצים. העלו סרטון כדי להתחיל.', 'No files yet. Upload a video to start.'],
  processing: ['מעבד…', 'Processing…'], uploading: ['מעלה', 'Uploading'], failed: ['נכשל', 'Failed'],
  addToTimeline: ['הוספה לציר הזמן', 'Add to timeline'], remove: ['מחיקה', 'Delete'],
  confirmDeleteMedia: ['למחוק את הקובץ ואת כל הקטעים שלו מציר הזמן?', 'Delete this file and all its clips from the timeline?'],
  play: ['נגן', 'Play'], pause: ['עצור', 'Pause'], prevFrame: ['פריים אחורה', 'Previous frame'], nextFrame: ['פריים קדימה', 'Next frame'],
  toStart: ['להתחלה', 'To start'], toEnd: ['לסוף', 'To end'],
  split: ['פיצול', 'Split'], del: ['מחיקה', 'Delete'], markIn: ['מכאן', 'From here'], markOut: ['עד כאן', 'To here'],
  delRange: ['מחיקת הטווח', 'Delete range'], clearRange: ['ביטול הסימון', 'Clear range'],
  silences: ['הסרת שתיקות', 'Remove silences'], ripple: ['סגירת רווחים', 'Close gaps'],
  rippleHint: ['אחרי מחיקה, הקטעים שאחריה זזים וסוגרים את הרווח', 'After deleting, later clips move to close the gap'],
  addTrack: ['שכבה חדשה', 'New track'], trackVideo: ['שכבת וידאו', 'Video track'], trackAudio: ['שכבת אודיו', 'Audio track'], trackText: ['שכבת טקסט', 'Text track'],
  zoomIn: ['הגדלה', 'Zoom in'], zoomOut: ['הקטנה', 'Zoom out'], zoomFit: ['התאמה לרוחב', 'Fit to width'],
  mute: ['השתקה', 'Mute'], hide: ['הסתרה', 'Hide'], lock: ['נעילה', 'Lock'], delTrack: ['מחיקת השכבה', 'Delete track'],
  emptyTimeline: ['ציר הזמן ריק – הוסיפו סרטון מלשונית המדיה', 'The timeline is empty – add a video from the Media tab'],
  emptyStage: ['העלו סרטון והוסיפו אותו לציר הזמן', 'Upload a video and add it to the timeline'],
  threshold: ['סף שקט', 'Silence threshold'], minSilence: ['משך מינימלי', 'Minimum length'], padding: ['שוליים שנשארים', 'Padding kept'],
  detect: ['זיהוי שתיקות', 'Detect silences'], detecting: ['מזהה…', 'Detecting…'],
  silFound: ['נמצאו {n} שתיקות · {s} שניות', '{n} silences found · {s} seconds'], silNone: ['לא נמצאו שתיקות עם ההגדרות האלה', 'No silences found with these settings'],
  silRemove: ['הסרת {n} שתיקות', 'Remove {n} silences'], silHint: ['השתיקות מסומנות באדום על ציר הזמן. ההסרה סוגרת את הרווחים בכל השכבות.', 'Silences are marked in red on the timeline. Removing them closes the gaps on all tracks.'],
  silSel: ['בודק רק את הקטעים שנבחרו', 'Checking only the selected clips'],
  sec: ['שנ׳', 's'],
  textPresets: ['סגנונות מוכנים', 'Ready styles'], textHint: ['לחיצה מוסיפה טקסט במקום הסמן. אפשר לגרור אותו על המסך.', 'Click to add a text at the playhead. Drag it on the preview to move it.'],
  defaultText: ['הטקסט שלך', 'Your text'],
  autoCaptions: ['תמלול אוטומטי', 'Auto captions'], language: ['שפת הדיבור', 'Spoken language'], he: ['עברית', 'Hebrew'], en: ['אנגלית', 'English'], auto: ['זיהוי אוטומטי', 'Auto detect'],
  accuracy: ['דיוק', 'Accuracy'], fast: ['מהיר', 'Fast'], balanced: ['מאוזן', 'Balanced'], best: ['הכי מדויק (איטי)', 'Most accurate (slow)'],
  lineLen: ['אורך שורה (תווים)', 'Line length (chars)'],
  transcribe: ['תמלול', 'Transcribe'], transcribing: ['מתמלל…', 'Transcribing…'], downloadingModel: ['מוריד את מודל הדיבור (פעם אחת)…', 'Downloading the speech model (once)…'], loadingModel: ['טוען את המודל…', 'Loading the model…'],
  trHint: ['התמלול רץ במחשב שלכם. בפעם הראשונה יורד מודל הדיבור.', 'Transcription runs on your computer. The first run downloads the speech model.'],
  trDone: ['נוצרו {n} כתוביות', '{n} captions created'], cancel: ['ביטול', 'Cancel'],
  importSrt: ['ייבוא SRT', 'Import SRT'], exportSrt: ['הורדת SRT', 'Download SRT'], clearCaptions: ['מחיקת הכול', 'Clear all'],
  captionStyle: ['סגנון הכתוביות', 'Caption style'], captionList: ['הכתוביות', 'Captions'], noCaptions: ['אין עדיין כתוביות. תמללו או ייבאו קובץ SRT.', 'No captions yet. Transcribe or import an SRT file.'],
  addCaption: ['כתובית חדשה', 'New caption'],
  font: ['גופן', 'Font'], size: ['גודל', 'Size'], color: ['צבע', 'Color'], highlight: ['צבע המילה הנאמרת', 'Spoken word color'], position: ['מיקום', 'Position'],
  posX: ['אופקי', 'Horizontal'], posY: ['גובה', 'Vertical'], mode: ['הדגשה', 'Highlight'],
  mode_none: ['בלי', 'None'], mode_word: ['המילה הנאמרת', 'Spoken word'], mode_karaoke: ['קריוקי', 'Karaoke'], mode_single: ['מילה אחת בכל פעם', 'One word at a time'],
  outline: ['קו מתאר', 'Outline'], shadow: ['צל', 'Shadow'], box: ['רקע', 'Background'], opacity: ['אטימות', 'Opacity'],
  anim: ['אנימציית כניסה', 'Entrance animation'], anim_none: ['בלי', 'None'], anim_fade: ['הופעה הדרגתית', 'Fade'], anim_slide: ['החלקה מלמטה', 'Slide up'], anim_pop: ['קפיצה', 'Pop'], anim_zoom: ['זום', 'Zoom'],
  duration: ['משך', 'Duration'], start: ['התחלה', 'Start'],
  volume: ['עוצמה', 'Volume'], fadeIn: ['כניסה הדרגתית', 'Fade in'], fadeOut: ['יציאה הדרגתית', 'Fade out'],
  fit: ['התאמה למסך', 'Fit'], contain: ['כל התמונה', 'Whole picture'], cover: ['מילוי המסך', 'Fill frame'], scale: ['גודל', 'Scale'],
  clipVideo: ['קטע וידאו', 'Video clip'], clipAudio: ['קטע אודיו', 'Audio clip'], clipImage: ['תמונה', 'Image'], clipText: ['טקסט', 'Text'], clipCaption: ['כתובית', 'Caption'],
  capStyleNote: ['את מראה הכתוביות קובעים בלשונית "כתוביות".', 'Caption looks are set in the Captions tab.'],
  nSelected: ['נבחרו {n} קטעים', '{n} clips selected'],
  project: ['הפרויקט', 'Project'], frame: ['גודל הפריים', 'Frame size'], fps: ['פריימים בשנייה', 'Frames per second'],
  nothingSel: ['בחרו קטע בציר הזמן כדי לערוך אותו', 'Select a clip on the timeline to edit it'],
  soundHint: ['▶ להשמעה, + להוספה במקום הסמן', '▶ to listen, + to add at the playhead'], all: ['הכול', 'All'],
  exportTitle: ['ייצוא הסרטון', 'Export video'], quality: ['איכות', 'Quality'],
  q_max: ['מקסימלית (מומלץ)', 'Maximum (recommended)'], q_high: ['גבוהה (מהיר יותר)', 'High (faster)'], q_draft: ['טיוטה (הכי מהיר)', 'Draft (fastest)'],
  startExport: ['התחלת הייצוא', 'Start export'], exporting: ['מייצא…', 'Exporting…'], exportDone: ['הסרטון מוכן', 'Your video is ready'],
  download: ['הורדה', 'Download'], exportAgain: ['ייצוא נוסף', 'Export again'], exportEmpty: ['אין מה לייצא – ציר הזמן ריק', 'Nothing to export – the timeline is empty'],
  exportInfo: ['MP4 · H.264 · {w}×{h} · {fps} fps · {d}', 'MP4 · H.264 · {w}×{h} · {fps} fps · {d}'],
  vertical: ['לאורך', 'Vertical'], horizontal: ['לרוחב', 'Horizontal'], portrait45: ['פיד', 'Feed'], square: ['ריבוע', 'Square'],
  apiTitle: ['API · MCP – עריכה בעזרת סוכן AI', 'API · MCP – let an AI agent edit'],
  apiIntro: ['כל פעולה בעורך זמינה גם לסוכן AI: דרך שרת MCP או דרך API מקומי. מה שהסוכן עושה מופיע כאן מיד, ואפשר לבטל עם Ctrl+Z.', 'Every editor action is available to an AI agent: through the MCP server or the local API. Whatever the agent does shows up here immediately, and can be undone with Ctrl+Z.'],
  mcpConnect: ['חיבור ל-Claude Code', 'Connect to Claude Code'], mcpJson: ['חיבור לכלים אחרים (קובץ הגדרות MCP)', 'Other tools (MCP config file)'],
  apiExample: ['דוגמה ל-API', 'API example'], apiList: ['רשימת הכתובות', 'Endpoints'], copy: ['העתקה', 'Copy'], copied: ['הועתק', 'Copied'],
  apiUpload: ['העלאת קובץ (גוף הבקשה הוא הקובץ)', 'Upload a file (the request body is the file)'], apiState: ['מצב הפרויקט', 'Project state'], apiEvents: ['עדכונים חיים (SSE)', 'Live updates (SSE)'],
  close: ['סגירה', 'Close'],
  k_space: ['נגן / עצור', 'Play / pause'], k_s: ['פיצול במקום הסמן', 'Split at playhead'], k_del: ['מחיקת הקטע או הטווח', 'Delete clip or range'],
  k_undo: ['ביטול', 'Undo'], k_redo: ['חזרה', 'Redo'], k_zoom: ['זום בציר הזמן', 'Zoom the timeline'], k_frame: ['פריים אחורה / קדימה', 'Frame back / forward'],
  k_io: ['סימון טווח: מכאן / עד כאן', 'Mark range: from / to'], k_home: ['להתחלה / לסוף', 'To start / end'], k_esc: ['ביטול בחירה', 'Clear selection'],
  wheel: ['גלגלת', 'Wheel'],
  error: ['שגיאה', 'Error'], offline: ['אין חיבור לשרת הסטודיו', 'No connection to the studio server'],
};

export function t(key, vars) {
  const pair = STR[key];
  let s = pair ? pair[S.lang === 'he' ? 0 : 1] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
export const label = (o) => (o ? o[S.lang] || o.he || o.en : '');

export function setLang(lang) {
  S.lang = lang;
  localStorage.setItem('studio.lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  emit('lang');
}

// יצירת אלמנט: h('button.btn', {onclick}, 'טקסט')
export function h(sel, attrs, ...kids) {
  const id = /#([\w-]+)/.exec(sel)?.[1];
  const [tag, ...cls] = sel.replace(/#[\w-]+/, '').split('.');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += ` ${v}`;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

const ICONS = {
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  prev: '<path d="M17 6l-7 6 7 6zM7 6v12"/>', next: '<path d="M7 6l7 6-7 6zM17 6v12"/>',
  start: '<path d="M19 6l-8 6 8 6zM6 5v14"/>', end: '<path d="M5 6l8 6-8 6zM18 5v14"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
  undo: '<path d="M8 5L4 9l4 4"/><path d="M4 9h10a6 6 0 010 12h-3"/>', redo: '<path d="M16 5l4 4-4 4"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  film: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M8 4.5v15M16 4.5v15M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5"/>',
  type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>', captions: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 14h4M13 14h4M7 10.5h2M11 10.5h6"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  volume: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5zM15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>', muted: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>', eyeOff: '<path d="M4 4l16 16M9.5 6a9 9 0 012.5-.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-3 3.7M6 7.7A16 16 0 002.5 12S6 18.5 12 18.5a9 9 0 003.3-.6"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
  plug: '<path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 01-11 0zM12 16.5V21"/>',
  in: '<path d="M7 4v16M11 8l-4 4 4 4"/><path d="M7 12h12" stroke-dasharray="2 2.5"/>', out: '<path d="M17 4v16M13 8l4 4-4 4"/><path d="M17 12H5" stroke-dasharray="2 2.5"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>', layers: '<path d="M12 4l9 5-9 5-9-5zM3 14l9 5 9-5"/>',
  fit: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 16V6a2 2 0 012-2h8"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2.5 4.5 3.5"/>',
};
export const icon = (name, size = 18) => h('span.ic', { html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>` });

export function fmt(sec, frames = false) {
  sec = Math.max(0, sec || 0);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  const base = `${m}:${String(s).padStart(2, '0')}`;
  if (!frames) return base;
  const fps = S.project?.settings.fps || 30;
  return `${base}:${String(Math.floor((sec % 1) * fps + 1e-6)).padStart(2, '0')}`;
}

export function toast(msg, kind = '') {
  const el = h(`div.toast.${kind || 'info'}`, { role: 'status' }, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 2600);
}

// קריאה לפעולה בשרת – אותן פעולות שזמינות ב-API וב-MCP
export async function api(name, args = {}) {
  let res;
  try {
    res = await fetch(`/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  } catch {
    toast(t('offline'), 'err');
    throw new Error('offline');
  }
  const data = await res.json();
  if (!data.ok) { toast(`${t('error')}: ${data.error}`, 'err'); throw new Error(data.error); }
  return data.result;
}

export const clipEnd = (c) => c.start + c.duration;
export const total = () => (S.project ? S.project.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0) : 0);
export const mediaOf = (c) => S.project.media.find((m) => m.id === c.mediaId);
export const trackOf = (c) => S.project.tracks.find((x) => x.id === c.trackId);
export const selected = () => S.project.clips.filter((c) => S.sel.has(c.id));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const isMobile = () => window.matchMedia('(max-width: 899px)').matches;

export function seek(time) {
  S.time = clamp(time, 0, Math.max(total(), 0));
  emit('time');
}
export function select(ids, add = false) {
  if (!add) S.sel.clear();
  for (const id of [].concat(ids)) { if (add && S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); }
  emit('sel');
}

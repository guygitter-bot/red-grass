// פעולות עריכה טהורות על הפרויקט (בלי קבצים ובלי רשת) – משמשות את השרת, את ה-API ואת ה-MCP.

export const EPS = 1e-4;
export const MIN_DUR = 0.04;

export const r3 = (x) => Math.round(x * 1000) / 1000;
export const newId = (p = 'c') => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const clipEnd = (c) => c.start + c.duration;

export const SIZES = {
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '4k': [3840, 2160],
};
export const FPS = [24, 25, 30, 50, 60];

// ברירת מחדל לסגנון הכתוביות
export const DEFAULT_CAPTION_STYLE = {
  preset: 'highlight', font: 'Heebo', size: 5.2, color: '#ffffff', highlight: '#ffd400',
  outline: 9, outlineColor: '#000000', box: false, boxColor: '#000000', boxOpacity: 0.7,
  y: 0.8, mode: 'word',
};

export function emptyProject() {
  return {
    settings: { width: 1080, height: 1920, fps: 30, ripple: true, autoSize: true },
    media: [],
    tracks: [
      { id: 'T1', kind: 'text', name: 'T1' },
      { id: 'V1', kind: 'video', name: 'V1' },
      { id: 'A1', kind: 'audio', name: 'A1' },
    ],
    clips: [],
    captionStyle: { ...DEFAULT_CAPTION_STYLE },
  };
}

export function trackKindFor(type) {
  if (type === 'video' || type === 'image') return 'video';
  if (type === 'audio') return 'audio';
  return type; // text / caption
}

export function trackClips(p, trackId, ignoreId) {
  return p.clips.filter((c) => c.trackId === trackId && c.id !== ignoreId).sort((a, b) => a.start - b.start);
}

export function totalDuration(p) {
  return r3(p.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0));
}

export function getClip(p, id) {
  const c = p.clips.find((x) => x.id === id);
  if (!c) throw new Error(`clip not found: ${id}`);
  return c;
}

export function getTrack(p, id) {
  const t = p.tracks.find((x) => x.id === id);
  if (!t) throw new Error(`track not found: ${id}`);
  return t;
}

// סדר השכבות מלמעלה למטה: כתוביות, טקסט, וידאו (העליונה ראשונה), אודיו.
const KIND_ORDER = { caption: 0, text: 1, video: 2, audio: 3 };

export function addTrack(p, kind) {
  if (!(kind in KIND_ORDER)) throw new Error(`bad track kind: ${kind}`);
  const prefix = { caption: 'C', text: 'T', video: 'V', audio: 'A' }[kind];
  let n = 1;
  while (p.tracks.some((t) => t.id === prefix + n)) n++;
  const track = { id: prefix + n, kind, name: prefix + n };
  if (kind === 'audio') {
    p.tracks.push(track);
  } else {
    // שכבה חדשה נכנסת מעל השכבות הקיימות מאותו סוג
    let i = p.tracks.findIndex((t) => KIND_ORDER[t.kind] >= KIND_ORDER[kind]);
    if (i < 0) i = p.tracks.length;
    p.tracks.splice(i, 0, track);
  }
  return track;
}

export function ensureTrack(p, kind) {
  const all = p.tracks.filter((t) => t.kind === kind);
  // לווידאו – השכבה הראשית היא התחתונה
  return (kind === 'video' ? all[all.length - 1] : all[0]) || addTrack(p, kind);
}

export function deleteTrack(p, id) {
  getTrack(p, id);
  p.clips = p.clips.filter((c) => c.trackId !== id);
  p.tracks = p.tracks.filter((t) => t.id !== id);
}

// מקום פנוי בשכבה: אם יש חפיפה – הקטע נדחף אל אחרי הקטע שמפריע.
export function freeStart(p, trackId, start, duration, ignoreId) {
  let s = Math.max(0, start);
  for (const c of trackClips(p, trackId, ignoreId)) {
    if (s < clipEnd(c) - EPS && s + duration > c.start + EPS) s = clipEnd(c);
  }
  return r3(s);
}

export function isFree(p, trackId, start, duration, ignoreId) {
  return trackClips(p, trackId, ignoreId).every((c) => !(start < clipEnd(c) - EPS && start + duration > c.start + EPS));
}

export function trackEnd(p, trackId) {
  return r3(trackClips(p, trackId).reduce((m, c) => Math.max(m, clipEnd(c)), 0));
}

// שכבה מהסוג הזה שפנויה בזמן המבוקש; אם אין – נפתחת שכבה חדשה.
export function freeTrack(p, kind, start, duration) {
  const t = p.tracks.find((x) => x.kind === kind && !x.locked && isFree(p, x.id, start, duration));
  return t || addTrack(p, kind);
}

export function addMediaClip(p, media, { trackId, start, duration } = {}) {
  const type = media.kind;
  const kind = trackKindFor(type);
  let track;
  if (trackId) {
    track = getTrack(p, trackId);
    if (track.kind !== kind) throw new Error(`a ${type} clip cannot go on a ${track.kind} track`);
  } else if (start != null) {
    const d = duration || media.duration || 4;
    track = kind === 'audio' ? freeTrack(p, kind, start, d) : ensureTrack(p, kind);
  } else {
    track = ensureTrack(p, kind);
  }
  const dur = r3(Math.max(MIN_DUR, duration || (type === 'image' ? 4 : media.duration || 4)));
  const clip = {
    id: newId('c'), type, trackId: track.id, mediaId: media.id,
    start: 0, duration: dur, offset: 0, volume: 1, fadeIn: 0, fadeOut: 0,
  };
  if (kind === 'video') Object.assign(clip, { fit: 'contain', scale: 1, x: 0.5, y: 0.5 });
  clip.start = freeStart(p, track.id, start == null ? trackEnd(p, track.id) : start, dur);
  // הסרטון הראשון קובע אם הפרויקט לאורך או לרוחב
  if (kind === 'video' && p.settings.autoSize && media.width && media.height
    && !p.clips.some((c) => trackKindFor(c.type) === 'video')) {
    const [w, h] = media.height > media.width ? SIZES['9:16'] : media.height === media.width ? SIZES['1:1'] : SIZES['16:9'];
    p.settings.width = w; p.settings.height = h;
  }
  p.clips.push(clip);
  return clip;
}

export const TEXT_DEFAULTS = {
  text: 'טקסט', font: 'Heebo', size: 7, color: '#ffffff', outline: 0, outlineColor: '#000000',
  shadow: true, box: false, boxColor: '#000000', boxOpacity: 0.75, x: 0.5, y: 0.5, anim: 'fade',
};

export function addTextClip(p, props = {}) {
  const { start, duration, trackId, ...style } = props;
  const dur = r3(Math.max(MIN_DUR, duration || 3));
  const at = Math.max(0, start || 0);
  const track = trackId ? getTrack(p, trackId) : freeTrack(p, 'text', at, dur);
  if (track.kind !== 'text') throw new Error('text clips go on a text track');
  const clip = { id: newId('c'), type: 'text', trackId: track.id, start: 0, duration: dur, ...TEXT_DEFAULTS, ...style };
  clip.start = freeStart(p, track.id, at, dur);
  p.clips.push(clip);
  return clip;
}

// חלק מקטע: הזמן המקומי [a, b) מתוך הקטע. שומר על מקור המדיה ועל תזמון המילים בכתוביות.
export function sliceClip(c, a, b) {
  const out = { ...c, duration: r3(b - a) };
  if (c.mediaId) out.offset = r3((c.offset || 0) + a);
  if (c.type === 'caption' && Array.isArray(c.words) && c.words.length) {
    out.words = c.words
      .filter((w) => { const mid = (w.s + w.e) / 2; return mid >= a && mid < b; })
      .map((w) => ({ w: w.w, s: r3(Math.max(0, w.s - a)), e: r3(Math.min(b - a, w.e - a)) }));
    out.text = out.words.map((w) => w.w).join(' ');
  }
  if (a > 0) out.fadeIn = 0;
  if (b < c.duration) out.fadeOut = 0;
  return out;
}

// פיצול בזמן t. בלי רשימת קטעים – מפצל את כל מה שנמצא מתחת לסמן.
export function splitAt(p, t, ids) {
  const created = [];
  for (const c of [...p.clips]) {
    if (ids && ids.length && !ids.includes(c.id)) continue;
    if (p.tracks.find((x) => x.id === c.trackId)?.locked) continue;
    if (t <= c.start + MIN_DUR || t >= clipEnd(c) - MIN_DUR) continue;
    const local = r3(t - c.start);
    const left = sliceClip(c, 0, local);
    const right = { ...sliceClip(c, local, c.duration), id: newId('c'), start: r3(t) };
    Object.assign(c, left);
    p.clips.push(right);
    created.push(right.id);
  }
  return created;
}

// מחיקת קטעים. ripple – הקטעים שאחריהם באותה שכבה זזים שמאלה וסוגרים את הרווח.
export function deleteClips(p, ids, ripple = true) {
  const gone = p.clips.filter((c) => ids.includes(c.id)).sort((a, b) => b.start - a.start);
  p.clips = p.clips.filter((c) => !ids.includes(c.id));
  if (ripple) {
    for (const g of gone) {
      for (const c of p.clips) {
        if (c.trackId === g.trackId && c.start >= clipEnd(g) - EPS) c.start = r3(c.start - g.duration);
      }
    }
  }
  return gone.length;
}

// מחיקת טווח זמן מכל השכבות (או מהשכבות שנבחרו). ripple – כל מה שאחרי הטווח זז שמאלה.
export function deleteRange(p, from, to, { ripple = true, trackIds } = {}) {
  from = Math.max(0, from);
  if (!(to > from + EPS)) return 0;
  const len = to - from;
  const out = [];
  let touched = 0;
  for (const c of p.clips) {
    const track = p.tracks.find((x) => x.id === c.trackId);
    if ((trackIds && !trackIds.includes(c.trackId)) || track?.locked) { out.push(c); continue; }
    const s = c.start, e = clipEnd(c);
    if (e <= from + EPS) { out.push(c); continue; }
    if (s >= to - EPS) { if (ripple) c.start = r3(s - len); out.push(c); continue; }
    touched++;
    if (s < from - EPS) {
      const left = sliceClip(c, 0, from - s);
      if (left.duration >= MIN_DUR) out.push({ ...left, start: r3(s) });
    }
    if (e > to + EPS) {
      const right = sliceClip(c, to - s, c.duration);
      if (right.duration >= MIN_DUR) {
        out.push({ ...right, id: s < from - EPS ? newId('c') : c.id, start: r3(ripple ? from : to) });
      }
    }
  }
  p.clips = out;
  return touched;
}

// מחיקת כמה טווחים בבת אחת (מהסוף להתחלה, כדי שהזמנים לא יזוזו באמצע).
export function deleteRanges(p, ranges, opts) {
  const sorted = mergeRanges(ranges).sort((a, b) => b[0] - a[0]);
  for (const [a, b] of sorted) deleteRange(p, a, b, opts);
  return sorted.length;
}

export function mergeRanges(ranges) {
  const s = ranges.map(([a, b]) => [a, b]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + EPS) last[1] = Math.max(last[1], r[1]);
    else out.push(r);
  }
  return out;
}

export function subtractRanges(ranges, cut) {
  let out = mergeRanges(ranges);
  for (const [ca, cb] of mergeRanges(cut)) {
    const next = [];
    for (const [a, b] of out) {
      if (cb <= a || ca >= b) { next.push([a, b]); continue; }
      if (ca > a) next.push([a, ca]);
      if (cb < b) next.push([cb, b]);
    }
    out = next;
  }
  return out;
}

export function moveClip(p, id, { start, trackId }) {
  const c = getClip(p, id);
  if (trackId && trackId !== c.trackId) {
    const t = getTrack(p, trackId);
    if (t.kind !== trackKindFor(c.type)) throw new Error(`a ${c.type} clip cannot go on a ${t.kind} track`);
    c.trackId = trackId;
  }
  c.start = freeStart(p, c.trackId, start == null ? c.start : start, c.duration, c.id);
  return c;
}

const NUM_LIMITS = {
  volume: [0, 2], fadeIn: [0, 30], fadeOut: [0, 30], scale: [0.05, 5], x: [-0.5, 1.5], y: [-0.5, 1.5],
  size: [1, 40], outline: [0, 30], boxOpacity: [0, 1],
};

// עדכון מאפיינים של קטע, כולל קיצוץ (start / duration / offset) בגבולות המדיה.
export function updateClip(p, id, patch) {
  const c = getClip(p, id);
  const media = c.mediaId ? p.media.find((m) => m.id === c.mediaId) : null;
  const { start, duration, offset, trackId, id: _i, type: _t, mediaId: _m, ...rest } = patch;
  for (const [k, v] of Object.entries(rest)) {
    if (k in NUM_LIMITS) {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error(`${k} must be a number`);
      c[k] = Math.min(NUM_LIMITS[k][1], Math.max(NUM_LIMITS[k][0], n));
    } else c[k] = v;
  }
  if (rest.text != null && c.type === 'caption') c.words = retimeWords(c.words, String(rest.text), c.duration);
  if (offset != null || duration != null) {
    let off = offset != null ? Math.max(0, Number(offset)) : c.offset || 0;
    let dur = duration != null ? Math.max(MIN_DUR, Number(duration)) : c.duration;
    if (media && c.type !== 'image' && media.duration) {
      off = Math.min(off, Math.max(0, media.duration - MIN_DUR));
      dur = Math.min(dur, media.duration - off);
    }
    if (c.type === 'caption' && c.words?.length && dur !== c.duration) {
      const k = dur / c.duration;
      c.words = c.words.map((w) => ({ w: w.w, s: r3(w.s * k), e: r3(w.e * k) }));
    }
    if (c.mediaId) c.offset = r3(off);
    c.duration = r3(dur);
  }
  if (start != null || trackId) moveClip(p, id, { start: start == null ? c.start : Number(start), trackId });
  else if (duration != null) {
    // הארכה לא נכנסת לתוך הקטע הבא
    const next = trackClips(p, c.trackId, c.id).find((o) => o.start >= c.start - EPS);
    if (next && clipEnd(c) > next.start) c.duration = r3(Math.max(MIN_DUR, next.start - c.start));
  }
  return c;
}

// כשעורכים טקסט של כתובית: אם מספר המילים זהה שומרים את התזמון, אחרת מחלקים אותו שווה לפי אורך.
export function retimeWords(old, text, duration) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  if (old && old.length === words.length) return old.map((w, i) => ({ ...w, w: words[i] }));
  const total = words.reduce((n, w) => n + w.length + 1, 0);
  let t = 0;
  return words.map((w) => {
    const d = (duration * (w.length + 1)) / total;
    const out = { w, s: r3(t), e: r3(t + d) };
    t += d;
    return out;
  });
}

// מילים עם זמנים (על ציר הזמן) -> כתוביות קצרות.
export function wordsToCaptions(words, { maxChars = 26, maxGap = 0.7 } = {}) {
  const caps = [];
  let cur = [];
  const flush = () => { if (cur.length) caps.push(cur); cur = []; };
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.w.length + 1, 0);
    const prev = cur[cur.length - 1];
    if (prev && (len + w.w.length > maxChars || w.s - prev.e > maxGap
      || (/[.?!…]$/.test(prev.w) && len > maxChars * 0.4))) flush();
    cur.push(w);
  }
  flush();
  return caps.map((ws, i) => {
    const start = ws[0].s;
    const nextStart = caps[i + 1] ? caps[i + 1][0].s : Infinity;
    const end = Math.max(start + 0.2, Math.min(ws[ws.length - 1].e + 0.12, nextStart));
    return {
      start: r3(start), duration: r3(end - start), text: ws.map((w) => w.w).join(' '),
      words: ws.map((w) => ({ w: w.w, s: r3(w.s - start), e: r3(Math.min(end, w.e) - start) })),
    };
  });
}

// מחליף (או מוסיף) כתוביות בשכבת הכתוביות.
export function setCaptions(p, caps, { replace = true } = {}) {
  const track = ensureTrack(p, 'caption');
  if (replace) p.clips = p.clips.filter((c) => c.type !== 'caption');
  const sorted = [...caps].filter((c) => c.text && c.duration > 0).sort((a, b) => a.start - b.start);
  const made = [];
  sorted.forEach((c, i) => {
    const next = sorted[i + 1];
    const dur = r3(Math.max(MIN_DUR, next ? Math.min(c.duration, next.start - c.start) : c.duration));
    const clip = {
      id: newId('c'), type: 'caption', trackId: track.id, start: r3(Math.max(0, c.start)), duration: dur,
      text: c.text, words: c.words?.length ? c.words : retimeWords(null, c.text, dur),
    };
    if (!replace) clip.start = freeStart(p, track.id, clip.start, dur);
    p.clips.push(clip);
    made.push(clip);
  });
  return made;
}

export function parseSrt(srt) {
  const ts = (s) => { const m = s.match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0').slice(0, 3) / 1000 : 0; };
  const caps = [];
  for (const block of String(srt).replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const text = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) caps.push({ start: ts(a), duration: Math.max(0.1, ts(b) - ts(a)), text });
  }
  return caps;
}

export function toSrt(p) {
  const f = (t) => {
    const ms = Math.round(t * 1000);
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  };
  return p.clips.filter((c) => c.type === 'caption').sort((a, b) => a.start - b.start)
    .map((c, i) => `${i + 1}\n${f(c.start)} --> ${f(clipEnd(c))}\n${c.text}\n`).join('\n');
}

// שתיקות על ציר הזמן: מקומות שבהם קטע אחד לפחות שקט ואף קטע אחר לא משמיע קול.
// silencesByMedia: { mediaId: [[from, to], ...] } בזמן של קובץ המקור.
export function timelineSilences(p, clips, silencesByMedia, { minDuration = 0.5, padding = 0.08 } = {}) {
  const silent = [];
  const loud = [];
  for (const c of clips) {
    const off = c.offset || 0;
    const mine = [];
    for (const [a, b] of silencesByMedia[c.mediaId] || []) {
      const s = Math.max(a, off), e = Math.min(b, off + c.duration);
      if (e > s) mine.push([c.start + s - off, c.start + e - off]);
    }
    silent.push(...mine);
    loud.push(...subtractRanges([[c.start, clipEnd(c)]], mine));
  }
  return subtractRanges(silent, loud)
    .map(([a, b]) => [r3(a + (a > EPS ? padding : 0)), r3(b - padding)])
    .filter(([a, b]) => b - a >= Math.max(MIN_DUR, minDuration - 2 * padding - EPS));
}

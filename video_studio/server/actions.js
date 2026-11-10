// כל פעולות העורך במקום אחד. מכאן נבנים גם ה-API (POST /api/<name>) וגם כלי ה-MCP – והממשק עצמו משתמש באותן פעולות.
import fs from 'node:fs';
import path from 'node:path';
import * as E from './edit.js';
import { project, commit, touchMedia, undo, redo, publicState, resetProject, jobs, publicJob, DIRS } from './store.js';
import { importMedia, registerMedia, deleteMediaFiles, findMedia, detectSilences } from './media.js';
import { startExport, cancelJob } from './export.js';
import { startTranscribe, speechClips, MODELS } from './transcribe.js';
import { ensureSfx, publicSfx, SFX, SFX_CATEGORIES } from './sfx.js';
import { TEXT_PRESETS, CAPTION_PRESETS, ANIMS, CAPTION_MODES } from './presets.js';
import { FONTS } from './ass.js';

const num = (description, extra = {}) => ({ type: 'number', description, ...extra });
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const bool = (description) => ({ type: 'boolean', description });
const ids = (description) => ({ type: 'array', items: { type: 'string' }, description });

const summary = () => ({
  settings: project.settings,
  duration: E.totalDuration(project),
  tracks: project.tracks,
  clips: [...project.clips].sort((a, b) => a.start - b.start).map((c) => {
    const { words, ...rest } = c;
    return { ...rest, end: E.r3(E.clipEnd(c)) };
  }),
  media: project.media.map(({ id, name, kind, duration, width, height, fps, hasAudio, status }) => ({ id, name, kind, duration, width, height, fps, hasAudio, status })),
  captionStyle: project.captionStyle,
});

async function silenceRanges({ thresholdDb = -35, minDuration = 0.5, padding = 0.08, clipIds }) {
  const clips = speechClips(project, clipIds);
  if (!clips.length) throw new Error('there is no clip with sound');
  thresholdDb = Math.min(-5, Math.max(-80, Number(thresholdDb)));
  minDuration = Math.min(10, Math.max(0.1, Number(minDuration)));
  padding = Math.min(minDuration / 2 - 0.01, Math.max(0, Number(padding)));
  const byMedia = {};
  for (const c of clips) byMedia[c.mediaId] ||= await detectSilences(findMedia(c.mediaId), thresholdDb, minDuration);
  return E.timelineSilences(project, clips, byMedia, { minDuration, padding });
}

// מחכה לסוף המשימה; משימה שנכשלה היא שגיאה
async function finished(job) {
  const done = await job.promise;
  if (done.status === 'error') throw new Error(done.error);
  return done;
}

async function addSfx({ sfxId, start, volume }) {
  const s = SFX.find((x) => x.id === sfxId);
  if (!s) throw new Error(`unknown sound: ${sfxId}. Use list_sounds.`);
  let media = project.media.find((m) => m.source === `sfx:${s.id}`);
  if (!media) {
    const file = path.join(DIRS.media, `sfx-${s.file}`);
    await fs.promises.copyFile(path.join(DIRS.sfx, s.file), file);
    const reg = await registerMedia(file, `${s.en}.wav`, { source: `sfx:${s.id}`, label: { he: s.he, en: s.en } });
    await reg.done;
    media = reg.media;
  }
  return commit((p) => {
    const clip = E.addMediaClip(p, media, { start: Math.max(0, Number(start) || 0) });
    if (volume != null) E.updateClip(p, clip.id, { volume });
    return clip;
  });
}

export const ACTIONS = [
  {
    name: 'get_project', description: 'Get the whole project: settings (frame size, fps), tracks, clips with start/end times, media library and caption style. Call this first.',
    params: {}, run: () => summary(),
  },
  {
    name: 'import_media', description: 'Upload a video / audio / image file into the media library from a local file path on this computer, or from a URL. Returns the media id (use add_clip to put it on the timeline).',
    params: { path: str('Absolute path of a local file'), url: str('http(s) URL of a file to download'), name: str('Display name (optional)') },
    run: async (a, ctx) => {
      if (a.path && !ctx.local) throw new Error('importing by path is only allowed from this computer');
      const { media, done } = await importMedia(a);
      await done;
      if (media.status === 'error') throw new Error(media.error);
      return media;
    },
  },
  {
    name: 'delete_media', description: 'Delete a media file from the library, together with every clip that uses it.',
    params: { mediaId: str('Media id', { required: true }) },
    run: ({ mediaId }) => {
      const m = findMedia(mediaId);
      commit((p) => { p.clips = p.clips.filter((c) => c.mediaId !== mediaId); });
      touchMedia((p) => { p.media = p.media.filter((x) => x.id !== mediaId); });
      deleteMediaFiles(m);
      return { deleted: mediaId };
    },
  },
  {
    name: 'add_clip', description: 'Put a media file on the timeline. Without "start" the clip is appended at the end of the track. Video and images go on video tracks, audio on audio tracks.',
    params: { mediaId: str('Media id', { required: true }), start: num('Timeline time in seconds'), trackId: str('Track id (optional)'), duration: num('Clip length in seconds (default: whole file; images: 4s)') },
    run: (a) => commit((p) => E.addMediaClip(p, findMedia(a.mediaId), a)),
  },
  {
    name: 'update_clip', description: 'Change a clip: move it (start, trackId), trim it (offset = where it starts inside the source file, duration), or set properties – volume (0-2), fadeIn / fadeOut (seconds), fit (contain | cover), scale, x, y (0-1 position of the centre). Text clips: text, font, size (% of frame height), color, outline, outlineColor, shadow, box, boxColor, boxOpacity, anim. Caption clips: text.',
    params: { clipId: str('Clip id', { required: true }), patch: { type: 'object', description: 'Fields to change', required: true } },
    run: ({ clipId, patch }) => commit((p) => E.updateClip(p, clipId, patch || {})),
  },
  {
    name: 'split', description: 'Cut clips in two at a timeline time. Without clipIds, every clip under that time is split.',
    params: { time: num('Timeline time in seconds', { required: true }), clipIds: ids('Only split these clips') },
    run: ({ time, clipIds }) => ({ created: commit((p) => E.splitAt(p, Number(time), clipIds)) }),
  },
  {
    name: 'delete_clips', description: 'Delete clips. With ripple (default) the following clips on the same track move left to close the gap.',
    params: { clipIds: ids('Clip ids', { required: true }), ripple: bool('Close the gap (default: the project setting, normally true)') },
    run: ({ clipIds, ripple }) => ({ deleted: commit((p) => E.deleteClips(p, clipIds || [], ripple ?? p.settings.ripple)) }),
  },
  {
    name: 'delete_range', description: 'Delete a time range ("from here to there") from all tracks and close the gap (ripple delete).',
    params: { from: num('Range start in seconds', { required: true }), to: num('Range end in seconds', { required: true }), ripple: bool('Close the gap (default true)'), trackIds: ids('Only these tracks (default: all)') },
    run: ({ from, to, ripple, trackIds }) => ({ clipsAffected: commit((p) => E.deleteRange(p, Number(from), Number(to), { ripple: ripple ?? true, trackIds })), duration: E.totalDuration(project) }),
  },
  {
    name: 'detect_silences', description: 'Find silent parts of the speech (selected clips, or the video clips). Returns timeline ranges [from, to] without changing anything.',
    params: { thresholdDb: num('Volume below this is silence, in dB (default -35)'), minDuration: num('Shortest silence to report, seconds (default 0.5)'), padding: num('Seconds of silence to keep at each edge (default 0.08)'), clipIds: ids('Only check these clips') },
    run: async (a) => { const ranges = await silenceRanges(a); return { ranges, count: ranges.length, total: E.r3(ranges.reduce((n, [x, y]) => n + y - x, 0)) }; },
  },
  {
    name: 'remove_silences', description: 'Detect silent parts and delete them from all tracks, closing the gaps. Same parameters as detect_silences; or pass "ranges" to delete exactly those.',
    params: { thresholdDb: num('dB threshold (default -35)'), minDuration: num('Minimum silence, seconds (default 0.5)'), padding: num('Silence kept at each edge (default 0.08)'), clipIds: ids('Only check these clips'), ranges: { type: 'array', description: 'Explicit ranges [[from, to], ...] from detect_silences', items: { type: 'array', items: { type: 'number' } } } },
    run: async (a) => {
      const ranges = a.ranges?.length ? a.ranges : await silenceRanges(a);
      const before = E.totalDuration(project);
      commit((p) => E.deleteRanges(p, ranges));
      return { removed: ranges.length, secondsRemoved: E.r3(before - E.totalDuration(project)), duration: E.totalDuration(project) };
    },
  },
  {
    name: 'transcribe', description: 'Transcribe the speech (Hebrew or English) and turn it into timed captions with word timing. Replaces existing captions. Runs locally; the first run downloads the speech model.',
    params: { language: str('Language of the speech', { enum: ['he', 'en', 'auto'] }), model: str('Speed / accuracy', { enum: Object.keys(MODELS) }), maxChars: num('Maximum characters per caption'), clipIds: ids('Only these clips'), wait: bool('Wait until finished (default true)') },
    run: async (a) => { const job = startTranscribe(a); return a.wait === false ? publicJob(job) : finished(job); },
  },
  {
    name: 'set_captions', description: 'Set captions directly: a list of {start, duration, text} (seconds on the timeline). Replaces the existing captions unless replace=false.',
    params: { captions: { type: 'array', required: true, description: 'Captions', items: { type: 'object', properties: { start: { type: 'number' }, duration: { type: 'number' }, text: { type: 'string' } }, required: ['start', 'duration', 'text'] } }, replace: bool('Replace existing captions (default true)') },
    run: ({ captions, replace }) => ({ captions: commit((p) => E.setCaptions(p, captions || [], { replace: replace ?? true })).length }),
  },
  {
    name: 'import_srt', description: 'Create captions from SRT subtitle text.',
    params: { srt: str('Contents of an .srt file', { required: true }) },
    run: ({ srt }) => ({ captions: commit((p) => E.setCaptions(p, E.parseSrt(srt))).length }),
  },
  {
    name: 'clear_captions', description: 'Delete all captions.', params: {},
    run: () => { commit((p) => { p.clips = p.clips.filter((c) => c.type !== 'caption'); }); return { ok: true }; },
  },
  {
    name: 'set_caption_style', description: `Choose how captions look. Either a ready preset (${CAPTION_PRESETS.map((x) => x.id).join(', ')}) and/or single fields: font, size (% of frame height), color, highlight (colour of the spoken word), outline, outlineColor, box, boxColor, boxOpacity, y (0 top - 1 bottom), mode (${CAPTION_MODES.join(' | ')}).`,
    params: { preset: str('Preset id'), style: { type: 'object', description: 'Fields to change' } },
    run: ({ preset, style }) => commit((p) => {
      if (preset) {
        const pr = CAPTION_PRESETS.find((x) => x.id === preset);
        if (!pr) throw new Error(`unknown caption preset: ${preset}`);
        Object.assign(p.captionStyle, { boxColor: '#000000', boxOpacity: 0.7 }, pr.style, { preset });
      }
      Object.assign(p.captionStyle, style || {});
      return p.captionStyle;
    }),
  },
  {
    name: 'add_text', description: `Add a title / text on the video. preset: ${TEXT_PRESETS.map((x) => x.id).join(', ')}. Fonts: ${FONTS.map((f) => f.family).join(', ')}. anim: ${ANIMS.join(' | ')}. x, y are the centre position (0-1), size is % of the frame height.`,
    params: { text: str('The text (\\n for a new line)', { required: true }), preset: str('Ready style'), start: num('Timeline time, seconds (default 0)'), duration: num('Seconds on screen (default 3)'), style: { type: 'object', description: 'Overrides: font, size, color, outline, outlineColor, shadow, box, boxColor, boxOpacity, x, y, anim' } },
    run: ({ text, preset, start, duration, style }) => commit((p) => {
      const pr = preset ? TEXT_PRESETS.find((x) => x.id === preset) : TEXT_PRESETS[0];
      if (!pr) throw new Error(`unknown text preset: ${preset}`);
      return E.addTextClip(p, { ...pr.style, ...style, text: String(text), start, duration, preset: pr.id });
    }),
  },
  {
    name: 'list_sounds', description: 'List the built-in sound effects and music loops, by category.', params: {},
    run: () => ({ categories: SFX_CATEGORIES, sounds: publicSfx() }),
  },
  {
    name: 'add_sound', description: 'Add a built-in sound effect or music loop to the timeline at a given time.',
    params: { soundId: str('Sound id from list_sounds', { required: true }), start: num('Timeline time, seconds (default 0)'), volume: num('Volume 0-2 (default 1)') },
    run: ({ soundId, start, volume }) => addSfx({ sfxId: soundId, start, volume }),
  },
  {
    name: 'add_track', description: 'Add a track (layer).', params: { kind: str('Track kind', { enum: ['video', 'audio', 'text'], required: true }) },
    run: ({ kind }) => commit((p) => E.addTrack(p, kind)),
  },
  {
    name: 'update_track', description: 'Mute, hide or lock a track.',
    params: { trackId: str('Track id', { required: true }), muted: bool('Mute the sound'), hidden: bool('Hide the picture / text'), locked: bool('Protect from edits') },
    run: ({ trackId, ...patch }) => commit((p) => {
      const t = E.getTrack(p, trackId);
      for (const k of ['muted', 'hidden', 'locked']) if (patch[k] != null) t[k] = !!patch[k];
      return t;
    }),
  },
  {
    name: 'delete_track', description: 'Delete a track and its clips.', params: { trackId: str('Track id', { required: true }) },
    run: ({ trackId }) => { commit((p) => E.deleteTrack(p, trackId)); return { deleted: trackId }; },
  },
  {
    name: 'set_project', description: `Project settings: frame size (size: ${Object.keys(E.SIZES).join(' | ')}, or width + height), fps (${E.FPS.join(' / ')}), ripple (close gaps after delete).`,
    params: { size: str('Frame preset', { enum: Object.keys(E.SIZES) }), width: num('Frame width'), height: num('Frame height'), fps: num('Frames per second'), ripple: bool('Close gaps after deleting') },
    run: (a) => commit((p) => {
      if (a.size) { if (!E.SIZES[a.size]) throw new Error('unknown size'); [p.settings.width, p.settings.height] = E.SIZES[a.size]; p.settings.autoSize = false; }
      if (a.width && a.height) { p.settings.width = Math.round(a.width / 2) * 2; p.settings.height = Math.round(a.height / 2) * 2; p.settings.autoSize = false; }
      if (a.fps) { if (!E.FPS.includes(Number(a.fps))) throw new Error(`fps must be one of ${E.FPS.join(', ')}`); p.settings.fps = Number(a.fps); }
      if (a.ripple != null) p.settings.ripple = !!a.ripple;
      return p.settings;
    }),
  },
  { name: 'undo', description: 'Undo the last edit.', params: {}, run: () => ({ undone: undo() }) },
  { name: 'redo', description: 'Redo the edit that was undone.', params: {}, run: () => ({ redone: redo() }) },
  {
    name: 'new_project', description: 'Clear the timeline (the media library is kept). Can be undone.', params: {},
    run: () => { resetProject(); return { ok: true }; },
  },
  {
    name: 'export', description: `Render the final MP4 (H.264 + AAC) with ffmpeg. size: ${Object.entries(E.SIZES).map(([k, [w, h]]) => `${k} = ${w}x${h}`).join(', ')}. fps: ${E.FPS.join(' / ')}. quality: max (default, visually lossless) | high | draft. Returns the file path and a download URL.`,
    params: { size: str('Frame preset', { enum: Object.keys(E.SIZES) }), width: num('Custom width'), height: num('Custom height'), fps: num('Frames per second'), quality: str('Quality', { enum: ['max', 'high', 'draft'] }), wait: bool('Wait until finished (default true)') },
    run: async (a) => { const job = startExport(a); return a.wait === false ? publicJob(job) : finished(job); },
  },
  {
    name: 'job_status', description: 'Progress of an export / transcription job.', params: { jobId: str('Job id', { required: true }) },
    run: ({ jobId }) => { const j = jobs.get(jobId); if (!j) throw new Error('job not found'); return publicJob(j); },
  },
  {
    name: 'cancel_job', description: 'Stop a running export / transcription.', params: { jobId: str('Job id', { required: true }) },
    run: ({ jobId }) => { const j = jobs.get(jobId); if (!j) throw new Error('job not found'); cancelJob(j); return publicJob(j); },
  },
];

const byName = new Map(ACTIONS.map((a) => [a.name, a]));

export function inputSchema(a) {
  const properties = {};
  const required = [];
  for (const [k, v] of Object.entries(a.params)) {
    const { required: req, ...schema } = v;
    properties[k] = schema;
    if (req) required.push(k);
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

export async function runAction(name, args = {}, ctx = { local: true }) {
  const a = byName.get(name);
  if (!a) throw Object.assign(new Error(`unknown action: ${name}`), { status: 404 });
  for (const [k, v] of Object.entries(a.params)) {
    if (v.required && (args[k] == null || args[k] === '')) throw new Error(`missing parameter: ${k}`);
  }
  return a.run(args, ctx);
}

// מידע קבוע שהממשק צריך: גופנים, סגנונות, גדלים, ספריית הסאונד
export function meta() {
  ensureSfx();
  return {
    sizes: E.SIZES, fps: E.FPS, fonts: FONTS, textPresets: TEXT_PRESETS, captionPresets: CAPTION_PRESETS,
    anims: ANIMS, captionModes: CAPTION_MODES, models: Object.keys(MODELS),
    sfx: publicSfx(), sfxCategories: SFX_CATEGORIES,
    actions: ACTIONS.map((a) => ({ name: a.name, description: a.description, params: Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, { type: v.type, required: !!v.required, description: v.description }])) })),
  };
}

export { publicState };

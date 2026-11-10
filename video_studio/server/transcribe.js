// תמלול אוטומטי במחשב עצמו (Whisper דרך transformers.js) – בלי לשלוח את הסרטון לשום שירות.
// המודל יורד פעם אחת (בתמלול הראשון) לתיקייה data/models.
import fs from 'node:fs';
import path from 'node:path';
import { DIRS, project, commit, createJob, updateJob, publicJob } from './store.js';
import { clipEnd, wordsToCaptions, setCaptions, r3 } from './edit.js';
import { run, FFMPEG, mediaPath } from './media.js';

// מהיר / מאוזן / הכי מדויק. אפשר להחליף עם STUDIO_WHISPER_MODEL (שם מודל ב-Hugging Face).
export const MODELS = {
  fast: 'onnx-community/whisper-base_timestamped',
  balanced: 'onnx-community/whisper-small_timestamped',
  best: 'onnx-community/whisper-large-v3-turbo_timestamped',
};
export const LANGUAGES = { he: 'hebrew', en: 'english' };

const pipes = new Map();
async function getPipe(modelId, onProgress) {
  if (pipes.has(modelId)) return pipes.get(modelId);
  let tf;
  try {
    tf = await import('@huggingface/transformers');
  } catch {
    throw new Error('the transcription engine is not installed – run "npm install" in the video_studio folder');
  }
  tf.env.cacheDir = DIRS.models;
  if (process.env.STUDIO_MODEL_DIR) {
    // מודלים שכבר נמצאים בדיסק (בלי אינטרנט)
    tf.env.localModelPath = process.env.STUDIO_MODEL_DIR;
    tf.env.allowRemoteModels = false;
  }
  const pipe = await tf.pipeline('automatic-speech-recognition', modelId, {
    dtype: process.env.STUDIO_WHISPER_DTYPE || 'q8',
    progress_callback: (p) => { if (p.status === 'progress' && p.total) onProgress?.(p.loaded / p.total, p.file); },
  });
  pipes.set(modelId, pipe);
  return pipe;
}

// מילים עם זמנים (בשניות, יחסית לתחילת הקטע שנשלח)
async function recognize(pipe, audio, language) {
  const opts = { chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' };
  if (LANGUAGES[language]) opts.language = LANGUAGES[language];
  let out;
  let wordLevel = true;
  try {
    out = await pipe(audio, { ...opts, return_timestamps: 'word' });
  } catch {
    // מודל בלי תזמון למילה: מקבלים משפטים עם זמנים ומחלקים את הזמן בין המילים לפי האורך
    wordLevel = false;
    out = await pipe(audio, { ...opts, return_timestamps: true });
  }
  const total = audio.length / 16000;
  const words = [];
  for (const ch of out.chunks || []) {
    const text = String(ch.text || '').trim();
    if (!text) continue;
    const s = ch.timestamp?.[0] ?? 0;
    const e = ch.timestamp?.[1] ?? Math.min(total, s + 2);
    if (wordLevel) { words.push({ w: text, s, e: Math.max(e, s + 0.05) }); continue; }
    const parts = text.split(/\s+/);
    const len = parts.reduce((n, w) => n + w.length + 1, 0);
    let t = s;
    for (const w of parts) { const d = ((e - s) * (w.length + 1)) / len; words.push({ w, s: t, e: t + d }); t += d; }
  }
  return words;
}

const transcripts = new Map(); // לפי קובץ + טווח + שפה + מודל

async function sourceWords(m, from, to, language, modelId, pipe) {
  const key = `${m.id}:${from}:${to}:${language}:${modelId}`;
  const cacheFile = path.join(DIRS.cache, `tr-${key.replace(/[^\w.-]+/g, '_')}.json`);
  if (transcripts.has(key)) return transcripts.get(key);
  if (fs.existsSync(cacheFile)) { const w = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); transcripts.set(key, w); return w; }
  const { stdout } = await run(FFMPEG, ['-v', 'error', '-ss', String(from), '-t', String(to - from), '-i', mediaPath(m),
    '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { binary: true });
  const audio = new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 4)).slice();
  const words = (await recognize(pipe, audio, language)).map((w) => ({ w: w.w, s: r3(w.s + from), e: r3(w.e + from) }));
  transcripts.set(key, words);
  fs.writeFileSync(cacheFile, JSON.stringify(words));
  return words;
}

// הקטעים שמתמללים: מה שנבחר; אחרת הדיבור שבשכבות הווידאו; ואם אין – קטעי האודיו.
export function speechClips(p, clipIds) {
  const audible = p.clips.filter((c) => (c.type === 'video' || c.type === 'audio')
    && p.media.find((m) => m.id === c.mediaId)?.hasAudio && !p.tracks.find((t) => t.id === c.trackId)?.muted);
  if (clipIds?.length) return audible.filter((c) => clipIds.includes(c.id));
  const video = audible.filter((c) => c.type === 'video');
  return video.length ? video : audible.filter((c) => !p.media.find((m) => m.id === c.mediaId)?.source);
}

export function startTranscribe({ clipIds, language = 'he', model = 'balanced', maxChars } = {}) {
  const clips = speechClips(project, clipIds);
  if (!clips.length) throw new Error('there is no clip with sound to transcribe');
  const modelId = process.env.STUDIO_WHISPER_MODEL || MODELS[model] || model;
  const job = createJob('transcribe', { language, model: modelId });
  let cancelled = false;
  job.cancel = () => { cancelled = true; };

  job.promise = (async () => {
    try {
      updateJob(job, { message: 'model' });
      const pipe = await getPipe(modelId, (k, file) => updateJob(job, { message: 'download', progress: k * 0.3, file }));
      // לכל קובץ מקור מתמללים פעם אחת את הטווח שבשימוש, ואז ממפים את המילים לציר הזמן דרך הקטעים
      const byMedia = new Map();
      for (const c of clips) {
        const r = byMedia.get(c.mediaId) || [Infinity, 0];
        byMedia.set(c.mediaId, [Math.min(r[0], c.offset || 0), Math.max(r[1], (c.offset || 0) + c.duration)]);
      }
      const words = [];
      let i = 0;
      for (const [mediaId, [from, to]] of byMedia) {
        if (cancelled) throw new Error('cancelled');
        updateJob(job, { message: 'transcribing', progress: 0.3 + (0.65 * i++) / byMedia.size });
        const m = project.media.find((x) => x.id === mediaId);
        const src = await sourceWords(m, r3(from), r3(to), language, modelId, pipe);
        for (const w of src) {
          const mid = (w.s + w.e) / 2;
          const c = clips.find((x) => x.mediaId === mediaId && mid >= (x.offset || 0) && mid < (x.offset || 0) + x.duration);
          if (!c) continue; // המילה נחתכה מהסרטון
          const shift = c.start - (c.offset || 0);
          words.push({ w: w.w, s: Math.max(c.start, w.s + shift), e: Math.min(clipEnd(c), w.e + shift) });
        }
      }
      if (cancelled) throw new Error('cancelled');
      words.sort((a, b) => a.s - b.s);
      const vertical = project.settings.height > project.settings.width;
      const caps = wordsToCaptions(words, { maxChars: Number(maxChars) || (vertical ? 18 : 32) });
      const made = commit((p) => setCaptions(p, caps));
      updateJob(job, { status: 'done', progress: 1, captions: made.length, words: words.length, text: caps.map((c) => c.text).join(' ').slice(0, 2000) });
    } catch (e) {
      updateJob(job, cancelled ? { status: 'cancelled' } : { status: 'error', error: friendly(e) });
    }
    return publicJob(job);
  })();
  return job;
}

function friendly(e) {
  const msg = String(e?.message || e);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|403|Unauthorized|local_files_only|allowRemoteModels/i.test(msg)) {
    return `could not download the speech model (needs internet access to huggingface.co on first use): ${msg.slice(0, 200)}`;
  }
  return msg.slice(0, 400);
}

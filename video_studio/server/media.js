// ספריית המדיה: קליטת קובץ, קריאת הנתונים שלו (ffprobe), תמונה מוקטנת, גל קול, וגרסה קלה לתצוגה בדפדפן.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DIRS, touchMedia, project, broadcast } from './store.js';
import { newId, r3 } from './edit.js';

export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE || 'ffprobe';
// הגרסה לתצוגה: mp4 (H.264) כברירת מחדל; webm לדפדפנים בלי H.264 (STUDIO_PROXY=webm)
const PROXY = process.env.STUDIO_PROXY === 'webm' ? 'webm' : 'mp4';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.wma', '.aiff']);

// מריץ פקודה ומחזיר את הפלט. stdout כ-Buffer כשמבקשים binary.
export function run(cmd, args, { binary = false, onStderr, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd });
    const out = [];
    let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => { err = (err + d).slice(-20000); onStderr?.(String(d)); });
    p.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? `${cmd} is not installed (install ffmpeg)` : e.message)));
    p.on('close', (code) => {
      const buf = Buffer.concat(out);
      if (code === 0) resolve({ stdout: binary ? buf : buf.toString(), stderr: err });
      else reject(new Error(`${cmd} failed (${code}): ${err.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}

export async function probe(file) {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const info = JSON.parse(stdout);
  const v = info.streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const out = { duration: r3(Number(info.format?.duration) || 0), hasAudio: !!a, hasVideo: !!v };
  if (v) {
    let [w, h] = [v.width, v.height];
    const rot = Math.abs(Number(v.side_data_list?.find((s) => s.rotation != null)?.rotation ?? v.tags?.rotate ?? 0));
    if (rot === 90 || rot === 270) [w, h] = [h, w];
    const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
    Object.assign(out, { width: w, height: h, fps: d ? Math.round((n / d) * 100) / 100 : 0 });
  }
  return out;
}

const safeName = (name) => path.basename(String(name || 'file')).replace(/[^\w.\-֐-׿ ]+/g, '_').slice(-120) || 'file';

// קובץ שכבר נמצא בתיקיית המדיה -> רשומה בספרייה. העיבוד הכבד ממשיך ברקע.
export async function registerMedia(file, name, extra = {}) {
  const id = newId('m');
  const ext = path.extname(name).toLowerCase();
  let info;
  try {
    info = await probe(file);
  } catch (e) {
    fs.rm(file, { force: true }, () => {});
    throw new Error(`unsupported file: ${name}`);
  }
  let kind = 'video';
  if (IMAGE_EXT.has(ext) || (info.hasVideo && !info.hasAudio && info.duration < 0.05)) kind = 'image';
  else if (!info.hasVideo || AUDIO_EXT.has(ext)) kind = 'audio';
  if (kind === 'audio' && !info.hasAudio) { fs.rm(file, { force: true }, () => {}); throw new Error(`unsupported file: ${name}`); }
  const media = {
    id, name: safeName(name), kind, file: path.basename(file), status: 'processing',
    duration: kind === 'image' ? 0 : info.duration, width: info.width || 0, height: info.height || 0,
    fps: info.fps || 0, hasAudio: kind !== 'image' && info.hasAudio, ...extra,
  };
  touchMedia((p) => p.media.push(media));
  const done = processMedia(media).then(
    () => touchMedia(() => { media.status = 'ready'; }),
    (e) => touchMedia(() => { media.status = 'error'; media.error = e.message; }),
  );
  return { media, done };
}

async function processMedia(m) {
  const src = path.join(DIRS.media, m.file);
  const base = path.join(DIRS.media, m.id);
  if (m.kind === 'image') {
    await run(FFMPEG, ['-y', '-v', 'error', '-i', src, '-frames:v', '1', '-vf', 'scale=320:-2', `${base}.thumb.jpg`]);
    m.thumb = `${m.id}.thumb.jpg`;
    m.proxy = m.file;
    return;
  }
  if (m.hasAudio) {
    const { stdout } = await run(FFMPEG, ['-v', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { binary: true });
    fs.writeFileSync(`${base}.peaks.json`, JSON.stringify(peaks(stdout, 8000, 50)));
    m.peaks = `${m.id}.peaks.json`;
  }
  if (m.kind === 'audio') {
    await run(FFMPEG, ['-y', '-v', 'error', '-i', src, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', `${base}.proxy.mp3`]);
    m.proxy = `${m.id}.proxy.mp3`;
    return;
  }
  await run(FFMPEG, ['-y', '-v', 'error', '-ss', String(Math.min(1, m.duration / 3)), '-i', src, '-frames:v', '1', '-vf', 'scale=320:-2', `${base}.thumb.jpg`]);
  m.thumb = `${m.id}.thumb.jpg`;
  // גרסה קלה עם הרבה פריימי מפתח – כדי שגרירת הסמן והחיתוכים יהיו חלקים
  const vf = "scale=-2:'min(540,ih)',fps=30";
  const codec = PROXY === 'webm'
    ? ['-c:v', 'libvpx', '-b:v', '1200k', '-deadline', 'realtime', '-cpu-used', '8', '-g', '10', '-c:a', 'libopus', '-b:a', '96k']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-g', '10', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'];
  await run(FFMPEG, ['-y', '-v', 'error', '-i', src, '-vf', vf, ...codec, '-ac', '2', `${base}.proxy.${PROXY}`]);
  m.proxy = `${m.id}.proxy.${PROXY}`;
}

// עוצמה מרבית לכל חלון (perSec חלונות בשנייה), 0..100
function peaks(buf, rate, perSec) {
  const step = Math.floor(rate / perSec);
  const n = Math.floor(buf.length / 2 / step);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let max = 0;
    for (let j = 0; j < step; j += 4) {
      const v = Math.abs(buf.readInt16LE((i * step + j) * 2));
      if (v > max) max = v;
    }
    out[i] = Math.round((max / 32768) * 100);
  }
  return out;
}

// העלאה מהדפדפן: גוף הבקשה הוא הקובץ עצמו.
export function saveUpload(req, name) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(safeName(name)).toLowerCase() || '.bin';
    const file = path.join(DIRS.media, `${newId('f')}${ext}`);
    const ws = fs.createWriteStream(file);
    req.pipe(ws);
    req.on('aborted', () => { ws.destroy(); fs.rm(file, { force: true }, () => {}); reject(new Error('upload aborted')); });
    ws.on('error', reject);
    ws.on('finish', () => resolve(file));
  });
}

// ייבוא מקובץ במחשב (רק מהמחשב עצמו) או מכתובת
export async function importMedia({ path: src, url, name }) {
  if (src) {
    const abs = path.resolve(src);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error(`file not found: ${src}`);
    const file = path.join(DIRS.media, `${newId('f')}${path.extname(abs).toLowerCase()}`);
    await fs.promises.copyFile(abs, file);
    return registerMedia(file, name || path.basename(abs));
  }
  if (url) {
    if (!/^https?:\/\//.test(url)) throw new Error('url must start with http(s)://');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const fname = name || decodeURIComponent(new URL(url).pathname.split('/').pop() || 'download');
    const file = path.join(DIRS.media, `${newId('f')}${path.extname(fname).toLowerCase() || '.mp4'}`);
    await fs.promises.writeFile(file, Buffer.from(await res.arrayBuffer()));
    return registerMedia(file, fname);
  }
  throw new Error('path or url is required');
}

export function deleteMediaFiles(m) {
  for (const f of new Set([m.file, m.proxy, m.thumb, m.peaks])) {
    if (f) fs.rm(path.join(DIRS.media, f), { force: true }, () => {});
  }
}

export const mediaPath = (m) => path.join(DIRS.media, m.file);
export const findMedia = (id) => {
  const m = project.media.find((x) => x.id === id);
  if (!m) throw new Error(`media not found: ${id}`);
  return m;
};

// זיהוי שתיקות בקובץ מקור (בזמן של הקובץ). נשמר בזיכרון לפי הקובץ והפרמטרים.
const silenceCache = new Map();
export async function detectSilences(m, thresholdDb, minDuration) {
  const key = `${m.id}:${thresholdDb}:${minDuration}`;
  if (silenceCache.has(key)) return silenceCache.get(key);
  let stderr = '';
  await run(FFMPEG, ['-hide_banner', '-nostats', '-i', mediaPath(m), '-vn',
    '-af', `silencedetect=noise=${thresholdDb}dB:d=${minDuration}`, '-f', 'null', '-'], { onStderr: (d) => { stderr += d; } });
  const out = [];
  let start = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: (-?[\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    if (e && start != null) { out.push([start, Number(e[1])]); start = null; }
  }
  if (start != null) out.push([start, m.duration]);
  silenceCache.set(key, out);
  return out;
}

export { broadcast };

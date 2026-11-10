// ייצוא: בונה מהפרויקט פקודת ffmpeg אחת (שכבות וידאו, מיקס אודיו, טקסטים וכתוביות) ומריץ אותה עם התקדמות.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DIRS, DATA, project, createJob, updateJob, publicJob } from './store.js';
import { clipEnd, totalDuration, SIZES, FPS } from './edit.js';
import { buildAss } from './ass.js';
import { FFMPEG } from './media.js';

// איכות: crf נמוך = איכות גבוהה יותר. "max" כמעט בלי אובדן נראה לעין.
const QUALITY = {
  max: { crf: 14, preset: 'slow', audio: '320k' },
  high: { crf: 18, preset: 'medium', audio: '256k' },
  draft: { crf: 24, preset: 'veryfast', audio: '160k' },
};

const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
const even = (x) => Math.max(2, Math.round(x / 2) * 2);

// הופך את הפרויקט לרשימת ארגומנטים של ffmpeg
export function buildCommand(p, { width: W, height: H, fps, quality = 'max', outFile, assFile }) {
  const q = QUALITY[quality] || QUALITY.max;
  const total = totalDuration(p);
  if (total <= 0) throw new Error('the timeline is empty');
  const track = (id) => p.tracks.find((t) => t.id === id) || {};
  const media = (id) => p.media.find((m) => m.id === id);
  const inputs = [];
  const filters = [`color=c=black:s=${W}x${H}:r=${fps}:d=${n3(total)},format=yuv420p[bg0]`];
  let last = 'bg0';
  let vi = 0;
  const audio = [];

  // שכבות הווידאו מלמטה למעלה
  const videoTracks = p.tracks.filter((t) => t.kind === 'video').reverse();
  const order = (c) => videoTracks.findIndex((t) => t.id === c.trackId) * 1e6 + c.start;
  const clips = p.clips.filter((c) => c.mediaId && media(c.mediaId)).sort((a, b) => order(a) - order(b));

  for (const c of clips) {
    const m = media(c.mediaId);
    const t = track(c.trackId);
    const file = path.join(DIRS.media, m.file);
    const isVisual = c.type === 'video' || c.type === 'image';
    if (isVisual && t.hidden && (t.muted || !m.hasAudio)) continue;
    if (!isVisual && t.muted) continue;
    const n = inputs.push(c.type === 'image'
      ? ['-loop', '1', '-framerate', String(fps), '-t', n3(c.duration), '-i', file]
      : ['-ss', n3(c.offset || 0), '-t', n3(c.duration), '-i', file]) - 1;
    if (isVisual && !t.hidden) {
      const s = c.scale || 1;
      const bw = even(W * s), bh = even(H * s);
      const fit = c.fit === 'cover'
        ? `scale=${bw}:${bh}:force_original_aspect_ratio=increase:flags=lanczos,crop=${bw}:${bh}`
        : `scale=${bw}:${bh}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos`;
      filters.push(`[${n}:v]fps=${fps},${fit},setsar=1,format=yuva420p,setpts=PTS-STARTPTS+${n3(c.start)}/TB[v${vi}]`);
      const x = `${n3((c.x ?? 0.5) * W)}-w/2`, y = `${n3((c.y ?? 0.5) * H)}-h/2`;
      filters.push(`[${last}][v${vi}]overlay=x=${x}:y=${y}:eof_action=pass:enable='between(t,${n3(c.start)},${n3(clipEnd(c))})'[bg${vi + 1}]`);
      last = `bg${vi + 1}`;
      vi++;
    }
    if (c.type !== 'image' && m.hasAudio && !t.muted && (c.volume ?? 1) > 0) {
      const f = ['aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo', `volume=${n3(c.volume ?? 1)}`];
      if (c.fadeIn > 0) f.push(`afade=t=in:st=0:d=${n3(Math.min(c.fadeIn, c.duration))}`);
      if (c.fadeOut > 0) f.push(`afade=t=out:st=${n3(Math.max(0, c.duration - c.fadeOut))}:d=${n3(Math.min(c.fadeOut, c.duration))}`);
      f.push(`adelay=${Math.round(c.start * 1000)}:all=1`);
      filters.push(`[${n}:a]${f.join(',')}[a${audio.length}]`);
      audio.push(`[a${audio.length}]`);
    }
  }

  if (assFile) {
    const rel = (f) => path.relative(DATA, f).split(path.sep).join('/');
    filters.push(`[${last}]ass=${rel(assFile)}:fontsdir=${rel(DIRS.fonts)}[vtxt]`);
    last = 'vtxt';
  }
  filters.push(`[${last}]format=yuv420p[vout]`);
  if (audio.length) {
    filters.push(`${audio.join('')}amix=inputs=${audio.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95,apad,atrim=0:${n3(total)}[aout]`);
  } else {
    filters.push(`anullsrc=r=48000:cl=stereo,atrim=0:${n3(total)}[aout]`);
  }

  return {
    total,
    filter: filters.join(';\n'),
    args: (filterArgs) => ['-y', '-hide_banner', '-nostats', '-progress', 'pipe:1', ...inputs.flat(), ...filterArgs,
      '-map', '[vout]', '-map', '[aout]', '-t', n3(total), '-r', String(fps),
      '-c:v', 'libx264', '-preset', q.preset, '-crf', String(q.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', q.audio, '-ar', '48000', '-movflags', '+faststart', outFile],
  };
}

export function resolveSize({ size, width, height, fps }) {
  const s = project.settings;
  if (size) {
    if (!SIZES[size]) throw new Error(`size must be one of: ${Object.keys(SIZES).join(', ')}`);
    [width, height] = SIZES[size];
  }
  width = even(Number(width) || s.width);
  height = even(Number(height) || s.height);
  fps = Number(fps) || s.fps;
  if (!FPS.includes(fps)) throw new Error(`fps must be one of: ${FPS.join(', ')}`);
  if (width > 7680 || height > 7680) throw new Error('frame too large');
  return { width, height, fps };
}

export function startExport(opts = {}) {
  const { width, height, fps } = resolveSize(opts);
  const quality = QUALITY[opts.quality] ? opts.quality : 'max';
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12);
  const name = `studio-${width}x${height}-${fps}fps-${stamp}.mp4`;
  const outFile = path.join(DIRS.exports, name);
  const job = createJob('export', { width, height, fps, quality, file: name });

  let assFile = null;
  const ass = buildAss(project, width, height);
  if (ass) {
    assFile = path.join(DIRS.exports, `${job.id}.ass`);
    fs.writeFileSync(assFile, ass);
  }
  const cmd = buildCommand(project, { width, height, fps, quality, outFile, assFile });
  const graphFile = path.join(DIRS.exports, `${job.id}.graph.txt`);
  fs.writeFileSync(graphFile, cmd.filter);
  // גרף קצר עובר כארגומנט; גרף ארוך (הרבה קטעים) – מקובץ, כדי לא לעבור את מגבלת אורך הפקודה
  const args = cmd.args(cmd.filter.length < 6000 ? ['-filter_complex', cmd.filter] : ['-filter_complex_script', graphFile]);

  job.promise = new Promise((resolve) => {
    const proc = spawn(FFMPEG, args, { cwd: DATA, stdio: ['ignore', 'pipe', 'pipe'] });
    job.proc = proc;
    let err = '';
    let buf = '';
    proc.stderr.on('data', (d) => { err = (err + d).slice(-6000); });
    proc.stdout.on('data', (d) => {
      buf += d;
      const m = [...buf.matchAll(/out_time_(?:us|ms)=(\d+)/g)].pop();
      buf = buf.slice(-200);
      if (m) {
        const progress = Math.min(0.99, Number(m[1]) / 1e6 / cmd.total);
        if (progress - job.progress >= 0.005) updateJob(job, { progress });
      }
    });
    const finish = (patch) => {
      for (const f of [assFile, graphFile]) if (f) fs.rm(f, { force: true }, () => {});
      updateJob(job, patch);
      resolve(publicJob(job));
    };
    proc.on('error', (e) => finish({ status: 'error', error: e.code === 'ENOENT' ? 'ffmpeg is not installed' : e.message }));
    proc.on('close', (code) => {
      if (job.status === 'cancelled') { fs.rm(outFile, { force: true }, () => {}); return finish({}); }
      if (code !== 0) { fs.rm(outFile, { force: true }, () => {}); return finish({ status: 'error', error: err.trim().split('\n').slice(-4).join(' | ') }); }
      finish({ status: 'done', progress: 1, url: `/exports/${encodeURIComponent(name)}`, path: outFile, bytes: fs.statSync(outFile).size });
    });
  });
  return job;
}

export function cancelJob(job) {
  if (job.status !== 'running') return;
  job.status = 'cancelled';
  job.proc?.kill('SIGKILL');
  job.cancel?.();
}

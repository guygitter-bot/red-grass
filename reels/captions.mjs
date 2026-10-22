#!/usr/bin/env node
// כתוביות בעברית לרילס: שורפת כתוביות לסרטון אנכי, לפי טקסט התסריט (או קובץ srt מוכן).
// שימוש: node reels/captions.mjs <video.mp4> <script.txt|captions.srt> [out.mp4]
// בלי תלויות npm – רק node 22 ו-ffmpeg/ffprobe.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_WORDS = 5; // מקסימום מילים בכתובית
const MAX_CHARS = 28; // מקסימום תווים בכתובית
const SNAP = 0.4; // עד כמה (שניות) מצמידים גבול כתובית להפסקה
const MIN_SPEECH = 0.3; // אזור דיבור קצר מזה נחשב רעש
const LONG_GAP = 0.6; // שתיקה ארוכה מזו – לא מציגים בה כתובית
const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fonts');

// ---------- פיצול התסריט ----------

// סימן פיסוק שמסיים קטע (נקודה, פסיק, שאלה, קריאה, מקף, נקודתיים)
const BREAK_END = /[.,?!:;…–—]$/;
const DASH_ONLY = /^[-–—]+$/;

// מפצל קטע (בלי פיסוק באמצע) לחלקים שווים ככל האפשר, בגבולות המילים והתווים
function splitEvenly(words) {
  const len = (ws) => ws.join(' ').length;
  let k = Math.max(Math.ceil(words.length / MAX_WORDS), Math.ceil(len(words) / MAX_CHARS), 1);
  for (; k <= words.length; k++) {
    // חלוקה חמדנית לפי יעד תווים לחלק
    const target = len(words) / k;
    const parts = [];
    let cur = [];
    for (let i = 0; i < words.length; i++) {
      const left = words.length - i; // מילים שנשארו (כולל הנוכחית)
      const partsLeft = k - parts.length; // חלקים שנשארו (כולל הנוכחי)
      const next = [...cur, words[i]];
      const mustFlush = cur.length && (left <= partsLeft - 1 || len(next) > MAX_CHARS || next.length > MAX_WORDS);
      const wantFlush = cur.length && partsLeft > 1 && len(cur) >= target * 0.85 && len(next) > target;
      if (mustFlush || wantFlush) {
        parts.push(cur);
        cur = [words[i]];
      } else cur = next;
    }
    if (cur.length) parts.push(cur);
    if (parts.every((p) => p.length <= MAX_WORDS && len(p) <= MAX_CHARS)) return parts;
  }
  return words.map((w) => [w]); // מילה ארוכה במיוחד – מילה לכתובית
}

// מפרק תסריט לכתוביות קצרות; מעדיף לשבור בפיסוק
export function splitScript(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const words = line.split(/\s+/).filter(Boolean);
    let clause = [];
    const flush = () => {
      if (clause.length) for (const part of splitEvenly(clause)) out.push(clean(part.join(' ')));
      clause = [];
    };
    for (const w of words) {
      if (DASH_ONLY.test(w)) { flush(); continue; } // מקף בודד = שבירה
      clause.push(w);
      if (BREAK_END.test(w)) flush();
    }
    flush();
  }
  return out.filter(Boolean);
}

// מסיר פיסוק סוגר (נקודה, פסיק...) – נשארים רק ? ו-!
function clean(s) {
  return s.replace(/[.,:;…–—-]+$/, '').trim();
}

// ---------- תזמון ----------

// אזורי דיבור = ההפך מהשתיקות. silences: [{start,end}]
export function speechFromSilences(silences, duration) {
  const regions = [];
  let t = 0;
  for (const s of [...silences].sort((a, b) => a.start - b.start)) {
    if (s.start - t > 0.05) regions.push({ start: t, end: Math.min(s.start, duration) });
    t = Math.max(t, s.end);
  }
  if (duration - t > 0.05) regions.push({ start: t, end: duration });
  return regions.filter((r) => r.end - r.start >= MIN_SPEECH); // פיקים קצרים הם רעש, לא דיבור
}

// ממפה "זמן דיבור מצטבר" לזמן אמיתי. side='start' – בגבול בין אזורים נבחר האזור הבא
function toReal(regions, s, side) {
  let cum = 0;
  for (const r of regions) {
    const len = r.end - r.start;
    const inside = side === 'start' ? s < cum + len - 1e-9 : s <= cum + len + 1e-9 && s > cum - 1e-9;
    if (inside) return r.start + Math.min(Math.max(s - cum, 0), len);
    cum += len;
  }
  const last = regions[regions.length - 1];
  return last ? last.end : 0;
}

// chunks: מערך טקסטים; regions: [{start,end}] אזורי דיבור. מחזיר [{start,end,text}]
export function planTimings(chunks, regions) {
  if (!chunks.length || !regions.length) return [];
  const total = regions.reduce((a, r) => a + r.end - r.start, 0);
  const weights = chunks.map((c) => c.replace(/\s/g, '').length + 1);
  const wSum = weights.reduce((a, b) => a + b, 0);

  // גבולות בזמן דיבור מצטבר (n+1 גבולות)
  const bounds = [0];
  let acc = 0;
  for (const w of weights) bounds.push((acc += (w / wSum) * total));
  bounds[bounds.length - 1] = total;

  // מיקומי ההפסקות בזמן דיבור מצטבר
  const pauses = [];
  let cum = 0;
  for (let i = 0; i < regions.length - 1; i++) {
    cum += regions[i].end - regions[i].start;
    pauses.push(cum);
  }
  // הצמדת כל גבול פנימי להפסקה הקרובה (עד SNAP), כל הפסקה פעם אחת ובסדר עולה
  const used = new Set();
  for (let i = 1; i < bounds.length - 1; i++) {
    let best = -1;
    let bestD = SNAP + 1e-9;
    pauses.forEach((p, j) => {
      const d = Math.abs(p - bounds[i]);
      if (!used.has(j) && d < bestD && p > bounds[i - 1] + 0.05) {
        best = j;
        bestD = d;
      }
    });
    if (best >= 0) {
      used.add(best);
      bounds[i] = pauses[best];
    }
  }
  for (let i = 1; i < bounds.length; i++) bounds[i] = Math.max(bounds[i], bounds[i - 1]); // סדר עולה

  // המרה לזמן אמיתי; כתובית שחוצה שתיקה ארוכה מפוצלת לשני קטעי הצגה
  const out = [];
  chunks.forEach((text, i) => {
    const a = bounds[i];
    const b = bounds[i + 1];
    let seg = null;
    let c = 0;
    for (let r = 0; r < regions.length; r++) {
      const len = regions[r].end - regions[r].start;
      const lo = Math.max(a, c);
      const hi = Math.min(b, c + len);
      if (hi - lo > 1e-6) {
        const s = regions[r].start + (lo - c);
        const e = regions[r].start + (hi - c);
        if (seg && s - seg.end <= LONG_GAP) seg.end = e;
        else out.push((seg = { start: s, end: e, text }));
      }
      c += len;
    }
  });
  // פער קצר בין כתוביות סמוכות – מאריכים כדי שלא יהבהב
  for (let i = 0; i < out.length - 1; i++) {
    const gap = out[i + 1].start - out[i].end;
    if (gap > 0 && gap < 0.15) out[i].end = out[i + 1].start;
  }
  return out;
}

// ---------- SRT / ASS ----------

const pad = (n, w = 2) => String(n).padStart(w, '0');
function srtTime(t) {
  const ms = Math.round(t * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}
function assTime(t) {
  const cs = Math.round(t * 100);
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
}

export function toSrt(entries) {
  return entries.map((e, i) => `${i + 1}\n${srtTime(e.start)} --> ${srtTime(e.end)}\n${e.text}\n`).join('\n');
}

export function parseSrt(text) {
  const toSec = (h, m, s, ms) => +h * 3600 + +m * 60 + +s + +ms.padEnd(3, '0') / 1000;
  const re = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)[^\n]*\n([\s\S]*?)(?=\n\s*\n|\n*$)/g;
  const out = [];
  for (const m of text.replace(/\r/g, '').replace(/^﻿/, '').matchAll(re)) {
    const t = m[9].split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
    if (t) out.push({ start: toSec(m[1], m[2], m[3], m[4]), end: toSec(m[5], m[6], m[7], m[8]), text: t });
  }
  return out;
}

export function toAss(entries, width, height) {
  const size = Math.round(height * 0.055);
  const outline = Math.max(2, Math.round(size * 0.14));
  const x = Math.round(width / 2);
  const y = Math.round(height * 0.68);
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Rubik,${size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${outline},2,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines = entries.map((e) => {
    const t = e.text.replace(/[{}]/g, '').replace(/\n/g, '\\N');
    return `Dialogue: 0,${assTime(e.start)},${assTime(e.end)},Default,,0,0,0,,{\\an5\\pos(${x},${y})}${t}`;
  });
  return head + lines.join('\n') + '\n';
}

// ---------- ffmpeg ----------

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  return r;
}

function probe(video) {
  const r = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height:stream_side_data=rotation:format=duration', '-of', 'json', video]);
  if (r.status !== 0) throw new Error('ffprobe נכשל: ' + r.stderr);
  const j = JSON.parse(r.stdout);
  const st = j.streams[0];
  let { width, height } = st;
  const rot = Math.abs(Math.round(st.side_data_list?.find((d) => 'rotation' in d)?.rotation ?? 0));
  if (rot === 90 || rot === 270) [width, height] = [height, width]; // ffmpeg מסובב אוטומטית
  return { width, height, duration: parseFloat(j.format.duration) };
}

function detectSilences(video) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', video, '-vn', '-af', 'silencedetect=noise=-35dB:d=0.25', '-f', 'null', '-']);
  const out = [];
  let start = null;
  for (const line of r.stderr.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: (-?[\d.]+)/);
    if (s) start = Math.max(0, parseFloat(s[1]));
    if (e && start !== null) {
      out.push({ start, end: parseFloat(e[1]) });
      start = null;
    }
  }
  if (start !== null) out.push({ start, end: Infinity }); // שתיקה עד סוף הסרטון
  return out;
}

export function main(argv) {
  const [video, input, outArg] = argv;
  if (!video || !input) {
    console.error('שימוש: node reels/captions.mjs <video.mp4> <script.txt|captions.srt> [out.mp4]');
    return 1;
  }
  const out = resolve(outArg || join(dirname(video), basename(video, extname(video)) + '-captions.mp4'));
  const { width, height, duration } = probe(video);
  const raw = readFileSync(input, 'utf8');

  let entries;
  if (extname(input).toLowerCase() === '.srt') {
    entries = parseSrt(raw); // זמנים כמו שהם
  } else {
    const chunks = splitScript(raw);
    const silences = detectSilences(video).map((s) => ({ start: s.start, end: Math.min(s.end, duration) }));
    entries = planTimings(chunks, speechFromSilences(silences, duration));
  }
  if (!entries.length) throw new Error('לא נמצאו כתוביות');

  mkdirSync(dirname(out), { recursive: true });
  const srtPath = out.replace(/\.[^.]+$/, '') + '.srt';
  writeFileSync(srtPath, toSrt(entries));

  // ספרייה זמנית בלי רווחים/תווים מיוחדים, כדי שהמסנן ass לא יסבול מנתיבים
  const tmp = mkdtempSync(join(tmpdir(), 'reel-'));
  try {
    writeFileSync(join(tmp, 'c.ass'), toAss(entries, width, height));
    cpSync(FONTS_DIR, join(tmp, 'fonts'), { recursive: true });
    const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', resolve(video),
      '-vf', 'ass=c.ass:fontsdir=fonts', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium',
      '-c:a', 'copy', '-movflags', '+faststart', out], { cwd: tmp, stdio: 'inherit' });
    if (r.status !== 0) throw new Error('ffmpeg נכשל');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`נוצר: ${out}\nכתוביות לעריכה: ${srtPath} (${entries.length} כתוביות)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error('שגיאה: ' + e.message);
    process.exitCode = 1;
  }
}

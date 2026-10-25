// מצלם את <תיקייה>/ad.html פריים אחרי פריים ומחבר לסרטון: מוזיקה + קריינות ואפקטים (window.AUDIO בעמוד, קבצים ב-audio/)
// node render.mjs <תיקייה> <קובץ יציאה> <מוזיקה> [שניות לצילום בדיקה, למשל 2.5,11.8]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const [,, dir, out, music, onlyAt] = process.argv;
const FPS = 30, DUR = 30;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(`file://${dir}/ad.html`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
// אחרי הקפיצה מחכים לשני פריימים, כדי שהצילום יראה את המצב החדש
const seek = (ms) => p.evaluate((ms) => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, ms);
if (onlyAt) {
  for (const s of onlyAt.split(',')) { await seek(+s * 1000); await p.screenshot({ path: `${out}-${s}.png` }); }
  await b.close(); process.exit(0);
}
// צלילים שקיימים בפועל (אם הקריינות עוד לא נוצרה – רק מוזיקה)
const cues = ((await p.evaluate(() => window.AUDIO)) || [])
  .map((c) => ({ ...c, file: `${dir}/audio/${c.f}.mp3` })).filter((c) => existsSync(c.file));
const inputs = cues.flatMap((c) => ['-i', c.file]);
const fx = cues.map((c, i) => `[${i + 2}:a]volume=${c.v ?? 1.6},adelay=${Math.round(c.t * 1000)}:all=1[c${i}]`);
const voice = cues.map((c, i) => (c.f.startsWith('v') ? `[c${i}]` : '')).join('');
const sfx = cues.map((c, i) => (c.f.startsWith('v') ? '' : `[c${i}]`)).join('');
const nv = voice.split('[').length - 1, ns = sfx.split('[').length - 1;
const music0 = `[1:a]atrim=0:${DUR},afade=t=in:d=0.3,afade=t=out:st=${DUR - 2}:d=2,volume=0.8[m]`;
let graph;
if (!cues.length) graph = `${music0.replace('[m]', '[a]')}`;
else {
  graph = [music0, ...fx];
  // המוזיקה יורדת כשמדברים
  if (nv) graph.push(`${voice}amix=inputs=${nv}:normalize=0,asplit[vo][vk]`, '[m][vk]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[md]');
  else graph.push('[m]anull[md]');
  graph.push(`[md]${nv ? '[vo]' : ''}${sfx}amix=inputs=${1 + (nv ? 1 : 0) + ns}:normalize=0:duration=first,alimiter=limit=0.95[a]`);
  graph = graph.join(';');
}
console.log(`audio: ${cues.length} cues`);
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', music, ...inputs,
  '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', String(DUR), out], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = 0; i < FPS * DUR; i++) {
  await seek((i / FPS) * 1000);
  const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await b.close();

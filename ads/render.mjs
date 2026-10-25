// מצלם את ad.html פריים אחרי פריים ומחבר לסרטון עם מוזיקה
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const [,, dir, out, music, onlyAt] = process.argv; // node render.mjs <תיקייה> <קובץ יציאה> <מוזיקה> [שניות לצילום בדיקה]
const FPS = 30, DUR = 30;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(`file://${dir}/ad.html`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
const seek = (ms) => p.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), ms);
if (onlyAt) {
  for (const s of onlyAt.split(',')) { await seek(+s * 1000); await p.screenshot({ path: `${out}-${s}.png` }); }
  await b.close(); process.exit(0);
}
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-i', music, '-filter_complex', `[1:a]atrim=0:${DUR},afade=t=in:d=0.5,afade=t=out:st=${DUR - 2}:d=2,volume=0.9[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', String(DUR), out], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = 0; i < FPS * DUR; i++) {
  await seek((i / FPS) * 1000);
  const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await b.close();

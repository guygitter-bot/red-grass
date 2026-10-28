const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, html, out, mode] = process.argv;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + html); await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  fs.mkdirSync(out, { recursive: true });
  const seg = await p.evaluate(() => window.SEG);
  const FPS = 30, N = Math.round(66.9 * FPS);
  let times = [];
  if (mode === 'test') times = [5.5].map(t => Math.round(t*FPS));
  else for (let f = 0; f < N; f++) { const t = f / FPS; if (Object.values(seg).some(([a, z]) => t >= a - 0.05 && t <= z + 0.05)) times.push(f); }
  for (const f of times) {
    await p.evaluate(t => window.setT(t), f / FPS);
    await p.screenshot({ path: path.join(out, String(f).padStart(5, '0') + '.png'), omitBackground: true });
  }
  console.log('frames', times.length);
  await b.close();
})();

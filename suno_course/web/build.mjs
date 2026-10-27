// בונה את האפליקציה (dist/) מאותם קובצי מקור של הקורס (../src) – אין עותק כפול של התוכן.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const src = path.join(here, '..', 'src');
const dist = path.join(here, 'dist');
const read = f => fs.readFileSync(path.join(src, f), 'utf8');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'img'), { recursive: true });

const head = read('01-head.html');
const shell = read('02-shell.html');
const js = [
  fs.readFileSync(path.join(here, 'app-shim.js'), 'utf8'),
  ...['03-helpers.js', '04-mocks.js', '05-content-a.js', '05-content-b.js', '06-engine.js', '07-tools.js'].map(read),
  fs.readFileSync(path.join(here, 'sync.js'), 'utf8'),
  // כפתור "חיבור ה-AI" בתפריט, ו-service worker להתקנה במסך הבית
  `document.querySelector('.side-tools').insertAdjacentHTML('beforeend', '<button class="btn sm" id="keyBtn" type="button">חיבור ה-AI (סיסמה)</button>');
document.getElementById('keyBtn').onclick = () => window.courseAskKey('מקלידים את סיסמת הקורס. היא נשמרת בטלפון הזה.');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
courseSyncStart();`,
].join('\n;\n');

const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0B7A69">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}
.keydlg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:50;padding:16px}
.keybox{background:var(--panel);color:var(--fg);border-radius:14px;padding:18px;width:min(420px,100%);display:grid;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.3)}
.keybox p{margin:0;color:var(--muted)}</style>
${head}
</head>
<body>
${shell}
<script src="app.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.writeFileSync(path.join(dist, 'app.js'), js);
for (const f of fs.readdirSync(path.join(here, '..', 'img'))) fs.copyFileSync(path.join(here, '..', 'img', f), path.join(dist, 'img', f));
for (const f of fs.readdirSync(path.join(here, 'public'))) fs.copyFileSync(path.join(here, 'public', f), path.join(dist, f));
console.log('built dist/');

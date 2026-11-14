// בדיקה מקצה לקצה של השרת עצמו (wrangler dev, אותו קוד כמו באוויר): סיסמה -> סרטון ברקע (Durable Object alarm) -> הורדת הקובץ.
// שימוש: node e2e.mjs <כתובת השרת> [max|fast]. מדפיס רק סטטוס, זמנים וגדלים.
import zlib from 'node:zlib';

const base = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const quality = process.argv[3] || 'max';
const password = 'בדיקה-123456';

// "בניין" פשוט (PNG בלי ספריות), בגודל של פריים אמיתי בערך
function testPng(w = 1280, h = 720) {
  const row = 1 + w * 3;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = [150 + (y % 7), 190, 235 - (x % 5)];
      if (y > h * 0.85) c = [90, 140 + (x % 9), 80];
      const inside = x > w * 0.35 && x < w * 0.65 && y > h * 0.15 && y <= h * 0.85;
      if (inside) c = (Math.floor((x - w * 0.35) / 32) % 2 === 1 && Math.floor((y - h * 0.15) / 36) % 2 === 1) ? [60, 80, 110] : [205, 200, 190];
      raw.set(c, y * row + 1 + x * 3);
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))]);
}

const post = (path, body, auth = true) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${encodeURIComponent(password)}` } : {}) },
  body: JSON.stringify(body),
});

let res = await post('/login', { password }, false);
console.log('login:', res.status);
if (!res.ok) process.exit(1);

const image = { media_type: 'image/png', data: testPng().toString('base64') };
console.log(`frame: ${Math.round(image.data.length / 1024)} KB of base64`);
res = await post('/clip', { image, motion: 'Slow aerial drone push-in toward the building, leaves moving in a light breeze.', aspect: '16:9', quality });
const started = await res.json();
console.log('clip start:', res.status, started.op ? 'op ok' : JSON.stringify(started));
if (!started.op) process.exit(1);

const from = Date.now();
let state = { done: false };
while (!state.done && Date.now() - from < 12 * 60 * 1000) {
  await new Promise((r) => setTimeout(r, 5000));
  state = await (await post('/clip/status', { op: started.op })).json();
}
console.log(`clip: ${state.done ? 'done' : 'NOT done'} after ${Math.round((Date.now() - from) / 1000)}s`, JSON.stringify(state));
if (!state.done || state.error) process.exit(1);

res = await post('/clip/file', { op: started.op });
const bytes = (await res.arrayBuffer()).byteLength;
console.log(`file: ${res.status} ${res.headers.get('content-type')} ${Math.round(bytes / 1024)} KB`);
process.exit(res.ok && bytes > 10000 ? 0 : 1);

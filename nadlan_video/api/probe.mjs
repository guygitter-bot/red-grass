// בדיקה אמיתית מול Google (רצה ב-GitHub Actions, שם יש מפתח): אילו מודלים קיימים, פריים אחד, וסרטון אחד בגרסה המהירה.
// מדפיס רק שמות מודלים, סטטוס, גדלים והודעות שגיאה – לא את המפתח ולא תמונות.
import zlib from 'node:zlib';
import { makeStill } from './still.js';
import { startClip, clipStatus, clipFile } from './video.js';
import { cleanBrief } from './brief.js';

const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, IMAGE_MODEL: process.env.IMAGE_MODEL, VIDEO_MODEL: process.env.VIDEO_MODEL, VIDEO_MODEL_FAST: process.env.VIDEO_MODEL_FAST };
if (!env.GEMINI_API_KEY) { console.log('GEMINI_API_KEY is not set - nothing to probe'); process.exit(0); }

// תמונת בדיקה: שמיים, "בניין" אפור עם שורות חלונות, ו"דשא" (PNG בלי ספריות)
function testPng(w = 640, h = 360) {
  const row = 1 + w * 3;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = [150, 190, 235];
      if (y > h * 0.85) c = [90, 140, 80];
      const inside = x > w * 0.35 && x < w * 0.65 && y > h * 0.15 && y <= h * 0.85;
      if (inside) c = (Math.floor((x - w * 0.35) / 16) % 2 === 1 && Math.floor((y - h * 0.15) / 18) % 2 === 1) ? [60, 80, 110] : [205, 200, 190];
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
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// כל המודלים שהמפתח רואה (כולל עמודים נוספים), עם השיטות שכל אחד תומך בהן – כדי לדעת איך קוראים היום למחולל הווידאו
let pageToken = '';
let total = 0;
do {
  const list = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
  const data = await list.json().catch(() => ({}));
  if (!list.ok) { console.log('list models:', list.status, JSON.stringify(data?.error?.message || data).slice(0, 400)); break; }
  for (const m of data.models || []) {
    total++;
    console.log('  ', m.name, '|', (m.supportedGenerationMethods || []).join(','));
  }
  pageToken = data.nextPageToken || '';
} while (pageToken);
console.log(`models: ${total}`);

let failed = false;
const brief = cleanBrief({ kind: 'building', look: 'golden', aspect: '16:9' });
let frame = { media_type: 'image/png', data: testPng().toString('base64') };
try {
  const still = await makeStill(env, frame, 'Photorealistic eye-level street view of this simple residential building with a small lawn.', brief, 'plan');
  console.log(`still: ok, model ${still.model}, ${still.media_type}, ${Math.round(still.data.length * 0.75 / 1024)} KB`);
  frame = { media_type: still.media_type, data: still.data };
} catch (e) {
  failed = true;
  console.log('still: FAILED -', e.message, '|', e.detail || '');
}

try {
  const started = await startClip(env, frame, 'Slow aerial drone push-in toward the building, leaves moving in a light breeze.', '16:9', 'fast');
  console.log(`clip: started, model ${started.model}, ${started.resolution}`);
  const from = Date.now();
  let state = { done: false };
  while (!state.done && Date.now() - from < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 10000));
    state = await clipStatus(env, started.op);
  }
  console.log(`clip: ${state.done ? 'done' : 'still not done'} after ${Math.round((Date.now() - from) / 1000)}s`, state.error || '', state.detail || '');
  if (!state.done || state.error) failed = true;
  else {
    const file = await clipFile(env, started.op);
    const bytes = (await new Response(file.body).arrayBuffer()).byteLength;
    console.log(`clip file: ${file.type}, ${Math.round(bytes / 1024)} KB`);
    if (bytes < 10000) failed = true;
  }
} catch (e) {
  failed = true;
  console.log('clip: FAILED -', e.message, '|', e.detail || '');
}
process.exit(failed ? 1 : 0);

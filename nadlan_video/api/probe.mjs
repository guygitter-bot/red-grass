// בדיקה אמיתית מול Google (רצה ב-GitHub Actions, שם יש מפתח): אילו מודלים קיימים, פריים אחד, וסרטון אחד בטיוטה.
// מדפיס רק שמות מודלים, סטטוס, גדלים והודעות שגיאה – לא את המפתח ולא תמונות.
import zlib from 'node:zlib';
import { makeStill } from './still.js';
import { generateClip, fetchClipFile } from './video.js';
import { cleanBrief } from './brief.js';
import { planFilm } from './director.js';

const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY, IMAGE_MODEL: process.env.IMAGE_MODEL, VIDEO_MODEL: process.env.VIDEO_MODEL };
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

// הבמאי (Claude): רשימת שוטים אמיתית מאותו שרטוט
if (env.ANTHROPIC_API_KEY) {
  try {
    const plan = await planFilm(env, brief, { plan: frame });
    console.log(`plan: ok, ${plan.shots.length} shots, stills: ${plan.shots.filter((s) => s.still).length}`);
    if (plan.shots.length < 2) failed = true;
  } catch (e) {
    failed = true;
    console.log('plan: FAILED -', e.message, '|', e.detail || '');
  }
} else console.log('ANTHROPIC_API_KEY is not set - skipping the director');
try {
  const still = await makeStill(env, frame, 'Photorealistic eye-level street view of this simple residential building with a small lawn.', brief, 'plan');
  console.log(`still: ok, model ${still.model}, ${still.media_type}, ${Math.round(still.data.length * 0.75 / 1024)} KB`);
  frame = { media_type: still.media_type, data: still.data };
} catch (e) {
  failed = true;
  console.log('still: FAILED -', e.message, '|', e.detail || '');
}

// סרטון אחד בטיוטה (360p) – אותה קריאה שהשרת עושה ברקע
try {
  const from = Date.now();
  const clip = await generateClip(env, frame, 'Slow aerial drone push-in toward the building, leaves moving in a light breeze.', '16:9', 'fast', AbortSignal.timeout(12 * 60 * 1000));
  console.log(`clip: ok after ${Math.round((Date.now() - from) / 1000)}s, model ${clip.model}, ${clip.resolution}, ${clip.type}, delivered as ${clip.uri ? `uri (${new URL(clip.uri).pathname.replace(/[A-Za-z0-9_-]{8,}/g, '<id>')})` : 'inline data'}`);
  let bytes;
  if (clip.uri) {
    const res = await fetchClipFile(env, clip.uri);
    console.log(`clip file: ${res.status} ${res.headers.get('content-type')} from ${new URL(res.url || clip.uri).pathname.replace(/[A-Za-z0-9_-]{8,}/g, '<id>')}`);
    bytes = (await res.arrayBuffer()).byteLength;
  } else {
    bytes = Buffer.from(clip.data, 'base64').length;
  }
  console.log(`clip size: ${Math.round(bytes / 1024)} KB`);
  if (bytes < 10000) failed = true;
} catch (e) {
  failed = true;
  console.log('clip: FAILED -', e.message, '|', e.detail || '');
}
process.exit(failed ? 1 : 0);

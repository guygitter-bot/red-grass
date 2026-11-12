// בדיקה אמיתית מול Google (רצה ב-GitHub Actions, שם יש מפתח): אילו מודלי תמונות קיימים, והדמיה אחת קטנה.
// מדפיס רק שמות מודלים, סטטוס והודעות שגיאה – לא את המפתח ולא תמונות.
import zlib from 'node:zlib';
import { renderImage, pickModel } from './render.js';
import { shoppingList } from './shop.js';

const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, IMAGE_MODEL: process.env.IMAGE_MODEL };
if (!env.GEMINI_API_KEY) { console.log('GEMINI_API_KEY is not set - nothing to probe'); process.exit(0); }

// תמונת בדיקה: "קיר" בהיר, "רצפה" חומה ו"ספה" אפורה (PNG בלי ספריות)
function testPng(w = 384, h = 288) {
  const row = 1 + w * 3;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = [233, 228, 216];
      if (y > h * 0.72) c = [155, 123, 86];
      if (x > w * 0.2 && x < w * 0.65 && y > h * 0.55 && y < h * 0.78) c = [90, 100, 112];
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

const list = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
console.log('list models:', list.status);
const data = await list.json().catch(() => ({}));
if (!list.ok) console.log('  ', JSON.stringify(data?.error?.message || data).slice(0, 400));
const all = data.models || [];
console.log(`models: ${all.length}`);
for (const m of all) {
  if (/banana|image|imagen/i.test(m.name)) console.log('  ', m.name, (m.supportedGenerationMethods || []).join(','));
}
console.log('configured:', env.IMAGE_MODEL, '| picked from list:', pickModel(all));

const before = { media_type: 'image/png', data: testPng().toString('base64') };
const change = 'לצבוע את הקיר בצבע ירוק זית';
let after;
try {
  after = await renderImage(env, before, change);
  console.log(`RENDER OK with ${after.model}: ${after.media_type}, ${Math.round(after.data.length * 0.75 / 1024)} KB`);
} catch (e) {
  console.log('RENDER FAILED:', e.detail || e.message);
  process.exit(1);
}

// רשימת קניות אמיתית מול Claude, כולל חיפוש ברשת (בודק גם שהסכמה של הכלי מתקבלת)
if (process.env.ANTHROPIC_API_KEY) {
  try {
    const shop = await shoppingList({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }, before, { media_type: after.media_type, data: after.data }, change);
    const sum = shop.items.reduce((t, i) => [t[0] + i.min, t[1] + i.max], [0, 0]);
    console.log(`SHOP OK: ${shop.items.length} items, ${sum[0]}-${sum[1]} ILS, labor: ${shop.labor ? 'yes' : 'no'}`);
    for (const i of shop.items) {
      console.log(`   ${i.name} | ${i.quantity} | ${i.min}-${i.max} | ${i.stores.join(', ')} | ${i.search}`);
      if (i.product) console.log(`      FOUND: ${i.product.title} | ${i.product.store} | ${i.product.price} ILS | ${i.product.url}`);
    }
    console.log(`products with a verified link: ${shop.items.filter((i) => i.product).length}`);
  } catch (e) {
    console.log('SHOP FAILED:', e.message);
    process.exit(1);
  }
}

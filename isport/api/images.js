// תמונות החולצות:
//   pageImages – שולף מדף ברשת את התמונה הראשית שלו (og:image, twitter:image, JSON-LD של מוצר).
//   download   – מוריד תמונה שהמנהל אישר, ובודק שזו באמת תמונה (לפי הבייטים, לא לפי מה שהאתר אומר).
//   התמונות שאושרו נשמרות אצלנו (R2), ולא נטענות מאתרים זרים בחנות.
import { fail } from './model.js';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const UA = 'Mozilla/5.0 (compatible; IsportCatalog/1.0)';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

// רק https לכתובת ציבורית (לא כתובת IP, לא שרתים פנימיים)
export function publicUrl(raw) {
  let u;
  try {
    u = new URL(String(raw ?? ''));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host)) return null;
  return u.toString();
}

// סוג התמונה לפי תחילת הקובץ
export function sniff(bytes) {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) return 'avif';
  return null;
}

export const contentType = (ext) => TYPES[ext] || 'application/octet-stream';

// הזמן המרבי חל גם על קריאת הגוף (אתר שעונה מהר ואז שולח לאט לא מעכב את הבקשה)
// מחזיר { res, read(max), done() } – read קורא את הגוף עד גבול; done משחרר כשלא קוראים
async function get(fetcher, url, accept) {
  const ctrl = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(fail(504, 'האתר לא ענה בזמן'));
    }, TIMEOUT_MS);
  });
  deadline.catch(() => {});
  const done = () => clearTimeout(timer);
  try {
    const res = await Promise.race([fetcher(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: ctrl.signal }), deadline]);
    return { res, done, read: (max) => Promise.race([readLimited(res, max), deadline]).finally(done) };
  } catch (e) {
    done();
    throw e;
  }
}

// קורא את הגוף עד גבול מסוים (לא נותנים לאתר זר למלא את הזיכרון)
async function readLimited(res, max) {
  const len = Number(res.headers.get('content-length') || 0);
  if (len > max) throw fail(413, 'הקובץ גדול מדי');
  if (!res.body) return new Uint8Array(await res.arrayBuffer()).slice(0, max + 1);
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw fail(413, 'הקובץ גדול מדי');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/gi, '/');

// כתובות התמונות הראשיות מתוך HTML של דף
export function imagesFromHtml(html, base) {
  const found = [];
  const add = (u) => {
    if (typeof u !== 'string' || !u.trim()) return;
    try {
      const abs = publicUrl(new URL(decode(u.trim()), base).toString());
      if (abs && !found.includes(abs) && !/\.svg(\?|$)/i.test(abs)) found.push(abs);
    } catch {
      // כתובת לא תקינה
    }
  };
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase();
    if (!['og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(key)) continue;
    add((tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i) || [])[1]);
  }
  // JSON-LD של מוצר: "image": "..." או ["...", ...]
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const walk = (node, depth) => {
      if (!node || depth > 5 || found.length > 12) return;
      if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
      if (typeof node !== 'object') return;
      const img = node.image;
      for (const i of [img].flat()) add(typeof i === 'object' ? i?.url || i?.contentUrl : i);
      if (node['@graph']) walk(node['@graph'], depth + 1);
    };
    walk(data, 0);
  }
  return found.slice(0, 4);
}

export async function pageImages(fetcher, pageUrl) {
  const url = publicUrl(pageUrl);
  if (!url) return [];
  try {
    const { res, read, done } = await get(fetcher, url, 'text/html,application/xhtml+xml');
    if (!res.ok || !/html/i.test(res.headers.get('content-type') || '')) {
      done();
      return [];
    }
    const html = new TextDecoder().decode(await read(MAX_PAGE_BYTES));
    return imagesFromHtml(html, res.url || url);
  } catch {
    return [];
  }
}

export async function download(fetcher, imageUrl) {
  const url = publicUrl(imageUrl);
  if (!url) throw fail(400, 'כתובת התמונה לא תקינה');
  let got;
  try {
    got = await get(fetcher, url, 'image/avif,image/webp,image/png,image/jpeg');
  } catch {
    throw fail(502, 'לא הצלחנו להוריד את התמונה');
  }
  const { res, read, done } = got;
  if (!res.ok || (res.url && !publicUrl(res.url))) {
    done();
    throw fail(502, 'לא הצלחנו להוריד את התמונה');
  }
  const bytes = await read(MAX_IMAGE_BYTES);
  const ext = sniff(bytes);
  if (!ext) throw fail(415, 'זו לא תמונה (JPG / PNG / WEBP)');
  return { bytes, ext };
}

export function fromBase64(data) {
  let bin;
  try {
    bin = atob(String(data ?? ''));
  } catch {
    throw fail(400, 'הקובץ לא תקין');
  }
  if (bin.length > MAX_IMAGE_BYTES) throw fail(413, 'הקובץ גדול מדי');
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const ext = sniff(bytes);
  if (!ext) throw fail(415, 'זו לא תמונה (JPG / PNG / WEBP)');
  return { bytes, ext };
}

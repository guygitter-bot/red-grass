// הורדת דפים מבחוץ בצורה בטוחה: רק כתובות ציבוריות (גם אחרי הפניות), מגבלת זמן ומגבלת גודל.

// כתובת שמותר לפנות אליה: http(s), לא localhost / כתובת IP / שמות פנימיים
export function isPublicUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host.includes('.')) return false;
  if (host === 'localhost' || /\.(local|internal|localhost|lan|home|corp|intranet)$/.test(host)) return false;
  if (/^[\d.]+$/.test(host) || host.includes(':') || /^\[/.test(host)) return false;
  // שירותי DNS שמחזירים כתובת פנימית לפי השם (127.0.0.1.nip.io וכו')
  if (/(^|\.)(nip\.io|sslip\.io|xip\.io|localtest\.me|lvh\.me)$/.test(host)) return false;
  return true;
}

// fetch עם הפניות ידניות (כל קפיצה נבדקת), מגבלת זמן, וקריאה של עד maxBytes בלבד
export async function safeFetch(fetchFn, url, init = {}, { maxBytes = 3_000_000, timeoutMs = 15000, maxRedirects = 5 } = {}) {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isPublicUrl(current)) throw new Error('כתובת לא מורשית');
    const res = await fetchFn(current, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400 && res.headers?.get?.('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    return { res, finalUrl: res.url || current, text: () => readCapped(res, maxBytes) };
  }
  throw new Error('יותר מדי הפניות');
}

async function readCapped(res, maxBytes) {
  if (!res.body?.getReader) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.byteLength;
    if (bytes >= maxBytes) {
      reader.cancel().catch(() => {});
      break;
    }
  }
  const all = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return decodeBytes(all, res.headers?.get?.('content-type'));
}

// אתרים ישנים בעברית כתובים בקידוד windows-1255 (או iso-8859-8) ולא ב-UTF-8 – בלי זה העברית יוצאת ג'יבריש.
// הקידוד: מהכותרת content-type, ואם אין – מתגית meta בתחילת הדף
const CP1255 = '\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u008a\u2039\u008c\u008d\u008e\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u009a\u203a\u009c\u009d\u009e\u009f\u00a0\u00a1\u00a2\u00a3\u20aa\u00a5\u00a6\u00a7\u00a8\u00a9\u00d7\u00ab\u00ac\u00ad\u00ae\u00af\u00b0\u00b1\u00b2\u00b3\u00b4\u00b5\u00b6\u00b7\u00b8\u00b9\u00f7\u00bb\u00bc\u00bd\u00be\u00bf\u05b0\u05b1\u05b2\u05b3\u05b4\u05b5\u05b6\u05b7\u05b8\u05b9\ufffd\u05bb\u05bc\u05bd\u05be\u05bf\u05c0\u05c1\u05c2\u05c3\u05f0\u05f1\u05f2\u05f3\u05f4\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\u05d0\u05d1\u05d2\u05d3\u05d4\u05d5\u05d6\u05d7\u05d8\u05d9\u05da\u05db\u05dc\u05dd\u05de\u05df\u05e0\u05e1\u05e2\u05e3\u05e4\u05e5\u05e6\u05e7\u05e8\u05e9\u05ea\ufffd\ufffd\u200e\u200f\ufffd';
export function charsetOf(contentType, head) {
  const m = String(contentType || '').match(/charset=["']?([\w-]+)/i)
    || head.match(/<meta[^>]+charset=["']?([\w-]+)/i);
  return m ? m[1].toLowerCase() : 'utf-8';
}
export function decodeBytes(bytes, contentType) {
  const charset = charsetOf(contentType, String.fromCharCode(...bytes.subarray(0, 4096)));
  if (/^(windows-1255|cp1255|iso-8859-8(-i)?|iso-8859-8-e|visual|hebrew|logical)$/.test(charset)) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x2000) {
      out += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x2000), (b) => (b < 0x80 ? b : CP1255.charCodeAt(b - 0x80))));
    }
    return out;
  }
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

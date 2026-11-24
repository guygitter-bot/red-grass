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
  const decoder = new TextDecoder();
  let out = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (bytes >= maxBytes) {
      reader.cancel().catch(() => {});
      break;
    }
  }
  return out + decoder.decode();
}

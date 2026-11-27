// פירוק מייל גולמי (MIME): כותרות, טקסט, וקובצי PDF מצורפים. בלי ספריות.
// מטפל ב-base64, quoted-printable, כותרות מקודדות (=?UTF-8?B?...?=) ובקידודים עבריים ישנים.

const latin1 = new TextDecoder('latin1');

function decodeBytes(bytes, charset = 'utf-8') {
  const cs = String(charset || 'utf-8').toLowerCase().replace(/^"|"$/g, '');
  try {
    return new TextDecoder(cs === 'iso-8859-8-i' ? 'iso-8859-8' : cs).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function base64ToBytes(s) {
  const clean = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
  const bin = atob(clean.slice(0, clean.length - (clean.length % 4)) || '');
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function qpToBytes(s) {
  const text = String(s).replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const m = text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3));
    if (m) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(text.charCodeAt(i) & 0xff);
  }
  return Uint8Array.from(out);
}

// =?charset?B?...?= / =?charset?Q?...?= (וגם כותרת שנשלחה ב-UTF-8 בלי קידוד)
export function decodeWords(s) {
  let str = String(s || '');
  if (/[\x80-\xff]/.test(str)) str = decodeBytes(Uint8Array.from(str, (c) => c.charCodeAt(0) & 0xff), 'utf-8');
  return str
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, data) => {
      const bytes = enc.toUpperCase() === 'B' ? base64ToBytes(data) : qpToBytes(data.replace(/_/g, ' '));
      return decodeBytes(bytes, cs);
    });
}

function splitHeaders(text) {
  const idx = text.search(/\r?\n\r?\n/);
  const head = idx < 0 ? text : text.slice(0, idx);
  const body = idx < 0 ? '' : text.slice(idx).replace(/^\r?\n\r?\n/, '');
  const headers = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] ??= m[2];
  }
  return { headers, body };
}

const param = (value, name) => {
  const m = String(value || '').match(new RegExp(`${name}\\*?=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i'));
  if (!m) return '';
  const v = m[1] ?? m[2];
  // filename*=utf-8''%D7%97...
  const ext = v.match(/^([\w-]+)''(.*)$/);
  return ext ? decodeBytes(Uint8Array.from(decodeURIComponent(ext[2]), (c) => c.charCodeAt(0)), ext[1]) : decodeWords(v);
};

// הגוף של חלק, כבתים
function partBytes(body, encoding) {
  const enc = String(encoding || '').toLowerCase();
  if (enc === 'base64') return base64ToBytes(body);
  if (enc === 'quoted-printable') return qpToBytes(body);
  return Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff);
}

const htmlToText = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

// raw: Uint8Array של המייל כולו. מחזיר { from, subject, date, messageId, text, pdfs: [{ name, data (base64) }] }
export function parseMail(raw, { maxPdfBytes = 4_000_000 } = {}) {
  const text = latin1.decode(raw);
  const { headers, body } = splitHeaders(text);
  const out = { from: decodeWords(headers.from), subject: decodeWords(headers.subject), date: headers.date || '', messageId: (headers['message-id'] || '').trim(), text: '', html: '', pdfs: [] };

  const walk = (hdrs, content, depth = 0) => {
    if (depth > 8) return;
    const type = String(hdrs['content-type'] || 'text/plain').toLowerCase();
    if (type.startsWith('multipart/')) {
      const boundary = param(hdrs['content-type'], 'boundary');
      if (!boundary) return;
      for (const piece of content.split(`--${boundary}`).slice(1)) {
        if (piece.startsWith('--')) break;
        const sub = splitHeaders(piece.replace(/^\r?\n/, ''));
        walk(sub.headers, sub.body, depth + 1);
      }
      return;
    }
    const disposition = hdrs['content-disposition'] || '';
    const name = param(disposition, 'filename') || param(hdrs['content-type'], 'name');
    const isPdf = type.startsWith('application/pdf') || (/\.pdf$/i.test(name) && /octet-stream|application/.test(type));
    if (isPdf) {
      const bytes = partBytes(content, hdrs['content-transfer-encoding']);
      if (bytes.length && bytes.length <= maxPdfBytes) out.pdfs.push({ name: name || 'invoice.pdf', data: bytesToBase64(bytes) });
      return;
    }
    if (/attachment/i.test(disposition)) return;
    if (type.startsWith('text/plain') || type.startsWith('text/html')) {
      const decoded = decodeBytes(partBytes(content, hdrs['content-transfer-encoding']), param(hdrs['content-type'], 'charset') || 'utf-8');
      if (type.startsWith('text/plain')) out.text += `${decoded}\n`;
      else out.html += `${htmlToText(decoded)}\n`;
    }
  };
  walk(headers, body);
  // עדיף הטקסט הרגיל; אם אין – הטקסט מתוך ה-HTML
  out.text = (out.text.trim() || out.html.trim()).slice(0, 20000);
  delete out.html;
  return out;
}

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

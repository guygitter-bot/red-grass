// כותב ZIP קטן בלי ספריות: בלי דחיסה (STORE), שמות קבצים ב-UTF-8

// טבלת CRC-32
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// files: [{ name, text }] -> Uint8Array של קובץ zip
export function makeZip(files) {
  const enc = new TextEncoder();
  const entries = files.map((f) => {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    return { name, data, crc: crc32(data) };
  });
  const parts = [];
  const central = [];
  let offset = 0;
  // 1980-01-01 (תאריך קבוע, כדי שהתוצאה תהיה זהה בכל הורדה)
  const DOS_TIME = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1;
  for (const e of entries) {
    const local = new Uint8Array(30 + e.name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true); // ביט 11 = שמות ב-UTF-8
    v.setUint16(8, 0, true); // STORE
    v.setUint16(10, DOS_TIME, true);
    v.setUint16(12, DOS_DATE, true);
    v.setUint32(14, e.crc, true);
    v.setUint32(18, e.data.length, true);
    v.setUint32(22, e.data.length, true);
    v.setUint16(26, e.name.length, true);
    v.setUint16(28, 0, true);
    local.set(e.name, 30);
    parts.push(local, e.data);

    const cen = new Uint8Array(46 + e.name.length);
    const c = new DataView(cen.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, DOS_TIME, true);
    c.setUint16(14, DOS_DATE, true);
    c.setUint32(16, e.crc, true);
    c.setUint32(20, e.data.length, true);
    c.setUint32(24, e.data.length, true);
    c.setUint16(28, e.name.length, true);
    c.setUint32(42, offset, true);
    cen.set(e.name, 46);
    central.push(cen);
    offset += local.length + e.data.length;
  }
  const cenSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// הורדת ה-zip כקובץ
export function downloadZip(fileName, files) {
  const url = URL.createObjectURL(new Blob([makeZip(files)], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

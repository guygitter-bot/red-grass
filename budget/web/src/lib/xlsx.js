// קריאת קובץ אקסל (xlsx) בטלפון, בלי ספרייה: קובץ xlsx הוא ZIP של קובצי XML.
// מחזיר את הגיליונות לפי הסדר: [{ name, cells: Map('B7' -> ערך) }]. בנוסחאות – הערך המחושב שנשמר בקובץ.

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// כל הקבצים שבתוך ה-ZIP: Map(שם -> פונקציה שמחזירה את התוכן כטקסט)
function unzip(buf) {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    files.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      return dec.decode(method === 8 ? await inflate(data) : data);
    });
  }
  return files;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function unescapeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e] ?? m;
  });
}

const attr = (s, name) => s.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const texts = (xml) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

export function parseSheet(xml, strings) {
  const cells = new Map();
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = attr(m[1], 'r');
    const type = attr(m[1], 't');
    const inner = m[2] || '';
    if (!ref) continue;
    let value;
    if (type === 'inlineStr') value = texts(inner);
    else {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (v == null) continue;
      if (type === 's') value = strings[Number(v)] ?? '';
      else if (type === 'str' || type === 'e') value = unescapeXml(v);
      else if (type === 'b') value = v === '1';
      else value = Number(v);
    }
    if (value === '' || value == null || Number.isNaN(value)) continue;
    cells.set(ref, value);
  }
  return cells;
}

export async function readXlsx(buf) {
  const files = unzip(buf);
  const read = async (name) => (files.has(name) ? files.get(name)() : '');
  const strings = [...(await read('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const rels = new Map([...(await read('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [attr(m[1], 'Id'), attr(m[1], 'Target')]));
  const sheets = [];
  for (const m of (await read('xl/workbook.xml')).matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const target = rels.get(attr(m[1], 'r:id')) || '';
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    sheets.push({ name: unescapeXml(attr(m[1], 'name') || ''), cells: parseSheet(await read(path), strings) });
  }
  return sheets;
}

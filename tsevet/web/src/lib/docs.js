// מסמכים לצירוף בשיחה: PDF עולה כמו שהוא (Claude קורא אותו, גם סרוק), ושאר המסמכים הופכים לטקסט כאן בטלפון
// לפני ההעלאה – Word (docx), Excel (xlsx), PowerPoint (pptx), CSV, טקסט, Markdown, JSON. בלי שרת ובלי AI.
import { strFromU8, unzipSync } from 'fflate';

export const PDF = 'application/pdf';
const TEXT_EXT = /^(txt|csv|tsv|md|markdown|json|log)$/;
const ZIP_EXT = /^(docx|xlsx|pptx)$/;
export const MAX_TEXT = 400_000;

export const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();

// האם זה מסמך שאנחנו יודעים לשלוח (ואיך)
export function docKind(file) {
  const ext = extOf(file.name);
  if (file.type === PDF || ext === 'pdf') return 'pdf';
  if (ZIP_EXT.test(ext)) return ext;
  if (TEXT_EXT.test(ext) || /^text\//.test(file.type || '')) return 'text';
  return null;
}

export const decodeEntities = (s) =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

// Word: פסקה = <w:p>, טקסט = <w:t>, טאב / שבירת שורה
export function docxXmlToText(xml) {
  return xml
    .split(/<\/w:p>/)
    .map((p) => decodeEntities(p.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '\u0001$1\u0002').replace(/<[^>]+>/g, '').replace(/\u0001|\u0002/g, '')))
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

// Excel: מספר עמודה מהכתובת (A1 -> 0, AB7 -> 27)
export function colIndex(ref) {
  const letters = String(ref || '').replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return Math.max(n - 1, 0);
}

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// גיליון -> שורות CSV. strings = הטקסטים המשותפים (sharedStrings)
export function sheetXmlToCsv(xml, strings) {
  const rows = [];
  for (const row of xml.match(/<row[\s\S]*?<\/row>/g) || []) {
    const cells = [];
    for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const type = (c.match(/\bt="(\w+)"/) || [])[1];
      let v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (type === 's' && v != null) v = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') v = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '';
      else if (type === 'b') v = v === '1' ? 'TRUE' : 'FALSE';
      cells[ref ? colIndex(ref) : cells.length] = decodeEntities(v ?? '');
    }
    const line = Array.from(cells, (x) => csvCell(x ?? '')).join(',').replace(/,+$/, '');
    if (line) rows.push(line);
  }
  return rows.join('\n');
}

export function sharedStrings(xml) {
  return (xml.match(/<si>[\s\S]*?<\/si>/g) || []).map((si) => decodeEntities((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
}

function xlsxToText(files) {
  const strings = files['xl/sharedStrings.xml'] ? sharedStrings(strFromU8(files['xl/sharedStrings.xml'])) : [];
  const wb = files['xl/workbook.xml'] ? strFromU8(files['xl/workbook.xml']) : '';
  const names = [...wb.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decodeEntities(m[1]));
  const sheets = Object.keys(files)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  return sheets.map((k, i) => `## ${names[i] || `גיליון ${i + 1}`}\n${sheetXmlToCsv(strFromU8(files[k]), strings)}`).join('\n\n');
}

function pptxToText(files) {
  return Object.keys(files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .map((k, i) => `## שקופית ${i + 1}\n${(strFromU8(files[k]).match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => decodeEntities(t.replace(/<[^>]+>/g, ''))).join(' ')}`)
    .join('\n\n');
}

// המסמך -> טקסט (לא PDF)
export async function docToText(file) {
  const kind = docKind(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === 'text') return new TextDecoder('utf-8').decode(bytes).slice(0, MAX_TEXT);
  const files = unzipSync(bytes);
  if (kind === 'docx') return docxXmlToText(strFromU8(files['word/document.xml'] || new Uint8Array())).slice(0, MAX_TEXT);
  if (kind === 'xlsx') return xlsxToText(files).slice(0, MAX_TEXT);
  if (kind === 'pptx') return pptxToText(files).slice(0, MAX_TEXT);
  throw new Error('סוג קובץ לא נתמך');
}

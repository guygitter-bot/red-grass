// קריאת קובץ טבלה מהבנק / מחברת האשראי לשורות: [{ name, rows: [[תא, תא, ...], ...] }]
// xlsx (רגיל), קובץ "xls" שהוא בעצם HTML (כך מייצאים הרבה אתרים של בנקים), ו-CSV.
// xls ישן (בינארי) – אי אפשר לקרוא בלי ספרייה; מבקשים לשמור כ-xlsx.
import { readXlsx, unescapeXml } from './xlsx';

const colNum = (c) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

// Map('B7' -> ערך) -> מערך שורות
export function cellsToRows(cells) {
  const rows = [];
  for (const [ref, v] of cells) {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const r = Number(m[2]) - 1;
    const c = colNum(m[1]) - 1;
    (rows[r] ||= [])[c] = v;
  }
  return Array.from(rows, (r) => Array.from(r || [], (v) => (v === undefined ? '' : v)));
}

const stripTags = (s) => unescapeXml(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export function parseHtmlTables(html) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  return tables.map((t, i) => ({
    name: `טבלה ${i + 1}`,
    rows: [...t.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((tr) => [...tr[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((td) => stripTags(td[1]))),
  }));
}

export function parseCsv(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return [{ name: 'CSV', rows }];
}

// טקסט בקידוד הנכון: UTF-8, ואם יוצא ג'יבריש – Windows-1255 (עברית ישנה)
function decode(bytes) {
  const utf = new TextDecoder('utf-8').decode(bytes);
  if (!utf.includes('�')) return utf.replace(/^﻿/, '');
  try {
    return new TextDecoder('windows-1255').decode(bytes);
  } catch {
    return utf;
  }
}

export async function readTables(buf) {
  const bytes = new Uint8Array(buf);
  // ZIP = xlsx
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return (await readXlsx(buf)).map((s) => ({ name: s.name, rows: cellsToRows(s.cells) }));
  // xls ישן (בינארי)
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw Object.assign(new Error('old-xls'), { code: 'old-xls' });
  const text = decode(bytes);
  if (/<table/i.test(text)) return parseHtmlTables(text);
  return parseCsv(text);
}

// ---------- ערכים ----------

// תאריך מתא: מספר סידורי של אקסל, "15/08/2026", "15.08.26", "2026-08-15" -> 'YYYY-MM-DD' או ''
export function parseDate(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return '';
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

// סכום מתא: 1234.5, "₪ 1,234.50", "-120", "120-", "(120)" -> מספר או null
export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').replace(/[₪$€\s‎‏]/g, '').replace(/,/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

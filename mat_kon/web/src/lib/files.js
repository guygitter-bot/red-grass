// "מתכון מקובץ": קריאת קבצים בטלפון/במחשב (בלי שרת ובלי AI) – Word, PDF, טקסט, דפי אינטרנט, תמונות ועוד.
// מהקובץ יוצא טקסט (או תמונות של עמודים סרוקים), מחולק לקטעים, והמשתמש בוחר מה לשלוח לסידור – כמו בייבוא מווטסאפ.
import { strFromU8, unzipSync } from 'fflate';
import { recipeScore } from './whatsapp';

const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b;
const isPdf = (b) => b.length > 4 && String.fromCharCode(...b.subarray(0, 5)) === '%PDF-';
const isOle = (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0; // Word ישן (.doc)
const isRtf = (b) => String.fromCharCode(...b.subarray(0, 5)) === '{\\rtf';
const ext = (name) => (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

export const IMAGE_EXT = /^(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/;
export const isImageFile = (file) => /^image\//.test(file.type || '') || IMAGE_EXT.test(ext(file.name));

// ---------- טקסט ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rlm: '', lrm: '' };
export const decodeEntities = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

// שורות נקיות: בלי רווחים מיותרים ובלי יותר משורה ריקה אחת ברצף
export const tidy = (s) => String(s || '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '')
  .replace(/[ \t\u00a0]+/g, ' ')
  .split('\n').map((l) => l.trim()).join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// קובץ טקסט: UTF-8, UTF-16 (עם BOM), ואם לא – קידוד עברי ישן (Windows-1255)
export function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1255').decode(bytes);
  }
}

// דף אינטרנט שנשמר (.html) / פרק מספר אלקטרוני
export function htmlToText(html) {
  return tidy(decodeEntities(String(html)
    .replace(/<(script|style|head|noscript|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|h[1-6]|ul|ol|table|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|tr|ul|ol|section|article|blockquote|header|footer)>/gi, '\n')
    .replace(/<(td|th)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')));
}

// Word (.docx): הפסקאות מ-word/document.xml
export function docxXmlToText(xml) {
  return tidy(decodeEntities(String(xml)
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:(br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:instrText\b[\s\S]*?<\/w:instrText>/g, '')
    .replace(/<[^>]+>/g, '')));
}

// LibreOffice / OpenDocument (.odt)
export function odtXmlToText(xml) {
  return tidy(decodeEntities(String(xml)
    .replace(/<text:tab\/>/g, '\t')
    .replace(/<text:s(\s+text:c="(\d+)")?\/>/g, (_, __, n) => ' '.repeat(Number(n) || 1))
    .replace(/<text:line-break\/>/g, '\n')
    .replace(/<\/text:(p|h)>/g, '\n')
    .replace(/<[^>]+>/g, '')));
}

// RTF (WordPad, TextEdit ישן): בלי עיצוב; עברית בקידוד Windows-1255 או \uN
export function rtfToText(rtf) {
  const s = String(rtf);
  const cp = Number((s.match(/\\ansicpg(\d+)/) || [])[1]) || 1252;
  let decoder;
  try {
    decoder = new TextDecoder(`windows-${cp}`);
  } catch {
    decoder = new TextDecoder('windows-1252');
  }
  let out = '';
  let bytes = [];
  const flush = () => {
    if (bytes.length) out += decoder.decode(new Uint8Array(bytes));
    bytes = [];
  };
  const stack = [];
  let skip = false; // קבוצה שאינה טקסט (גופנים, צבעים, תמונות)
  let uc = 1;
  let pendingSkip = 0; // תווים חלופיים אחרי \uN
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') {
      stack.push({ skip, uc });
      const head = s.slice(i + 1, i + 12);
      if (/^\\\*|^\\(fonttbl|colortbl|stylesheet|info|pict|header|footer|listtable|listoverridetable|rsidtbl|generator|themedata|colorschememapping|latentstyles|datastore|xmlnstbl)/.test(head)) skip = true;
      continue;
    }
    if (c === '}') {
      ({ skip, uc } = stack.pop() || { skip: false, uc: 1 });
      continue;
    }
    if (c === '\\') {
      const next = s[i + 1];
      if (next === "'") {
        const hex = s.slice(i + 2, i + 4);
        i += 3;
        if (pendingSkip > 0) {
          pendingSkip -= 1;
          continue;
        }
        if (!skip) bytes.push(parseInt(hex, 16));
        continue;
      }
      if (next === '\\' || next === '{' || next === '}') {
        i += 1;
        if (!skip) {
          flush();
          out += next;
        }
        continue;
      }
      const m = s.slice(i + 1).match(/^([a-z]+)(-?\d+)? ?/i);
      if (!m) {
        i += 1;
        continue;
      }
      i += m[0].length;
      const [, word, arg] = m;
      if (skip) continue;
      if (word === 'uc') uc = Number(arg) || 0;
      else if (word === 'u') {
        flush();
        out += String.fromCharCode((Number(arg) + 65536) % 65536);
        pendingSkip = uc;
      } else if (['par', 'line', 'row'].includes(word)) {
        flush();
        out += '\n';
      } else if (['tab', 'cell'].includes(word)) {
        flush();
        out += '\t';
      }
      continue;
    }
    if (c === '\r' || c === '\n') continue;
    if (pendingSkip > 0) {
      pendingSkip -= 1;
      continue;
    }
    if (!skip) {
      flush();
      out += c;
    }
  }
  flush();
  return tidy(out);
}

// Word ישן (.doc): הטקסט שמור בקובץ כ-UTF-16 או כתווים של 8 ביט. קריאה "בערך" – מספיקה ל-AI
export function legacyDocToText(bytes) {
  const runs = [];
  let run = '';
  const keep = (code) => (code >= 0x20 && code < 0x7f) || (code >= 0x05d0 && code <= 0x05ea) || (code >= 0x0591 && code <= 0x05c7)
    || code === 0x0d || code === 0x09 || code === 0x0b || code === 0x2013 || code === 0x2019 || code === 0x201d || code === 0x00bd || code === 0x00bc;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (keep(code)) run += code === 0x0d || code === 0x0b ? '\n' : String.fromCharCode(code);
    else {
      if (run.replace(/\s/g, '').length >= 6) runs.push(run);
      run = '';
    }
  }
  if (run.replace(/\s/g, '').length >= 6) runs.push(run);
  const wide = runs.join('\n');
  // מסמך ששמור בתווים של 8 ביט (עברית ישנה ב-Windows-1255) – מה שיצא ארוך יותר
  const raw = new TextDecoder('windows-1255').decode(bytes);
  const narrow = (raw.match(/[ -~א-ת\r\t]{6,}/g) || []).join('\n').replace(/\r/g, '\n');
  const letters = (t) => (t.match(/[א-תa-z]/gi) || []).length;
  return tidy(letters(wide) >= letters(narrow) / 2 ? wide : narrow);
}

// ---------- חלוקה לקטעים ----------

const MAX_PART = 6000; // תווים בקטע אחד שנשלח לסידור (עד 6 מתכונים בקטע; בשרת: עד 20000)
const MIN_PART = 1200;
const titleLike = (line) => line.length >= 2 && line.length <= 60 && !/^[\d•\-*–·(]/.test(line) && !/[.:,;]$/.test(line);

// מסמך ארוך (חוברת מתכונים) מחולק לקטעים בגבולות של כותרות; מסמך קצר – קטע אחד.
// בכל קטע ה-AI יכול למצוא כמה מתכונים, כך שמתכון שנחתך באמצע הוא המקרה הנדיר.
export function splitDocument(text, maxPart = MAX_PART) {
  const clean = tidy(text);
  if (clean.length <= maxPart) return clean ? [clean] : [];
  const blocks = clean.split(/\n\s*\n|\f/).map((b) => b.trim()).filter(Boolean);
  const parts = [];
  let current = '';
  for (const block of blocks) {
    const first = block.split('\n')[0];
    const boundary = current.length >= MIN_PART && titleLike(first);
    if (current && (current.length + block.length > maxPart || (boundary && current.length + block.length > maxPart / 2))) {
      parts.push(current);
      current = '';
    }
    // פסקה ענקית בלי שורות ריקות – נחתכת לפי שורות
    if (block.length > maxPart) {
      for (const line of block.split('\n')) {
        if (current.length + line.length > maxPart && current) {
          parts.push(current);
          current = '';
        }
        current += `${current ? '\n' : ''}${line.slice(0, maxPart)}`;
      }
      continue;
    }
    current += `${current ? '\n\n' : ''}${block}`;
  }
  if (current) parts.push(current);
  return parts;
}

function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// קטעים -> פריטים לבחירה במסך הייבוא
export function fileCandidates({ name, parts = [], pages = [] }, { existingKeys = [] } = {}) {
  const saved = new Set(existingKeys.filter(Boolean));
  const many = parts.length + pages.length > 1;
  const items = parts.map((text, i) => {
    const id = `file:${hashText(text)}`;
    const title = text.split('\n').find((l) => l.trim().length > 1)?.slice(0, 80) || name;
    return {
      id, type: 'text', text, title, author: name, date: many ? `חלק ${i + 1} מתוך ${parts.length}` : '',
      saved: saved.has(id), likely: !many || recipeScore(text) >= 3,
    };
  });
  // עמודים סרוקים: כל קבוצה (עד 4 עמודים) נקראת כמו צילום
  pages.forEach((group, i) => {
    items.push({
      id: `pages:${i}`, type: 'photo', images: group.images, thumb: group.thumb, title: group.label, text: '',
      author: name, date: '', saved: false, likely: true,
    });
  });
  return items;
}

// ---------- PDF (נטען רק כשצריך) ----------

let pdfjs;
async function loadPdf() {
  if (!pdfjs) {
    const [lib, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    pdfjs = lib;
  }
  return pdfjs;
}

// אותיות סופיות בתחילת מילה = הטקסט שמור הפוך (נפוץ ב-PDF בעברית)
export function fixReversedHebrew(text) {
  const start = (text.match(/(^|[\s(])[ךםןףץ][א-ת]/g) || []).length;
  const end = (text.match(/[א-ת][ךםןףץ]($|[\s).,:])/g) || []).length;
  if (start <= end || start < 3) return text;
  return text.split('\n').map((l) => [...l].reverse().join('').replace(/[()[\]]/g, (c) => MIRROR[c])).join('\n');
}

const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[' };

// שורות לפי הגובה בעמוד; שורה בעברית מסודרת מימין לשמאל
export function pageItemsToText(items) {
  const lines = [];
  for (const it of items) {
    if (!it.str || !it.transform) continue;
    const y = it.transform[5];
    const h = Math.abs(it.height || it.transform[3]) || 10;
    let line = lines.find((l) => Math.abs(l.y - y) < h * 0.5);
    if (!line) lines.push((line = { y, h, parts: [] }));
    line.parts.push({ x: it.transform[4], w: it.width || 0, str: it.str });
  }
  lines.sort((a, b) => b.y - a.y);
  const out = [];
  let prev = null;
  for (const line of lines) {
    const text = line.parts.map((p) => p.str).join('');
    const rtl = (text.match(/[֐-׿]/g) || []).length > (text.match(/[a-z]/gi) || []).length;
    line.parts.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
    if (prev && prev.y - line.y > line.h * 1.8) out.push(''); // רווח גדול = פסקה חדשה
    // רווח רק כשיש מרווח אמיתי בין החלקים; בשורה בעברית הסוגריים שמורים הפוכים
    let joined = '';
    line.parts.forEach((p, i) => {
      const before = line.parts[i - 1];
      const gap = before && (rtl ? before.x - (p.x + p.w) : p.x - (before.x + before.w));
      joined += `${before && gap > line.h * 0.15 ? ' ' : ''}${p.str}`;
    });
    if (rtl) joined = joined.replace(/[()[\]]/g, (c) => MIRROR[c]);
    out.push(joined.replace(/\s+/g, ' ').trim());
    prev = line;
  }
  return out.join('\n');
}

const MAX_PDF_PAGES = 120;
const MAX_SCANNED_PAGES = 12;

async function renderPage(page, maxSide, quality) {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, maxSide / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvas.toDataURL('image/jpeg', quality);
}

async function readPdf(bytes, onProgress) {
  const lib = await loadPdf();
  let doc;
  try {
    doc = await lib.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  } catch (e) {
    if (e?.name === 'PasswordException') throw new Error('ה-PDF נעול בסיסמה. פתחו אותו, שמרו עותק בלי סיסמה ונסו שוב.');
    throw new Error('לא הצלחתי לפתוח את ה-PDF');
  }
  const count = Math.min(doc.numPages, MAX_PDF_PAGES);
  const pages = [];
  for (let n = 1; n <= count; n++) {
    onProgress?.(`קורא עמוד ${n} מתוך ${count}…`);
    const page = await doc.getPage(n);
    pages.push({ page, text: pageItemsToText((await page.getTextContent()).items) });
  }
  const text = fixReversedHebrew(pages.map((p) => p.text).join('\f'));
  const letters = text.replace(/\s/g, '').length;
  // יש טקסט אמיתי – משתמשים בו (חינם ומדויק)
  if (letters >= 80 * Math.min(count, 3) || letters > 2000) return { text };
  // עמודים סרוקים (צילום של דף): קוראים אותם כמו צילום מתכון
  const scanned = pages.slice(0, MAX_SCANNED_PAGES);
  const groups = [];
  const per = scanned.length <= 4 ? 4 : 2;
  for (let i = 0; i < scanned.length; i += per) {
    const slice = scanned.slice(i, i + per);
    const images = [];
    for (const [j, p] of slice.entries()) {
      onProgress?.(`מכין עמוד סרוק ${i + j + 1} מתוך ${scanned.length}…`);
      images.push(await renderPage(p.page, 1600, 0.85));
    }
    const thumb = await renderPage(slice[0].page, 480, 0.7);
    const from = i + 1;
    const to = i + slice.length;
    groups.push({ images, thumb, label: from === to ? `עמוד ${from}` : `עמודים ${from}–${to}` });
  }
  return { pages: groups, truncated: doc.numPages > MAX_SCANNED_PAGES };
}

// ---------- הקובץ כולו ----------

const PAGES_HINT = 'קובץ Pages: פתחו אותו באייפון/במק ← שיתוף ← ייצוא ← PDF או Word, ובחרו את הקובץ החדש.';
const UNSUPPORTED = 'את סוג הקובץ הזה עדיין אי אפשר לקרוא. שמרו אותו כ-PDF, Word או טקסט ונסו שוב.';

// קובץ אחד -> { name, text } או { name, pages } (עמודים סרוקים). תמונות מטופלות במסך (כמו צילום מתכון)
export async function readRecipeFile(file, onProgress) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = String(file.name || 'קובץ').replace(/\.[^.]+$/, '');
  const kind = ext(file.name);
  if (!bytes.length) throw new Error('הקובץ ריק');
  if (isPdf(bytes)) return { name, ...(await readPdf(bytes, onProgress)) };
  if (isZip(bytes)) {
    let files;
    try {
      files = unzipSync(bytes, { filter: (f) => /^(word\/document\.xml|content\.xml|QuickLook\/Preview\.pdf|preview\.jpg|META-INF\/container\.xml|.*\.(x?html?|txt|md))$/i.test(f.name) });
    } catch {
      throw new Error('לא הצלחתי לפתוח את הקובץ');
    }
    if (files['word/document.xml']) return { name, text: docxXmlToText(strFromU8(files['word/document.xml'])) };
    if (files['content.xml']) return { name, text: odtXmlToText(strFromU8(files['content.xml'])) };
    if (files['QuickLook/Preview.pdf']) return { name, ...(await readPdf(files['QuickLook/Preview.pdf'], onProgress)) };
    if (kind === 'pages' || files['preview.jpg']) throw new Error(PAGES_HINT);
    // ספר אלקטרוני (.epub) או תיקייה עם דפי אינטרנט/טקסט
    const pages = Object.keys(files).filter((n) => /\.(x?html?|txt|md)$/i.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    if (pages.length) {
      const text = pages.map((n) => (/\.(txt|md)$/i.test(n) ? decodeText(files[n]) : htmlToText(strFromU8(files[n])))).join('\n\n');
      return { name, text: tidy(text) };
    }
    throw new Error(UNSUPPORTED);
  }
  if (isRtf(bytes)) return { name, text: rtfToText(new TextDecoder('latin1').decode(bytes)) };
  if (isOle(bytes)) {
    if (/^(xls|ppt|msg)$/.test(kind)) throw new Error(UNSUPPORTED);
    return { name, text: legacyDocToText(bytes) };
  }
  if (/^(pages|numbers|key|xlsx|pptx|exe|apk|mp4|mov|mp3|m4a)$/.test(kind)) throw new Error(kind === 'pages' ? PAGES_HINT : UNSUPPORTED);
  // טקסט: txt, md, csv, html, eml, json...
  const text = decodeText(bytes);
  // תווים בינאריים = לא טקסט
  if ((text.slice(0, 4000).match(/[\u0000-\u0008\u000e-\u001f\ufffd]/g) || []).length > 40) throw new Error(UNSUPPORTED);
  return { name, text: /^(html?|xhtml|mht)$/.test(kind) || /^\s*<(!doctype|html)/i.test(text) ? htmlToText(text) : tidy(text) };
}

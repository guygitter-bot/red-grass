// עזרים לרשימת החומר: זיהוי קישורים בטקסט שהודבק, סינון, חיפוש וקבצים

const URL_RE = /https?:\/\/[^\s<>"'״]+/gi;

// טקסט שהודבק -> { links, text }. קישורים מופרדים; טקסט בלי קישורים נשמר כפתק
export function parsePasted(input) {
  const raw = String(input || '');
  const links = [...new Set((raw.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?)\]}]+$/, '')))];
  const rest = raw.replace(URL_RE, ' ').replace(/[ \t]+/g, ' ').trim();
  // כשיש קישורים, הטקסט שלידם (למשל כותרת מהשיתוף) הוא הערה; בלי קישורים – הטקסט עצמו הוא הפריט
  return links.length ? { links, text: '', note: rest.slice(0, 500) } : { links, text: rest, note: '' };
}

// טקסט שהגיע בשיתוף מאפליקציה אחרת (‎?title=&text=&url=‎)
export function sharedText(search) {
  const p = new URLSearchParams(search);
  return [p.get('title'), p.get('text'), p.get('url')].filter(Boolean).join('\n').trim();
}

const norm = (s) => String(s || '').toLowerCase();

export function matches(item, query) {
  const q = norm(query).trim();
  if (!q) return true;
  const hay = norm([item.title, item.summary, item.note, item.url, item.file?.name, item.category, item.text, ...(item.tags || []), ...(item.points || [])].join(' '));
  return q.split(/\s+/).every((w) => hay.includes(w));
}

export const isWaiting = (item) => item.status === 'pending' || item.status === 'working';

// קטגוריות עם מספר הפריטים בכל אחת, הגדולות קודם
export function categoryList(items, categories = {}) {
  const counts = new Map();
  for (const i of items) if (i.category) counts.set(i.category, (counts.get(i.category) || 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, emoji: categories[name]?.emoji || '📁' }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'));
}

// filter: 'all' | 'waiting' (ממפה / נכשל) | שם קטגוריה
export function filterItems(items, filter, query) {
  return items.filter((i) => {
    if (filter === 'waiting' && !(isWaiting(i) || i.status === 'failed')) return false;
    if (filter !== 'all' && filter !== 'waiting' && i.category !== filter) return false;
    return matches(i, query);
  });
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function sizeText(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('לא הצלחתי לקרוא את הקובץ'));
  reader.readAsDataURL(blob);
});

// תמונה גדולה מוקטנת במכשיר (הסוכן קורא תמונות עד 5MB, ואין צורך ביותר)
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

// קובץ מהמכשיר -> { name, type, data } לשליחה לשרת
export async function readFile(original) {
  const file = await shrinkImage(original);
  if (file.size > MAX_FILE_BYTES) throw new Error(`"${original.name}" גדול מדי (עד 10MB)`);
  return { name: file.name, type: file.type || 'application/octet-stream', data: await blobToBase64(file) };
}

// הורדת קובץ שנשמר בשרת
export function downloadFile({ name, type, data }) {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  // PDF ותמונות נפתחים בלשונית חדשה, השאר יורדים
  if (/^(application\/pdf|image\/|text\/)/.test(type)) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

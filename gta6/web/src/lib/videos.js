// עזרים לרשימת הסרטונים: זיהוי קישורים בטקסט שהודבק, סינון, חיפוש ורשימת כל הקודים

const URL_RE = /https?:\/\/[^\s<>"'״]+/gi;

// טקסט שהודבק -> { links, note }. הטקסט שליד הקישורים (למשל כותרת מהשיתוף) נשמר כהערה
export function parsePasted(input) {
  const raw = String(input || '');
  const links = [...new Set((raw.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?)\]}]+$/, '')))];
  const note = raw.replace(URL_RE, ' ').replace(/[ \t]+/g, ' ').trim();
  return { links, note: note.slice(0, 500) };
}

// טקסט שהגיע בשיתוף מאפליקציה אחרת (‎?title=&text=&url=‎)
export function sharedText(search) {
  const p = new URLSearchParams(search);
  return [p.get('title'), p.get('text'), p.get('url')].filter(Boolean).join('\n').trim();
}

const norm = (s) => String(s || '').toLowerCase();

// סרטון ישן / חלקי – תמיד עם רשימת קודים
export const codesOf = (item) => (Array.isArray(item?.codes) ? item.codes : []);

export function matches(item, query) {
  const q = norm(query).trim();
  if (!q) return true;
  const codes = codesOf(item).flatMap((c) => [c.code, c.effect, c.platform]);
  const hay = norm([item.title, item.summary, item.note, item.url, item.category, ...(item.tags || []), ...codes].join(' '));
  return q.split(/\s+/).every((w) => hay.includes(w));
}

export const isWaiting = (item) => item.status === 'pending' || item.status === 'working';

// קטגוריות עם מספר הסרטונים בכל אחת, הגדולות קודם
export function categoryList(items, categories = {}) {
  const counts = new Map();
  for (const i of items) if (i.category) counts.set(i.category, (counts.get(i.category) || 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, emoji: categories[name]?.emoji || '🎮' }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'));
}

// filter: 'all' | 'waiting' (קורא / נכשל) | CODES | שם קטגוריה
export const CODES = '__codes__';
export function filterItems(items, filter, query) {
  return items.filter((i) => {
    if (filter === 'waiting' && !(isWaiting(i) || i.status === 'failed')) return false;
    if (filter === CODES && !codesOf(i).length) return false;
    if (!['all', 'waiting', CODES].includes(filter) && i.category !== filter) return false;
    return matches(i, query);
  });
}

// כל הקודים מכל הסרטונים, עם הסרטון שממנו הגיעו: [{ code, effect, platform, item }]
export function allCodes(items, query = '') {
  const q = norm(query).trim();
  const out = [];
  for (const item of items) {
    for (const c of codesOf(item)) {
      const hay = norm([c.code, c.effect, c.platform, item.title].join(' '));
      if (!q || q.split(/\s+/).every((w) => hay.includes(w))) out.push({ ...c, item });
    }
  }
  return out;
}

// כותרות הסרטונים החדשים ביותר בקטגוריה (לתצוגה מקדימה באריח)
export function newestTitles(items, name, limit = 2) {
  return items
    .filter((i) => i.category === name && i.title)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit)
    .map((i) => i.title);
}

// כתובת (hash) -> filter: '' = 'all', '#/waiting', '#/codes', '#/c/<שם>'
export function filterFromHash(hash) {
  const h = String(hash || '');
  if (h === '#/waiting') return 'waiting';
  if (h === '#/codes') return CODES;
  if (h.startsWith('#/c/')) {
    try {
      return decodeURIComponent(h.slice(4)) || 'all';
    } catch {
      return 'all';
    }
  }
  return 'all';
}

export function hashFromFilter(filter) {
  if (!filter || filter === 'all') return '';
  if (filter === 'waiting') return '#/waiting';
  if (filter === CODES) return '#/codes';
  return `#/c/${encodeURIComponent(filter)}`;
}

// מאיפה הסרטון (לתגית בכרטיס)
export function sourceOf(url) {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
  if (/facebook\.com|fb\.watch/.test(host)) return 'Facebook';
  if (/instagram\.com/.test(host)) return 'Instagram';
  if (/tiktok\.com/.test(host)) return 'TikTok';
  if (/youtube\.com|youtu\.be/.test(host)) return 'YouTube';
  if (/x\.com|twitter\.com/.test(host)) return 'X';
  return host;
}

export const countText = (n) => (n === 1 ? 'סרטון אחד' : `${n} סרטונים`);
export const codesText = (n) => (n === 1 ? 'קוד אחד' : `${n} קודים`);

export const PLATFORMS = ['PlayStation', 'Xbox', 'PC', 'טלפון', 'כל הפלטפורמות', 'לא ידוע'];

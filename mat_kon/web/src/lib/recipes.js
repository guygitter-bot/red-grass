// עזרים לספר המתכונים: קישורים משותפים, חיפוש, עריכה כטקסט.

// קישור שהגיע משיתוף (share target) או מהדבקה: ?url=... או טקסט שמכיל קישור
export function linkFromShare(search) {
  const params = new URLSearchParams(search);
  for (const value of [params.get('url'), params.get('text'), params.get('title')]) {
    const m = String(value || '').match(/https?:\/\/[^\s<>"']+/i);
    if (m) return m[0];
  }
  return null;
}

export function linkFromText(text) {
  const t = String(text || '').trim();
  const m = t.match(/https?:\/\/[^\s<>"']+/i);
  if (m) return m[0];
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) ? t : null;
}

export const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // ניקוד
    .replace(/["'״׳`\-–]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const haystack = (r) =>
  normalize([
    r.title, r.originalTitle, r.description, r.category, ...(r.tags || []),
    ...(r.ingredients || []).flatMap((s) => [s.title, ...s.items]),
    r.source?.author, r.source?.site,
  ].join(' '));

// חיפוש לפי שם, מצרך, תגית או ערוץ. כל המילים צריכות להופיע.
export function filterRecipes(recipes, { query = '', category = null, favorites = false } = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return recipes.filter(
    (r) =>
      (!category || r.category === category) &&
      (!favorites || r.favorite) &&
      (!words.length || words.every((w) => haystack(r).includes(w))),
  );
}

export function countByCategory(recipes) {
  const counts = {};
  for (const r of recipes) counts[r.category] = (counts[r.category] || 0) + 1;
  return counts;
}

// רשימת קטעים <-> טקסט לעריכה: שורה לכל פריט, "## כותרת" לפתיחת קטע
export function sectionsToText(sections) {
  return (sections || [])
    .map((s) => [s.title ? `## ${s.title}` : null, ...s.items].filter((l) => l !== null).join('\n'))
    .join('\n\n');
}

export function textToSections(text) {
  const sections = [];
  let current = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#+\s*(.+)$/);
    if (heading) {
      current = { title: heading[1].trim(), items: [] };
      sections.push(current);
    } else {
      if (!current) {
        current = { title: '', items: [] };
        sections.push(current);
      }
      current.items.push(line.replace(/^(\d+[.)]|[-•*])\s*/, ''));
    }
  }
  return sections.filter((s) => s.items.length);
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^(www|m)\./, '');
  } catch {
    return url;
  }
}

export const VIDEO_LABEL = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  vimeo: 'Vimeo',
};

export const isVideo = (r) => Boolean(VIDEO_LABEL[r?.source?.kind]);

export const CATEGORY_EMOJI = {
  'עוגות': '🎂',
  'עוגיות ומאפים מתוקים': '🍪',
  'קינוחים': '🍮',
  'לחמים ומאפים': '🥖',
  'ארוחת בוקר': '🍳',
  'סלטים': '🥗',
  'מרקים': '🍲',
  'פסטה ואורז': '🍝',
  'עוף': '🍗',
  'בשר': '🥩',
  'דגים': '🐟',
  'צמחוני וטבעוני': '🥦',
  'תוספות': '🥔',
  'רטבים וממרחים': '🫙',
  'משקאות': '🥤',
  'אחר': '🍴',
};

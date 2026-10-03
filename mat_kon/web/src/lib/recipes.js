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
export function filterRecipes(recipes, { query = '', category = null, favorites = false, tag = null } = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return recipes.filter(
    (r) =>
      (!category || r.category === category) &&
      (!favorites || r.favorite) &&
      (!tag || (r.tags || []).includes(tag)) &&
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

// קישור הזמנה: ...#invite=TOKEN ; כניסה: ...#login
export function parseAuthHash(hash) {
  const invite = String(hash || '').match(/[#&]invite=([\w-]{10,})/);
  if (invite) return { mode: 'register', token: invite[1] };
  const join = String(hash || '').match(/[#&]join=([\w-]{10,})/);
  if (join) return { mode: 'join', token: join[1] };
  if (/^#login\b/.test(String(hash || ''))) return { mode: 'login' };
  return null;
}

// כמה מתכונים חינמיים נשארו למשתמש שהוזמן (null = בלי הגבלה)
export function freeLeft(user) {
  if (!user || user.plan === 'paid') return null;
  return Math.max(0, user.freeLimit - user.added);
}

export function shortUrl(url) {
  try {
    const u = new URL(url);
    return `${hostOf(url)}${u.pathname.length > 1 ? u.pathname : ''}`;
  } catch {
    return String(url || '');
  }
}

// המתכון כטקסט לשיתוף (למשל חזרה לווטסאפ)
export function recipeAsText(r) {
  const list = (sections, numbered) => {
    let n = 0;
    return (sections || [])
      .map((s) => [s.title ? `*${s.title}*` : null, ...s.items.map((i) => (numbered ? `${(n += 1)}. ${i}` : `• ${i}`))].filter(Boolean).join('\n'))
      .join('\n\n');
  };
  return [
    `*${r.title}*`,
    r.servings ? `${r.servings}` : null,
    `\n*מצרכים*\n${list(r.ingredients, false)}`,
    `\n*אופן ההכנה*\n${list(r.steps, true)}`,
    r.tips?.length ? `\n*טיפים*\n${r.tips.map((t) => `• ${t}`).join('\n')}` : null,
  ].filter(Boolean).join('\n');
}

// מיון הספר
export const SORTS = { new: 'החדשים', abc: 'א-ב', rating: 'הדירוג הגבוה' };
export function sortRecipes(recipes, sort) {
  const list = [...recipes];
  if (sort === 'abc') return list.sort((a, b) => a.title.localeCompare(b.title, 'he'));
  if (sort === 'rating') return list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

// התגיות הנפוצות בספר
export function topTags(recipes, limit = 12) {
  const counts = new Map();
  for (const r of recipes) for (const t of r.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he')).slice(0, limit);
}

export const emojiOf = (category) => CATEGORY_EMOJI[category] || '🏷️';

// קובץ הגיבוי: המתכונים והקטגוריות שלי (רשימת הקניות והתכנון נכללים לעיון, ולא משוחזרים)
export function backupFile({ recipes, categories, shopping, plan }) {
  return JSON.stringify({ app: 'mat-kon', version: 1, exportedAt: new Date().toISOString(), categories, recipes, shopping, plan }, null, 1);
}

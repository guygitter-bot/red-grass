// הספר: המבנה שנשמר במכשיר, ומה נשאר לעשות בו. פונקציות טהורות (עם בדיקות).
//   { id, createdAt, brief, title, subtitle, dedication, look, coverScene,
//     coverKind: 'art' | 'photo'  (כריכה מאוירת, או התמונה הראשונה שהועלתה),
//     usePhoto  – האיורים מציירים את גיבור הספר לפי התמונה הראשונה,
//     art       – איור לכל פרק,
//     photos    – כמה תמונות הועלו (נשמרות כ-p0, p1...),
//     hasCover, thumb (כריכה ממוזערת לרשימה),
//     chapters: [{ id, title, summary, text, scene, hasImage }],
//     stage: 'outline' (מאשרים את המתווה) | 'book' (נכתב / מוכן),
//     share: { id, secret } | null }
import { isKid } from './brief.js';

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const safeChapter = (c) => ({ id: '', title: '', summary: '', text: '', scene: '', hasImage: false, ...c });

// ספר ישן שחסר בו שדה ממשיך לעבוד
export function safeBook(b) {
  return {
    createdAt: 0, title: '', subtitle: '', dedication: '', look: '', coverScene: '', coverKind: 'art', usePhoto: false, art: true,
    photos: 0, hasCover: false, thumb: '', stage: 'outline', share: null,
    ...b,
    brief: { answers: [], ...(b?.brief || {}) },
    chapters: (Array.isArray(b?.chapters) ? b.chapters : []).map(safeChapter),
  };
}

// ספר חדש מהמתווה שהסופר החזיר
export function makeBook(brief, outline, { photos = 0, coverKind = 'art', usePhoto = false, art = true } = {}) {
  return safeBook({
    id: newId(),
    createdAt: Date.now(),
    brief,
    title: outline.title,
    subtitle: outline.subtitle || '',
    dedication: brief.dedication || outline.dedication || '',
    look: outline.look || '',
    coverScene: outline.cover || '',
    coverKind: photos && coverKind === 'photo' ? 'photo' : 'art',
    usePhoto: Boolean(photos && usePhoto),
    art,
    photos,
    chapters: outline.chapters.map((c) => ({ id: newId(), title: c.title, summary: c.summary || '' })),
  });
}

export const chapterKey = (chapter) => `c${chapter.id}`;
export const photoKeys = (book) => Array.from({ length: book.photos || 0 }, (_, i) => `p${i}`);
// המפתח של תמונת הכריכה ('' = אין עדיין)
export const coverKey = (book) => (book.coverKind === 'photo' && book.photos ? 'p0' : book.hasCover ? 'cover' : '');

// כל מפתחות התמונות שיש לספר (למחיקה ולשיתוף)
export function imageKeys(book) {
  return [...(book.hasCover ? ['cover'] : []), ...book.chapters.filter((c) => c.hasImage).map(chapterKey), ...photoKeys(book)];
}

// המתווה כפי שהוא נשלח לסופר
export const outlineOf = (book) => ({ title: book.title, subtitle: book.subtitle, chapters: book.chapters.map((c) => ({ title: c.title, summary: c.summary })) });

// סוף הפרק הקודם – כדי שהפרק הבא ימשיך ממנו
export const tail = (text, max = 700) => String(text || '').slice(-max);

// מה הצעד הבא ביצירת הספר? skipArt = מזהי פרקים (או 'cover') שהאיור שלהם נכשל בריצה הזאת; noArt = לא לאייר בכלל
// מחזיר { kind: 'cover' } | { kind: 'chapter', index } | { kind: 'art', index } | null (הכול מוכן)
export function nextStep(book, { skipArt = new Set(), noArt = false } = {}) {
  const wantsCover = !noArt && book.coverKind === 'art' && !book.hasCover && book.coverScene && !skipArt.has('cover');
  if (wantsCover) return { kind: 'cover' };
  if (book.stage !== 'book') return null;
  for (let index = 0; index < book.chapters.length; index++) {
    const c = book.chapters[index];
    if (!c.text) return { kind: 'chapter', index };
    if (!noArt && book.art && !c.hasImage && c.scene && !skipArt.has(c.id)) return { kind: 'art', index };
  }
  return null;
}

export function progress(book) {
  const total = book.chapters.length;
  const written = book.chapters.filter((c) => c.text).length;
  const artTotal = book.art ? total : 0;
  const art = book.art ? book.chapters.filter((c) => c.hasImage).length : 0;
  return { total, written, art, artTotal, done: total > 0 && written === total, percent: total ? Math.round(((written + art) / (total + artTotal)) * 100) : 0 };
}

// מילים בספר (להצגה: "כ-X עמודים", 250 מילים לעמוד)
export function pagesEstimate(book) {
  const words = book.chapters.reduce((n, c) => n + (c.text ? c.text.split(/\s+/).length : 0), 0);
  return Math.max(1, Math.round(words / 250) + book.chapters.filter((c) => c.hasImage).length + 3);
}

// הספר כפי שהוא עולה לשיתוף: רק מה שהקורא רואה (בלי הבריף). רק פרקים שכבר נכתבו
export function toShared(book) {
  return {
    title: book.title,
    subtitle: book.subtitle,
    dedication: book.dedication,
    name: book.brief.name || '',
    from: book.brief.from || '',
    kid: isKid(book.brief),
    cover: coverKey(book),
    photos: photoKeys(book),
    chapters: book.chapters.filter((c) => c.text).map((c) => ({ title: c.title, text: c.text, image: c.hasImage ? chapterKey(c) : '' })),
  };
}

// הספר לקריאה: src(key) מחזיר כתובת לתמונה (data: במכשיר, כתובת בשרת בספר ששותף)
export function toView(shared, src) {
  const pic = (key) => (key ? src(key) || '' : '');
  return {
    ...shared,
    coverSrc: pic(shared.cover),
    photoSrcs: (shared.photos || []).filter((k) => k !== shared.cover).map(pic).filter(Boolean),
    chapters: shared.chapters.map((c) => ({ ...c, imageSrc: pic(c.image) })),
  };
}

// דפי הספר לפי הסדר: כריכה, הקדשה, תוכן העניינים, פרקים, אלבום, סוף
export function pagesOf(view) {
  return [
    { type: 'cover' },
    ...(view.dedication ? [{ type: 'dedication' }] : []),
    ...(view.chapters.length > 1 ? [{ type: 'toc' }] : []),
    ...view.chapters.map((_, index) => ({ type: 'chapter', index })),
    ...(view.photoSrcs?.length ? [{ type: 'album' }] : []),
    { type: 'end' },
  ];
}

export const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

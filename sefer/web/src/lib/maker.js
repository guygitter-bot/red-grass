// יצירת הספר: רץ ברקע (כל עוד האפליקציה פתוחה) – כריכה, ואחר כך פרק ואיור, פרק ואיור. כל צעד נשמר מיד,
// כך שאם סוגרים באמצע ממשיכים מאותה נקודה.
import { getChapter, getArt } from './api.js';
import { getBook, saveBook, getImage, saveImage } from './store.js';
import { safeBook, nextStep, outlineOf, tail, chapterKey } from './book.js';
import { compactArt, makeThumb } from './image.js';

// מצב לכל ספר: { running, doing: 'cover' | 'chapter' | 'art', index, error, detail, artError }
const status = new Map();
const listeners = new Set();

export const getStatus = (id) => status.get(id) || { running: false };
export function subscribe(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function set(id, patch) {
  status.set(id, { ...getStatus(id), ...patch });
  for (const fn of listeners) fn(id);
}

export const stop = (id) => { if (getStatus(id).running) set(id, { stopping: true }); };

// התמונה של גיבור הספר (אם ביקשו שהאיורים יהיו לפיה)
const heroPhoto = async (book) => (book.usePhoto && book.photos ? (await getImage(book.id, 'p0')) || null : null);

async function draw(book, scene, cover) {
  const photo = await heroPhoto(book);
  const art = await getArt({ scene, style: book.brief.style, look: book.look, cover, photo: photo ? { media_type: photo.media_type, data: photo.data } : undefined });
  return compactArt(art);
}

// צעד אחד. מחזיר את הספר המעודכן
async function doStep(book, step) {
  if (step.kind === 'cover') {
    const art = await draw(book, book.coverScene, true);
    await saveImage(book.id, 'cover', art);
    return { ...book, hasCover: true, thumb: await makeThumb(art).catch(() => '') };
  }
  const chapter = book.chapters[step.index];
  const chapters = [...book.chapters];
  if (step.kind === 'chapter') {
    const before = step.index > 0 ? tail(book.chapters[step.index - 1].text) : '';
    const { text, scene } = await getChapter(book.brief, outlineOf(book), step.index, before, chapter.note || '');
    chapters[step.index] = { ...chapter, text, scene, note: '' };
    return { ...book, chapters };
  }
  const art = await draw(book, chapter.scene, false);
  await saveImage(book.id, chapterKey(chapter), art);
  chapters[step.index] = { ...chapter, hasImage: true };
  return { ...book, chapters };
}

// מריץ את כל הצעדים שנשארו. תקלה באיור לא עוצרת את הכתיבה (מדלגים, ואפשר לנסות שוב אחר כך);
// תקלה בכתיבה עוצרת ומוצגת למשתמש.
export async function run(id) {
  if (getStatus(id).running) return;
  set(id, { running: true, stopping: false, error: '', detail: '', artError: '' });
  const skipArt = new Set();
  let noArt = false;
  try {
    for (;;) {
      const book = safeBook(await getBook(id));
      if (!book.id || getStatus(id).stopping) break;
      const step = nextStep(book, { skipArt, noArt });
      if (!step) break;
      set(id, { doing: step.kind, index: step.index ?? -1 });
      try {
        const next = await doStep(book, step);
        // הספר אולי נערך בינתיים (שם, הקדשה) – שומרים רק את מה שהצעד הזה שינה
        const fresh = safeBook((await getBook(id)) || next);
        if (step.kind === 'cover') await saveBook({ ...fresh, hasCover: next.hasCover, thumb: next.thumb });
        else {
          const done = next.chapters[step.index];
          await saveBook({ ...fresh, chapters: fresh.chapters.map((c) => (c.id === done.id ? { ...c, ...(step.kind === 'chapter' ? { text: done.text, scene: done.scene, note: '' } : { hasImage: true }) } : c)) });
        }
        set(id, {});
      } catch (e) {
        if (step.kind === 'chapter') throw e;
        // איור: מדלגים עליו. אם אין מאייר בכלל / נגמרה המכסה – מפסיקים לנסות בריצה הזאת
        skipArt.add(step.kind === 'cover' ? 'cover' : book.chapters[step.index].id);
        if (e.status === 503 || e.status === 429 || /קרדיט|מפתח/.test(e.message)) noArt = true;
        set(id, { artError: e.message || 'האיור לא הצליח', detail: e.detail || '' });
      }
    }
  } catch (e) {
    set(id, { error: e.message || 'משהו השתבש. נסו שוב.', detail: e.detail || '' });
  } finally {
    set(id, { running: false, stopping: false, doing: '', index: -1 });
  }
}

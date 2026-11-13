// השמירה במכשיר (IndexedDB): הספרים נשארים בטלפון / במחשב של מי שיצר אותם.
//   books:  ראו safeBook ב-book.js
//   images: מפתח = `${book.id}:${key}` (key: cover / c<מזהה פרק> / p<מספר> לתמונות שהועלו) -> { media_type, data }
const DB = 'sefer-ishi';
let opening = null;

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('books', { keyPath: 'id' });
        req.result.createObjectStore('images');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return opening;
}

// פעולה אחת או כמה בעסקה אחת; fn מקבל את המחסנים ומחזיר בקשה (או כלום)
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['books', 'images'], mode);
    const req = fn(t.objectStore('books'), t.objectStore('images'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const listBooks = () => tx('readonly', (books) => books.getAll()).then((all) => all || []);
export const getBook = (id) => tx('readonly', (books) => books.get(id));
export const saveBook = (book) => tx('readwrite', (books) => { books.put(book); });
export const getImage = (bookId, key) => tx('readonly', (_, images) => images.get(`${bookId}:${key}`));
export const saveImage = (bookId, key, image) => tx('readwrite', (_, images) => { images.put(image, `${bookId}:${key}`); });
export const deleteImage = (bookId, key) => tx('readwrite', (_, images) => { images.delete(`${bookId}:${key}`); });

// כל התמונות של ספר: { key: image }
export async function bookImages(bookId, keys) {
  const out = {};
  for (const key of keys) {
    const im = await getImage(bookId, key);
    if (im) out[key] = im;
  }
  return out;
}

export function removeBook(bookId, keys) {
  return tx('readwrite', (books, images) => {
    books.delete(bookId);
    for (const key of keys) images.delete(`${bookId}:${key}`);
  });
}

// קבצים ותמונות שמצורפים למשימות.
// תמונה גדולה מוקטנת במכשיר לפני ההעלאה (תמונה מהמצלמה שוקלת כמה MB – אחרי ההקטנה כמה מאות KB).
// הקבצים נשמרים בשרת, ובמכשיר נשמר עותק (Cache Storage) – כדי שקובץ שכבר נפתח ייפתח גם בלי אינטרנט.
import { MAX_FILE_BYTES, newId } from './store';
import { downloadFile, uploadFile } from './sync';

const MAX_SIDE = 1600;
const QUALITY = 0.85;
const CACHE = 'attachments';
// כתובות blob (או הבטחה לכתובת, בזמן ההורדה) שכבר נוצרו בפתיחה הזאת של האפליקציה
const urls = new Map();

// גודל חדש לתמונה, כך שהצלע הארוכה לא תעבור את max
export function scaledSize(width, height, max = MAX_SIDE) {
  const longest = Math.max(width, height);
  if (!longest || longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

// תמונות שאפשר להקטין (GIF מונפש ו-SVG נשארים כמו שהם)
export function shrinkable(type) {
  return /^image\/(jpeg|png|webp|heic|heif)$/.test(type || '');
}

// "IMG_1234.HEIC" -> "IMG_1234.jpg"
export function jpgName(name) {
  const base = String(name || 'תמונה').replace(/\.[^.\s]{1,5}$/, '');
  return `${base || 'תמונה'}.jpg`;
}

export function base64ToBytes(data) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function shrinkImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // רקע לבן (תמונת PNG שקופה לא תהפוך לשחורה)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (blob && blob.size < file.size) return { blob, name: jpgName(file.name), type: 'image/jpeg' };
  } catch {
    // הדפדפן לא יודע לפתוח את התמונה – עולה כמו שהיא
  }
  return { blob: file, name: file.name, type: file.type };
}

async function cacheBlob(id, blob) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(`/attachments/${id}`, new Response(blob, { headers: { 'content-type': blob.type } }));
  } catch {
    // אין Cache Storage – הקובץ ייטען שוב מהשרת בפעם הבאה
  }
}

async function cachedBlob(id) {
  try {
    const res = await (await caches.open(CACHE)).match(`/attachments/${id}`);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

// מעלה קובץ שנבחר ומחזיר את הפרטים לשמירה במשימה: { id, name, type, size }
export async function attachFile(file) {
  const ready = shrinkable(file.type) ? await shrinkImage(file) : { blob: file, name: file.name, type: file.type };
  if (ready.blob.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" גדול מדי – אפשר לצרף קבצים עד 4MB`);
  const id = newId();
  const saved = await uploadFile({ id, name: ready.name || 'קובץ', type: ready.type || 'application/octet-stream', data: await blobToBase64(ready.blob) });
  const blob = ready.blob.type === saved.type ? ready.blob : new Blob([ready.blob], { type: saved.type });
  await cacheBlob(id, blob);
  urls.set(id, URL.createObjectURL(blob));
  return saved;
}

// כתובת להצגה / הורדה של קובץ מצורף (מהמכשיר אם כבר נשמר, אחרת מהשרת)
// (אותו קובץ שמבוקש פעמיים בבת אחת – יורד פעם אחת)
export function fileUrl(attachment) {
  const { id } = attachment;
  if (!urls.has(id)) {
    const loading = (async () => {
      let blob = await cachedBlob(id);
      if (!blob) {
        const file = await downloadFile(id);
        blob = new Blob([base64ToBytes(file.data)], { type: file.type });
        await cacheBlob(id, blob);
      }
      return URL.createObjectURL(blob);
    })();
    // נכשל (למשל בלי אינטרנט) – ננסה שוב בפעם הבאה
    loading.catch(() => urls.delete(id));
    urls.set(id, loading);
  }
  return Promise.resolve(urls.get(id));
}

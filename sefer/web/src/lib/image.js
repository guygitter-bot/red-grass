// תמונות: הקטנה לפני שליחה ושמירה, ותמונה ממוזערת לרשימות.
// תמונה בכל האפליקציה = { media_type, data } (base64), כמו שהשרת מקבל ומחזיר.
export const MAX_SIDE = 1280;
export const THUMB_SIDE = 360;
// איור שהגיע מהמאייר נשמר מוקטן (PNG מלא שוקל כמה מגה)
export const ART_SIDE = 1280;

// גודל חדש שנכנס ב-max בלי לעוות (ולא מגדיל תמונה קטנה)
export function fitSize(w, h, max) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export const dataUrl = (im) => (im ? `data:${im.media_type};base64,${im.data}` : '');

export function fromDataUrl(url) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url || '');
  return m ? { media_type: m[1], data: m[2] } : null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('לא הצלחנו לקרוא את התמונה'));
    img.src = src;
  });
}

// מצייר מקור (קובץ או תמונה שמורה) בגודל מוקטן ומחזיר { media_type, data, w, h }
async function shrink(src, max, quality) {
  const img = await loadImage(src);
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, max);
  if (!w) throw new Error('לא הצלחנו לקרוא את התמונה');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return { ...fromDataUrl(canvas.toDataURL('image/jpeg', quality)), w, h };
}

// קובץ מהמצלמה / מהגלריה -> תמונה מוקטנת לשליחה
export async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await shrink(url, MAX_SIDE, 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// תמונה ממוזערת לרשימות (מחרוזת data:)
export async function makeThumb(im) {
  return dataUrl(await shrink(dataUrl(im), THUMB_SIDE, 0.8));
}

// איור מהמאייר -> JPEG מוקטן לשמירה ולשיתוף
export async function compactArt(im) {
  const { media_type, data } = await shrink(dataUrl(im), ART_SIDE, 0.86);
  return { media_type, data };
}

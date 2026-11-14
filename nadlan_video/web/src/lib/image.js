// תמונות וקבצים: הקטנה לפני שליחה, תמונה ממוזערת לרשימות, הורדה ושיתוף.
// תמונה בכל האפליקציה = { media_type, data } (base64), כמו שהשרת מקבל ומחזיר.
export const MAX_SIDE = 1920;
export const THUMB_SIDE = 480;

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
    img.onerror = () => reject(new Error('לא הצלחנו לקרוא את התמונה. צריך קובץ תמונה (JPG / PNG); תוכנית ב-PDF – לצלם מסך.'));
    img.src = src;
  });
}

// מצייר מקור (קובץ או תמונה שמורה) בגודל מוקטן על רקע לבן (שרטוט שקוף) ומחזיר { media_type, data }
async function shrink(src, max, quality) {
  const img = await loadImage(src);
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, max);
  if (!w) throw new Error('לא הצלחנו לקרוא את התמונה');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return fromDataUrl(canvas.toDataURL('image/jpeg', quality));
}

// קובץ מהמצלמה / מהגלריה -> תמונה מוקטנת לשליחה
export async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await shrink(url, MAX_SIDE, 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// תמונה ממוזערת לרשימות (מחרוזת data:)
export async function makeThumb(im) {
  return dataUrl(await shrink(dataUrl(im), THUMB_SIDE, 0.8));
}

// שם קובץ בטוח מתוך שם הפרויקט
export const fileName = (name, extra = '') => `${String(name || 'nadlan').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'nadlan'}${extra}`;

export const videoExt = (type) => (/webm/i.test(type || '') ? 'webm' : 'mp4');

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// שיתוף (ווטסאפ וכו'); אם המכשיר לא תומך – הורדה
export async function shareBlob(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  downloadBlob(blob, name);
}

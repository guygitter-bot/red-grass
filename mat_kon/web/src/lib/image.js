// הקטנת תמונות בדפדפן לפני שליחה: לקריאה (חדה מספיק לטקסט) ולשמירה בספר (קטנה)

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('לא הצלחתי לפתוח את התמונה'));
    };
    img.src = url;
  });
}

// WebP קטן בכ-30% מ-JPEG באותה איכות. דפדפן שלא יודע לשמור WebP (ספארי ישן) מחזיר PNG – אז JPEG
let webpOk;
const canWebp = () => {
  if (webpOk === undefined) {
    try {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      webpOk = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpOk = false;
    }
  }
  return webpOk;
};

function draw(img, maxSide, quality, format = 'image/jpeg') {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(format, quality);
}

// data URL -> תמונה ל-AI (הסוג לפי מה שבאמת נשמר: WebP או JPEG)
export const dataUrlToPart = (dataUrl) => ({ type: dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg', data: dataUrl.split(',')[1] });

const fast = () => (canWebp() ? 'image/webp' : 'image/jpeg');

// לקריאת המתכון: עד 1600 פיקסלים בצד הארוך
export async function photoForReading(file) {
  return draw(await loadImage(file), 1600, 0.85, fast());
}

// לשמירה בספר: קטנה מ-150KB (WebP כשאפשר – נטענת מהר יותר)
export async function thumbnail(file) {
  const img = await loadImage(file);
  for (const [side, q] of [[640, 0.75], [480, 0.7], [360, 0.6]]) {
    const url = draw(img, side, q, fast());
    if (url.length < 150 * 1024) return url;
  }
  return null;
}

// תמונת "הכנתי!" לקהילה: עד 1024 פיקסלים ופחות מ-380KB (מגבלת השרת)
export async function talkPhoto(file) {
  const img = await loadImage(file);
  for (const [side, q] of [[1024, 0.8], [900, 0.7], [720, 0.6]]) {
    const url = draw(img, side, q);
    if (url.length < 500 * 1024) return url;
  }
  throw new Error('התמונה גדולה מדי');
}

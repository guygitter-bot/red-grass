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

function draw(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export const dataUrlToPart = (dataUrl) => ({ type: 'image/jpeg', data: dataUrl.split(',')[1] });

// לקריאת המתכון: עד 1600 פיקסלים בצד הארוך
export async function photoForReading(file) {
  return draw(await loadImage(file), 1600, 0.85);
}

// לשמירה בספר: קטנה מ-150KB
export async function thumbnail(file) {
  const img = await loadImage(file);
  for (const [side, q] of [[640, 0.75], [480, 0.7], [360, 0.6]]) {
    const url = draw(img, side, q);
    if (url.length < 150 * 1024) return url;
  }
  return null;
}

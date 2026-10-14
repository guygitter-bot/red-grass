// הקטנת תמונה של מורה ל-256 פיקסלים (JPEG), כדי שתישמר מהר ובקטן
export function resizePhoto(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = size / Math.min(img.width, img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      // חותכים לריבוע מהמרכז
      canvas.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('לא הצלחתי לקרוא את התמונה'));
    };
    img.src = url;
  });
}

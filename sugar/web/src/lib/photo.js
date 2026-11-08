// תמונת החיישן: הקטנה בטלפון (כדי שתעלה מהר ותישאר קריאה), העלאה לשרת וקבלה ממנו
import { api } from './api';

// קובץ תמונה → JPEG מוקטן (data URL). הצד הארוך עד 2000 פיקסלים – מספיק לקרוא את המדבקה
export async function shrinkImage(file, maxSide = 2000, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('לא הצלחתי לפתוח את התמונה'));
      i.src = url;
    });
    let side = maxSide;
    let q = quality;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', q);
      if (data.length < 1_800_000) return data;
      side *= 0.8;
      q = Math.max(0.6, q - 0.1);
    }
    throw new Error('התמונה גדולה מדי');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// שמירה בזיכרון לפי זמן ההעלאה – לא מורידים שוב כל פעם שפותחים את המסך
let cache = { at: 0, data: '' };

export async function getSensorPhoto(at) {
  if (at && cache.at === at && cache.data) return cache;
  const r = await api('/sensor/get');
  cache = { at: r.at || 0, data: r.data || '', by: r.by || '' };
  return cache;
}

export async function uploadSensorPhoto(data, by) {
  const r = await api('/sensor/photo', { data, by });
  cache = { at: r.at, data, by };
  return cache;
}

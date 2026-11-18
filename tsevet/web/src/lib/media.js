// הכנת קבצים לפני ההעלאה: תמונה מוקטנת, וסרטון עם תמונה ממוזערת (poster)
import { API, getToken } from './api';
import { PDF, docKind, docToText } from './docs';

export const LIMITS = {
  image: { bytes: 8 * 1024 * 1024, label: '8MB' },
  video: { bytes: 95 * 1024 * 1024, label: '95MB' },
  audio: { bytes: 30 * 1024 * 1024, label: '30MB' },
  doc: { bytes: 20 * 1024 * 1024, label: '20MB' },
};
export const MAX_FILES = 6;

export function kindOf(file) {
  const t = file.type || '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (docKind(file)) return 'doc';
  return null;
}

// הודעת שגיאה בעברית אם הקובץ לא מתאים, אחרת null
export function checkFile(file, kind = kindOf(file), size = file.size) {
  if (!kind) return `"${file.name}" – אפשר לצרף תמונה, סרטון, הקלטה או מסמך (PDF, Word, Excel, CSV, טקסט)`;
  const lim = LIMITS[kind];
  if (size > lim.bytes) {
    const what = { image: 'תמונה', video: 'סרטון', audio: 'הקלטה', doc: 'מסמך' }[kind];
    return `"${file.name}" גדול מדי – ${what} יכולה להיות עד ${lim.label}`;
  }
  return null;
}

// גודל חדש לפי הצלע הארוכה
export function fitSize(w, h, max) {
  const long = Math.max(w, h);
  if (long <= max) return { w, h };
  const k = max / long;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

// תמונה: הקטנה עד 1600 והמרה ל-JPEG (גיף נשאר כמו שהוא)
export async function prepareImage(file) {
  if (file.type === 'image/gif') return { blob: file, name: file.name, type: file.type, w: 0, h: 0 };
  try {
    const bmp = await createImageBitmap(file);
    const { w, h } = fitSize(bmp.width, bmp.height, 1600);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await toBlob(canvas, 0.85);
    if (!blob) throw new Error('no blob');
    return { blob, name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', w, h };
  } catch {
    // לא הצלחנו להקטין – שולחים כמו שהוא
    return { blob: file, name: file.name, type: file.type, w: 0, h: 0 };
  }
}

// סרטון: משך, מידות ותמונה אחת מתוכו (בכל כשל או אחרי 6 שניות – בלי תמונה)
export function probeVideo(file, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      v.load();
      resolve(res);
    };
    const info = { dur: 0, w: 0, h: 0, poster: null };
    const timer = setTimeout(() => finish(info), timeoutMs);
    v.onerror = () => finish(info);
    v.onloadedmetadata = () => {
      info.dur = Number.isFinite(v.duration) ? Math.round(v.duration) : 0;
      info.w = v.videoWidth;
      info.h = v.videoHeight;
      v.currentTime = Math.min(1, (v.duration || 1) * 0.1);
    };
    v.onseeked = async () => {
      try {
        const { w, h } = fitSize(v.videoWidth, v.videoHeight, 960);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(v, 0, 0, w, h);
        info.poster = await toBlob(canvas, 0.8);
      } catch {
        // בלי תמונה
      }
      finish(info);
    };
    v.src = url;
  });
}

// העלאה עם התקדמות (XMLHttpRequest). params: name, type, dur, w, h, poster
export function uploadBlob(blob, params, onProgress) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, String(v));
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API}/app/upload?${q}`);
    xhr.setRequestHeader('authorization', `Bearer ${getToken()}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new Error('אין חיבור לאינטרנט'));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // תשובה לא תקינה
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || 'ההעלאה נכשלה'));
    };
    xhr.send(blob);
  });
}

// כל התהליך לקובץ אחד: הכנה + העלאה (בסרטון: קודם התמונה). מחזיר { id, kind, name }
export async function uploadFile(file, onProgress) {
  const kind = kindOf(file);
  const bad = checkFile(file, kind);
  if (bad) throw new Error(bad);
  if (kind === 'image') {
    const p = await prepareImage(file);
    const tooBig = checkFile(file, kind, p.blob.size);
    if (tooBig) throw new Error(tooBig);
    return uploadBlob(p.blob, { name: p.name, type: p.type, w: p.w, h: p.h }, onProgress);
  }
  if (kind === 'video') {
    const info = await probeVideo(file);
    let poster = '';
    if (info.poster) {
      try {
        poster = (await uploadBlob(info.poster, { name: 'poster.jpg', type: 'image/jpeg', w: 0, h: 0 })).id;
      } catch {
        // ממשיכים בלי תמונה
      }
    }
    return uploadBlob(file, { name: file.name, type: file.type, dur: info.dur, w: info.w, h: info.h, poster }, onProgress);
  }
  if (kind === 'doc') {
    // PDF – כמו שהוא; שאר המסמכים – טקסט (נקרא כאן בטלפון)
    if (docKind(file) === 'pdf') return uploadBlob(file, { name: file.name, type: PDF }, onProgress);
    const text = await docToText(file).catch(() => {
      throw new Error(`"${file.name}" – לא הצלחנו לקרוא את הקובץ`);
    });
    if (!text.trim()) throw new Error(`"${file.name}" – לא נמצא טקסט בקובץ`);
    return uploadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), { name: file.name, type: 'text/plain' }, onProgress);
  }
  return uploadBlob(file, { name: file.name, type: file.type }, onProgress);
}

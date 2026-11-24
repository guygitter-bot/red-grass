// פנייה לשרת (gta6/api). בלי סיסמה
const API = (import.meta.env.VITE_API_URL || 'https://gta6-videos-api.guygitter.workers.dev').replace(/\/$/, '');

export async function api(path, body = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('אין חיבור לאינטרנט');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'תקלה בשרת');
  return data;
}

// העלאת קובץ וידאו מהטלפון לצפייה (גוף הבקשה = הקובץ עצמו). onProgress(0..1)
// XMLHttpRequest ולא fetch – כדי להראות כמה כבר עלה (סרטון יכול להיות עשרות MB)
export function uploadVideo(id, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/video/upload?id=${encodeURIComponent(id)}`);
    xhr.setRequestHeader('content-type', file.type && file.type.startsWith('video/') ? file.type : 'video/mp4');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || 'ההעלאה נכשלה'));
    };
    xhr.onerror = () => reject(new Error('אין חיבור לאינטרנט'));
    xhr.send(file);
  });
}

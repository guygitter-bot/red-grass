// פנייה לשרת (nadlan_video/api). הסיסמה נשמרת במכשיר ונשלחת בכל בקשה (מקודדת, כי כותרת לא יכולה להכיל עברית).
const API = (import.meta.env.VITE_API_URL || 'https://nadlan-video-api.guygitter.workers.dev').replace(/\/$/, '');
const KEY = 'nadlan-video-password';

let password = '';
try { password = localStorage.getItem(KEY) || ''; } catch { password = ''; }
let onLogout = () => {};

export const hasPassword = () => Boolean(password);
export const setOnLogout = (fn) => { onLogout = fn; };

function remember(p) {
  password = p;
  try {
    if (p) localStorage.setItem(KEY, p);
    else localStorage.removeItem(KEY);
  } catch { /* חלון פרטי – הסיסמה נשארת רק עד סגירת הלשונית */ }
}

export function logout() {
  remember('');
  onLogout();
}

function toError(data, fallback) {
  // detail = מה שענה השירות החיצוני (באנגלית), מוצג בקטן כדי שאפשר יהיה לאבחן
  const err = new Error(data?.error || fallback);
  err.detail = data?.detail || '';
  err.code = data?.code || '';
  return err;
}

async function send(path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(password ? { authorization: `Bearer ${encodeURIComponent(password)}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('אין חיבור לאינטרנט');
  }
  if (res.status === 401 && path !== '/login') {
    const data = await res.json().catch(() => ({}));
    logout();
    throw toError(data, 'צריך להיכנס מחדש');
  }
  return res;
}

export async function api(path, body = {}) {
  const res = await send(path, body);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw toError(data, 'תקלה בשרת');
  return data;
}

// האם כבר נקבעה סיסמה לאפליקציה (הכניסה הראשונה קובעת אותה)
export async function health() {
  try {
    const res = await fetch(`${API}/health`);
    return await res.json();
  } catch {
    throw new Error('אין חיבור לאינטרנט');
  }
}

export async function login(p) {
  const out = await api('/login', { password: p });
  remember(p);
  return out;
}

// הבמאי: רשימת השוטים לסרטון
export const planFilm = (brief, photo, plan) => api('/plan', { brief, photo, plan });
// פריים הפתיחה של שוט
export const makeStill = (image, instruction, brief, source) => api('/still', { image, instruction, brief, source }).then((d) => d.image);
// מתחיל יצירת סרטון -> { op, resolution }
export const startClip = (image, motion, aspect, quality, style) => api('/clip', { image, motion, aspect, quality, style });
export const clipStatus = (op) => api('/clip/status', { op });

// הקובץ של סרטון מוכן (Blob)
export async function clipFile(op) {
  const res = await send('/clip/file', { op });
  if (!res.ok) throw toError(await res.json().catch(() => ({})), 'לא הצלחנו להוריד את הסרטון');
  const blob = await res.blob();
  if (!blob.size) throw new Error('לא הצלחנו להוריד את הסרטון');
  return blob.type.startsWith('video/') ? blob : new Blob([blob], { type: 'video/mp4' });
}

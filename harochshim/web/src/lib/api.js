// פנייה לשרת (harochshim/api). מנהל: אסימון אחרי סיסמה. ספק: הסוד מהקישור האישי שלו
const API = (import.meta.env.VITE_API_URL || 'https://harochshim-api.guygitter.workers.dev').replace(/\/$/, '');

export async function api(path, body = {}, token) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('אין חיבור לאינטרנט');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'תקלה בשרת'), { status: res.status });
  return data;
}

// שמירה מקומית בטלפון (מצב פרטי / חסום – פשוט לא נשמר)
export function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function store(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // לא נשמר
  }
}

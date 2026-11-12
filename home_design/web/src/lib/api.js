// פנייה לשרת (home_design/api). בלי סיסמה
const API = (import.meta.env.VITE_API_URL || 'https://meatzev-habayit-api.guygitter.workers.dev').replace(/\/$/, '');

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
  if (!res.ok) {
    // detail = מה שענה השירות החיצוני (באנגלית), מוצג בקטן כדי שאפשר יהיה לאבחן
    const err = new Error(data.error || 'תקלה בשרת');
    err.detail = data.detail || '';
    throw err;
  }
  return data;
}

// הצעות מהמעצב לתמונה
export const getIdeas = (image, note) => api('/ideas', { image, note });
// הדמיה: אותה תמונה אחרי השינוי
export const render = (image, request) => api('/render', { image, request }).then((d) => d.image);

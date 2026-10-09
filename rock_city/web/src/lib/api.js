// פנייה לשרת (rock_city/api). הסוד של הכניסה נשמר במכשיר
const API = (import.meta.env.VITE_API_URL || 'https://rock-city-api.guygitter.workers.dev').replace(/\/$/, '');
const KEY = 'rc_token';

export function getToken() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(t) {
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    // מצב פרטי – רק לשיחה הזאת
  }
}

export async function api(path, body = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('אין חיבור לאינטרנט'), { offline: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'תקלה בשרת'), { status: res.status, data });
  return data;
}

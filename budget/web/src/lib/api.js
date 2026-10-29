// פנייה לשרת (budget/api). הסוד של החיבור נשמר במכשיר אחרי הכניסה בסיסמה
const API = (import.meta.env.VITE_API_URL || 'https://bayit-budget-api.guygitter.workers.dev').replace(/\/$/, '');
const TOKEN = 'bb_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN, token);
    else localStorage.removeItem(TOKEN);
  } catch {
    // מצב פרטי
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
  if (!res.ok) throw Object.assign(new Error(data.error || 'תקלה בשרת'), { status: res.status });
  return data;
}

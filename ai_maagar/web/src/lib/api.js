// פנייה לשרת (ai_maagar/api). האסימון נשמר במכשיר אחרי כניסה אחת
const API = (import.meta.env.VITE_API_URL || 'https://ai-maagar-api.guygitter.workers.dev').replace(/\/$/, '');
const TOKEN_KEY = 'aim_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // מצב פרטי
  }
}

export class AuthError extends Error {}

export async function api(path, body = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('אין חיבור לאינטרנט');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') throw new AuthError(data.error || 'צריך להתחבר מחדש');
  if (!res.ok) throw new Error(data.error || 'תקלה בשרת');
  return data;
}

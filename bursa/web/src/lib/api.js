// פנייה לשרת (bursa/api). הכול POST עם JSON, ואחרי הכניסה גם טוקן
const API = (import.meta.env.VITE_API_URL || 'https://bursa-api.guygitter.workers.dev').replace(/\/$/, '');
const TOKEN_KEY = 'bursa_token';
const OPEN = ['/status', '/setup', '/login'];

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
    // מצב פרטי – רק לשיחה הזאת
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, body = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = getToken();
  if (token && !OPEN.includes(path)) headers.authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('אין חיבור לאינטרנט', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !OPEN.includes(path)) {
    // התחברות פגה – מנקים ומציגים כניסה
    setToken('');
    window.dispatchEvent(new Event('bursa-logout'));
  }
  if (!res.ok) throw new ApiError(data.error || 'תקלה בשרת', res.status);
  return data;
}

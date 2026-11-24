// פנייה לשרת (promptika/api). אחרי כניסה – אסימון בכל בקשה
const API = (import.meta.env.VITE_API_URL || 'https://promptika-api.guygitter.workers.dev').replace(/\/$/, '');
const TOKEN_KEY = 'pk_token';

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

export async function api(method, path, body) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('אין חיבור לאינטרנט');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    setToken('');
    window.dispatchEvent(new Event('pk-logout'));
  }
  if (!res.ok) throw Object.assign(new Error(data.error || 'תקלה בשרת'), { status: res.status });
  return data;
}

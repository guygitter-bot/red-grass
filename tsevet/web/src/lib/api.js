// פנייה לשרת (tsevet/api). הסוד של החיבור נשמר במכשיר אחרי הכניסה בסיסמה
export const API = (import.meta.env.VITE_API_URL || 'https://tsevet-api.guygitter.workers.dev').replace(/\/$/, '');
const TOKEN = 'tsevet_token';

// מי שמאזין לכניסה / יציאה (נרשם ב-App)
let onUnauth = () => {};
export function setUnauthHandler(fn) {
  onUnauth = fn;
}

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
  if (!res.ok) {
    // 401 בכל קריאה מחוברת = צריך להיכנס מחדש (חוץ מניסיון כניסה עצמו)
    if (res.status === 401 && !path.startsWith('/app/login') && !path.startsWith('/app/setup') && !path.startsWith('/app/status')) {
      setToken('');
      onUnauth();
    }
    throw Object.assign(new Error(data.error || 'תקלה בשרת'), { status: res.status });
  }
  return data;
}

// כניסה / קביעת סיסמה: path הוא /app/login או /app/setup
export async function loginWith(path, password) {
  const r = await api(path, { password });
  setToken(r.token);
  return r.token;
}

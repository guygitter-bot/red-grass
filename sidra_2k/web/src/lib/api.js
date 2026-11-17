// הקשר לשרת. עותק אחרון של הסדרה נשמר במכשיר, כדי שהמסך ייפתח מיד (וגם בלי אינטרנט).
// מי שנכנס כמאסטר מקבל סוד (token) שנשמר במכשיר ונשלח עם כל שינוי. השרת הוא זה שבודק.
import { safeSeries } from './series';

const API = import.meta.env.VITE_API_URL || 'https://sidra-2k-api.guygitter.workers.dev';
const CACHE_KEY = 'sidra_cache';
const TOKEN_KEY = 'sidra_token';

const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    // מצב פרטי – רק לשיחה הזאת
  }
};

export function cached() {
  try {
    return safeSeries(JSON.parse(read(CACHE_KEY)));
  } catch {
    return safeSeries(null);
  }
}

export async function call(path, body = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = read(TOKEN_KEY);
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'אין חיבור לשרת');
  if (data.token) write(TOKEN_KEY, data.token);
  if (path === 'logout') write(TOKEN_KEY, '');
  const s = safeSeries(data);
  // הסוד פג (למשל אחרי החלפת מכשיר) – לא שומרים אותו סתם
  if (token && !s.master && path === 'get') write(TOKEN_KEY, '');
  write(CACHE_KEY, JSON.stringify(s));
  return s;
}

// הקשר לשרת. עותק אחרון של הסדרה נשמר במכשיר, כדי שהמסך ייפתח מיד (וגם בלי אינטרנט).
import { safeSeries } from './series';

const API = import.meta.env.VITE_API_URL || 'https://sidra-2k-api.guygitter.workers.dev';
const CACHE_KEY = 'sidra_cache';

export function cached() {
  try {
    return safeSeries(JSON.parse(localStorage.getItem(CACHE_KEY)));
  } catch {
    return safeSeries(null);
  }
}

export async function call(path, body = {}) {
  const res = await fetch(`${API}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'אין חיבור לשרת');
  const s = safeSeries(data);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    // מצב פרטי – בלי עותק במכשיר
  }
  return s;
}

// כניסה ויציאה. כל פונקציה מחזירה תשובה, או null אם הכתובת לא שלה
import { json, readBody } from '../lib/http.js';
import { isReady, login, logout, requireSession } from '../lib/auth.js';

// כתובות שלא צריכות כניסה
export async function publicRoutes({ method, path, request, storage }) {
  // האם כבר נקבעה סיסמה (כדי שהמסך ידע לבקש "קביעת סיסמה" או "כניסה")
  if (method === 'GET' && path === '/status') return json({ ready: await isReady(storage) });
  if (method === 'POST' && path === '/login') {
    const { password } = await readBody(request);
    return json({ token: await login(storage, password) });
  }
  return null;
}

export async function authRoutes({ method, path, request, storage }) {
  if (method === 'POST' && path === '/logout') {
    await requireSession(storage, request.headers);
    await logout(storage, request.headers);
    return json({ ok: true });
  }
  return null;
}

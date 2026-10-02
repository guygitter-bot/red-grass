// השרת המשותף שמחזיק את מפתח ה-API. הכתובת שלו נכתבת אוטומטית ל-public/proxy.json
// כשהשרת עולה (.github/workflows/points-proxy.yml).

export async function loadProxyUrl() {
  if (import.meta.env.VITE_PROXY_URL) return import.meta.env.VITE_PROXY_URL;
  try {
    const res = await fetch('proxy.json', { cache: 'no-store' });
    if (!res.ok) return '';
    const { url } = await res.json();
    return typeof url === 'string' ? url.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

// הרשאה מול השרת: בעל האפליקציה עם קוד גישה, או מכשיר שהוזמן עם מפתח מכשיר משלו.
export const proxyConnected = (s) => Boolean(s.proxyUrl && (s.accessCode || s.deviceKey));
export const isOwner = (s) => Boolean(s.proxyUrl && s.accessCode);

export function authHeaders(s) {
  if (s.accessCode) return { 'x-access-code': s.accessCode };
  if (s.deviceKey) return { 'x-device-key': s.deviceKey };
  return {};
}

async function request(s, method, path, body) {
  const res = await fetch(`${s.proxyUrl}${path}`, {
    method,
    headers: { ...authHeaders(s), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || data?.error || `שגיאה מהשרת (${res.status})`), { status: res.status });
  return data;
}

// קישור הזמנה חד-פעמי: ...#invite=XXXX. נלקח מהכתובת ונמחק ממנה מיד.
export function takeInviteToken() {
  const match = window.location.hash.match(/[#&]invite=([^&]+)/);
  if (!match) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return decodeURIComponent(match[1]);
}

export async function redeemInvite(proxyUrl, token) {
  const res = await fetch(`${proxyUrl}/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (res.status === 410) throw new Error('הקישור כבר נוצל או שפג תוקפו. בקש/י קישור חדש.');
  if (!res.ok) throw new Error(`לא הצלחתי להתחבר (${res.status}). נסה/י שוב.`);
  return res.json(); // { deviceKey, name }
}

export const createInvite = (s, name) => request(s, 'POST', '/invites', { name });
export const listDevices = async (s) => (await request(s, 'GET', '/devices')).devices || [];
export const removeDevice = (s, id) => request(s, 'DELETE', `/devices?id=${encodeURIComponent(id)}`);

export const inviteLink = (token) =>
  `${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(token)}`;

// מקבל קישור הזמנה מלא או רק את הטוקן (למשל מהדבקה בהגדרות).
export function parseInviteToken(text) {
  const s = String(text || '').trim();
  const fromLink = s.match(/invite=([A-Za-z0-9_-]{16,100})/);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9_-]{16,100}$/.test(s) ? s : null;
}

// באייפון, אפליקציה שנוספה למסך הבית שומרת נתונים בנפרד מ-Safari. לכן שם לא משתמשים בקישור
// בדפדפן, אלא מסבירים להתקין קודם ולהדביק את הקישור בתוך האפליקציה.
export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.navigator.standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);

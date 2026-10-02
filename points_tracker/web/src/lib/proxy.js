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

// קישור הזמנה: ...#code=XXXX. הקוד נשמר במכשיר ונמחק מהכתובת.
export function takeInviteCode() {
  const match = window.location.hash.match(/[#&]code=([^&]+)/);
  if (!match) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return decodeURIComponent(match[1]);
}

export const inviteLink = (code) =>
  `${window.location.origin}${window.location.pathname}#code=${encodeURIComponent(code)}`;

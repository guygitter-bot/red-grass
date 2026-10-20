// השרת של mat-kon. הכתובת נקבעת בזמן הבנייה (.github/workflows/mat-kon.yml)
export const API_URL = (import.meta.env.VITE_API_URL || 'https://mat-kon-api.guygitter.workers.dev').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(session, method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(session ? { authorization: `Bearer ${session}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new ApiError('אין חיבור לשרת', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `שגיאה (${res.status})`, res.status);
  return data;
}

// 30 הימים האחרונים, גם ימים בלי הרשמות (0)
export function lastDays(byDay, days = 30, today = new Date()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    out.push({ day: d, count: byDay?.[d] || 0 });
  }
  return out;
}

export const SOURCES = { app: 'מהאפליקציה בחנות', invite: 'מהזמנה שלך', family: 'הצטרפו לספר משותף', other: 'אחר' };
export const ISSUE_STATUS = { new: 'חדשה', working: 'בטיפול', fixed: 'תוקנה' };
export const SECURITY = { loginFail: 'כניסות שנכשלו', ownerFail: 'ניסיונות סיסמת בעלים שגויה', ownerLogin: 'כניסות בעלים', rateLimited: 'חסימות (יותר מדי ניסיונות)', signup: 'הרשמות' };

export function ago(iso, now = Date.now()) {
  if (!iso) return '—';
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  return `לפני ${Math.round(h / 24)} ימים`;
}

export const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;

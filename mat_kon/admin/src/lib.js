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

// צילום מסך לשליחה ל-Claude: מוקטן בדפדפן (עד 1600 פיקסלים, JPEG), כדי שיהיה קטן אבל קריא
export async function shrinkImage(file, maxSide = 1600) {
  // קריאה כ-data URL (מדיניות האבטחה של האפליקציה לא מתירה blob: לתמונות)
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('לא הצלחתי לקרוא את התמונה'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('לא הצלחתי לפתוח את התמונה'));
    el.src = url;
  });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.85, 0.7, 0.55]) {
    const out = canvas.toDataURL('image/jpeg', q);
    if (out.length < 1_900_000) return out;
  }
  throw new Error('התמונה גדולה מדי');
}

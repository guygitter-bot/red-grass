// כלים משותפים לפנייה ל-Google (Gemini API): כתובת, הודעות שגיאה בעברית, ורשימת המודלים.
export const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function fail(message, detail) {
  const e = new Error(message);
  e.detail = detail || '';
  return e;
}

// שגיאות מ-Google בעברית. what = "הפריימים" / "הווידאו"
export function googleMessage(status, text, what) {
  const t = String(text || '').toLowerCase();
  if (status === 400 && /api key|api_key/.test(t)) return 'מפתח Google לא תקין. צריך לעדכן את GEMINI_API_KEY בסודות של GitHub.';
  if (status === 402 || /credits are depleted|prepay/.test(t)) return 'נגמר הקרדיט בחשבון Google. צריך לטעון קרדיט ב-AI Studio (ai.studio/projects ← Billing) ואז לנסות שוב.';
  if (status === 401 || status === 403) return `מפתח Google לא תקין או שאין לו הרשאה ליצירת ${what}.`;
  if (status === 429 && /billing|free.?tier|quota/.test(t)) return `יצירת ${what} דורשת חשבון Google עם חיוב פעיל, או שנגמרה המכסה (aistudio.google.com ← Billing).`;
  if (status === 429 || status >= 500) return 'יש עומס אצל Google כרגע. נסו שוב בעוד דקה.';
  return `לא הצלחנו ליצור את ${what}. נסו שוב.`;
}

// ההודעה של Google עצמה (באנגלית), קצרה – מוצגת למשתמש באותיות קטנות כדי שאפשר יהיה לאבחן תקלה
export function googleDetail(status, model, raw) {
  let msg = '';
  try { msg = JSON.parse(raw)?.error?.message || ''; } catch { msg = ''; }
  return `${status} ${model}: ${String(msg || raw || '').replace(/\s+/g, ' ').slice(0, 300)}`;
}

// האם השגיאה אומרת שהמודל עצמו לא קיים / לא תומך (ואז מנסים מודל אחר)
export const modelMissing = (status, raw) => status === 404 || (status === 400 && /model .*(not found|not supported)|is not found|unknown model|modalit/i.test(raw));

export async function listModels(env) {
  // הרשימה מגיעה בעמודים
  const all = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const res = await fetch(`${BASE}/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
    if (!res.ok) break;
    const data = await res.json().catch(() => null);
    all.push(...(data?.models || []));
    pageToken = data?.nextPageToken || '';
    if (!pageToken) break;
  }
  return all;
}

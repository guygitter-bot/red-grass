// פנייה לשרת (sefer/api). בלי סיסמה
export const API = (import.meta.env?.VITE_API_URL || 'https://sefer-ishi-api.guygitter.workers.dev').replace(/\/$/, '');

async function call(path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, body === undefined ? {} : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('אין חיבור לאינטרנט');
  }
  const data = await res.json().catch(() => ({}));
  // פעולת AI ארוכה מחזירה 200 גם בשגיאה, עם error בגוף
  if (!res.ok || data.error) {
    // detail = מה שענה השירות החיצוני (באנגלית), מוצג בקטן כדי שאפשר יהיה לאבחן
    const err = new Error(data.error || 'תקלה בשרת');
    err.detail = data.detail || '';
    err.status = res.status;
    throw err;
  }
  return data;
}

// מתווה הספר: שם, הקדשה, פרקים, תיאור הכריכה
export const getOutline = (brief) => call('/outline', { brief });
// פרק אחד: { text, scene }
export const getChapter = (brief, outline, index, before, note) => call('/chapter', { brief, outline, index, before, note });
// איור (כריכה או פרק): { media_type, data }
export const getArt = (args) => call('/image', args).then((d) => d.image);
// שיתוף בקישור / עדכון / ביטול
export const shareBook = (payload) => call('/share', payload);
export const unshareBook = (id, secret) => call('/unshare', { id, secret });
// ספר ששותף (למי שקיבל קישור)
export const readShared = (id) => call(`/book/${encodeURIComponent(id)}`);
export const sharedImageUrl = (id, key) => `${API}/book/${encodeURIComponent(id)}/img/${encodeURIComponent(key)}`;

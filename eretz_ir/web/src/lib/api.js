// פנייה לשרת (eretz_ir/api)
const API = (import.meta.env.VITE_API_URL || 'https://eretz-ir-api.guygitter.workers.dev').replace(/\/$/, '');

export async function api(path, body = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('אין חיבור לאינטרנט'), { offline: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'תקלה בשרת'), { status: res.status, data });
  return data;
}

// פנייה לשרת Kidzfinder. הכתובת נקבעת בבנייה (VITE_API_URL), אחרת ברירת המחדל.
const BASE = import.meta.env?.VITE_API_URL || 'https://kidzfinder-api.guygitter.workers.dev';

async function call(path, { method = 'POST', body, token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'network');
  return data;
}

export const api = {
  createFamily: (name, parentName) => call('/api/family/create', { body: { name, parentName } }),
  pairCode: (id, token) => call(`/api/family/${id}/pair-code`, { token }),
  state: (id, token) => call(`/api/family/${id}/state`, { method: 'GET', token }),
  addPlace: (id, token, place) => call(`/api/family/${id}/places`, { token, body: place }),
  delPlace: (id, token, placeId) => call(`/api/family/${id}/places/delete`, { token, body: { id: placeId } }),
  command: (id, token, childId, action) => call(`/api/family/${id}/command`, { token, body: { childId, action } }),
};

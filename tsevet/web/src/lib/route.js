// ניווט לפי # בכתובת (בלי ספריית ניווט): #/ · #/chats · #/c/<id> · #/costs · #/settings
export function parseRoute(hash) {
  const h = String(hash || '').replace(/^#/, '') || '/';
  const m = h.match(/^\/c\/(.+)$/);
  if (m) return { name: 'chat', id: decodeURIComponent(m[1]) };
  if (h === '/chats') return { name: 'chats' };
  if (h === '/costs') return { name: 'costs' };
  if (h === '/settings') return { name: 'settings' };
  return { name: 'team' };
}

export function go(path) {
  location.hash = path;
}

// שיחה חדשה יכולה לבוא עם יעד מוגדר מראש (מפתח בוט) – נשמר בזיכרון עד שהצ'אט נפתח
const presets = new Map();
export function setPreset(id, to) {
  presets.set(id, to);
}
export function getPreset(id) {
  return presets.get(id) ?? null;
}

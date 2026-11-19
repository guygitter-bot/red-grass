// שמירה במכשיר (localStorage). כל קריאה וכתיבה בתוך try/catch – במצב פרטי או כשחסום פשוט לא נשמר
import { safeKit } from './kit';

const K = { kits: 'mf_kits', active: 'mf_active', songs: 'mf_songs', vol: 'mf_vol' };

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // לא נשמר – ממשיכים בלי
  }
}

export function loadKits() {
  const raw = read(K.kits);
  return Array.isArray(raw) ? raw.map(safeKit) : [];
}
export function saveKits(kits) {
  write(K.kits, kits);
}
export function loadActiveId() {
  const v = read(K.active);
  return typeof v === 'string' ? v : null;
}
export function saveActiveId(id) {
  write(K.active, id);
}

// שירים אחרונים: [{id, title}], עד 6
export function loadSongs() {
  const raw = read(K.songs);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s.id === 'string')
    .map((s) => ({ id: s.id, title: typeof s.title === 'string' ? s.title : '' }))
    .slice(0, 6);
}
export function saveSongs(songs) {
  write(K.songs, songs.slice(0, 6));
}
// מוסיף שיר לראש הרשימה (בלי כפילויות), שומר כותרת קיימת אם לא ניתנה חדשה
export function addSong(songs, id, title = '') {
  const old = songs.find((s) => s.id === id);
  const rest = songs.filter((s) => s.id !== id);
  return [{ id, title: title || old?.title || '' }, ...rest].slice(0, 6);
}

export function loadVolumes() {
  const v = read(K.vol) || {};
  const num = (x, d) => (typeof x === 'number' && x >= 0 && x <= 1 ? x : d);
  return { drums: num(v.drums, 0.8), song: num(v.song, 0.6) };
}
export function saveVolumes(vol) {
  write(K.vol, vol);
}

// היסט סנכרון לכל שיר (שניות), לפי מזהה היוטיוב – למצב "ללמוד את השיר"
const SYNC_KEY = 'mf_sync';
export function loadSyncOffset(id) {
  const all = read(SYNC_KEY);
  const v = all && typeof all === 'object' ? all[id] : null;
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 3600 ? v : 0;
}
export function saveSyncOffset(id, offset) {
  const all = read(SYNC_KEY);
  const next = all && typeof all === 'object' ? { ...all } : {};
  next[id] = Math.round(offset * 1000) / 1000;
  write(SYNC_KEY, next);
}

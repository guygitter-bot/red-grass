// הנתונים במכשיר + סנכרון עם השרת.
// כל הרשומות נשמרות במכשיר (localStorage), כך שהאפליקציה נפתחת ועובדת גם בלי אינטרנט.
// שינוי נכנס לרשימת "לשלוח" (dirty) ונשלח לשרת שנייה וחצי אחרי העריכה, בפתיחה, כשחוזרים לאפליקציה,
// כשהרשת חוזרת ופעם בדקה. מהשרת חוזר כל מה שהשתנה מאז הפעם הקודמת (rev). העריכה המאוחרת גוברת.
import { useSyncExternalStore } from 'react';
import { api, getToken, setToken } from './api';

const K_RECS = 'bb_recs';
const K_REV = 'bb_rev';
const K_DIRTY = 'bb_dirty';

const read = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // אין מקום / מצב פרטי – נשאר רק לשיחה הזאת
  }
};

let recs = new Map(read(K_RECS, []).map((r) => [r.id, r]));
let rev = read(K_REV, 0);
let dirty = new Set(read(K_DIRTY, []));
let state = { records: [...recs.values()], status: 'idle', authed: !!getToken() };
const listeners = new Set();

function emit(patch = {}) {
  state = { ...state, records: [...recs.values()], ...patch };
  listeners.forEach((l) => l());
}

function persist() {
  write(K_RECS, [...recs.values()]);
  write(K_REV, rev);
  write(K_DIRTY, [...dirty]);
}

export function newId(prefix = 'i') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

let timer = null;
function soon(ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(sync, ms);
}

// שמירה של רשומה אחת או כמה (חדשות או עריכה). deleted: true = מחיקה
export function save(...list) {
  const now = Date.now();
  for (const r of list.flat()) {
    const old = recs.get(r.id);
    const updatedAt = Math.max(now, (old?.updatedAt || 0) + 1);
    recs.set(r.id, { ...old, ...r, updatedAt });
    dirty.add(r.id);
  }
  persist();
  emit();
  soon();
}

export function remove(id) {
  const old = recs.get(id);
  if (old) save({ id, t: old.t, deleted: true });
}

let running = null;
export function sync() {
  if (!getToken()) return Promise.resolve();
  if (running) {
    // עוד סנכרון באמצע – ננסה שוב אחריו
    soon(500);
    return running;
  }
  running = (async () => {
    const sent = [...dirty].map((id) => recs.get(id)).filter(Boolean);
    emit({ status: 'syncing' });
    try {
      const res = await api('/sync', { since: rev, changes: sent });
      for (const s of sent) {
        // אם נערך שוב בזמן הסנכרון – נשאר לשליחה
        if (recs.get(s.id)?.updatedAt === s.updatedAt) dirty.delete(s.id);
      }
      for (const r of res.changes) {
        const mine = recs.get(r.id);
        if (mine && dirty.has(r.id) && mine.updatedAt > r.updatedAt) continue;
        const { rev: _rev, ...clean } = r;
        recs.set(r.id, clean);
        dirty.delete(r.id);
      }
      rev = res.rev;
      persist();
      emit({ status: dirty.size ? 'pending' : 'ok' });
    } catch (err) {
      if (err.status === 401) {
        setToken('');
        emit({ status: 'idle', authed: false });
      } else emit({ status: err.offline ? 'offline' : 'error' });
    } finally {
      running = null;
    }
  })();
  return running;
}

export async function login(path, password) {
  const { token } = await api(path, { password });
  setToken(token);
  // מכשיר חדש: מקבלים הכול מההתחלה (ומה שהיה כאן עולה ומתמזג)
  rev = 0;
  for (const id of recs.keys()) dirty.add(id);
  persist();
  emit({ authed: true });
  await sync();
}

export async function changePassword(password, newPassword) {
  const { token } = await api('/password', { password, newPassword });
  setToken(token);
}

// יציאה: מוחקת את הנתונים מהמכשיר הזה (בשרת הם נשארים)
export async function logout() {
  await api('/logout').catch(() => {});
  setToken('');
  recs = new Map();
  rev = 0;
  dirty = new Set();
  persist();
  emit({ authed: false, status: 'idle' });
}

let started = false;
function start() {
  if (started) return;
  started = true;
  sync();
  setInterval(() => {
    if (document.visibilityState === 'visible') sync();
  }, 60_000);
  window.addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync();
  });
}

function subscribe(l) {
  listeners.add(l);
  start();
  return () => listeners.delete(l);
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state);
}

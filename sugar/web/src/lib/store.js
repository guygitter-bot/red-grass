// הנתונים במכשיר + סנכרון עם השרת.
// כל הרשומות נשמרות במכשיר (localStorage), כך שהאפליקציה נפתחת ועובדת גם בלי אינטרנט.
// שינוי נכנס לרשימת "לשלוח" (dirty) ונשלח לשרת שנייה וחצי אחרי העריכה, בפתיחה, כשחוזרים לאפליקציה,
// כשהרשת חוזרת ופעם בדקה. מהשרת חוזר כל מה שהשתנה מאז הפעם הקודמת (rev). העריכה המאוחרת גוברת.
import { useSyncExternalStore } from 'react';
import { api } from './api';

const K_RECS = 'ys_recs';
const K_REV = 'ys_rev';
const K_DIRTY = 'ys_dirty';

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
let state = { records: [...recs.values()], status: 'idle' };
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
      emit({ status: err.offline ? 'offline' : 'error' });
    } finally {
      running = null;
    }
  })();
  return running;
}

// שאלה בשיחה עם ה-AI: השאלה והתשובה נשמרות כהודעות (ומסתנכרנות), כך שכל מי שמשתף רואה את אותה שיחה
export async function askAi(context, question, history, by) {
  save({ id: newId('c'), t: 'chat', role: 'user', text: question.slice(0, 4000), at: Date.now(), by });
  const { answer, left } = await api('/ai', { context, question, history: history.slice(-12).map(({ role, text }) => ({ role, text })) });
  save({ id: newId('c'), t: 'chat', role: 'assistant', text: answer.slice(0, 10000), at: Date.now(), asked: by });
  return { answer, left };
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

// סנכרון בין מכשירים דרך השרת (seder/api). האפליקציה עובדת קודם כול מהמכשיר;
// כשיש רשת היא שולחת מה שהשתנה ומקבלת מה שהשתנה במכשירים האחרים.
// כל רשומה נושאת updatedAt – בעריכה של אותה משימה בשני מכשירים, העריכה המאוחרת גוברת.
import { emptySync } from './store';

export const API_URL = (import.meta.env.VITE_API_URL || 'https://seder-api.guygitter.workers.dev').replace(/\/+$/, '');
const TOKEN_KEY = 'seder_token';
export const MAX_CHANGES = 2000;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // אחסון חסום
  }
}

export class AuthError extends Error {}

async function post(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path === '/sync') throw new AuthError(data.error || 'צריך להתחבר מחדש');
  if (!res.ok) throw new Error(data.error || `שגיאה ${res.status}`);
  return data;
}

export async function login(password) {
  const { token } = await post('/login', { password });
  setToken(token);
  return token;
}

export function logout() {
  setToken(null);
}

const keyOf = (kind, id) => `${kind}:${id}`;

function localRecords(state) {
  const map = new Map();
  for (const t of state.tasks) map.set(keyOf('task', t.id), { kind: 'task', id: t.id, data: t, updatedAt: t.updatedAt || 0 });
  for (const c of state.categories) map.set(keyOf('category', c.id), { kind: 'category', id: c.id, data: c, updatedAt: c.updatedAt || 0 });
  return map;
}

// מה צריך לשלוח: רשומות שהשתנו מאז הסנכרון האחרון, ומחיקות (היו בשרת ואינן במכשיר)
export function collectChanges(state, now = Date.now()) {
  const { known } = state.sync;
  const local = localRecords(state);
  const changes = [];
  for (const [key, rec] of local) if (known[key] !== rec.updatedAt) changes.push(rec);
  for (const key of Object.keys(known)) {
    if (local.has(key)) continue;
    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    changes.push({ kind, id, updatedAt: Math.max(now, known[key] + 1), deleted: true });
  }
  return changes.slice(0, MAX_CHANGES);
}

// אחרי תשובת השרת: מסמנים מה נשלח, ומכניסים את השינויים מהמכשירים האחרים
export function applyRemote(state, pushed, response) {
  const known = { ...state.sync.known };
  for (const p of pushed) {
    if (p.deleted) delete known[keyOf(p.kind, p.id)];
    else known[keyOf(p.kind, p.id)] = p.updatedAt;
  }
  const tasks = new Map(state.tasks.map((t) => [t.id, t]));
  const categories = new Map(state.categories.map((c) => [c.id, c]));
  for (const r of response.records || []) {
    const target = r.kind === 'task' ? tasks : r.kind === 'category' ? categories : null;
    if (!target) continue;
    const key = keyOf(r.kind, r.id);
    const local = target.get(r.id);
    // נערך במכשיר הזה אחרי מה שבשרת – נשאר, וישלח בסנכרון הבא
    if (local && (local.updatedAt || 0) > r.updatedAt) continue;
    if (r.deleted) {
      target.delete(r.id);
      delete known[key];
    } else {
      target.set(r.id, r.data);
      known[key] = r.updatedAt;
    }
  }
  return {
    ...state,
    tasks: [...tasks.values()],
    categories: [...categories.values()],
    sync: { cursor: response.cursor ?? state.sync.cursor, known },
  };
}

// סבב סנכרון מלא (כולל עמודים נוספים). getState מחזיר את המצב העדכני, apply מעדכן אותו
export async function runSync(getState, apply) {
  const token = getToken();
  if (!token) return false;
  let working = getState();
  for (let round = 0; round < 50; round += 1) {
    const changes = collectChanges(working);
    const res = await post('/sync', { since: working.sync.cursor, changes }, token);
    working = applyRemote(working, changes, res);
    apply((s) => applyRemote(s, changes, res));
    if (!res.more && changes.length < MAX_CHANGES) break;
  }
  return true;
}

export function resetSync(state) {
  return { ...state, sync: emptySync() };
}

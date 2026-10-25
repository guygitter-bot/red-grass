// שליחת תוצאות הסיבובים לשרת. אם אין רשת – נשמר בתור ונשלח בפעם הבאה
import { API_URL } from './config.js';

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* מצב פרטי */ }
}

// מזהה קבוע לטלפון הזה (בלי פרטים אישיים)
export function kidId() {
  let id = load('ew-kid', '');
  if (!/^[a-z0-9]{8,32}$/.test(id)) {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    id = [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
    save('ew-kid', id);
  }
  return id;
}

export function kidName() {
  return load('ew-name', '');
}

export function setKidName(name) {
  save('ew-name', String(name || '').trim().slice(0, 30));
  flush();
}

export function report(round) {
  const outbox = load('ew-outbox', []);
  outbox.push(round);
  save('ew-outbox', outbox.slice(-50));
  flush();
}

let sending = false;
export async function flush() {
  if (sending) return;
  const rounds = load('ew-outbox', []);
  if (!kidName() && !rounds.length) return;
  sending = true;
  try {
    const res = await fetch(`${API_URL}/round`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kid: { id: kidId(), name: kidName() }, rounds }),
    });
    if (res.ok) {
      // מוחקים רק את מה שנשלח (אולי נוסף סיבוב בינתיים)
      save('ew-outbox', load('ew-outbox', []).slice(rounds.length));
    }
  } catch { /* אין רשת – ננסה בפעם הבאה */ }
  sending = false;
}

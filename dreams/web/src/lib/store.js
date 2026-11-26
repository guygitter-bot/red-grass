// כל הנתונים נשמרים רק במכשיר (localStorage). אין שרת – החלומות פרטיים.
import { KINDS } from './kinds';
import { nightKey } from './night';
import { HD_TYPES, HD_AUTHORITIES, LENSES } from './lenses';

const KEY = 'zc_data';
const KIND_IDS = KINDS.map((k) => k.id);
const LENS_IDS = LENSES.map((l) => l.id);
const RELATED = ['yes', 'partly', 'no'];
export const MOODS = ['😊', '😌', '😐', '😟', '😱'];

const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const isKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function safeHd(h) {
  const o = h && typeof h === 'object' ? h : {};
  return {
    type: HD_TYPES.some((t) => t.id === o.type) ? o.type : null,
    authority: HD_AUTHORITIES.some((a) => a.id === o.authority) ? o.authority : null,
  };
}

// תשובות לשאלות העדשות: { [מזהה עדשה]: [מחרוזות] }. עדשה לא מוכרת או מידע שבור – נזרקים.
function safeLensNotes(n) {
  const out = {};
  if (!n || typeof n !== 'object' || Array.isArray(n)) return out;
  for (const id of LENS_IDS) {
    if (!Array.isArray(n[id])) continue;
    out[id] = n[id].slice(0, 12).map((x) => str(x, 3000));
    if (!out[id].some((x) => x.trim())) delete out[id];
  }
  return out;
}

export function safeSettings(s) {
  const o = s && typeof s === 'object' ? s : {};
  return {
    voice: o.voice !== false, // הקראה בקול במסכי הלילה
    chime: o.chime !== false, // צלצול עדין
    napCycles: [2, 3, 4, 5].includes(o.napCycles) ? o.napCycles : 3,
    seenIntro: o.seenIntro === true,
    // Human Design: סוג ותוקף (לא חובה; null = לא יודע/ת)
    hd: safeHd(o.hd),
  };
}

export function safeIntention(i) {
  if (!i || typeof i !== 'object') return null;
  const kind = KIND_IDS.includes(i.kind) ? i.kind : 'problem';
  return {
    kind,
    text: str(i.text, 500),
    phrase: str(i.phrase, 300),
    image: str(i.image, 500), // תמונה אחת שמייצגת את השאלה
    ritual: i.ritual === true, // האם עבר את טקס השינה
    at: typeof i.at === 'number' ? i.at : 0,
  };
}

export function safeEntry(e) {
  const o = e && typeof e === 'object' ? e : {};
  const at = typeof o.at === 'number' ? o.at : Date.now();
  return {
    id: str(o.id, 40) || newId(),
    night: isKey(o.night) ? o.night : nightKey(at),
    at,
    type: ['dream', 'nap', 'none'].includes(o.type) ? o.type : 'dream',
    title: str(o.title, 120),
    text: str(o.text, 20000),
    related: RELATED.includes(o.related) ? o.related : null,
    answer: str(o.answer, 5000), // "אם החלום היה תשובה – מה הוא אומר?"
    mood: Number.isInteger(o.mood) && o.mood >= 0 && o.mood < MOODS.length ? o.mood : null,
    clarity: Number.isInteger(o.clarity) && o.clarity >= 1 && o.clarity <= 5 ? o.clarity : null,
    lucid: o.lucid === true,
    tags: Array.isArray(o.tags) ? [...new Set(o.tags.map((t) => str(t, 40).trim()).filter(Boolean))].slice(0, 20) : [],
    // רישומי תנומת אדיסון: מה עלה בכל סבב
    lensNotes: safeLensNotes(o.lensNotes), // תשובות לשאלות מכל עדשה
    glimpses: Array.isArray(o.glimpses) ? o.glimpses.map((g) => str(g, 2000)).filter(Boolean).slice(0, 10) : [],
  };
}

export function safeData(d) {
  const o = d && typeof d === 'object' ? d : {};
  const nights = {};
  if (o.nights && typeof o.nights === 'object') {
    for (const [k, v] of Object.entries(o.nights)) {
      const i = isKey(k) ? safeIntention(v) : null;
      if (i) nights[k] = i;
    }
  }
  const entries = Array.isArray(o.entries) ? o.entries.map(safeEntry) : [];
  entries.sort((a, b) => b.at - a.at);
  return { v: 1, nights, entries, settings: safeSettings(o.settings) };
}

export function loadData() {
  try {
    return safeData(JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return safeData(null);
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// גיבוי לקובץ
export function exportText(data) {
  return JSON.stringify({ app: 'zimun-chalomot', exported: new Date().toISOString(), ...data }, null, 2);
}

// שחזור מגיבוי: מאחד עם מה שכבר יש (לא מוחק כלום). רשומה עם אותו מזהה – הגרסה מהקובץ.
export function mergeImport(current, text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('הקובץ לא נקרא. צריך לבחור קובץ גיבוי של האפליקציה (.json).');
  }
  if (!parsed || parsed.app !== 'zimun-chalomot') throw new Error('זה לא קובץ גיבוי של זימון חלומות.');
  const incoming = safeData(parsed);
  const byId = new Map(current.entries.map((e) => [e.id, e]));
  for (const e of incoming.entries) byId.set(e.id, e);
  return safeData({
    nights: { ...current.nights, ...incoming.nights },
    entries: [...byId.values()],
    settings: current.settings,
  });
}

// מבנה הנתונים ושמירה במכשיר (localStorage). הכול פונקציות טהורות – קל לבדוק ולהחליף בעתיד בשרת.
import { addDays, dueDate, fromKey, todayKey } from './dates';

const KEY = 'seder_v1';

export const PRIORITIES = {
  3: { label: 'חשוב מאוד', short: 'גבוהה', dot: 'bg-rose-500', text: 'text-rose-600', ring: 'border-rose-300 bg-rose-50' },
  2: { label: 'חשיבות בינונית', short: 'בינונית', dot: 'bg-amber-400', text: 'text-amber-600', ring: 'border-amber-300 bg-amber-50' },
  1: { label: 'חשיבות נמוכה', short: 'נמוכה', dot: 'bg-sky-400', text: 'text-sky-600', ring: 'border-sky-300 bg-sky-50' },
};

export const TYPES = {
  task: { label: 'משימה', emoji: '✅' },
  event: { label: 'אירוע', emoji: '📅' },
  followup: { label: 'מעקב / מחכה לתשובה', emoji: '⏳' },
  later: { label: 'לבדוק בהמשך', emoji: '💡' },
};

export const COLORS = ['rose', 'orange', 'amber', 'lime', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'fuchsia'];

export const DEFAULT_CATEGORIES = [
  { id: 'care', name: 'טיפוח אישי', emoji: '💅', color: 'fuchsia' },
  { id: 'home', name: 'סידור בית', emoji: '🧹', color: 'teal' },
  { id: 'work', name: 'עבודה', emoji: '💼', color: 'indigo' },
  { id: 'errands', name: 'סידורים', emoji: '🛒', color: 'amber' },
  { id: 'kids', name: 'ילדים', emoji: '🧸', color: 'sky' },
  { id: 'guy', name: 'גיא', emoji: '❤️', color: 'rose' },
];

export const REMIND_OPTIONS = [
  { value: null, label: 'בלי תזכורת' },
  { value: 0, label: 'בזמן האירוע' },
  { value: 10, label: '10 דקות לפני' },
  { value: 30, label: 'חצי שעה לפני' },
  { value: 60, label: 'שעה לפני' },
  { value: 180, label: '3 שעות לפני' },
  { value: 1440, label: 'יום לפני' },
];

export function newId() {
  return (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 16);
}

// sync: מה כבר מסונכרן עם השרת (cursor = עד איזה שינוי קיבלנו, known = גרסת כל רשומה בשרת)
export function emptySync() {
  return { cursor: 0, known: {} };
}

// הגדרות אישיות (כרגע: השם לברכה בלוח). מסתנכרנות בין המכשירים כרשומה אחת מסוג setting
export function emptyProfile() {
  return { id: 'profile', name: '', updatedAt: 0 };
}

export function normalizeProfile(p) {
  if (!p || typeof p !== 'object') return emptyProfile();
  return {
    id: 'profile',
    name: typeof p.name === 'string' ? p.name.slice(0, 40) : '',
    updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : 0,
  };
}

export function emptyState() {
  return { categories: DEFAULT_CATEGORIES, tasks: [], notified: {}, profile: emptyProfile(), sync: emptySync() };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    return normalize(data);
  } catch {
    return emptyState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // אחסון מלא או חסום – הנתונים נשארים בזיכרון עד הסגירה
  }
}

export function normalize(data) {
  return {
    categories: Array.isArray(data?.categories) && data.categories.length ? data.categories : DEFAULT_CATEGORIES,
    tasks: Array.isArray(data?.tasks) ? data.tasks.filter((t) => t && t.id && typeof t.title === 'string') : [],
    notified: data?.notified && typeof data.notified === 'object' ? data.notified : {},
    profile: normalizeProfile(data?.profile),
    sync: data?.sync && Number.isInteger(data.sync.cursor) && data.sync.known && typeof data.sync.known === 'object' ? data.sync : emptySync(),
  };
}

export function makeTask(fields) {
  const now = Date.now();
  return {
    id: newId(),
    title: '',
    notes: '',
    type: 'task',
    categoryId: null,
    parentId: null,
    due: null,
    time: null,
    priority: 2,
    remind: null,
    links: [],
    done: false,
    doneAt: null,
    createdAt: now,
    ...fields,
    updatedAt: now,
  };
}

// ---- פעולות (מחזירות state חדש) ----

export function addTask(state, fields) {
  const task = makeTask(fields);
  return { ...state, tasks: [...state.tasks, task] };
}

export function updateTask(state, id, patch) {
  const notified = { ...state.notified };
  // שינוי מועד או תזכורת -> תזכורת חדשה תצא שוב
  if ('due' in patch || 'time' in patch || 'remind' in patch || 'remindTime' in patch) delete notified[id];
  return { ...state, notified, tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)) };
}

// השם שמופיע בברכה בלוח ("בוקר טוב, נועה"). ריק = בלי שם
export function setName(state, name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (clean === (state.profile?.name || '')) return state;
  return { ...state, profile: { id: 'profile', name: clean, updatedAt: Date.now() } };
}

export function toggleDone(state, id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  const done = !task.done;
  return updateTask(state, id, { done, doneAt: done ? Date.now() : null });
}

export function removeTask(state, id) {
  const ids = new Set([id]);
  // מחיקה כוללת את כל תתי המשימות (בכל עומק)
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of state.tasks) {
      if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return { ...state, tasks: state.tasks.filter((t) => !ids.has(t.id)) };
}

export function upsertCategory(state, fields) {
  const cat = { ...fields, updatedAt: Date.now() };
  const exists = state.categories.some((c) => c.id === cat.id);
  return {
    ...state,
    categories: exists ? state.categories.map((c) => (c.id === cat.id ? cat : c)) : [...state.categories, { ...cat, id: cat.id || newId() }],
  };
}

export function removeCategory(state, id) {
  return {
    ...state,
    categories: state.categories.filter((c) => c.id !== id),
    tasks: state.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null, updatedAt: Date.now() } : t)),
  };
}

// ---- שאילתות ----

export function subtasksOf(tasks, id) {
  return tasks.filter((t) => t.parentId === id);
}

export function progress(tasks, id) {
  const subs = subtasksOf(tasks, id);
  return { done: subs.filter((s) => s.done).length, total: subs.length };
}

// סדר: לא בוצע קודם, אחר כך לפי שעה, חשיבות ותאריך יצירה
export function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if ((a.due || '9999') !== (b.due || '9999')) return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
    if ((a.time || '99') !== (b.time || '99')) return (a.time || '99') < (b.time || '99') ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.createdAt - b.createdAt;
  });
}

export function isOverdue(task, now = new Date()) {
  return !task.done && task.due && task.due < todayKey(now);
}

export function topLevel(tasks) {
  return tasks.filter((t) => !t.parentId);
}

export function forDay(tasks, key) {
  return tasks.filter((t) => t.due === key);
}

export function dashboard(state, now = new Date()) {
  const today = todayKey(now);
  const weekEnd = addDays(today, 7);
  const open = state.tasks.filter((t) => !t.done);
  const todays = state.tasks.filter((t) => t.due === today);
  const doneThisWeek = state.tasks.filter((t) => t.done && t.doneAt && now - t.doneAt < 7 * 86400000).length;
  return {
    today: todays.filter((t) => !t.done).length,
    todayDone: todays.filter((t) => t.done).length,
    todayTotal: todays.length,
    overdue: sortTasks(open.filter((t) => t.due && t.due < today)),
    upcoming: sortTasks(open.filter((t) => t.due && t.due > today && t.due <= weekEnd && (t.type === 'event' || t.time || t.priority === 3))).slice(0, 6),
    important: sortTasks(open.filter((t) => t.priority === 3 && !t.parentId)).slice(0, 6),
    waiting: sortTasks(open.filter((t) => t.type === 'followup')),
    later: open.filter((t) => t.type === 'later').length,
    noDate: open.filter((t) => !t.due && !t.parentId && t.type !== 'later').length,
    doneThisWeek,
    byCategory: state.categories.map((c) => {
      const mine = state.tasks.filter((t) => t.categoryId === c.id && t.type !== 'later' && !t.parentId);
      return { ...c, open: mine.filter((t) => !t.done).length, done: mine.filter((t) => t.done).length };
    }),
  };
}

// מתי התזכורת יוצאת:
//   remindTime ("HH:MM") – בשעה שנבחרה, ביום של המשימה
//   בלי שעה למשימה – 9:00 בבוקר של אותו יום
//   עם שעה – remind דקות לפני
export function reminderAt(task) {
  if (task.remind == null || !task.due) return null;
  if (task.remindTime) {
    const [h, m] = task.remindTime.split(':').map(Number);
    const at = fromKey(task.due);
    at.setHours(h, m, 0, 0);
    return at;
  }
  const at = dueDate(task);
  if (!task.time) at.setHours(9, 0, 0, 0);
  else at.setMinutes(at.getMinutes() - task.remind);
  return at;
}

// תזכורות שהגיע זמנן ועוד לא הוצגו
export function dueReminders(state, now = new Date()) {
  return state.tasks.filter((t) => {
    if (t.done || state.notified[t.id]) return false;
    const at = reminderAt(t);
    // לא מתריעים על דברים שעברו מזמן (למשל אחרי שבוע שהאפליקציה לא נפתחה)
    return at && at <= now && now - at < 12 * 3600000;
  });
}

export function search(tasks, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return tasks.filter((t) => `${t.title} ${t.notes} ${(t.links || []).map((l) => l.url).join(' ')}`.toLowerCase().includes(q));
}

// שמירה מהעורך: המשימה ותתי המשימות שלה בבת אחת (חדשות נוספות, שנמחקו יוצאות, השאר מתעדכנות)
export function saveTree(state, task, subtasks) {
  let next = state.tasks.some((t) => t.id === task.id) ? updateTask(state, task.id, task) : { ...state, tasks: [...state.tasks, makeTask(task)] };
  const keep = new Set(subtasks.map((s) => s.id));
  for (const old of subtasksOf(next.tasks, task.id)) if (!keep.has(old.id)) next = removeTask(next, old.id);
  for (const sub of subtasks) {
    const fields = { ...sub, parentId: task.id, categoryId: sub.categoryId ?? task.categoryId };
    next = next.tasks.some((t) => t.id === sub.id) ? updateTask(next, sub.id, fields) : { ...next, tasks: [...next.tasks, makeTask(fields)] };
  }
  return next;
}

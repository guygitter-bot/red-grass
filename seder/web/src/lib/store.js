// מבנה הנתונים ושמירה במכשיר (localStorage). הכול פונקציות טהורות – קל לבדוק ולהחליף בעתיד בשרת.
import { DAY_NAMES, addDays, addMonths, dueDate, fromKey, todayKey } from './dates';

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

// משימה / תזכורת חוזרת (repeat במשימה). משימות ישנות בלי השדה = לא חוזרות
export const REPEATS = {
  daily: { label: 'כל יום' },
  weekly: { label: 'כל שבוע' },
  monthly: { label: 'כל חודש' },
};

// סוג התחום (kind): רגיל – משימות; 'list' – רשימה פשוטה לסימון (מה לארוז, קניות, תווי קניה...).
// תחומים ישנים בלי השדה = משימות. הפריטים ברשימה הם משימות רגילות בתוך התחום, כך ששום דבר לא הולך לאיבוד
export const CATEGORY_KINDS = {
  tasks: { label: 'משימות', hint: 'עם תאריכים, תזכורות וחשיבות' },
  list: { label: 'רשימה', hint: 'פריטים לסימון – מה לארוז, קניות, תווי קניה' },
};

export function isList(category) {
  return category?.kind === 'list';
}

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
    categories: Array.isArray(data?.categories) && data.categories.length ? sortCategories(data.categories) : DEFAULT_CATEGORIES,
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
    contacts: [],
    attachments: [],
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
  // משימה שעוברת לתחום אחר מאבדת את הסדר הידני – היא תופיע למעלה בתחום החדש
  const moved = (t) => 'categoryId' in patch && patch.categoryId !== t.categoryId;
  return { ...state, notified, tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch, ...(moved(t) && { order: null }), updatedAt: Date.now() } : t)) };
}

// השם שמופיע בברכה בלוח ("בוקר טוב, נועה"). ריק = בלי שם
export function setName(state, name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (clean === (state.profile?.name || '')) return state;
  return { ...state, profile: { id: 'profile', name: clean, updatedAt: Date.now() } };
}

export function toggleDone(state, id, now = new Date()) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  // משימה חוזרת שבוצעה – לא נסגרת אלא עוברת לפעם הבאה (אחרי היום), ותתי המשימות מתאפסות
  if (!task.done && isRepeating(task)) {
    const next = nextOccurrence(task, todayKey(now));
    let s = updateTask(state, id, { due: next, lastDoneAt: now.getTime() });
    for (const sub of subtasksOf(s.tasks, id)) if (sub.done) s = updateTask(s, sub.id, { done: false, doneAt: null });
    return s;
  }
  const done = !task.done;
  return updateTask(state, id, { done, doneAt: done ? Date.now() : null });
}

// ---- משימות חוזרות ----

export function isRepeating(task) {
  return !!(task?.due && REPEATS[task.repeat]);
}

// הפעם ה-k אחרי due (0 = due עצמו). אותו כלל בשרת: seder/api/reminders.js → occurrenceKey
export function occurrenceKey(due, repeat, k) {
  if (repeat === 'monthly') return addMonths(due, k);
  return addDays(due, k * (repeat === 'weekly' ? 7 : 1));
}

// הפעם הבאה שאחרי היום (ואחרי due)
export function nextOccurrence(task, today = todayKey()) {
  let k = 1;
  while (occurrenceKey(task.due, task.repeat, k) <= today) k += 1;
  return occurrenceKey(task.due, task.repeat, k);
}

// "כל יום" / "כל שבוע ביום שלישי" / "כל חודש ב-15"
export function repeatLabel(task) {
  if (!isRepeating(task)) return '';
  const d = fromKey(task.due);
  if (task.repeat === 'weekly') return `כל שבוע ביום ${DAY_NAMES[d.getDay()]}`;
  if (task.repeat === 'monthly') return `כל חודש ב-${d.getDate()}`;
  return REPEATS.daily.label;
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
  // תחום חדש נכנס בסוף הרשימה
  const last = state.categories.reduce((max, c, i) => Math.max(max, Number.isFinite(c.order) ? c.order : i), -1);
  return {
    ...state,
    categories: exists ? state.categories.map((c) => (c.id === cat.id ? cat : c)) : [...state.categories, { ...cat, id: cat.id || newId(), order: last + 1 }],
  };
}

// ---- סדר התחומים ----
// לכל תחום order (מספר). תחומים ישנים בלי order נשארים לפי המקום שלהם ברשימה.
// הסדר נשמר בתוך כל תחום, כדי שיסתנכרן בין המכשירים כמו כל עריכה אחרת

export function sortCategories(categories) {
  return categories
    .map((c, i) => ({ c, key: Number.isFinite(c.order) ? c.order : i, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.c);
}

// הזזת פריט ברשימה ממקום from למקום to (המשיכה באצבע מכניסה אותו בין שני פריטים, לא מחליפה ביניהם)
export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// הזזת תחום: delta = כמה מקומות למעלה (מינוס) או למטה (פלוס). כל התחומים מקבלים מספור חדש 0,1,2...
export function moveCategory(state, id, delta) {
  const list = sortCategories(state.categories);
  const from = list.findIndex((c) => c.id === id);
  const next = moveItem(list, from, from + delta);
  if (next === list) return state;
  const now = Date.now();
  return { ...state, categories: next.map((c, i) => (c.order === i ? c : { ...c, order: i, updatedAt: now })) };
}

// מחיקת תחום: המשימות שבו נשארות בלי תחום, או (withTasks) נמחקות יחד איתו – כולל תתי המשימות
export function removeCategory(state, id, withTasks = false) {
  let next = state;
  if (withTasks) for (const t of state.tasks.filter((x) => x.categoryId === id && !x.parentId)) next = removeTask(next, t.id);
  return {
    ...next,
    categories: next.categories.filter((c) => c.id !== id),
    tasks: next.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null, updatedAt: Date.now() } : t)),
  };
}

// ---- רשימות (תחום מסוג list) ----

// "ניקוי מה שסומן": הפריטים שסומנו יוצאים מהרשימה
export function clearChecked(state, categoryId) {
  let next = state;
  for (const t of state.tasks.filter((x) => x.categoryId === categoryId && !x.parentId && x.done)) next = removeTask(next, t.id);
  return next;
}

// "הכול מחדש": מורידים את כל הסימונים – לרשימה שחוזרת על עצמה (מה לארוז לכל טיול)
export function uncheckAll(state, categoryId) {
  const now = Date.now();
  return { ...state, tasks: state.tasks.map((t) => (t.categoryId === categoryId && t.done ? { ...t, done: false, doneAt: null, updatedAt: now } : t)) };
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

// ---- סדר ידני של משימות בתוך תחום ----
// משימה שהוזזה באצבע מקבלת order. משימות בלי order (חדשות, או שעברו מתחום אחר) מופיעות למעלה
// לפי הסדר הרגיל, ואחריהן המשימות לפי הסדר שנקבע. משימות שבוצעו תמיד בסוף.
// כל עוד לא הזיזו כלום – הסדר בדיוק כמו קודם (sortTasks)
export function sortManual(list) {
  const ordered = (t) => !t.done && Number.isFinite(t.order);
  const rank = (t) => (t.done ? 2 : ordered(t) ? 1 : 0);
  return sortTasks(list)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || (ordered(a.t) && ordered(b.t) ? a.t.order - b.t.order : 0) || a.i - b.i)
    .map((x) => x.t);
}

// הזזת משימה בתוך הרשימה שעל המסך (ids לפי הסדר המוצג). כל הרשימה מקבלת מספור חדש 0,1,2...
export function moveTask(state, ids, from, to) {
  const next = moveItem(ids, from, to);
  if (next === ids) return state;
  const order = new Map(next.map((id, i) => [id, i]));
  const now = Date.now();
  return {
    ...state,
    tasks: state.tasks.map((t) => (order.has(t.id) && t.order !== order.get(t.id) ? { ...t, order: order.get(t.id), updatedAt: now } : t)),
  };
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
  const lists = new Set(state.categories.filter(isList).map((c) => c.id));
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
    // פריטים ברשימות (קניות, אריזה...) הם לא "משימות בלי תאריך"
    noDate: open.filter((t) => !t.due && !t.parentId && t.type !== 'later' && !lists.has(t.categoryId)).length,
    doneThisWeek,
    // כמה משימות לביצוע יש כרגע – פתוחות, בלי תתי משימות, אירועים, מעקבים, "לבדוק" ופריטים ברשימות
    openTotal: open.filter((t) => (t.type || 'task') === 'task' && !t.parentId && !lists.has(t.categoryId)).length,
  };
}

// מתי התזכורת יוצאת:
//   remindTime ("HH:MM") – בשעה שנבחרה, ביום של המשימה
//   בלי שעה למשימה – 9:00 בבוקר של אותו יום
//   עם שעה – remind דקות לפני
// (במשימה חוזרת – זו התזכורת של הפעם הנוכחית, due; הפעמים הבאות: currentReminderAt)
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

// במשימה חוזרת: התזכורת של הפעם האחרונה שכבר הגיעה (או של הפעם הראשונה, אם עוד לא הגיעה)
export function currentReminderAt(task, now = new Date()) {
  const first = reminderAt(task);
  if (!first || !isRepeating(task)) return first;
  const at = (k) => reminderAt({ ...task, due: occurrenceKey(task.due, task.repeat, k) });
  // קפיצה קרובה למקום (בלי לעבור על שנים של ימים אחד־אחד)
  const days = Math.floor((now - first) / 86400000);
  let k = Math.max(0, task.repeat === 'monthly' ? Math.floor(days / 31) - 1 : Math.floor(days / (task.repeat === 'weekly' ? 7 : 1)) - 1);
  while (k > 0 && at(k) > now) k -= 1;
  while (at(k + 1) <= now) k += 1;
  return at(k);
}

// תזכורות שהגיע זמנן ועוד לא הוצגו
export function dueReminders(state, now = new Date()) {
  return state.tasks.filter((t) => {
    const seen = state.notified[t.id];
    // משימה חוזרת: כל פעם חדשה מזכירה שוב (notified = מתי הוצגה הקודמת)
    if (t.done || (seen && !isRepeating(t))) return false;
    const at = currentReminderAt(t, now);
    if (seen && at && seen >= at.getTime()) return false;
    // לא מתריעים על דברים שעברו מזמן (למשל אחרי שבוע שהאפליקציה לא נפתחה)
    return at && at <= now && now - at < 12 * 3600000;
  });
}

export function search(tasks, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return tasks.filter((t) => `${t.title} ${t.notes} ${(t.links || []).map((l) => l.url).join(' ')} ${contactsOf(t).map((c) => `${c.name} ${c.phone}`).join(' ')} ${attachmentsOf(t).map((a) => a.name).join(' ')}`.toLowerCase().includes(q));
}

// ---- קבצים ותמונות ----
// בכל משימה: attachments = [{ id, name, type, size }]. הקובץ עצמו נשמר בשרת (seder/api/files.js),
// ובמשימה רק הפרטים – כך שהמשימות נשארות קטנות ומסתנכרנות מהר. משימות ישנות בלי השדה = בלי קבצים

export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function attachmentsOf(task) {
  return (Array.isArray(task?.attachments) ? task.attachments : []).filter((a) => a && typeof a.id === 'string' && a.id);
}

export function isImage(attachment) {
  return /^image\//.test(attachment?.type || '');
}

// "1.2MB" / "350KB"
export function fileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

// ---- אנשים / גורמים לבירור ----
// בכל משימה: contacts = [{ name, phone }]. משימות ישנות בלי השדה נחשבות כמשימות בלי אנשים

export function cleanContact(c) {
  return {
    name: String(c?.name || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    phone: String(c?.phone || '').replace(/[^\d+*#\-\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20),
  };
}

export function contactsOf(task) {
  return (Array.isArray(task?.contacts) ? task.contacts : []).map(cleanContact).filter((c) => c.name || c.phone);
}

// קישור לחיוג (בלי מספר סביר – אין כפתור חיוג)
export function telUrl(phone) {
  const dial = String(phone || '').replace(/[^\d+*#]/g, '');
  return dial.replace(/\D/g, '').length >= 3 ? `tel:${dial}` : null;
}

// כל האנשים שכבר נכתבו במשימות (להשלמה אוטומטית). שם שחוזר – פעם אחת, עם הטלפון האחרון שנכתב לו
export function knownContacts(tasks) {
  const byName = new Map();
  for (const t of [...tasks].sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))) {
    for (const c of contactsOf(t)) {
      if (!c.name) continue;
      const key = c.name.toLowerCase();
      byName.set(key, { name: c.name, phone: c.phone || byName.get(key)?.phone || '' });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

// "רופאת המשפחה · 03-1234567, ביטוח לאומי" – לשיתוף וליומן
export function contactsText(task) {
  return contactsOf(task).map((c) => [c.name, c.phone].filter(Boolean).join(' · ')).join(', ');
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

import { loadJson } from './storage';
// השרת של mat-kon (mat_kon/api). הכתובת נקבעת בזמן הבנייה (.github/workflows/mat-kon.yml).
// בלי session = בעל האפליקציה (פתוח). עם session = משתמש שהוזמן, עם ספר מתכונים משלו.
export const API_URL = (import.meta.env.VITE_API_URL || 'https://mat-kon-api.guygitter.workers.dev').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(session, method, path, body, { keepalive = false } = {}) {
  let res;
  const payload = body && JSON.stringify(body);
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      // keepalive: הבקשה ממשיכה גם כשהאפליקציה נסגרת (עד 64KB)
      keepalive: keepalive && payload && payload.length < 60000,
      headers: {
        ...(session ? { authorization: `Bearer ${session}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: payload,
    });
  } catch {
    throw new ApiError('אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `שגיאה מהשרת (${res.status})`, res.status, data);
  return data;
}

export const getMe = (s) => api(s, 'GET', '/me');
export const listRecipes = (s) => api(s, 'GET', '/recipes').then((d) => (d.recipes || []).map(safeRecipe));

// מתכון בצורה שהמסכים מצפים לה, גם אם משהו בשרת נשמר פגום
const strOr = (v, d = '') => (typeof v === 'string' ? v : d);
const sectionsOr = (v) => (Array.isArray(v) ? v : [])
  .filter((x) => x && Array.isArray(x.items))
  .map((x) => ({ title: strOr(x.title), items: x.items.map((i) => String(i ?? '')) }));
export function safeRecipe(r) {
  return {
    ...r,
    title: strOr(r.title, 'מתכון') || 'מתכון',
    category: strOr(r.category, 'אחר') || 'אחר',
    // כל הקטגוריות של המתכון (הראשית ראשונה). מתכון ישן – רק הקטגוריה שלו
    categories: [...new Set([strOr(r.category, 'אחר') || 'אחר', ...(Array.isArray(r.categories) ? r.categories.filter((c) => typeof c === 'string' && c) : [])])],
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    ingredients: sectionsOr(r.ingredients),
    steps: sectionsOr(r.steps),
    tips: Array.isArray(r.tips) ? r.tips.map(String) : [],
    source: r.source && typeof r.source === 'object' ? r.source : {},
  };
}
export const addRecipe = (s, url, hint) => api(s, 'POST', '/recipes', hint ? { url, hint } : { url });
// הוספה ברקע: השרת מחזיר מספר עבודה מיד, וממשיך גם אם האפליקציה נסגרת
export const addRecipeAsync = (s, url, hint) => api(s, 'POST', '/recipes?async=1', hint ? { url, hint } : { url }).then((d) => d.job);
export const getJob = (s, id) => api(s, 'GET', `/jobs/${id}`).then((d) => d.job);

// הוספה ברקע ומחכים לתוצאה (ייבוא מווטסאפ): גם אם האפליקציה ברקע, השרת ממשיך, והמעקב חוזר כשחוזרים
export async function addRecipeAndWait(s, url, hint) {
  const job = await addRecipeAsync(s, url, hint);
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    let state;
    try {
      state = await getJob(s, job.id);
    } catch (e) {
      if (e.status === 404) throw e;
      continue; // רשת נפלה לרגע – ממשיכים לבדוק
    }
    if (state.status === 'done') return { recipe: await getRecipe(s, state.recipeId) };
    if (state.status === 'error') throw new ApiError(state.error, state.code || 502, {});
  }
}
export const getRecipe = (s, id) => api(s, 'GET', `/recipes/${id}`).then((d) => safeRecipe(d.recipe));
export const refreshRecipe = (s, id) => api(s, 'POST', `/recipes/${id}/refresh`);
export const updateRecipe = (s, id, patch) => api(s, 'PUT', `/recipes/${id}`, patch).then((d) => d.recipe);
// הסוכן משבץ מתכון קיים בכל הקטגוריות שמתאימות לו
export const categorizeRecipe = (s, id) => api(s, 'POST', `/recipes/${id}/categorize`).then((d) => d.recipe);
export const deleteRecipe = (s, id) => api(s, 'DELETE', `/recipes/${id}`);

// הזמנות (בעל האפליקציה). כשהספר נעול, המכשיר של הבעלים שולח את ה-session שלו
const own = () => loadJson('matkon_session', '');
export const listInvites = () => api(own(), 'GET', '/invites');
export const createInvite = (name) => api(own(), 'POST', '/invites', { name }).then((d) => d.invite);
export const deleteInvite = (token) => api(own(), 'DELETE', `/invites/${encodeURIComponent(token)}`);
export const setPlan = (userId, plan) => api(own(), 'PUT', `/users/${userId}/plan`, { plan }).then((d) => d.user);

// משתמש שהוזמן
export const checkInvite = (token) => api('', 'POST', '/invite', { token });
export const register = (form) => api('', 'POST', '/register', form);
// מזהה אקראי של המכשיר: מכשיר שכבר נכנס לחשבון לא ננעל כשזר מנסה סיסמאות מהרבה כתובות
export function deviceId() {
  try {
    let id = localStorage.getItem('matkon_device');
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('matkon_device', id);
    }
    return id;
  } catch {
    return undefined;
  }
}
export const login = (email, password) => api('', 'POST', '/login', { email, password, device: deviceId() });
export const logout = (s) => api(s, 'POST', '/logout', {}).catch(() => {});

export const inviteLink = (token) => `${window.location.origin}${window.location.pathname}#invite=${token}`;
export const loginLink = () => `${window.location.origin}${window.location.pathname}#login`;
export const addTextRecipe = (s, item) => api(s, 'POST', '/recipes/text', item);

// מתכון מתמונות / שנכתב ידנית
export const addPhotoRecipe = (s, body) => api(s, 'POST', '/recipes/photo', body);
export const addManualRecipe = (s, recipe) => api(s, 'POST', '/recipes/manual', recipe);

// רשימת קניות
export const getShopping = (s) => api(s, 'GET', '/shopping').then((d) => d.items);
export const putShopping = (s, items) => api(s, 'PUT', '/shopping', { items }).then((d) => d.items);
export const organizeShopping = (s, items) => api(s, 'POST', '/shopping/organize', { items }).then((d) => d.groups);

// שינויים ברמת פריט (כדי ששני בני משפחה לא ימחקו זה לזה)
export const shoppingOps = (s, ops) => api(s, 'POST', '/shopping/ops', { ops }, { keepalive: true }).then((d) => d.items);
export const pantryOps = (s, ops) => api(s, 'POST', '/pantry/ops', { ops }, { keepalive: true }).then((d) => d.items);
export const planOps = (s, ops) => api(s, 'POST', '/plan/ops', { ops }, { keepalive: true }).then((d) => d.plan);

// תכנון ארוחות שבועי
export const getPlan = (s) => api(s, 'GET', '/plan').then((d) => d.plan);
export const putPlan = (s, plan) => api(s, 'PUT', '/plan', { plan }).then((d) => d.plan);

// חיפוש מתכון ברשת לפי שם
export const searchRecipes = (s, q) => api(s, 'POST', '/search', { q }).then((d) => d.results);

// קטגוריות משלי
export const addCategory = (s, name) => api(s, 'POST', '/categories', { name }).then((d) => d.custom);
export const setCategoryPrefs = (s, prefs) => api(s, 'PUT', '/categories/prefs', prefs);
export const removeCategory = (s, name) => api(s, 'POST', '/categories/remove', { name });

// גיבוי ושחזור
// שחזור במנות של 40 מתכונים (קובץ גדול עם תמונות לא נשלח בבקשה אחת), ואחר כך רשימת קניות, תכנון ומלאי
export async function restoreBackup(s, backup, onProgress) {
  const recipes = backup.recipes || [];
  const ids = {};
  let restored = 0;
  let skipped = 0;
  for (let i = 0; i < recipes.length || i === 0; i += 40) {
    const part = await api(s, 'POST', '/recipes/restore', { recipes: recipes.slice(i, i + 40), ...(i === 0 ? { categories: backup.categories || [] } : {}) });
    restored += part.restored;
    skipped += part.skipped;
    Object.assign(ids, part.ids || {});
    onProgress?.(Math.min(i + 40, recipes.length), recipes.length);
    if (i + 40 >= recipes.length) break;
  }
  const remap = (id) => (id && ids[id]) || id;
  const add = (items) => items.map((item) => ({ op: 'add', id: String(item.id || `${Date.now()}-${Math.random()}`), item }));
  if (Array.isArray(backup.shopping) && backup.shopping.length) {
    await shoppingOps(s, add(backup.shopping.slice(0, 500).map((i) => ({ ...i, recipeId: remap(i.recipeId) }))));
  }
  if (Array.isArray(backup.pantry) && backup.pantry.length) await pantryOps(s, add(backup.pantry.slice(0, 400)));
  if (backup.plan && typeof backup.plan === 'object') {
    const meals = Object.entries(backup.plan).flatMap(([day, list]) => (Array.isArray(list) ? list : []).map((m) => ({ ...m, day, recipeId: remap(m.recipeId) })));
    if (meals.length) await planOps(s, add(meals.slice(-500)));
  }
  return { restored, skipped };
}

// חשבון: יציאה מכל המכשירים, מחיקת החשבון
export const logoutAll = (s) => api(s, 'POST', '/logout-all', {});
export const deleteAccount = (s) => api(s, 'DELETE', '/account');
export const changePassword = (s, current, next) => api(s, 'POST', '/account/password', { current, next });

// המלאי בבית: מקרר ומזווה
export const getPantry = (s) => api(s, 'GET', '/pantry').then((d) => d.items);
export const putPantry = (s, items) => api(s, 'PUT', '/pantry', { items }).then((d) => d.items);
export const scanPantry = (s, body) => api(s, 'POST', '/pantry/scan', body).then((d) => d.items);
export const pantryIdeas = (s, items, wish) => api(s, 'POST', '/pantry/ideas', { items, wish }).then((d) => d.results);

// איפה לקנות: חנויות קרובות ומחירים
export const findStores = (s, lat, lon, items) => api(s, 'POST', '/stores', { lat, lon, items });

// כניסה עם גוגל
export const getAuthConfig = () => api('', 'GET', '/auth-config');
export const googleSignIn = (credential, token, join) => api('', 'POST', '/google', { credential, ...(token ? { token } : {}), ...(join ? { join } : {}) });

// ספר משותף: בעל הספר מצרף בני משפחה עם קישור הצטרפות
export const checkJoin = (join) => api('', 'POST', '/join', { join });
export const getMembers = (s) => api(s, 'GET', '/members');
export const createMemberLink = (s) => api(s, 'POST', '/members', {}).then((d) => d.join);
export const removeMember = (s, id) => api(s, 'DELETE', `/members/${encodeURIComponent(id)}`);
export const cancelMemberLink = (s, token) => api(s, 'DELETE', `/members/links/${encodeURIComponent(token)}`);
export const joinLink = (token) => `${window.location.origin}${window.location.pathname}#join=${token}`;
export const ownerLogin = (password) => api('', 'POST', '/owner-login', { password, device: deviceId() });

// ניהול (בעל האפליקציה): עלויות AI לפי ספר ותקלות אחרונות
export const getAdminUsage = (month) => api(own(), 'GET', `/admin/usage${month ? `?month=${month}` : ''}`);
export const getAdminErrors = () => api(own(), 'GET', '/admin/errors');
export const linkGoogle = (s, credential) => api(s, 'POST', '/google', { credential, link: true }).then((d) => d.user);
export const reportClientError = (where, message) => api(loadJson('matkon_session', ''), 'POST', '/client-error', { where, message }).catch(() => {});

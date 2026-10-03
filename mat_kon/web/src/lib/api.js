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

export async function api(session, method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(session ? { authorization: `Bearer ${session}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body && JSON.stringify(body),
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
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    ingredients: sectionsOr(r.ingredients),
    steps: sectionsOr(r.steps),
    tips: Array.isArray(r.tips) ? r.tips.map(String) : [],
    source: r.source && typeof r.source === 'object' ? r.source : {},
  };
}
export const addRecipe = (s, url, hint) => api(s, 'POST', '/recipes', hint ? { url, hint } : { url });
export const refreshRecipe = (s, id) => api(s, 'POST', `/recipes/${id}/refresh`);
export const updateRecipe = (s, id, patch) => api(s, 'PUT', `/recipes/${id}`, patch).then((d) => d.recipe);
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
export const login = (email, password) => api('', 'POST', '/login', { email, password });
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
export const shoppingOps = (s, ops) => api(s, 'POST', '/shopping/ops', { ops }).then((d) => d.items);
export const pantryOps = (s, ops) => api(s, 'POST', '/pantry/ops', { ops }).then((d) => d.items);
export const planOps = (s, ops) => api(s, 'POST', '/plan/ops', { ops }).then((d) => d.plan);

// תכנון ארוחות שבועי
export const getPlan = (s) => api(s, 'GET', '/plan').then((d) => d.plan);
export const putPlan = (s, plan) => api(s, 'PUT', '/plan', { plan }).then((d) => d.plan);

// חיפוש מתכון ברשת לפי שם
export const searchRecipes = (s, q) => api(s, 'POST', '/search', { q }).then((d) => d.results);

// קטגוריות משלי
export const addCategory = (s, name) => api(s, 'POST', '/categories', { name }).then((d) => d.custom);
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
export const ownerLogin = (password) => api('', 'POST', '/owner-login', { password });

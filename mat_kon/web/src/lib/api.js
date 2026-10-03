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
export const listRecipes = (s) => api(s, 'GET', '/recipes').then((d) => d.recipes);
export const addRecipe = (s, url, hint) => api(s, 'POST', '/recipes', hint ? { url, hint } : { url });
export const refreshRecipe = (s, id) => api(s, 'POST', `/recipes/${id}/refresh`);
export const updateRecipe = (s, id, patch) => api(s, 'PUT', `/recipes/${id}`, patch).then((d) => d.recipe);
export const deleteRecipe = (s, id) => api(s, 'DELETE', `/recipes/${id}`);

// הזמנות (בעל האפליקציה)
export const listInvites = () => api('', 'GET', '/invites');
export const createInvite = (name) => api('', 'POST', '/invites', { name }).then((d) => d.invite);
export const deleteInvite = (token) => api('', 'DELETE', `/invites/${encodeURIComponent(token)}`);
export const setPlan = (userId, plan) => api('', 'PUT', `/users/${userId}/plan`, { plan }).then((d) => d.user);

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

// תכנון ארוחות שבועי
export const getPlan = (s) => api(s, 'GET', '/plan').then((d) => d.plan);
export const putPlan = (s, plan) => api(s, 'PUT', '/plan', { plan }).then((d) => d.plan);

// חיפוש מתכון ברשת לפי שם
export const searchRecipes = (s, q) => api(s, 'POST', '/search', { q }).then((d) => d.results);

// קטגוריות משלי
export const addCategory = (s, name) => api(s, 'POST', '/categories', { name }).then((d) => d.custom);
export const removeCategory = (s, name) => api(s, 'POST', '/categories/remove', { name });

// גיבוי ושחזור
export const restoreBackup = (s, backup) => api(s, 'POST', '/recipes/restore', backup);

// המלאי בבית: מקרר ומזווה
export const getPantry = (s) => api(s, 'GET', '/pantry').then((d) => d.items);
export const putPantry = (s, items) => api(s, 'PUT', '/pantry', { items }).then((d) => d.items);
export const scanPantry = (s, body) => api(s, 'POST', '/pantry/scan', body).then((d) => d.items);
export const pantryIdeas = (s, items, wish) => api(s, 'POST', '/pantry/ideas', { items, wish }).then((d) => d.results);

// איפה לקנות: חנויות קרובות ומחירים
export const findStores = (s, lat, lon, items) => api(s, 'POST', '/stores', { lat, lon, items });

// כניסה עם גוגל
export const getAuthConfig = () => api('', 'GET', '/auth-config');
export const googleSignIn = (credential, token) => api('', 'POST', '/google', { credential, ...(token ? { token } : {}) });

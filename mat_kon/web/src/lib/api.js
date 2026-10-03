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
export const addRecipe = (s, url) => api(s, 'POST', '/recipes', { url });
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

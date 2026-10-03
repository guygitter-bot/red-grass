// השרת של mat-kon (mat_kon/api). הכתובת נקבעת בזמן הבנייה (.github/workflows/mat-kon.yml).
export const API_URL = (import.meta.env.VITE_API_URL || 'https://mat-kon-api.guygitter.workers.dev').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(code, method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'x-access-code': code, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new ApiError('אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `שגיאה מהשרת (${res.status})`, res.status);
  return data;
}

export const checkCode = (code) => api(code, 'GET', '/check');
export const listRecipes = (code) => api(code, 'GET', '/recipes').then((d) => d.recipes);
export const addRecipe = (code, url) => api(code, 'POST', '/recipes', { url });
export const refreshRecipe = (code, id) => api(code, 'POST', `/recipes/${id}/refresh`);
export const updateRecipe = (code, id, patch) => api(code, 'PUT', `/recipes/${id}`, patch).then((d) => d.recipe);
export const deleteRecipe = (code, id) => api(code, 'DELETE', `/recipes/${id}`);

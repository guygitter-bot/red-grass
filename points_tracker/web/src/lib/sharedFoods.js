// המאגר המשותף בשרת: מאכלים שכל המשתמשים מוסיפים (ידנית או דרך הסוכן באפליקציה).

export const sharedAvailable = (s) => Boolean(s.proxyUrl && s.accessCode);

function headers(s, json) {
  const h = { 'x-access-code': s.accessCode };
  if (s.adminCode) h['x-admin-code'] = s.adminCode;
  if (json) h['content-type'] = 'application/json';
  return h;
}

async function call(s, method, query = '', body) {
  const res = await fetch(`${s.proxyUrl}/foods${query}`, {
    method,
    headers: headers(s, Boolean(body)),
    body: body && JSON.stringify(body),
  });
  if (res.status === 403) throw new Error('קוד המנהל לא נכון');
  if (!res.ok) throw new Error(`שגיאה מהשרת (${res.status})`);
  return res.json();
}

export const fetchSharedFoods = async (s) => (await call(s, 'GET')).foods || [];
export const addSharedFood = (s, food) => call(s, 'POST', '', food);
export const adminUpdateFood = (s, food, oldName) =>
  call(s, 'PUT', oldName ? `?oldName=${encodeURIComponent(oldName)}` : '', food);
export const adminDeleteFood = (s, name) => call(s, 'DELETE', `?name=${encodeURIComponent(name)}`);

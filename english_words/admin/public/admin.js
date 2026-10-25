import { API_URL } from './config.js';
import { kidHtml } from './view.js';

const $ = (id) => document.getElementById(id);
let hasPassword = true;

function token() {
  try { return localStorage.getItem('milim-admin-token') || ''; } catch { return ''; }
}
function setToken(t) {
  try { t ? localStorage.setItem('milim-admin-token', t) : localStorage.removeItem('milim-admin-token'); } catch { /* מצב פרטי */ }
}

async function api(path, body = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path === '/admin/overview') { setToken(''); showLogin(); throw new Error(''); }
  if (!res.ok) throw new Error(data.error || 'תקלה, נסו שוב');
  return data;
}

async function showLogin() {
  $('dash').classList.add('hidden');
  $('login').classList.remove('hidden');
  $('loginErr').textContent = '';
  try { hasPassword = (await api('/admin/status')).hasPassword; } catch { $('loginErr').textContent = 'אין חיבור לשרת'; }
  $('loginTitle').textContent = hasPassword ? 'כניסה עם הסיסמה' : 'כניסה ראשונה: בחרו סיסמה לניהול (לפחות 6 תווים)';
  $('pass2').classList.toggle('hidden', hasPassword);
  $('pass').autocomplete = hasPassword ? 'current-password' : 'new-password';
  $('loginBtn').textContent = hasPassword ? 'כניסה' : 'שמירת סיסמה';
}

async function login() {
  const password = $('pass').value;
  $('loginErr').textContent = '';
  if (!hasPassword && password !== $('pass2').value) { $('loginErr').textContent = 'הסיסמאות לא זהות'; return; }
  try {
    const { token: t } = await api(hasPassword ? '/admin/login' : '/admin/setup', { password });
    setToken(t);
    $('pass').value = $('pass2').value = '';
    showDash();
  } catch (e) {
    $('loginErr').textContent = e.message;
  }
}

async function showDash() {
  $('login').classList.add('hidden');
  $('dash').classList.remove('hidden');
  $('dashErr').textContent = '';
  try {
    const { kids } = await api('/admin/overview', { token: token() });
    $('kids').innerHTML = kids.map(kidHtml).join('');
    $('empty').classList.toggle('hidden', kids.length > 0);
  } catch (e) {
    $('dashErr').textContent = e.message;
  }
}

$('loginBtn').onclick = login;
for (const id of ['pass', 'pass2']) $(id).onkeydown = (e) => { if (e.key === 'Enter') login(); };
$('refresh').onclick = showDash;
$('logout').onclick = () => { setToken(''); showLogin(); };
$('kids').onclick = async (e) => {
  const b = e.target.closest('[data-delete]');
  if (!b || !confirm(`למחוק את ${b.dataset.name} ואת כל התוצאות?`)) return;
  try { await api('/admin/delete', { token: token(), id: b.dataset.delete }); showDash(); } catch (err) { $('dashErr').textContent = err.message; }
};
// חוזרים לאפליקציה – מרעננים
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && token() && !$('dash').classList.contains('hidden')) showDash();
});

if (token()) showDash(); else showLogin();

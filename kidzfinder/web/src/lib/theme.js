// מצב לילה: שמור ב-localStorage, מחלקה dark על html.
const KEY = 'kf_theme';

export function applyTheme() {
  const t = get();
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
export function get() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function toggle() {
  const dark = document.documentElement.classList.contains('dark');
  try { localStorage.setItem(KEY, dark ? 'light' : 'dark'); } catch {}
  applyTheme();
}

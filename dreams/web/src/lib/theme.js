// מצב לילה: ברירת המחדל לילה (האפליקציה משמשת בעיקר ליד המיטה). 'light' / 'dark' נשמר ב-localStorage.
const KEY = 'zc_theme';

export function isDark() {
  try {
    return localStorage.getItem(KEY) !== 'light';
  } catch {
    return true;
  }
}

export function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark());
}

export function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // אין אחסון
  }
  applyTheme();
  return next === 'dark';
}

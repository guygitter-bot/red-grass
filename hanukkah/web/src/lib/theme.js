// מצב לילה: 'light' / 'dark' נשמר ב-localStorage; בלי ערך – עוקבים אחרי המכשיר
const KEY = 'ch_theme';

export function savedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'dark' || t === 'light' ? t : null;
  } catch {
    return null;
  }
}

export function isDark() {
  const t = savedTheme();
  if (t) return t === 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
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
    // אין אחסון – המצב יחזור לברירת המחדל
  }
  applyTheme();
  return next === 'dark';
}

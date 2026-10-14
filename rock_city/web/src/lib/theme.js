// מצב לילה: auto (לפי המכשיר) / light / dark. נשמר בכל מכשיר בנפרד
const KEY = 'rc_theme';

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function isDark(theme = getTheme()) {
  return theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

export function applyTheme(theme = getTheme()) {
  document.documentElement.classList.toggle('dark', isDark(theme));
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // מצב פרטי – רק לשיחה הזאת
  }
  applyTheme(theme);
}

// מצב לילה מיד בטעינה (הלוגיקה המלאה ב-src/lib/theme.js)
try {
  var t = localStorage.getItem('rc_theme');
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}

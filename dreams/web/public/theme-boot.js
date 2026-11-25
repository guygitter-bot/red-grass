// מצב לילה מיד בטעינה (הלוגיקה המלאה ב-src/lib/theme.js). ברירת המחדל כאן: לילה.
try {
  var t = localStorage.getItem('zc_theme');
  if (t !== 'light') document.documentElement.classList.add('dark');
} catch (e) {
  document.documentElement.classList.add('dark');
}

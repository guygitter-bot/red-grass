// מצב לילה מיד בטעינה (קובץ נפרד ולא סקריפט בתוך הדף, בגלל מדיניות האבטחה – CSP)
try {
  var t = localStorage.getItem('isport_theme');
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}

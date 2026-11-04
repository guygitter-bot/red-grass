// "מי אני" – השם של מי שמשתמש במכשיר הזה (אמא, אבא, סבתא, הגננת...). נשמר רק במכשיר, ונרשם ליד כל ארוחה והודעה
const KEY = 'ys_me';

export function getMe() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setMe(name) {
  try {
    localStorage.setItem(KEY, String(name || '').trim().slice(0, 30));
  } catch {
    // מצב פרטי
  }
}

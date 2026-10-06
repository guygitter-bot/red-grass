// מרחב: אפליקציה נפרדת לאדם נוסף, שנפתחת מקישור ‎?u=<מזהה>‎ (ראו seder/api/spaces.js).
// המזהה נשמר במכשיר, כך שגם פתיחה מהמסך הראשי / מהתראה (בלי הקישור) נכנסת לאותו מרחב.
// כל מה שנשמר במכשיר (משימות, חיבור, סיסמה לפתיחה בלי רשת) נשמר בנפרד לכל מרחב – גם באותו טלפון.
const PARAM = 'u';
const KEY = 'seder_space';
const SPACE_RE = /^[A-Za-z0-9_-]{16}$/;

export function detectSpace(search = '', saved = null) {
  const fromUrl = new URLSearchParams(search).get(PARAM);
  if (fromUrl && SPACE_RE.test(fromUrl)) return fromUrl;
  return saved && SPACE_RE.test(saved) ? saved : '';
}

function init() {
  if (typeof window === 'undefined') return '';
  try {
    const space = detectSpace(window.location.search, localStorage.getItem(KEY));
    if (space) localStorage.setItem(KEY, space);
    return space;
  } catch {
    return detectSpace(window.location.search);
  }
}

export const SPACE = init();

// שם המפתח במכשיר: באפליקציה הראשית – כמו תמיד (כדי לא לאבד נתונים קיימים), במרחב – עם המזהה
export const scoped = (key, space = SPACE) => (space ? `${key}@${space}` : key);

// הכתובת בלי פרמטרים זמניים – אבל עם המרחב (באייפון "הוספה למסך הבית" שומרת את הכתובת הזו)
export const appPath = (space = SPACE) => `${typeof window === 'undefined' ? '/' : window.location.pathname}${space ? `?${PARAM}=${space}` : ''}`;

// הקישור שנשלח לאדם החדש
export const spaceLink = (id, origin = window.location.origin + window.location.pathname) => `${origin}?${PARAM}=${id}`;

// יציאה מהמרחב במכשיר הזה (חזרה לאפליקציה הראשית). הנתונים של המרחב נשארים בשרת
export function leaveSpace() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // אחסון חסום
  }
  window.location.replace(window.location.pathname);
}

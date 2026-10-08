// הפרופיל של מי שמשחק במכשיר הזה: מזהה + סוד (נוצרים פעם אחת), שם ותמונה. נשמר רק במכשיר.
const KEY = 'eir_profile';
const LAST = 'eir_last_game';

const randomId = (len) => {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
};

export function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && p.id && p.token) return { name: '', photo: '', ...p };
  } catch {
    // אין גישה לאחסון – פרופיל חדש
  }
  return { id: randomId(16), token: randomId(32), name: '', photo: '' };
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // מצב פרטי – רק לשיחה הזאת
  }
}

export function lastGame() {
  try {
    return localStorage.getItem(LAST) || '';
  } catch {
    return '';
  }
}

export function setLastGame(code) {
  try {
    if (code) localStorage.setItem(LAST, code);
    else localStorage.removeItem(LAST);
  } catch {
    // לא נורא
  }
}

// אותיות שהיו לאחרונה במכשיר הזה (גם במשחקים קודמים) – כדי שלא יחזרו מהר
const RECENT = 'eir_recent_letters';
export function recentLetters() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
export function rememberLetter(letter) {
  try {
    const list = recentLetters();
    if (list[0] === letter) return;
    localStorage.setItem(RECENT, JSON.stringify([letter, ...list.filter((l) => l !== letter)].slice(0, 15)));
  } catch {
    // לא נורא
  }
}

// תמונה מהגלריה/מצלמה -> ריבוע קטן (160 פיקסלים, JPEG) כדי שיעבור מהר לכולם
export function shrinkPhoto(file, size = 160) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('לא הצלחתי לפתוח את התמונה'));
    };
    img.src = url;
  });
}

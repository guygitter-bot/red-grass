// אותה בדיקת אות כמו בשרת (api/game.js) – כאן רק כדי לסמן בזמן הכתיבה. לשנות בשניהם.
const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[֑-ֽֿ-ׇ]/g, '')
    .replace(/[-־_.,!?;:()"״]/g, ' ')
    .replace(/[׳`’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function startsWithLetter(answer, letter) {
  const first = normalize(answer)[0];
  return !!first && (FINALS[first] || first) === letter;
}

// זמנים לבחירה (כמו TIMES בשרת)
export const TIMES = [
  { seconds: 60, label: 'דקה' },
  { seconds: 120, label: '2 דקות' },
  { seconds: 180, label: '3 דקות' },
  { seconds: 300, label: '5 דקות' },
  { seconds: 480, label: '8 דקות' },
];

// 1:05
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// הקוד מתוך קישור הזמנה (?g=ABCDE) או כפי שהוקלד
export function codeFrom(text) {
  const s = String(text || '').trim();
  const m = s.match(/[?&]g=([A-Za-z0-9]{5})/) || s.match(/^([A-Za-z0-9]{5})$/);
  return m ? m[1].toUpperCase() : '';
}

export function inviteLink(code) {
  return `${location.origin}${location.pathname}?g=${code}`;
}

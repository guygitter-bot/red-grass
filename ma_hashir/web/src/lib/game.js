// הגדרות המשחק (כמו ב-api/game.js – לשנות בשניהם)
export const ERAS = [
  { id: 'all', label: 'כל השנים' },
  { id: '60', label: 'שנות ה-60' },
  { id: '70', label: 'שנות ה-70' },
  { id: '80', label: 'שנות ה-80' },
  { id: '90', label: 'שנות ה-90' },
  { id: '00', label: 'שנות ה-2000' },
  { id: '10', label: 'שנות ה-2010' },
  { id: '20', label: 'שנות ה-2020' },
];
export const LANGS = [
  { id: 'both', label: '🌍 גם וגם' },
  { id: 'il', label: '🇮🇱 ישראליים' },
  { id: 'intl', label: '🌐 לועזיים' },
];
export const COUNTS = [10, 20];
export const MODES = [
  { id: 'solo', label: '👤 כל אחד לעצמו' },
  { id: 'teams', label: '👥 קבוצה נגד קבוצה' },
];
export const TEAMS = [
  { name: 'הכחולים', to: 'לכחולים', icon: '🔵', color: 'text-team0', bg: 'bg-team0' },
  { name: 'האדומים', to: 'לאדומים', icon: '🔴', color: 'text-team1', bg: 'bg-team1' },
];
export const JOKER_EVERY = 30;
// כמה שניות שומעים: רגיל ועם הארכה
export const SNIPPET = 5;
export const SNIPPET_LONG = 10;

export const eraLabel = (id) => ERAS.find((e) => e.id === id)?.label || '';
export const langLabel = (id) => LANGS.find((l) => l.id === id)?.label || '';

// הקוד מתוך קישור הזמנה (?g=ABCDE) או כפי שהוקלד
export function codeFrom(text) {
  const s = String(text || '').trim();
  const m = s.match(/[?&]g=([A-Za-z0-9]{5})/) || s.match(/^([A-Za-z0-9]{5})$/);
  return m ? m[1].toUpperCase() : '';
}

export function inviteLink(code) {
  return `${location.origin}${location.pathname}?g=${code}`;
}

// דירוג: אותו ניקוד = אותו מקום
export function ranking(items) {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  return sorted.map((item) => ({ ...item, place: sorted.findIndex((x) => x.total === item.total) + 1 }));
}

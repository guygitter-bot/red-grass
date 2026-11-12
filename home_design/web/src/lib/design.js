// קיצורי דרך לכתיבת הבקשה: סגנונות, שינויים נפוצים וצבעי קיר.
export const STYLES = ['מודרני', 'סקנדינבי', 'כפרי חם', 'תעשייתי', 'יפני מינימליסטי', 'בוהו', 'קלאסי', 'ים תיכוני'];

export const QUICK = [
  { label: 'חיפוי עץ', text: 'לחפות את הקיר בפסי עץ אלון אנכיים' },
  { label: 'טפט', text: 'להדביק על הקיר טפט בדוגמה עדינה שמתאימה לחדר' },
  { label: 'מדפים', text: 'להוסיף על הקיר מדפים צפים מעץ עם ספרים וצמחים' },
  { label: 'קיר תמונות', text: 'לתלות על הקיר קבוצת תמונות ממוסגרות בסידור מאוזן' },
  { label: 'תאורה', text: 'להוסיף תאורה נסתרת חמה וגופי תאורה על הקיר' },
  { label: 'בטון / טיח', text: 'לתת לקיר גימור של טיח מינרלי בגוון בטון בהיר' },
  { label: 'לבנים', text: 'לחפות את הקיר בלבנים חשופות' },
  { label: 'צמחייה', text: 'להוסיף צמחים גדולים ועציצים שמתאימים לחדר' },
];

export const COLORS = [
  { name: 'לבן שבור', hex: '#f3efe6' },
  { name: 'בז׳ חולי', hex: '#d8c7ab' },
  { name: 'אפור בהיר', hex: '#c9ccc9' },
  { name: 'ירוק זית', hex: '#7c8560' },
  { name: 'ירוק מרווה', hex: '#a9b8a3' },
  { name: 'כחול עמוק', hex: '#243b55' },
  { name: 'תכלת מעושן', hex: '#9db4c0' },
  { name: 'טרקוטה', hex: '#c26a4a' },
  { name: 'חרדל', hex: '#c99a2e' },
  { name: 'ורוד עתיק', hex: '#d8aba1' },
  { name: 'אפור פחם', hex: '#3b3f42' },
  { name: 'בורדו', hex: '#6e2a35' },
];

export const colorText = (c) => `לצבוע את הקיר בצבע ${c.name} (${c.hex})`;
export const styleText = (s) => `לעצב מחדש את החדר בסגנון ${s}, בלי לשנות את המבנה שלו`;

// מוסיף משפט לבקשה שכבר נכתבה (בלי לכפול אותו)
export function addToRequest(current, text) {
  const cur = String(current || '').trim();
  if (!cur) return text;
  if (cur.includes(text)) return cur;
  return `${cur}${/[.!?]$/.test(cur) ? '' : '.'} ${text}`;
}

// שם ברירת מחדל לפרויקט חדש
export function defaultName(date = new Date()) {
  return `חדר ${date.getDate()}.${date.getMonth() + 1}`;
}

// כותרת קצרה לגרסה ברשימה
export function shortTitle(text, max = 28) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

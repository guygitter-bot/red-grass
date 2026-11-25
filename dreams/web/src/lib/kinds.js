// סוגי הכוונות – לכל סוג: שם, אייקון, הסבר קצר ומשפט הכוונה המוצע
export const KINDS = [
  {
    id: 'problem',
    icon: '🗝️',
    name: 'פתרון לבעיה',
    hint: 'החלטה, תקיעות בעבודה, שאלה שאין לה תשובה',
    placeholder: 'למשל: האם לעבור דירה השנה?',
    phrase: (t) => `הלילה אחלום על: ${t}`,
  },
  {
    id: 'creative',
    icon: '🎨',
    name: 'רעיון יצירתי',
    hint: 'שיר, עיצוב, סיפור, שם למשהו',
    placeholder: 'למשל: איך ייראה הלוגו של העסק?',
    phrase: (t) => `הלילה אראה בחלום: ${t}`,
  },
  {
    id: 'feeling',
    icon: '🌊',
    name: 'רגש או קשר',
    hint: 'מישהו שחסר לך, מצב שמעיק, פרידה',
    placeholder: 'למשל: לפגוש את סבתא',
    phrase: (t) => `הלילה אחלום על: ${t}`,
  },
  {
    id: 'place',
    icon: '🏔️',
    name: 'מקום או חוויה',
    hint: 'לטוס, ים, מקום מהילדות',
    placeholder: 'למשל: לעוף מעל הים',
    phrase: (t) => `הלילה אהיה ב: ${t}`,
  },
  {
    id: 'lucid',
    icon: '✨',
    name: 'חלום צלול',
    hint: 'לדעת בתוך החלום שזה חלום',
    placeholder: 'מה לעשות בחלום? למשל: לעוף',
    phrase: (t) => (t ? `בפעם הבאה שאחלום, אזכור שזה חלום – ואז: ${t}` : 'בפעם הבאה שאחלום, אזכור שזה חלום'),
  },
  {
    id: 'recall',
    icon: '🌙',
    name: 'רק לזכור חלום',
    hint: 'בלי נושא – להתאמן בזכירה',
    placeholder: '',
    phrase: () => 'כשאתעורר, אזכור את החלום שלי',
  },
];

export const kindById = (id) => KINDS.find((k) => k.id === id) || KINDS[0];

// משפט הכוונה: קצר, בגוף ראשון, בזמן עתיד (כמו בהנחיות של ברט)
export function makePhrase(kind, text) {
  const t = String(text || '').trim().replace(/[?？!.]+$/, '');
  const k = kindById(kind);
  if (!t && k.id !== 'lucid' && k.id !== 'recall') return '';
  return k.phrase(t);
}

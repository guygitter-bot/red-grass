// מה ששואלים את מי שיוצר ספר: אירוע, פרטים, שאלות, טון, סגנון איור ואורך.
// המזהים כפולים ב-api/brief.js – לשנות בשניהם (בדיקה בשרת מוודאת).
export const OCCASIONS = [
  { id: 'birthday', icon: '🎂', label: 'יום הולדת', hint: 'ספר שיקראו שוב גם בעוד עשור' },
  { id: 'anniversary', icon: '💍', label: 'יום נישואין', hint: 'כל השנים שלכם בספר אחד' },
  { id: 'wedding', icon: '💒', label: 'חתונה', hint: 'איך שניהם הגיעו עד לכאן' },
  { id: 'romantic', icon: '💕', label: 'מחווה רומנטית', hint: 'למה האהבה שלכם מיוחדת' },
  { id: 'funny', icon: '😂', label: 'צחוקים', hint: 'קורע מצחוק, ובסוף גם מרגש' },
  { id: 'kid', icon: '🧸', label: 'סיפור לילד/ה', hint: 'סיפור מאויר שהילד/ה הגיבורים שלו' },
  { id: 'just', icon: '🎁', label: 'סתם מתנה', hint: 'בלי סיבה, ובדיוק בגלל זה מרגש' },
  { id: 'other', icon: '✨', label: 'משהו אחר', hint: 'פרישה, פרידה, זיכרון, חיית מחמד...' },
];

export const TONES = [
  { id: 'moving', label: 'מרגש' },
  { id: 'funny', label: 'מצחיק' },
  { id: 'mixed', label: 'מצחיק וגם מרגש' },
  { id: 'adventure', label: 'הרפתקה' },
];

export const STYLES = [
  { id: 'watercolor', label: 'צבעי מים' },
  { id: 'storybook', label: 'ספר ילדים' },
  { id: 'comic', label: 'קומיקס' },
  { id: 'pencil', label: 'עפרונות' },
  { id: 'real', label: 'ציור ריאליסטי' },
];

export const LENGTHS = [
  { id: 'short', chapters: 6, label: 'קצר', hint: '6 פרקים' },
  { id: 'medium', chapters: 10, label: 'רגיל', hint: '10 פרקים' },
  { id: 'long', chapters: 14, label: 'ארוך', hint: '14 פרקים' },
];

export const MAX_PHOTOS = 6;

// השאלות לפי אירוע. {שם} מוחלף בשם של מי שהספר עליו. אף שאלה לא חובה – אבל כל תשובה מוסיפה לספר
const COMMON = [
  'שלוש מילים שמתארות את {שם}',
  'מה {שם} הכי אוהב/ת? (תחביבים, אוכל, מקומות, קבוצה...)',
  'סיפור או רגע עם {שם} שאי אפשר לשכוח',
  'משפטים או הרגלים שכולם מזהים אצל {שם}',
  'האנשים החשובים בחיים של {שם} (שמות ומי הם)',
  'מה תרצו לומר או לאחל ל{שם}?',
];

const COUPLE = [
  'איך הכרתם? ספרו על ההתחלה',
  'רגע אחד שבו הבנתם שזה זה',
  'מקומות, טיולים או חוויות שהם רק שלכם',
  'מה הכי מצחיק או מיוחד ב{שם}?',
  'בדיחות פרטיות, כינויים ומשפטים שרק אתם מבינים',
  'מה תרצו לומר או לאחל ל{שם}?',
];

const QUESTIONS = {
  anniversary: COUPLE,
  wedding: [
    'איך הזוג הכיר? ספרו על ההתחלה',
    'מה מיוחד בכל אחד מהם, ומה מיוחד בהם ביחד?',
    'סיפור מצחיק או מרגש עליהם',
    'איך הייתה הצעת הנישואין?',
    'האנשים החשובים בחיים שלהם (שמות ומי הם)',
    'מה תרצו לאחל להם?',
  ],
  romantic: COUPLE,
  funny: [
    'שלוש מילים שמתארות את {שם}',
    'הפדיחות והסיפורים שתמיד חוזרים אליהם',
    'משפטים, הרגלים ושיגעונות שכולם מזהים אצל {שם}',
    'מה {שם} הכי אוהב/ת, ועל מה תמיד מתלונן/ת?',
    'החברים שחייבים להופיע בספר (שמות ומי הם)',
    'ובכל זאת – למה אוהבים את {שם}?',
  ],
  kid: [
    'מה {שם} הכי אוהב/ת? (משחקים, חיות, דמויות, אוכל...)',
    'במה {שם} ממש טוב/ה, ומה מיוחד בו/בה?',
    'מי החברים, האחים או חיית המחמד שיופיעו בסיפור?',
    'איזו הרפתקה תרצו? (חלל, דרקונים, ים, ג׳ונגל, בית ספר קסום...)',
    'משהו ש{שם} מתמודד/ת איתו והסיפור יכול לחזק (לא חובה)',
    'מה תרצו לומר ל{שם} בסוף הסיפור?',
  ],
};

export const questionsFor = (occasion, name) => (QUESTIONS[occasion] || COMMON).map((q) => q.replaceAll('{שם}', name || 'מי שהספר עליו'));

export const isKid = (brief) => brief?.occasion === 'kid';

// בריף ריק לספר חדש
export const emptyBrief = () => ({
  occasion: '', name: '', gender: 'm', relation: '', age: '', from: '',
  tone: 'mixed', style: 'watercolor', length: 'medium', dedication: '', answers: [],
});

// ברירות מחדל שמתאימות לאירוע (נקבעות כשבוחרים אירוע)
export function defaultsFor(occasion) {
  if (occasion === 'kid') return { tone: 'adventure', style: 'storybook', length: 'medium' };
  if (occasion === 'funny') return { tone: 'funny', style: 'comic', length: 'medium' };
  if (occasion === 'romantic' || occasion === 'anniversary' || occasion === 'wedding') return { tone: 'moving', style: 'watercolor', length: 'medium' };
  return { tone: 'mixed', style: 'watercolor', length: 'medium' };
}

// התשובות שמולאו, יחד עם השאלה שלהן (כך הן נשלחות לסופר)
export function answered(questions, answers) {
  return questions.map((q, i) => ({ q, a: String(answers?.[i] || '').trim() })).filter((x) => x.a);
}

// אפשר להתחיל? מחזיר הודעה בעברית אם חסר משהו, או ''
export function briefProblem(brief) {
  if (!brief.occasion) return 'בחרו לאיזה אירוע הספר';
  if (!String(brief.name || '').trim()) return 'כתבו על מי הספר';
  if ((brief.answers || []).length < 2) return 'ענו לפחות על שתי שאלות, כדי שיהיה לסופר ממה לכתוב';
  return '';
}

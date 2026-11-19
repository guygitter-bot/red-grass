// רשימת הנושאים – המקור היחיד. הסדר כאן הוא הסדר במסך, ובתוך כל פרק נושא נפתח אחרי שעוברים את הקודם
export const PASS = 80;
export const ROUND_SIZE = 10;
export const EXAM_SIZE = 20;
export const EXAM = 'exam';

export const SECTIONS = [
  { id: 'numbers', title: 'מספרים טבעיים ופעולות חשבון', emoji: '🔢' },
  { id: 'fractions', title: 'שברים פשוטים', emoji: '🍕' },
  { id: 'measure', title: 'מדידות אורכים', emoji: '📏' },
  { id: 'geometry', title: 'גיאומטריה', emoji: '📐' },
  { id: 'data', title: 'חקר נתונים', emoji: '📊' },
];

export const TOPICS = [
  { id: 'sequences', section: 'numbers', emoji: '🔢', title: 'סדרות', note: 'המשך סדרה, מספר חסר, הכלל' },
  { id: 'digits', section: 'numbers', emoji: '🧩', title: 'בניית מספרים מספרות', note: 'הכי גדול, הכי קטן, זוגי' },
  { id: 'ops', section: 'numbers', emoji: '➕', title: 'ארבע פעולות החשבון', note: 'חיבור, חיסור, כפל, חילוק' },
  { id: 'order', section: 'numbers', emoji: '🧮', title: 'סדר פעולות החשבון', note: 'סוגריים, כפל וחילוק קודם' },
  { id: 'zero_one', section: 'numbers', emoji: '0️⃣', title: 'תכונות האפס והאחד', note: 'כפל ב-0 וב-1, חילוק, חיבור' },
  { id: 'times_more', section: 'numbers', emoji: '✖️', title: 'משמעות הכפל', note: 'פי כמה? פי 3 יותר' },
  { id: 'word_problems', section: 'numbers', emoji: '📖', title: 'בעיות מילוליות', note: 'שלב אחד ושני שלבים' },
  { id: 'write_problem', section: 'numbers', emoji: '✏️', title: 'כתיבת שאלה לתרגיל', note: 'איזה סיפור מתאים?' },
  { id: 'compare_frac', section: 'fractions', emoji: '⚖️', title: 'השוואת שברים', note: 'מי גדול? מי קטן?' },
  { id: 'bigger_smaller', section: 'fractions', emoji: '↕️', title: 'גדול וקטן משבר נתון', note: 'איזה שבר גדול מ-3/4?' },
  { id: 'whole_from_part', section: 'fractions', emoji: '🍰', title: 'השלמת השלם', note: 'מהחלק אל השלם' },
  { id: 'length', section: 'measure', emoji: '📏', title: 'מדידת אורכים', note: 'מ"מ, ס"מ, מ\', ק"מ וסרגל' },
  { id: 'parallel', section: 'geometry', emoji: '🛤️', title: 'צלעות מקבילות', note: 'זוגות של צלעות מקבילות' },
  { id: 'perimeter', section: 'geometry', emoji: '🔲', title: 'היקף מצולעים', note: 'סכום כל הצלעות' },
  { id: 'area', section: 'geometry', emoji: '🟦', title: 'שטחים', note: 'משבצות ואורך × רוחב' },
  { id: 'angles', section: 'geometry', emoji: '📐', title: 'זוויות', note: 'ישרה, חדה, קהה' },
  { id: 'diagonals', section: 'geometry', emoji: '❌', title: 'אלכסונים', note: 'כמה אלכסונים יש?' },
  { id: 'chart', section: 'data', emoji: '📊', title: 'דיאגרמות', note: 'עמודות ופיקטוגרמה' },
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);
// כל סוגי התרגול (הנושאים + המבחן המסכם) – חייב להיות זהה ל-MODES בשרת (api/stats.js) ול-STAGES בניהול
export const MODES = [...TOPIC_IDS, EXAM];
export const MODE_TITLES = { ...Object.fromEntries(TOPICS.map((t) => [t.id, t.title])), [EXAM]: 'מבחן מסכם' };

export const topicsOf = (sectionId) => TOPICS.filter((t) => t.section === sectionId);

// נושא פתוח אם הוא הראשון בפרק, או שעברו את הקודם לו באותו פרק (best = {נושא: אחוז})
export function isUnlocked(topicId, best) {
  const t = TOPICS.find((x) => x.id === topicId);
  const list = topicsOf(t.section);
  const i = list.indexOf(t);
  return i === 0 || (best[list[i - 1].id] || 0) >= PASS;
}
export const allPassed = (best) => TOPIC_IDS.every((id) => (best[id] || 0) >= PASS);

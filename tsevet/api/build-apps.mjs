// בונה את apps.js: מה הצוות יודע על כל אפליקציה (מתוך ה-README שלה במאגר).
// רץ אוטומטית לפני כל עלייה (.github/workflows/tsevet.yml), כך שהבוטים תמיד מכירים את הגרסה העדכנית.
// הרצה ידנית: node build-apps.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const MAX_README = 9000;

// האפליקציות שמפרסמים (כלים פנימיים כמו טוטו וחשבוניות – לא כאן)
const LIST = [
  { key: 'seder', dir: 'seder', name: 'סדר', url: 'https://seder-tasks.pages.dev', about: 'אפליקציית משימות וסדר יום בעברית' },
  { key: 'bis', dir: 'points_tracker', name: 'ביס', url: 'https://bis-app.pages.dev', about: 'מעקב ניקוד אוכל, מים ומשקל עם סוכן חכם (צילום מנה → נקודות)' },
  { key: 'mat_kon', dir: 'mat_kon', name: 'mat-kon', url: 'https://mat-kon.pages.dev', about: 'ספר מתכונים משפחתי חכם: הוספה מקישור/סרטון, רשימת קניות, מלאי ותכנון ארוחות' },
  { key: 'ai_maagar', dir: 'ai_maagar', name: 'מאגר AI', url: 'https://ai-maagar-631.pages.dev', about: 'שמירת קישורים וקבצים על AI שממופים אוטומטית לקטגוריות' },
  { key: 'eretz_ir', dir: 'eretz_ir', name: 'ארץ עיר', url: 'https://eretz-ir.pages.dev', about: 'משחק ארץ עיר אונליין לכמה שחקנים עם בדיקת תשובות אוטומטית' },
  { key: 'rock_city', dir: 'rock_city', name: 'רוק סיטי', url: 'https://rock-city-school.pages.dev', about: 'מערכת שעות לבית ספר למוזיקה: שיעורים, תלמידים, מורים ותשלומים' },
];

const apps = LIST.map(({ dir, ...app }) => {
  let readme = '';
  try {
    readme = readFileSync(`${root}${dir}/README.md`, 'utf8').slice(0, MAX_README);
  } catch {
    readme = '(אין README)';
  }
  return { ...app, readme };
});

const out = `// נוצר אוטומטית מ-build-apps.mjs – לא לערוך ידנית.\nexport const APPS = ${JSON.stringify(apps, null, 2)};\n`;
writeFileSync(new URL('./apps.js', import.meta.url), out);
console.log(`apps.js: ${apps.length} apps`);

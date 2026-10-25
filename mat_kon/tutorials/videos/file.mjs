import { record, demo } from '../kit.mjs';
import { join, dirname } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from '../../web/node_modules/fflate/esm/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// קובץ Word אמיתי עם שני מתכונים (נבחר כאילו מהטלפון)
const DOC = join(HERE, '..', '.rec', 'saba-recipes.docx');
mkdirSync(dirname(DOC), { recursive: true });
const para = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const lines = [
  'קציצות דגים ברוטב עגבניות', 'מצרכים:', 'חצי קילו דג טחון', '2 ביצים', '3 כפות פירורי לחם', 'פלפל אדום, שום, פפריקה',
  'אופן ההכנה:', 'מערבבים את הדג עם הביצים והפירורים ויוצרים קציצות.', 'מבשלים רוטב מפלפל, שום ועגבניות ומבשלים בו את הקציצות 40 דקות.',
  '', 'עוגת תפוזים', 'מצרכים:', '3 ביצים', 'כוס סוכר', 'כוס מיץ תפוזים', '2 כוסות קמח תופח', 'חצי כוס שמן',
  'אופן ההכנה:', 'מערבבים הכל ואופים בתנור 180 מעלות כ-40 דקות.',
];
writeFileSync(DOC, zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(para).join('')}</w:body></w:document>`),
}));

const base = { ...demo.NEW_RECIPE, tips: [], tags: [] };
const FISH = {
  ...base, id: 'r-file-fish', title: 'קציצות דגים ברוטב עגבניות', category: 'דגים', description: 'הקציצות של סבתא מהקובץ המשפחתי.',
  servings: '6 מנות', totalTime: '55 דקות',
  ingredients: [{ title: '', items: ['חצי קילו דג טחון', '2 ביצים', '3 כפות פירורי לחם', '1 פלפל אדום', '4 שיני שום', '1 כפית פפריקה'] }],
  steps: [{ title: '', items: ['מערבבים את הדג עם הביצים והפירורים ויוצרים קציצות.', 'מבשלים רוטב מפלפל, שום ועגבניות.', 'מבשלים את הקציצות ברוטב 40 דקות.'] }],
};

await record('file', async ({ page, mock, say, tap, wait, card, uncard, scroll, point, hideDot }) => {
  await card('📄', 'מדריך חדש', 'מתכון מקובץ', 'מתכונים בקובץ Word, PDF או טקסט? מכניסים אותם לספר', 3000);
  await uncard();
  await say('במסך הראשי לוחצים על <b>מקובץ / ווטסאפ</b>', 2200, true);
  mock.state.newRecipe = FISH;
  await tap(page.getByRole('link', { name: 'מקובץ / ווטסאפ' }), { after: 600 });
  await say('לוחצים <b>בחירת קובץ</b>: מהטלפון, מהמחשב, מגוגל דרייב או מ-iCloud', 3200);
  await point(page.locator('label:has(input[type=file])'), 500);
  await page.evaluate(() => window.__tut.press(195, 200));
  await wait(400);
  // שם בעברית: נשלח כתוכן (Playwright לא מעביר נתיב עם עברית)
  await page.locator('input[type=file]').setInputFiles({ name: 'המתכונים של סבתא.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: readFileSync(DOC) });
  await hideDot();
  await page.getByText('הקובץ מוכן').waitFor({ timeout: 10000 });
  await say('הקובץ נקרא בטלפון. Word, PDF, טקסט או תמונה – הכל עובד', 3400, true);
  await say('קובץ ארוך עם הרבה מתכונים מתחלק לחלקים, ובוחרים מה להכניס', 3400, true);
  await tap(page.getByRole('button', { name: /^ייבוא 1 לספר/ }), { after: 300 });
  await say('כל המתכונים שבקובץ מסודרים…', 0, true);
  await page.getByText('קציצות דגים ברוטב עגבניות · ').waitFor({ timeout: 15000 });
  await wait(1000);
  await say('מוכן! לוחצים על שם המתכון כדי לפתוח אותו', 2600, true);
  await tap(page.getByRole('link', { name: /קציצות דגים/ }), { after: 1200 });
  await say('בראש המתכון כתוב מאיזה קובץ הוא הגיע', 2800, true);
  await scroll(350, 1500);
  await say('💡 PDF סרוק או צילום של דף נקראים כמו צילום מתכון', 3400, true);
});

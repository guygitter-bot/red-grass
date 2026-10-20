import { record } from '../kit.mjs';

await record('search', async ({ page, say, tap, type, wait, card, uncard, point }) => {
  await card('🔎', 'מדריך 4', 'חיפוש מתכון', 'אין קישור? כותבים שם של מנה ומוצאים מתכון מהקהילה או מהרשת');
  await uncard();
  await say('במקום קישור, כותבים בשדה למעלה <b>שם של מנה</b>', 2800);
  await type(page.getByPlaceholder('קישור או שם של מנה'), 'פשטידת תרד', { delay: 70 });
  await say('לוחצים <b>הוספה</b>', 1000);
  await tap(page.getByRole('button', { name: 'הוספה' }), { after: 400 });
  await page.getByText('פשטידת תרד וגבינות קלה').waitFor({ timeout: 15000 });
  await wait(500);
  await say('קודם מופיעים מתכונים <b>מהקהילה</b>: מה שמשתמשים אחרים שמרו בספר שלהם', 3600, true);
  await point(page.getByText('(18 דירוגים)').first(), 1500);
  await say('לכל מתכון רואים <b>דירוג</b>, בכמה ספרים הוא נשמר, זמן הכנה וקלוריות', 3600, true);
  await say('אפשר לסנן: עד 30 דקות, פרווה, חלבי, בשרי, טבעוני או ללא גלוטן', 3400, true);
  await point(page.getByRole('button', { name: 'עד 30 דק׳' }), 1200);
  await tap(page.getByText('פשטידת תרד וגבינות קלה').first(), { after: 900 });
  await say('לוחצים על מתכון ורואים אותו במלואו', 2600, true);
  await say('אהבתם? לוחצים <b>שמירה בספר שלי</b>', 2200, true);
  await tap(page.getByRole('button', { name: 'שמירה בספר שלי' }), { after: 1500 });
  await say('הנה המתכון בספר שלכם', 2400);
  await say('💡 לא מצאתם בקהילה? במסך החיפוש יש גם <b>חיפוש ברשת</b>', 3600, true);
});

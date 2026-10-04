import { record } from '../kit.mjs';

await record('search', async ({ page, say, tap, type, wait, card, uncard, scroll, point }) => {
  await card('🔎', 'מדריך 4', 'חיפוש מתכון ברשת', 'אין קישור? כותבים שם של מנה ומוצאים מתכון טוב');
  await uncard();
  await say('במקום קישור, כותבים בשדה למעלה <b>שם של מנה</b>', 2800);
  await type(page.getByPlaceholder('קישור או שם של מנה'), 'פשטידת תרד', { delay: 70 });
  await say('לוחצים <b>הוספה</b>', 1000);
  await tap(page.getByRole('button', { name: 'הוספה' }), { after: 400 });
  await say('מחפשים ברשת מתכונים טובים… (כמה שניות)', 0);
  await page.getByText('פשטידת תרד וגבינות קלה').waitFor({ timeout: 15000 });
  await wait(600);
  await say('נמצאו כמה מתכונים מאתרי בישול. אפשר ללחוץ <b>לצפייה במתכון</b> כדי להציץ', 3400, true);
  await point(page.getByRole('link', { name: 'לצפייה במתכון' }).first(), 1500);
  await say('בוחרים את המתכון הכי מתאים ולוחצים <b>לספר</b>', 2000, true);
  await tap(page.getByRole('button', { name: 'לספר' }).first(), { after: 600 });
  await say('הוא מסתדר ונכנס לספר, כמו קישור רגיל', 3000, true);
  await tap(page.getByRole('button', { name: 'חזרה' }), { after: 1500 });
  await page.getByText('פשטידת תרד וגבינות').first().waitFor({ timeout: 15000 });
  await say('הנה המתכון בספר שלכם', 2400);
  await tap(page.getByText('פשטידת תרד וגבינות').first(), { after: 1200 });
  await say('מצרכים ואופן הכנה מסודרים, וקישור למקור', 2800, true);
  await say('💡 טיפ: אפשר גם ללחוץ על <b>חיפוש ברשת</b> במסך הראשי', 3600, true);
});

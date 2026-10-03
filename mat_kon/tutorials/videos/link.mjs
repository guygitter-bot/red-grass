import { record } from '../kit.mjs';

await record('link', async ({ page, say, tap, type, wait, card, uncard, scroll }) => {
  await card('🔗', 'מדריך 1', 'מתכון מקישור', 'כל אתר, YouTube, TikTok או Instagram הופך למתכון מסודר');
  await uncard();
  await say('מעתיקים קישור למתכון או לסרטון, ומדביקים אותו בשדה למעלה');
  await type(page.getByPlaceholder('קישור או שם של מנה'), 'https://www.example-food.co.il/spinach-quiche', { delay: 25 });
  await say('לוחצים <b>הוספה</b>', 1200);
  await tap(page.getByRole('button', { name: 'הוספה' }));
  await say('המתכון מסתדר ברקע – אפשר להמשיך להשתמש באפליקציה ואפילו לסגור אותה', 3500);
  await page.getByText('פשטידת תרד וגבינות').first().waitFor({ timeout: 15000 });
  await say('המתכון נכנס לספר, לקטגוריה המתאימה', 2600);
  await tap(page.getByText('פשטידת תרד וגבינות').first(), { after: 1200 });
  await say('מצרכים, אופן הכנה, זמנים וקישור למקור – הכל מסודר', 2800, true);
  await scroll(500, 1500);
  await scroll(500, 1500);
  await say('💡 טיפ: בטלפון אפשר גם לשתף קישור ישר מהאפליקציה של האתר או הסרטון ל-mat-kon', 3800, true);
});

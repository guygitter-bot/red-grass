// סרטון ללקוחות: איך מזמינים חולצה – חיפוש, התאמה אישית, הערה למוכר והמשך ל-FlyLinking
import { MARK, record } from '../kit.mjs';

await record('order', async ({ page, say, tap, type, wait, card, uncard, scroll, scrollTo, point, hideDot }) => {
  await card(MARK, 'Isport', 'איך מזמינים חולצה', 'בוחרים חולצה, מוסיפים שם ומספר, וממשיכים להזמנה');
  await uncard();
  await say('זה דף הבית של <b>Isport</b>', 2400);
  await scroll(520, 1200);
  await say('כאן כל החולצות – של קבוצות ושל נבחרות', 2800);
  await say('אפשר לסנן: <b>קבוצות</b>, <b>נבחרות</b> או ליגה מסוימת', 3000, true);
  await point(page.getByRole('button', { name: 'נבחרות' }), 900);
  await say('או לחפש לפי שם, עונה, צבע או קוד מוצר', 2400, true);
  await type(page.getByLabel('חיפוש חולצות'), 'ליברפול', { delay: 110, after: 900 });
  await say('הנה החולצה. לוחצים עליה', 1800, true);
  await tap(page.getByRole('link', { name: /ליברפול/ }).first(), { after: 1200 });
  await say('בדף החולצה: תמונות, תיאור, ופרטים על הקבוצה', 3000, true);
  await scrollTo(page.getByText('התאמה אישית'));
  await say('עכשיו ההתאמה האישית. הכול לא חובה', 2600, true);
  await type(page.getByPlaceholder('ISRAEL'), 'ISRAEL', { delay: 120 });
  await type(page.getByPlaceholder('10'), '10', { delay: 200 });
  await say('בוחרים פאץ\' – למשל <b>ליגת האלופות</b>', 2200, true);
  await tap(page.getByRole('button', { name: 'ליגת האלופות' }));
  await say('ואם יש גם גרסת שרוול ארוך – בוחרים אורך שרוול', 2600, true);
  await tap(page.getByRole('button', { name: 'שרוול ארוך' }));
  await scrollTo(page.getByText('כך זה ייראה'));
  await say('רואים בערך איך השם והמספר ייראו על הגב', 2800, true);
  await say('לוחצים <b>שמור</b>', 1200, true);
  await tap(page.getByRole('button', { name: 'שמור' }), { after: 1200 });
  await say('נוצרה הערה מסודרת למוכר, והיא כבר הועתקה', 3200, true);
  await point(page.locator('pre'), 1200);
  await say('לוחצים <b>המשך ל-FlyLinking</b>', 2000, true);
  await point(page.getByRole('link', { name: /המשך ל-FlyLinking/ }), 1200);
  await say('שם בוחרים מידה וגרסה, ומדביקים את ההערה בשדה ההערות למוכר', 4200, true);
  await hideDot();
  await scrollTo(page.getByRole('heading', { name: 'ליברפול' }), 700);
  await say('💡 טיפ: לוחצים על ♡ כדי לשמור חולצה במועדפים', 3200, true);
  await tap(page.getByRole('button', { name: 'הוספה למועדפים' }), { after: 800 });
  await card(MARK, 'Isport', 'זהו!', 'חולצה, שם, מספר – ולהזמנה', 2600);
});

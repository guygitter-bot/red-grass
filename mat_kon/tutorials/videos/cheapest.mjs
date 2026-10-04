import { record } from '../kit.mjs';

await record('cheapest', async ({ page, say, tap, wait, card, uncard, scroll, point, hideDot }) => {
  // גלילה רכה בתוך החלון הצף
  const sheetScroll = async (dy, ms = 1300) => {
    await page.evaluate((d) => document.querySelector('.overflow-y-auto.rounded-t-3xl')?.scrollBy({ top: d, behavior: 'smooth' }), dy);
    await wait(ms);
  };

  await card('💰', 'מדריך 9', 'איפה הכי זול', 'משווים מחיר לכל הסל בין הרשתות הקרובות אליכם – ומגיעים ישר לסניף');
  await uncard();
  await say('ברשימת הקניות יש כפתור גדול: <b>איפה לקנות הכי זול</b>', 2600, true);
  await tap(page.getByRole('button', { name: /איפה לקנות הכי זול/ }), { after: 800 });
  await say('למעלה רואים מה בדיוק יושווה – המוצרים שעוד לא סימנתם', 2800, true);
  await say('כדי למצוא סופרים קרובים לוחצים <b>שימוש במיקום שלי</b>', 1400, true);
  await tap(page.getByRole('button', { name: /שימוש במיקום שלי/ }), { after: 500 });
  await say('המיקום משמש רק לחיפוש הזה, בקירוב, ולא נשמר', 2400, true);
  await page.getByRole('heading', { name: 'השוואת מחירים לסל' }).waitFor({ timeout: 15000 });
  await wait(500);

  await say('לכל רשת מחיר לכל הסל. <b>הכי זול</b> מסומן בירוק', 3000, true);
  await say('מתחת לכל רשת: הסניף הקרוב אליכם והמרחק ממנו', 2800, true);
  await say('לוחצים על רשת כדי לראות מחיר לכל מוצר – כולל מבצעים', 1600, true);
  await tap(page.getByRole('button', { name: /רמי לוי/ }).first(), { after: 1200 });
  await sheetScroll(120, 800);
  await say('כל מוצר עם המחיר שלו ברשת הזו', 2600, true);
  await tap(page.getByRole('button', { name: /רמי לוי/ }).first(), { after: 700 });

  await say('אם חסרים מוצרים ברשת, מופיעה הערה – ההשוואה עדיין הוגנת', 2600, true);
  await say('<b>הזמנה אונליין</b> מובילה לאתר הרשת, כדי להזמין עד הבית', 1400, true);
  await point(page.getByRole('link', { name: /הזמנה אונליין/ }).first(), 2000);
  await hideDot();

  await sheetScroll(520, 1200);
  await say('למטה: <b>סופרים קרובים</b> עם כתובת ומרחק', 2800, true);
  await say('<b>ניווט</b> פותח את Waze ישר לסניף', 1200, true);
  await point(page.getByRole('link', { name: /ניווט/ }).first(), 2000);
  await hideDot();
  await say('💡 טיפ: מסמנים מה שכבר קניתם, וההשוואה תחושב רק על מה שנשאר', 3800, true);
}, { start: '#/shopping' });

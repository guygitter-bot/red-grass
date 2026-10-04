import { record } from '../kit.mjs';

await record('shopping', async ({ page, say, tap, type, wait, card, uncard, scroll, point, hideDot }) => {
  await card('🛒', 'מדריך 8', 'רשימת קניות', 'מצרכים ממתכונים ופריטים משלכם – בסידור חכם ובסימון תוך כדי קנייה');
  await uncard();
  await say('בדף של מתכון, מתחת למספר המנות, יש כפתור <b>לרשימת קניות</b>', 2800, true);
  await scroll(250, 1200);
  await say('קודם בוחרים כמה מנות מבשלים – הכמויות יתאימו לזה', 2400, true);
  await tap(page.getByRole('button', { name: 'לרשימת קניות', exact: true }), { after: 1200 });
  await say('כל המצרכים נכנסו לרשימה, לפי מספר המנות', 2600);
  await hideDot();

  await say('חוזרים לספר ועוברים ללשונית <b>קניות</b> בתפריט התחתון', 1400, true);
  await tap(page.getByRole('button', { name: 'חזרה' }).first(), { after: 900 });
  await tap(page.getByRole('link', { name: /קניות/ }), { after: 1500 });
  await say('כאן הרשימה, מקובצת לפי המתכון שממנו הגיעו הפריטים', 2800);
  await scroll(300, 1200);
  await scroll(-300, 800);

  await say('צריך עוד משהו? כותבים פריט למעלה ולוחצים <b>הוספה</b>', 1400);
  await type(page.getByPlaceholder('הוספת פריט (למשל: חלב)'), 'חלב', { delay: 130, after: 500 });
  await tap(page.getByRole('button', { name: 'הוספה', exact: true }), { after: 1200 });
  await say('הפריט נכנס לקבוצה "פריטים נוספים", בתחתית הרשימה', 2600, true);
  await scroll(900, 1400);
  await scroll(-1200, 900);

  await say('<b>סידור חכם</b> מאחד כפילויות ומחלק את הרשימה למחלקות בסופר', 1800);
  await tap(page.getByRole('button', { name: /סידור חכם/ }), { after: 600 });
  await say('רגע… הסוכן מסדר את הרשימה', 2400, true);
  await page.getByRole('heading', { name: 'ירקות ופירות' }).waitFor({ timeout: 15000 });
  await say('עכשיו הכל לפי מחלקות – קל ללכת בסופר בלי לחזור על עצמכם', 2800, true);
  await hideDot();

  await say('בסופר מסמנים כל פריט שהכנסתם לעגלה', 1400, true);
  await tap(page.getByRole('button', { name: /סימון/ }).nth(0), { after: 700 });
  await tap(page.getByRole('button', { name: /סימון/ }).nth(1), { after: 700 });
  await tap(page.getByRole('button', { name: /סימון/ }).nth(2), { after: 1000 });
  await say('מה שסומן מקבל קו, ו<b>מחיקת מה שנקנה</b> מנקה אותו בבת אחת', 2800, true);
  await tap(page.getByRole('button', { name: /מחיקת מה שנקנה/ }), { after: 1500 });
  await hideDot();
  await say('אפשר גם לשתף את הרשימה בכפתור השיתוף למעלה', 2400, true);
  await point(page.getByRole('button', { name: 'שיתוף' }), 1200);
  await say('💡 טיפ: הרשימה נשמרת וגם משותפת בין כל המכשירים של אותו ספר', 3800);
}, { start: '#/r/r-shakshuka', mock: { shopping: [] } });

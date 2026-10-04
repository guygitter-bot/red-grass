import { record } from '../kit.mjs';

await record('share', async ({ page, say, tap, point, wait, card, uncard, scroll, hideDot }) => {
  await card('👨‍👩‍👧', 'מדריך 13', 'ספר משותף למשפחה', 'כל המשפחה עובדת על אותו ספר, אותה רשימת קניות ואותו מקרר');
  await uncard();
  await say('בראש המסך הראשי לוחצים על <b>גלגל השיניים</b>', 1400);
  await tap(page.getByRole('link', { name: 'הגדרות' }), { after: 1000 });
  await say('לוחצים <b>שיתוף הספר</b>', 1300);
  await tap(page.getByRole('link', { name: /שיתוף הספר/ }), { after: 1000 });
  await say('שולחים קישור הצטרפות לבן/בת הזוג או לבני משפחה', 2800, true);
  await say('לוחצים <b>יצירת קישור הצטרפות</b>', 1200, true);
  await tap(page.getByRole('button', { name: /יצירת קישור הצטרפות/ }), { after: 1200 });
  await say('הקישור מוכן, ותקף להצטרפות אחת', 2400, true);
  await say('<b>שליחה</b> פותחת את וואטסאפ וכו׳, ו<b>העתקה</b> מעתיקה את הקישור', 3000, true);
  await tap(page.getByRole('button', { name: /העתקה/ }), { after: 1400 });
  await hideDot();
  await scroll(300, 900);
  await say('בחלק <b>מי בספר</b> רואים את כל המשתתפים – עד 5 אנשים', 3000, true);
  await point(page.getByRole('button', { name: /הסרת/ }), 900);
  await say('כדי להסיר מישהו לוחצים על <b>פח הזבל</b> (המתכונים נשארים בספר)', 3400, true);
  await hideDot();
  await card('📲', 'מצד בן/בת הזוג', 'איך מצטרפים?', 'פותחים את הקישור שקיבלו, ונכנסים עם חשבון גוגל או עם אימייל וסיסמה. מאותו רגע רואים את אותם מתכונים, קניות, תכנון ומקרר', 6500);
  await card('💡', 'טיפ', 'הקישור תקף להצטרפות אחת', 'צריך לצרף עוד מישהו? פשוט יוצרים קישור חדש', 3500);
}, { start: '#/' });

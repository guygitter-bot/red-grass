import { record } from '../kit.mjs';

await record('book', async ({ page, say, tap, type, wait, card, uncard, scroll, point, hideDot }) => {
  await card('📚', 'מדריך 7', 'ארגון הספר', 'חיפוש, קטגוריות, תגיות, מועדפים ומיון – למצוא כל מתכון מהר');
  await uncard();
  await say('זה הספר שלכם: כל המתכונים במקום אחד', 2400, true);

  await say('מחפשים לפי שם, מצרך או תגית – למשל <b>שוקולד</b>', 1200, true);
  const search = page.getByPlaceholder('חיפוש לפי שם, מצרך או תגית');
  await type(search, 'שוקולד', { delay: 120, after: 1800 });
  await say('רק מה שמתאים נשאר על המסך', 2200);
  await tap(page.getByRole('button', { name: 'ניקוי' }), { after: 800 });

  await say('השורה הזו היא <b>קטגוריות</b> – לוחצים על אחת כדי לסנן', 2600, true);
  await tap(page.getByRole('button', { name: /^.{0,3} ?עוגות/ }).first(), { after: 1800 });
  await say('לוחצים שוב על אותה קטגוריה (או על <b>הכל</b>) כדי לחזור', 2400);
  await tap(page.getByRole('button', { name: /^הכל/ }), { after: 1000 });

  await say('צריך קטגוריה משלכם? לוחצים <b>+ קטגוריה</b>', 1400, true);
  await tap(page.getByRole('button', { name: /קטגוריה$/ }).last(), { after: 600 });
  await type(page.getByPlaceholder('שם הקטגוריה'), 'ארוחות שבת', { delay: 90, after: 600 });
  await say('כותבים שם ולוחצים <b>הוספה</b>', 1200, true);
  await tap(page.getByRole('button', { name: 'הוספה', exact: true }), { after: 1500 });
  await say('הקטגוריה נוצרה – ובדף של מתכון אפשר להעביר אליה מתכונים', 3000, true);
  await tap(page.getByRole('button', { name: /^הכל/ }), { after: 600 });
  await hideDot();

  await say('מתחת לקטגוריות יש <b>תגיות</b> – לוחצים על תגית כדי לראות את כל המתכונים שלה', 1800, true);
  await tap(page.getByRole('button', { name: /^#שוקולד/ }), { after: 2000 });
  await say('לוחצים שוב כדי לבטל את הסינון', 1500, true);
  await tap(page.getByRole('button', { name: /^#שוקולד/ }), { after: 800 });

  await say('ב<b>מועדפים</b> רואים רק מתכונים שסימנתם בלב', 1200, true);
  await tap(page.getByRole('button', { name: /מועדפים/ }), { after: 2200 });
  await tap(page.getByRole('button', { name: /מועדפים/ }), { after: 600 });

  await say('ובאפשרות <b>מיון</b> בוחרים סדר: החדשים, א-ב או הדירוג הגבוה', 1600, true);
  const sort = page.locator('select').first();
  await tap(sort, { after: 300 });
  await sort.selectOption('rating');
  await wait(1600);
  await say('כאן המתכונים עם הדירוג הגבוה ביותר קודם', 2200);
  await hideDot();
  await say('💡 טיפ: אפשר לשלב – קטגוריה, תגית ומיון יחד, ולמצוא כל מתכון בשניות', 3800);
});

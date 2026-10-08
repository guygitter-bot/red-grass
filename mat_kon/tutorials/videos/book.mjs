import { record } from '../kit.mjs';

await record('book', async ({ page, say, tap, type, wait, card, uncard, hideDot, point }) => {
  await card('📚', 'מדריך 7', 'ארגון הספר', 'חיפוש, קטגוריות, מועדפים ומיון – למצוא כל מתכון מהר');
  await uncard();
  await say('זה הספר שלכם: כל המתכונים במקום אחד', 2400, true);

  await say('מחפשים לפי שם או מצרך – למשל <b>שוקולד</b>', 1200, true);
  const search = page.getByPlaceholder('חיפוש לפי שם או מצרך');
  await type(search, 'שוקולד', { delay: 120, after: 1800 });
  await say('רק מה שמתאים נשאר על המסך', 2200);
  await tap(page.getByRole('button', { name: 'ניקוי' }), { after: 800 });

  await say('לוחצים <b>קטגוריות</b> כדי לראות את כל הקטגוריות', 1400, true);
  await tap(page.getByRole('link', { name: /קטגוריות/ }).first(), { after: 1500 });
  await say('כל קטגוריה היא אריח, עם מספר המתכונים שבה', 2600, true);
  await say('לוחצים על הלב כדי לסמן קטגוריה מועדפת – היא תופיע ראשונה, וגם כקיצור דרך בספר', 1600, true);
  await tap(page.getByRole('button', { name: 'סימון עוגות כמועדפת' }), { after: 1400 });

  await say('צריך קטגוריה משלכם? לוחצים <b>קטגוריה חדשה</b>', 1400, true);
  await tap(page.getByRole('button', { name: /קטגוריה חדשה/ }), { after: 600 });
  await type(page.getByPlaceholder('שם הקטגוריה'), 'ארוחות שבת', { delay: 90, after: 600 });
  await say('כותבים שם ולוחצים <b>הוספה</b>', 1200, true);
  await tap(page.getByRole('button', { name: 'הוספה', exact: true }), { after: 1500 });
  await say('הקטגוריה נוצרה – ובדף של מתכון אפשר להוסיף אליה מתכונים', 3000, true);
  await say('מתכון יכול להופיע בכמה קטגוריות. הכפתור הזה משבץ את המתכונים שכבר בספר בכל הקטגוריות שמתאימות להם', 1200, true);
  await point(page.getByRole('button', { name: /^שיבוץ/ }), 3200);

  await say('לוחצים על אריח כדי לראות רק את המתכונים שבו', 1400, true);
  await tap(page.getByRole('button', { name: /^.{0,3} ?עוגות/ }).first(), { after: 1800 });
  await say('לוחצים <b>הכל</b> כדי לחזור לכל המתכונים', 1400, true);
  await tap(page.getByRole('button', { name: /^הכל/ }), { after: 1000 });
  await hideDot();

  await say('ב<b>מתכונים מועדפים</b> רואים רק מתכונים שסימנתם בלב', 1200, true);
  await tap(page.getByRole('button', { name: /מתכונים מועדפים/ }), { after: 2200 });
  await tap(page.getByRole('button', { name: /מתכונים מועדפים/ }), { after: 600 });

  await say('ובאפשרות <b>מיון</b> בוחרים סדר: החדשים, א-ב או הדירוג הגבוה', 1600, true);
  const sort = page.locator('select').first();
  await tap(sort, { after: 300 });
  await sort.selectOption('rating');
  await wait(1600);
  await say('כאן המתכונים עם הדירוג הגבוה ביותר קודם', 2200);
  await hideDot();
  await say('💡 טיפ: אפשר לשלב – חיפוש, קטגוריה ומיון יחד, ולמצוא כל מתכון בשניות', 3800);
});

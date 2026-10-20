import { record } from '../kit.mjs';

await record('community', async ({ page, say, tap, type, wait, card, uncard, point, hideDot, scroll }) => {
  await card('🤝', 'מדריך 15', 'הקהילה', 'מתכונים שמשתמשים אחרים שמרו ודירגו – ואיך משתפים מתכון משלכם');
  await uncard();
  await say('הקהילה היא מאגר משותף של מתכונים מכל המשתמשים. הספר שלכם נשאר פרטי', 3800);
  await say('מתכון שמישהו שמר מקישור – נכנס למאגר לבד, בלי שם ובלי פרטים של מי ששמר', 4200);

  await say('מחפשים מנה: כותבים את השם ולוחצים <b>הוספה</b>', 1400, true);
  await type(page.getByPlaceholder('קישור או שם של מנה'), 'פשטידת תרד', { delay: 70 });
  await tap(page.getByRole('button', { name: 'הוספה' }), { after: 400 });
  await page.getByText('פשטידת תרד וגבינות קלה').waitFor({ timeout: 15000 });
  await wait(500);
  await say('למעלה – מה שנמצא <b>בקהילה</b>. זה מיידי ובחינם', 3200, true);
  await point(page.getByText('(18 דירוגים)').first(), 1200);
  await say('רואים דירוג, ובכמה ספרים המתכון נשמר – כך יודעים מה באמת טוב', 3600, true);
  await say('ואפשר לסנן: כשר, ללא גלוטן, טבעוני ועוד', 1400, true);
  await point(page.getByRole('button', { name: /כשר, ללא גלוטן ועוד/ }), 1800);

  await tap(page.getByText('פשטידת תרד וגבינות קלה').first(), { after: 900 });
  await say('לוחצים על מתכון ורואים אותו במלואו, עם קרדיט למקור', 3000, true);
  await say('מתכון לא מתאים? למטה יש <b>דיווח על המתכון</b>', 1400, true);
  await point(page.getByRole('button', { name: /דיווח על המתכון/ }), 2200);
  await say('אהבתם? <b>שמירה בספר שלי</b>', 1400, true);
  await tap(page.getByRole('button', { name: 'שמירה בספר שלי' }), { after: 1500 });
  await say('המתכון בספר שלכם. כשנותנים לו כוכבים – זה עוזר גם לאחרים', 3400);
  await hideDot();

  // חוזרים לספר (מהמתכון, ואם צריך גם ממסך החיפוש)
  for (let i = 0; i < 3 && !(await page.getByRole('link', { name: 'המתכונים' }).isVisible()); i++) {
    await tap(page.getByRole('button', { name: /^(חזרה|סגירה)$/ }).first(), { after: 900 });
  }
  await tap(page.getByRole('link', { name: 'המתכונים' }), { after: 1000 });
  await say('ומתכון משלכם? למשל העוגיות של סבתא', 1400, true);
  await tap(page.getByText('עוגיות שוקולד צ\'יפס של סבתא').first(), { after: 1200 });
  await say('מתכון שכתבתם, צילמתם או קיבלתם בווטסאפ נשאר פרטי. הוא מתפרסם רק אם תבחרו', 3600);
  const publish = page.getByRole('button', { name: 'פרסום לקהילה' });
  await publish.scrollIntoViewIfNeeded();
  await wait(600);
  await say('בתחתית הדף לוחצים <b>פרסום לקהילה</b>', 1200, true);
  await tap(publish, { after: 1000 });
  await say('בפעם הראשונה בוחרים <b>שם להצגה</b>. האימייל שלכם לא מוצג', 1400, true);
  await type(page.getByPlaceholder('למשל: דנה מבשלת'), 'דנה מבשלת', { delay: 80 });
  await say('מאשרים את התנאים: רק מתכונים שמותר לשתף, בלי פרטים אישיים', 1400, true);
  await tap(page.getByRole('checkbox'), { after: 600 });
  await tap(page.getByRole('button', { name: 'שמירה ופרסום' }), { after: 400 });
  await say('לפני הפרסום המתכון נבדק אוטומטית', 2400);
  await page.getByText('פורסם בקהילה! 🎉').waitFor({ timeout: 10000 });
  await say('פורסם! עכשיו כולם יכולים למצוא אותו, עם השם שבחרתם', 3200, true);
  await say('ומתחרטים? <b>ביטול פרסום</b> – והמתכון נשאר רק אצלכם', 1400, true);
  await point(page.getByRole('button', { name: 'ביטול פרסום' }), 2400);
  await say('💡 טיפ: מתכון שכמה אנשים דיווחו עליו מוסתר עד שהוא נבדק', 3800);
});

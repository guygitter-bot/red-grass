import { record } from '../kit.mjs';

await record('fridge', async ({ page, mock, say, tap, type, upload, wait, card, uncard, scroll, hideDot, unsay }) => {
  // מוצר בודד: האפליקציה שולחת mode 'single' (השרת המדומה מצפה ל-'one'), אז מחזירים כאן מוצר אחד
  const handle = mock.handle;
  mock.handle = async (method, path, body) => {
    if (path.startsWith('/pantry/scan') && body.mode === 'single') {
      await wait(mock.state.delay);
      return { items: [{ name: 'יוגורט יווני', qty: '4 גביעים', place: 'fridge' }] };
    }
    return handle(method, path, body);
  };

  await card('🧊', 'מדריך 10', 'המקרר והמזווה', 'יודעים מה יש בבית – בלי לפתוח את המקרר');
  await uncard();
  await say('לוחצים למטה על <b>מקרר ומזווה</b>', 1400);
  await tap(page.getByRole('link', { name: 'מקרר ומזווה' }), { after: 1000 });
  await say('יש שני אזורים: <b>המקרר</b> ו<b>המזווה</b>', 2600);
  await tap(page.getByRole('link', { name: /המקרר/ }), { after: 1000 });

  await say('הכי פשוט: כותבים מה יש – אפשר כמה ביחד, עם פסיק', 800);
  await type(page.getByPlaceholder('הוספת מוצר (למשל: ביצים)'), 'חומוס, טחינה', { delay: 80 });
  await say('ולוחצים <b>הוספה</b>', 600);
  await tap(page.getByRole('button', { name: 'הוספה' }), { after: 1400 });

  await scroll(-2000, 600);
  await say('קנינו משהו חדש? <b>צילום מוצר</b> – מזהה ומוסיף מיד', 1600, true);
  const single = page.locator('label', { hasText: 'צילום מוצר' });
  await upload(single, single.locator('input'), ['yogurt.png']);
  await say('מזהה את המוצר…', 0, true);
  await page.getByText('יוגורט יווני').first().waitFor({ timeout: 15000 });
  await say('היוגורט נכנס לרשימה, עם הכמות 🥣', 2800, true);

  await say('אחרי קנייה גדולה: <b>צילום כל המקרר</b>', 1600, true);
  const many = page.locator('label', { hasText: 'צילום כל המקרר' });
  await upload(many, many.locator('input'), ['fridge.png']);
  await say('ממפה את כל המוצרים בתמונה…', 0, true);
  await page.getByText(/מצאתי \d+ מוצרים/).waitFor({ timeout: 15000 });
  await hideDot();
  await say('לפני שמוסיפים – בודקים את הרשימה', 2400, true);
  await say('מורידים סימון ממה שלא צריך…', 800, true);
  await tap(page.getByRole('button', { name: 'לא להוסיף' }).nth(3), { after: 800 });
  await say('מתקנים שם, וכפתור 🧊/🥫 מעביר בין מקרר למזווה', 800, true);
  const nameInput = page.locator('input[value="שמנת מתוקה"]');
  await tap(nameInput, { after: 300 });
  await nameInput.press('End');
  await nameInput.pressSequentially(' 38%', { delay: 110 });
  await wait(1200);
  await say('ולוחצים <b>הוספה</b>', 1000, true);
  await tap(page.getByRole('button', { name: /הוספה של \d+ מוצרים/ }), { after: 1500 });

  await say('מוצר נגמר? לוחצים על ה-<b>✕</b> ליד השם', 1200, true);
  await tap(page.getByRole('button', { name: 'הסרת חמאה' }), { after: 1400 });
  await say('רוצים לעדכן כמות? פשוט מצלמים או מוסיפים שוב – השורה מתעדכנת ולא נכפלת', 3400, true);
  await hideDot();
  await scroll(1200, 1800);
  await unsay();
  await scroll(-3000, 600);
  await tap(page.getByRole('link', { name: 'חזרה' }), { after: 1000 });
  await say('המזווה עובד בדיוק אותו דבר – עם <b>צילום מדף</b> 🥫', 1000);
  await tap(page.getByRole('link', { name: /המזווה/ }), { after: 2200 });
  await hideDot();
  await say('💡 טיפ: כשהמקרר והמזווה מעודכנים, נמצא לכם מה לבשל ממה שיש בבית', 3800);
}, { start: '#', mock: { delay: 1800 } });

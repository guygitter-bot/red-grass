import { record, demo } from '../kit.mjs';

// השקשוקה מתחילה בלי דירוג ובלי לב, כדי להראות איך מסמנים
const recipes = demo.RECIPES.map((r) => (r.id === 'r-shakshuka' ? { ...r, rating: 0, favorite: false } : r));

await record('recipe', async ({ page, say, tap, type, wait, card, uncard, point, hideDot }) => {
  // גלילה רכה עד שהאלמנט נמצא בגובה y על המסך
  const reveal = async (loc, y = 120, ms = 900) => {
    await page.evaluate(([sel, top]) => sel && window.scrollBy({ top: sel.getBoundingClientRect().top - top, behavior: 'smooth' }), [await loc.elementHandle(), y]);
    await wait(ms);
  };

  await card('🍳', 'מדריך 6', 'דף המתכון', 'כמויות, מה חסר, מצב בישול, דירוג והערות – הכל במקום אחד');
  await uncard();
  await say('בראש הדף: קישור למקור, תמונה ותיאור קצר', 2600);

  await reveal(page.getByRole('heading', { name: 'שקשוקה ביתית' }), 90);
  await say('נותנים <b>כוכבים</b> למתכון – כדי לזכור כמה הוא הצליח', 2000);
  await tap(page.getByRole('button', { name: '5 כוכבים' }), { after: 900 });
  await say('ובלב ❤️ למעלה מסמנים אותו כ<b>מועדף</b>', 1500, true);
  await tap(page.getByRole('button', { name: 'מועדף' }), { after: 1300 });

  await say('לוחצים על הקטגוריה כדי להעביר את המתכון לקטגוריה אחרת', 2200);
  const cat = page.getByRole('combobox', { name: 'קטגוריה' });
  await tap(cat, { after: 300 });
  await cat.selectOption('צמחוני וטבעוני');
  await wait(1500);
  await say('ותגיות מוסיפים ב<b>+ תגית</b>', 1600);
  await tap(page.getByRole('button', { name: 'תגית' }), { after: 300 });
  await page.getByPlaceholder('תגית').pressSequentially('בראנץ׳', { delay: 90 });
  await page.getByPlaceholder('תגית').press('Enter');
  await hideDot();
  await wait(1200);

  await reveal(page.getByRole('heading', { name: 'מצרכים' }), 70);
  await say('צריך יותר? לוחצים <b>+</b> והכמויות מתעדכנות לבד', 1600, true);
  await tap(page.getByRole('button', { name: 'יותר' }), { after: 700 });
  await tap(page.getByRole('button', { name: 'יותר' }), { after: 1600 });
  await say('תוך כדי הכנה מסמנים כל מצרך שכבר הוספתם', 1500, true);
  await tap(page.getByRole('button', { name: /שמן זית/ }).first(), { after: 600 });
  await tap(page.getByRole('button', { name: /בצל קצוץ/ }).first(), { after: 1200 });
  await hideDot();

  const missing = page.getByText('חסר לך בבית:');
  await reveal(missing, 380);
  await say('כאן רואים מה <b>חסר לכם בבית</b>, לפי מה שיש במקרר ובמזווה', 3000, true);
  await say('ובלחיצה – רק החסרים נכנסים לרשימת הקניות', 1500, true);
  await tap(page.getByRole('button', { name: 'רק החסרים לרשימת הקניות' }), { after: 2200 });
  await hideDot();

  await reveal(page.getByRole('heading', { name: 'אופן ההכנה' }), 80);
  await say('מוכנים לבשל? לוחצים <b>מצב בישול</b>', 1600);
  await tap(page.getByRole('button', { name: 'מצב בישול' }), { after: 1000 });
  await say('שלב אחד בכל פעם, באותיות גדולות – והמסך לא נכבה', 2800);
  await say('כשכתוב זמן בשלב, מופיע כפתור <b>טיימר</b>', 1500, true);
  await tap(page.getByRole('button', { name: /טיימר 5 דקות/ }), { after: 2200 });
  await say('הטיימר רץ למעלה ומצפצף כשהזמן נגמר', 2400, true);
  await tap(page.getByRole('button', { name: 'הבא' }), { after: 1400 });
  await tap(page.getByRole('button', { name: 'הבא' }), { after: 1400 });
  await say('ב<b>מצרכים</b> רואים את הרשימה בלי לצאת', 1500, true);
  await tap(page.getByRole('button', { name: 'מצרכים' }), { after: 1800 });
  await tap(page.getByRole('button', { name: 'מצרכים' }), { after: 800 });
  await tap(page.getByRole('button', { name: 'סגירת מצב בישול' }), { after: 900 });
  await hideDot();

  const notes = page.getByPlaceholder(/הוספתי פחות סוכר/);
  await reveal(notes, 260);
  await say('ב<b>הערות שלי</b> כותבים מה שינינו – נשמר לבד', 1500, true);
  await type(notes, 'יצא מעולה עם פטה מעל 👌', { delay: 60, after: 1500 });
  await page.mouse.click(200, 120);
  await hideDot();

  const edit = page.getByRole('button', { name: 'עריכה' });
  await reveal(edit, 300);
  await say('בתחתית הדף: <b>עריכה</b> של המתכון, הדפסה או שמירה כ-PDF', 2600, true);
  await point(page.getByRole('button', { name: 'הדפסה / PDF' }), 900);
  await tap(edit, { after: 1000 });
  await hideDot();
  await say('משנים שם, מצרכים, שלבים או תמונה – ולוחצים <b>שמירה</b>', 2800, true);
  await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
  await wait(1500);
  const cancel = page.getByRole('button', { name: 'ביטול' });
  await reveal(cancel, 500);
  await tap(cancel, { after: 900 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(1000);
  await say('ובכפתור השיתוף למעלה שולחים את המתכון לחברים', 1500, true);
  await point(page.getByRole('button', { name: 'שיתוף' }), 1800);
  await hideDot();
  await say('💡 טיפ: מספר המנות והסימונים נשמרים לכל מתכון, גם כשחוזרים אליו אחר כך', 3800, true);
}, { start: '#/r/r-shakshuka', mock: { recipes } });

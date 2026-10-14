import { record, demo } from '../kit.mjs';

// השקשוקה מתחילה בלי דירוג ובלי לב, כדי להראות איך מסמנים
const recipes = demo.RECIPES.map((r) => (r.id === 'r-shakshuka' ? { ...r, rating: 0, favorite: false } : r));

await record('recipe', async ({ page, say, tap, type, wait, card, uncard, point, hideDot }) => {
  // גלילה רכה עד שהאלמנט נמצא בגובה y על המסך
  const reveal = async (loc, y = 120, ms = 900) => {
    await page.evaluate(([el, top]) => window.scrollBy({ top: el.getBoundingClientRect().top - top, behavior: 'smooth' }), [await loc.elementHandle(), y]);
    await wait(ms);
  };

  await card('🍳', 'מדריך 6', 'דף המתכון', 'כמויות, מה חסר, מצב בישול, דירוג והערות – הכל במקום אחד');
  await uncard();
  await say('בראש הדף: קישור למקור, תמונה ותיאור קצר', 2400);

  await reveal(page.getByRole('heading', { name: 'שקשוקה ביתית' }), 90, 700);
  await say('נותנים <b>כוכבים</b> – כדי לזכור כמה המתכון הצליח', 1400);
  await tap(page.getByRole('button', { name: '5 כוכבים' }), { after: 700 });
  await say('ב<b>לב</b> למעלה מסמנים אותו כמועדף', 1100);
  await tap(page.getByRole('button', { name: 'מועדף' }), { after: 1000 });
  await say('וב<b>שיתוף</b> שולחים אותו לחברים', 600);
  await point(page.getByRole('button', { name: 'שיתוף' }), 1500);

  await say('מתכון יכול להיות בכמה קטגוריות. ב<b>+ קטגוריה</b> מוסיפים עוד אחת', 1400);
  const cat = page.getByRole('combobox', { name: 'הוספה לקטגוריה' });
  await tap(cat, { after: 300 });
  await cat.selectOption('צמחוני וטבעוני');
  await wait(1300);
  await say('ובאיקס שליד הקטגוריה מוציאים את המתכון ממנה', 2400);
  await hideDot();

  await reveal(page.getByRole('heading', { name: 'מצרכים' }), 70);
  await say('צריך יותר? לוחצים <b>+</b> והכמויות מתעדכנות לבד', 1300, true);
  await tap(page.getByRole('button', { name: 'יותר' }), { after: 600 });
  await tap(page.getByRole('button', { name: 'יותר' }), { after: 1400 });
  await say('תוך כדי הכנה מסמנים כל מצרך שכבר הוספתם', 1000, true);
  await tap(page.getByRole('button', { name: /שמן זית/ }).first(), { after: 500 });
  await tap(page.getByRole('button', { name: /בצל קצוץ/ }).first(), { after: 900 });
  await hideDot();

  await reveal(page.getByText('חסר לך בבית:'), 380);
  await say('כאן רואים מה <b>חסר לכם בבית</b>, לפי מה שיש במקרר ובמזווה', 2800, true);
  await say('ובלחיצה – רק החסרים נכנסים לרשימת הקניות', 1200, true);
  await tap(page.getByRole('button', { name: 'רק החסרים לרשימת הקניות' }), { after: 1800 });
  await hideDot();

  await reveal(page.getByRole('heading', { name: 'אופן ההכנה' }), 80, 700);
  await say('מוכנים לבשל? לוחצים <b>מצב בישול</b>', 1200);
  await tap(page.getByRole('button', { name: 'מצב בישול' }), { after: 800 });
  await say('שלב אחד בכל פעם, באותיות גדולות – והמסך לא נכבה', 2600, true);
  await say('כשכתוב זמן בשלב, מופיע כפתור <b>טיימר</b>', 1200, true);
  await tap(page.getByRole('button', { name: /טיימר 5 דקות/ }), { after: 600 });
  await say('הטיימר רץ למעלה ומצפצף כשהזמן נגמר', 1400);
  await tap(page.getByRole('button', { name: 'הבא' }), { after: 1200 });
  await say('ב<b>מצרכים</b> רואים את הרשימה בלי לצאת', 1000);
  await tap(page.getByRole('button', { name: 'מצרכים', exact: true }), { after: 1800 });
  await tap(page.getByRole('button', { name: 'סגירת מצב בישול' }), { after: 700 });
  await hideDot();

  const notes = page.getByPlaceholder(/הוספתי פחות סוכר/);
  await reveal(notes, 260);
  await say('ב<b>הערות שלי</b> כותבים מה שינינו – נשמר לבד', 1000, true);
  await type(notes, 'יצא מעולה עם פטה מעל 👌', { delay: 55, after: 1000 });
  await page.evaluate(() => document.activeElement?.blur());
  await hideDot();

  const edit = page.getByRole('button', { name: 'עריכה' });
  await reveal(edit, 380);
  await say('בתחתית: הדפסה או שמירה כ-<b>PDF</b>…', 600, true);
  await point(page.getByRole('button', { name: 'הדפסה / PDF' }), 1400);
  await say('…ו<b>עריכה</b> של המתכון', 600, true);
  await tap(edit, { after: 900 });
  await hideDot();
  await reveal(page.getByText('שם המתכון'), 140, 900);
  await say('משנים שם, מצרכים, שלבים או תמונה – ולוחצים <b>שמירה</b>', 2800);
  await say('💡 טיפ: מספר המנות והסימונים נשמרים לכל מתכון, גם כשחוזרים אליו אחר כך', 3800);
}, { start: '#/r/r-shakshuka', mock: { recipes } });

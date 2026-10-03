import { record, demo } from '../kit.mjs';

// המתכון ש"נקרא" מהפתק בכתב היד (note.png)
const NOTE_RECIPE = {
  ...demo.NEW_RECIPE,
  id: 'r-grandma-spinach',
  title: 'פשטידת תרד של סבתא',
  description: 'הפשטידה של סבתא מהפתק בכתב היד – רכה, עם פטה וגבינה לבנה.',
  servings: '8 מנות',
  prepTime: '10 דקות',
  cookTime: '45 דקות',
  totalTime: '55 דקות',
  tags: ['צמחוני', 'של סבתא'],
  ingredients: [{ title: '', items: ['חצי קילו תרד', '4 ביצים', 'גביע גבינה לבנה', '150 גרם פטה', '2 כפות קמח'] }],
  steps: [{ title: '', items: ['מחממים תנור ל-180 מעלות.', 'מערבבים בקערה את כל המצרכים.', 'יוצקים לתבנית משומנת.', 'אופים 45 דקות עד שהפשטידה זהובה.'] }],
  tips: [],
  source: { kind: 'photo' },
};

await record('photo', async ({ page, say, tap, type, upload, wait, card, uncard, scroll }) => {
  await card('📸', 'מדריך 2', 'צילום מתכון', 'דף מספר בישול, פתק בכתב יד או צילום מסך – הופכים למתכון מסודר');
  await uncard();
  await say('לוחצים על הכפתור הכתום <b>צילום מתכון</b> שבתחתית המסך', 2600, true);
  await upload(page.locator('nav label'), page.locator('nav input[type=file]'), ['note.png']);
  await say('מצלמים את הדף – למשל פתק בכתב יד של סבתא', 2800, true);
  await say('אפשר להוסיף עד 4 תמונות של אותו מתכון, למשל שני עמודים', 2800, true);
  await say('ואם רוצים – כותבים הערה קטנה', 1600, true);
  await page.getByPlaceholder('הערה (לא חובה)', { exact: false }).waitFor();
  await type(page.getByPlaceholder('הערה (לא חובה)', { exact: false }), 'הפשטידה של סבתא', { delay: 60 });
  await say('לוחצים <b>בניית מתכון מהתמונות</b>', 1400, true);
  await tap(page.getByRole('button', { name: 'בניית מתכון מהתמונות' }), { after: 300 });
  await say('קוראים את כתב היד ומסדרים את המתכון… (כמה שניות)', 0, true);
  await page.getByRole('heading', { name: 'פשטידת תרד של סבתא' }).first().waitFor({ timeout: 15000 });
  await wait(600);
  await say('המתכון מוכן ונשמר בספר – עם מצרכים ושלבי הכנה', 3000, true);
  await scroll(450, 1600);
  await scroll(450, 1600);
  await say('💡 טיפ: צלמו באור טוב ומלמעלה, כך שכל הדף ייכנס לתמונה', 3800, true);
}, { mock: { newRecipe: NOTE_RECIPE } });

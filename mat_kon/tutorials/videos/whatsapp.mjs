import { record, demo } from '../kit.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHAT = join(HERE, '..', 'whatsapp-chat.txt');

const base = { ...demo.NEW_RECIPE, tips: [], tags: [] };
const COOKIES = {
  ...base, id: 'r-wa-cookies', title: 'עוגיות שוקולד צ\'יפס של רחל', category: 'עוגיות', description: 'עוגיות רכות עם שוקולד צ\'יפס, מהצ\'אט המשפחתי.',
  servings: '24 עוגיות', prepTime: '15 דקות', cookTime: '12 דקות', totalTime: '27 דקות',
  ingredients: [{ title: '', items: ['2 כוסות קמח', '1 כוס סוכר חום', '200 גרם חמאה רכה', '2 ביצים', '1 כפית אבקת אפייה', '200 גרם שוקולד צ\'יפס'] }],
  steps: [{ title: '', items: ['מחממים תנור ל-180 מעלות.', 'מערבבים חמאה וסוכר ומוסיפים ביצים, קמח ואבקת אפייה.', 'מקפלים פנימה את השוקולד ויוצרים כדורים.', 'אופים 12 דקות.'] }],
  source: { kind: 'whatsapp' },
};
const PASTA = {
  ...base, id: 'r-wa-pasta', title: 'פסטה קרמית עם פטריות', category: 'פסטה ואורז', description: 'פסטה בשמנת ופטריות, מהסרטון ששיתפה דנה.',
  servings: '4 מנות', totalTime: '25 דקות',
  ingredients: [{ title: '', items: ['500 גרם פסטה', '300 גרם פטריות', '1 מיכל שמנת לבישול', '2 שיני שום', 'פרמזן מגורר'] }],
  steps: [{ title: '', items: ['מבשלים את הפסטה.', 'מטגנים פטריות ושום.', 'מוסיפים שמנת ומבשלים 5 דקות.', 'מערבבים עם הפסטה ומגישים עם פרמזן.'] }],
  source: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=demo123' },
};

await record('whatsapp', async ({ page, mock, say, tap, wait, card, uncard, scroll, point, hideDot }) => {
  await card('💬', 'מדריך 5', 'ייבוא מווטסאפ', 'קבוצה משפחתית מלאה במתכונים? מייבאים אותם לספר בבת אחת', 3000);
  await card('📤', 'קודם מייצאים', 'ייצוא הצ\'אט מווטסאפ', 'בווטסאפ: ⋮ ← עוד ← ייצוא צ\'אט ← <b>ללא מדיה</b>. באייפון: לוחצים על שם הקבוצה ← ייצוא צ\'אט', 4600);
  await uncard();
  await say('במסך הראשי לוחצים על <b>ייבוא מווטסאפ</b>', 2200, true);
  mock.state.newRecipe = COOKIES;
  await tap(page.getByRole('link', { name: 'ייבוא מווטסאפ' }), { after: 600 });
  await say('כאן מופיעות ההוראות לייצוא הצ\'אט', 2400);
  await say('לוחצים <b>בחירת קובץ הצ\'אט</b> ובוחרים את הקובץ ששמרתם', 2600);
  await point(page.locator('label:has(input[accept*=".zip"])'), 500);
  await page.evaluate(() => window.__tut.press(195, 600));
  await wait(400);
  await page.locator('input[accept*=".zip"]').setInputFiles(join(HERE, '..', '.rec', 'WhatsApp Chat with Family Recipes.txt'));
  await hideDot();
  await page.getByText('נסרקו').waitFor({ timeout: 10000 });
  await say('האפליקציה סורקת את הצ\'אט בטלפון ומוצאת מתכונים כתובים וקישורים', 3600, true);
  await say('כל מה שנראה כמו מתכון כבר מסומן. אפשר לבחור או לבטל', 3000, true);
  await tap(page.getByRole('button', { name: 'ניקוי' }), { after: 700 });
  await say('נתחיל בעוגיות: מסמנים אותן', 1800, true);
  await tap(page.getByRole('button', { name: 'בחירה' }).first(), { after: 600 });
  await say('לוחצים על <b>ייבוא</b> בתחתית המסך', 1800, true);
  await tap(page.getByRole('button', { name: /^ייבוא 1 לספר/ }), { after: 300 });
  await say('המתכון נקרא ומסודר…', 0, true);
  await page.getByText('עוגיות שוקולד צ\'יפס של רחל').waitFor({ timeout: 15000 });
  await wait(1200);
  await say('מוכן! ועכשיו נוסיף גם את הסרטון שדנה שיתפה', 2800, true);
  mock.state.newRecipe = PASTA;
  await tap(page.getByRole('button', { name: 'בחירה' }).nth(1), { after: 600 });
  await tap(page.getByRole('button', { name: /^ייבוא 1 לספר/ }), { after: 300 });
  await page.getByText('פסטה קרמית עם פטריות').waitFor({ timeout: 15000 });
  await wait(800);
  await say('שני המתכונים נכנסו לספר. לוחצים על שם מתכון כדי לפתוח אותו', 3200, true);
  await tap(page.getByRole('link', { name: /עוגיות שוקולד/ }), { after: 1200 });
  await say('המתכון מהצ\'אט, מסודר עם מצרכים ושלבים', 2800, true);
  await say('💡 טיפ: באנדרואיד אפשר לשתף את הצ\'אט ישר ל-mat-kon מתפריט הייצוא', 3800, true);
}, { mock: { recipes: demo.RECIPES.filter((r) => r.id !== 'r-cookies') } });

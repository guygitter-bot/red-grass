import { record, demo } from '../kit.mjs';

await record('manual', async ({ page, say, tap, type, wait, card, uncard, scroll, point }) => {
  await card('✍️', 'מדריך 3', 'כתיבה ידנית', 'המתכון שלכם, בלי קישור ובלי תמונה – כותבים ושומרים');
  await uncard();
  await say('רוצים להוסיף מתכון משלכם? לוחצים על <b>כתיבה ידנית</b>', 2600, true);
  await tap(page.getByRole('link', { name: 'כתיבה ידנית' }), { after: 800 });
  await say('מתחילים בשם המתכון', 1200);
  await type(page.locator('label:has-text("שם המתכון") input'), 'עוגת תפוזים של אמא', { delay: 50 });
  await say('בוחרים קטגוריה וכמות', 1600);
  await tap(page.locator('label:has-text("קטגוריה") select'), { after: 200 });
  await page.locator('label:has-text("קטגוריה") select').selectOption('עוגות');
  await wait(600);
  await type(page.locator('label:has-text("כמות") input'), '10 פרוסות', { delay: 50 });
  await say('במצרכים כותבים <b>שורה לכל פריט</b>', 1600, true);
  await type(page.locator('label:has-text("מצרכים") textarea'), '3 תפוזים\n3 ביצים\n1 כוס סוכר\n1 כוס שמן\n2 כוסות קמח\n2 כפיות אבקת אפייה', { delay: 18 });
  await say('גם באופן ההכנה – שורה לכל שלב', 1600, true);
  await type(page.locator('label:has-text("אופן ההכנה") textarea'), 'מחממים תנור ל-180 מעלות\nטוחנים תפוזים שלמים בבלנדר\nמערבבים עם שאר המצרכים\nאופים 40 דקות', { delay: 18 });
  await say('אפשר גם להוסיף טיפ, ותמונה של העוגה', 2400, true);
  await type(page.locator('label:has-text("טיפים") textarea'), 'טעימה במיוחד עם קצפת', { delay: 40 });
  await say('לוחצים <b>שמירת המתכון</b>', 1200, true);
  await tap(page.getByRole('button', { name: 'שמירת המתכון' }), { after: 800 });
  await page.getByRole('heading', { name: 'עוגת תפוזים של אמא' }).first().waitFor({ timeout: 10000 });
  await say('המתכון נשמר בספר, בקטגוריה שבחרתם', 2800);
  await scroll(450, 1500);
  await say('💡 טיפ: שורה שמתחילה ב-## פותחת קטע חדש, למשל "## לציפוי"', 3800, true);
});

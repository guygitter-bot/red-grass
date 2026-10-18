// סרטון לבעל האתר: ייבוא מוצרים מערוץ הטלגרם (במחשב) – תיקיית הייצוא, סינון תאריכים, ייבוא כטיוטות ופרסום
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARK, PASSWORD, record } from '../kit.mjs';

// ייצוא מדומה כמו של Telegram Desktop: result.json + photos/
function fakeExport(imgDir, tmp) {
  const dir = join(tmp, 'ChatExport_iSport');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'photos'), { recursive: true });
  const ago = (days) => {
    const d = new Date(Date.now() - days * 864e5);
    return { date: d.toISOString().slice(0, 19), date_unixtime: String(Math.floor(d / 1000)) };
  };
  let n = 0;
  const photo = (img) => {
    n += 1;
    copyFileSync(join(imgDir, `${img}.png`), join(dir, 'photos', `photo_${n}.jpg`));
    return `photos/photo_${n}.jpg`;
  };
  const post = (id, days, imgs, text) => {
    const t = ago(days);
    return imgs.map((img, i) => ({ id: id + i, type: 'message', ...t, photo: photo(img), text: i === imgs.length - 1 ? text : '' }));
  };
  const link = (url) => ({ type: 'link', text: url });
  const messages = [
    ...post(100, 35, ['s0'], ['ליברפול בית 2026\nלינק: ', link('https://store.flylinking.com/g/LIV26'), '\nקוד: Liverpool-Home-26-Red']),
    ...post(200, 10, ['s4', 's4b'], ['ברזיל 2026 – חולצת הבית\nלינק ישיר לרכישה: ', link('https://store.flylinking.com/g/BRA26'), '\nקוד: Brazil-H-26']),
    ...post(300, 4, ['s2', 's2b'], ['חולצת הפרידה של ליונל מסי\nלינק: ', link('https://t.me/Sportv4Us/9294'), '\nקוד: Messi-Tribute-27\nשרוול ארוך: Messi-Tribute-27-LongSleeve']),
    ...post(400, 2, ['rm-front', 'rm-back', 'rm-other'], [
      "בוקה ג'וניורס 2027\nבכל הגרסאות\n\nלינק ישיר לרכישה: ", link('https://store.flylinking.com/g/M2Q8AJ5C10'),
      '\n\nקודים:\nכחול BocaJuniors-H-27 (Home)\nלבן BocaJuniors-A-27 (Away)\n\nAdd League Patches',
    ]),
  ];
  writeFileSync(join(dir, 'result.json'), JSON.stringify({ name: 'iSport', type: 'public_channel', messages }));
  return dir;
}

await record('import', async ({ page, say, tap, type, wait, card, uncard, scrollTo, point, hideDot, imgDir, tmp }) => {
  const dir = fakeExport(imgDir, tmp);
  await card(MARK, 'ניהול', 'ייבוא מטלגרם', 'מוצרים מהערוץ לאתר – בכמה לחיצות');
  await uncard();
  await type(page.getByPlaceholder('סיסמה'), PASSWORD, { delay: 30 });
  await tap(page.getByRole('button', { name: 'כניסה' }), { after: 1000 });
  await say('במסך הניהול לוחצים <b>ייבוא מטלגרם</b>', 2200);
  await tap(page.getByRole('link', { name: 'ייבוא מטלגרם' }), { after: 1000 });
  await say('קודם מייצאים את הערוץ מ-Telegram Desktop במחשב. ההוראות כתובות כאן', 3600);
  await point(page.locator('ol li').nth(1), 1200);
  await say('מסמנים Photos בפורמט JSON, ואפשר לבחור כבר שם טווח תאריכים', 3600);
  await point(page.locator('ol li').nth(2), 1200);
  await say('ואז בוחרים את התיקייה שטלגרם יצר', 2400);
  const pick = page.getByText('בחירת תיקיית הייצוא');
  const { x, y } = await point(pick, 600);
  await page.evaluate(([a, b]) => window.__tut.press(a, b), [x, y]);
  await page.locator('input[type=file]').setInputFiles(dir);
  await page.getByText('BocaJuniors-H-27').waitFor();
  await wait(800);
  await say('כל קוד מוצר מההודעות מופיע כאן – עם התמונות, התאריך והקישור', 3600);
  await say('מסננים לפי תאריכים – למשל רק החודש האחרון', 2600);
  await tap(page.getByRole('button', { name: 'חודש' }), { after: 1000 });
  await say('קוד שכבר באתר לא מסומן, וגם רואים מיד אם חסר קישור FlyLinking', 3800);
  await point(page.getByText('אין קישור FlyLinking').first(), 1400);
  await say('מורידים סימון ממה שלא רוצים לייבא', 2400);
  await tap(page.locator('label', { hasText: 'Brazil-H-26' }).locator('input[type=checkbox]'), { after: 800 });
  await say('ולוחצים <b>ייבוא</b>', 1400);
  await tap(page.getByRole('button', { name: /^ייבוא \d+ מוצרים/ }), { after: 300 });
  await page.getByText(/יובאו \d+ טיוטות/).waitFor({ timeout: 30000 });
  await wait(600);
  await say('כל מוצר נשמר כטיוטה מוסתרת, עם הקוד המדויק מהערוץ', 3400);
  await hideDot();
  await page.evaluate(() => { window.location.hash = '#/admin'; });
  await wait(1000);
  await tap(page.getByRole('button', { name: 'מוסתרים' }), { after: 900 });
  await say('עוברים על הטיוטות, מתקנים מה שצריך ומפרסמים', 3000);
  await tap(page.getByText('BocaJuniors-H-27'), { after: 1200 });
  await say('בהודעה עם כמה קודים, כל מוצר מקבל את כל התמונות – מוחקים את אלה שלא שלו', 4400);
  await point(page.locator('img[src*="/img/img-"]').last(), 1200);
  await tap(page.locator('button[title="הסרה"]').last(), { after: 900 });
  await say('ולוחצים <b>שמירה ופרסום באתר</b>', 2000);
  await tap(page.getByRole('button', { name: 'שמירה ופרסום באתר' }), { after: 1200 });
  await say('החולצה כבר באתר!', 2200);
  await say('💡 טיפ: השלמה אוטומטית בייבוא עולה כסף, ולכן היא כבויה. אפשר להפעיל אותה רק למוצרים שצריך', 4800);
  await card(MARK, 'ניהול', 'זהו!', 'מהערוץ לאתר בכמה דקות', 2600);
}, { start: '#/admin', desktop: true });

import { record } from '../kit.mjs';

await record('plan', async ({ page, say, tap, type, wait, card, uncard, scroll, hideDot, unsay, go }) => {
  await card('📅', 'מדריך 12', 'תכנון שבועי', 'מחליטים מה מבשלים השבוע, וקונים הכל בלחיצה אחת');
  await uncard();
  await say('בתפריט למטה לוחצים <b>תכנון שבועי</b>', 1400);
  await tap(page.getByRole('link', { name: 'תכנון שבועי' }), { after: 1000 });
  await say('כל יום בשבוע בכרטיס משלו', 2400, true);
  await say('לוחצים על <b>+</b> ליד היום שרוצים', 1200, true);
  await tap(page.getByRole('button', { name: 'הוספת ארוחה' }).nth(2), { after: 900 });
  await say('בוחרים סוג ארוחה', 1500, true);
  await tap(page.getByRole('button', { name: 'ארוחת צהריים' }), { after: 700 });
  await say('ובוחרים מתכון מהספר. אפשר גם לכתוב ארוחה חופשית', 2200, true);
  await tap(page.getByRole('button', { name: /עוף בתנור/ }), { after: 1400 });
  await hideDot();
  await say('המתכון נכנס ליום שבחרתם', 2200);
  await say('אפשר גם מתוך דף המתכון – לוחצים על <b>לוח השנה</b> למעלה', 2200, true);
  await go('#/r/r-shakshuka');
  await tap(page.getByRole('button', { name: 'הוספה לתכנון השבועי' }), { after: 900 });
  await say('בוחרים יום, למשל <b>מחר</b>', 1800, true);
  await tap(page.getByRole('button', { name: /מחר/ }), { after: 1200 });
  await hideDot();
  await go('#/plan');
  await say('השקשוקה מחכה למחר בתכנון', 2200, true);
  await say('מדפדפים בין שבועות עם החצים למעלה', 1200);
  await tap(page.getByRole('button', { name: 'שבוע הבא' }), { after: 1500 });
  await tap(page.getByRole('button', { name: 'שבוע קודם' }), { after: 1200 });
  await say('ועכשיו הקסם: <b>רשימת קניות לכל השבוע</b>', 1400);
  await tap(page.getByRole('button', { name: /רשימת קניות לכל השבוע/ }), { after: 1500 });
  await say('כל המצרכים של כל המתכונים נוספו לרשימת הקניות, בלי כפילויות', 3000);
  await hideDot();
  await say('💡 טיפ: מה שכבר יש במקרר ובמזווה אפשר להוריד מהרשימה לפני שיוצאים לקנות', 3800);
}, { start: '#/', mock: { plan: (() => {
  const d = new Date(); const day = d.getDay(); const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const key = (n) => { const x = new Date(s.getFullYear(), s.getMonth(), s.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  return [{ id: 'pl1', day: key(0), recipeId: 'r-pasta', title: 'פסטה', meal: 'ארוחת ערב' }];
})() } });

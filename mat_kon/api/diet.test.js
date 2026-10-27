import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanDiet, dietBadges, dietInfo, matchesDiets, recipeDiet } from './diet.js';

const ids = (items, extra) => Object.entries(dietInfo(items, extra)).filter(([, v]) => v).map(([k]) => k).sort();

test('diet: the server and app copies are identical', () => {
  assert.equal(readFileSync(new URL('./diet.js', import.meta.url), 'utf8'), readFileSync(new URL('../web/src/lib/diet.js', import.meta.url), 'utf8'));
});

test('diet: kosher, parve, dairy and meat by ingredients', () => {
  const cake = dietInfo(['2 ביצים', '1 כוס קמח', '100 גרם חמאה', 'חלב']);
  assert.deepEqual([cake.kosher, cake.dairy, cake.parve, cake.meat, cake.gf], [true, true, false, false, false]);
  const cheeseburger = dietInfo(['המבורגר', 'פרוסת גבינה צהובה']);
  assert.deepEqual([cheeseburger.kosher, cheeseburger.meat, cheeseburger.dairy], [false, false, false]);
  assert.equal(dietInfo(['שרימפס', 'שום']).kosher, false);
  assert.equal(dietInfo(['חזה עוף', 'פילה סלמון']).kosher, false);
  // לא מתבלבלים: חלבון ביצה, חמאת בוטנים, חלב קוקוס, מלפפונים כבושים, דגני בוקר
  const parve = dietInfo(['2 חלבונים', 'חמאת בוטנים', 'חלב קוקוס', 'מלפפונים כבושים', 'דגני בוקר']);
  assert.deepEqual([parve.parve, parve.kosher, parve.vegetarian], [true, true, true]);
});

test('diet: gluten free vs celiac, lactose, eggs, nuts, vegan', () => {
  const salad = ['עגבניות', 'מלפפון', 'שמן זית', 'רוטב סויה ללא גלוטן'];
  assert.deepEqual(ids(salad), ['celiac', 'eggs', 'gf', 'kosher', 'lactose', 'nosugar', 'nuts', 'parve', 'pesach', 'vegan', 'vegetarian']);
  // שיבולת שועל ואבקת מרק: בלי גלוטן ברור, אבל לא לצליאקים
  const soup = dietInfo(['גזר', 'אבקת מרק', 'שיבולת שועל ללא גלוטן']);
  assert.deepEqual([soup.gf, soup.celiac], [true, false]);
  assert.equal(dietInfo(['קמח רגיל']).celiac, false);
  assert.equal(dietInfo(['קמח שקדים', 'קמח תירס']).gf, true);
  assert.equal(dietInfo(['חלב ללא לקטוז']).lactose, true);
  assert.equal(dietInfo(['שמנת מתוקה']).lactose, false);
  assert.equal(dietInfo(['אגוזי מלך']).nuts, false);
  assert.equal(dietInfo(['קורט אגוז מוסקט']).nuts, true);
  assert.equal(dietInfo(['דבש']).vegan, false);
  assert.equal(dietInfo(['דבש תמרים']).vegan, true);
  assert.equal(dietInfo(['ג\'לטין']).vegetarian, false);
});

test('diet: nutrition and time filters only when known', () => {
  assert.deepEqual(ids(['ביצה'], { nutrition: { calories: 300, protein: 25, carbs: 5 }, minutes: 20 }).filter((k) => ['light', 'lowcarb', 'protein', 'quick'].includes(k)), ['light', 'lowcarb', 'protein', 'quick']);
  assert.deepEqual(ids(['ביצה']).filter((k) => ['light', 'lowcarb', 'protein', 'quick'].includes(k)), []);
  assert.equal(matchesDiets(dietInfo(['ביצה']), ['parve', 'gf']), true);
  assert.equal(matchesDiets(dietInfo(['ביצה']), ['vegan']), false);
  assert.equal(matchesDiets(dietInfo(['ביצה']), ['unknown']), true);
});

test('diet: Passover, sugar, salt, babies and equipment', () => {
  const kugel = dietInfo(['קמח מצה', 'ביצים', 'שמן']);
  assert.deepEqual([kugel.pesach, kugel.kitniyot, kugel.gf], [true, true, false]);
  assert.deepEqual([dietInfo(['אורז', 'גזר']).pesach, dietInfo(['אורז', 'גזר']).kitniyot], [true, false]);
  assert.equal(dietInfo(['קמח רגיל', 'שמרים']).pesach, false);
  assert.equal(dietInfo(['2 כפות סוכר']).nosugar, false);
  assert.equal(dietInfo(['ממתיק סטיביה', 'קמח שקדים']).nosugar, true);
  assert.equal(dietInfo(['2 כפות רוטב סויה']).lowsodium, false);
  assert.equal(dietInfo(['2 כפות רוטב סויה'], { nutrition: { sodium: 300 } }).lowsodium, true);
  assert.equal(dietInfo(['קורט מלח', 'בטטה']).lowsodium, true);
  assert.equal(dietInfo(['דבש', 'יוגורט']).baby, false);
  assert.equal(dietInfo(['בטטה', 'גזר', 'שמן זית']).baby, true);
  const air = dietInfo(['חזה עוף'], { steps: ['מתבלים', 'אופים באייר פרייר 15 דקות'] });
  assert.deepEqual([air.airfryer, air.nooven, air.pressure], [true, true, false]);
  assert.equal(dietInfo(['קמח'], { steps: ['אופים בתנור 180 מעלות'] }).nooven, false);
  assert.equal(dietInfo(['קמח'], { steps: ['מבשלים בסיר לחץ'] }).pressure, true);
});

test('diet: the AI marking wins until the ingredients are edited', () => {
  const ingredients = [{ title: '', items: ['רוטב מיוחד', 'ירקות'] }];
  const diet = cleanDiet({ gf: false, kosher: true, junk: 'x' }, ingredients[0].items);
  assert.deepEqual(Object.keys(diet).sort(), ['gf', 'kosher', 'of']);
  assert.equal(recipeDiet({ ingredients, diet }).gf, false);
  // עריכה של המצרכים – חוזרים להערכה לפי המילים
  assert.equal(recipeDiet({ ingredients: [{ title: '', items: ['רוטב מיוחד', 'ירקות', 'מלח'] }], diet }).gf, true);
  assert.equal(cleanDiet(null, []), null);
  assert.deepEqual(dietBadges(dietInfo(['טופו', 'ירקות'], { minutes: 20, steps: ['מטגנים באייר פרייר'] })), ['פרווה', 'מתאים לצליאקים', 'טבעוני', 'ללא סוכר', 'עד 30 דקות', 'אייר פרייר']);
});

// סינון מתכונים לפי כשרות, רגישויות, תזונה וזמן – הערכה לפי המצרכים (לא תעודת כשרות ולא אישור רפואי).
// הקובץ זהה ב-api/diet.js וב-web/src/lib/diet.js (בדיקה בשרת מוודאת שהם זהים) – לשנות בשניהם.

// הסינונים, לפי קבוצות (הסדר כאן = הסדר במסך)
export const DIETS = [
  { id: 'kosher', label: 'כשר', group: 'כשרות' },
  { id: 'parve', label: 'פרווה', group: 'כשרות' },
  { id: 'dairy', label: 'חלבי', group: 'כשרות' },
  { id: 'meat', label: 'בשרי', group: 'כשרות' },
  { id: 'gf', label: 'ללא גלוטן', group: 'רגישויות' },
  { id: 'celiac', label: 'מתאים לצליאקים', group: 'רגישויות' },
  { id: 'lactose', label: 'ללא לקטוז', group: 'רגישויות' },
  { id: 'eggs', label: 'ללא ביצים', group: 'רגישויות' },
  { id: 'nuts', label: 'ללא אגוזים ובוטנים', group: 'רגישויות' },
  { id: 'vegan', label: 'טבעוני', group: 'תזונה וזמן' },
  { id: 'vegetarian', label: 'צמחוני', group: 'תזונה וזמן' },
  { id: 'protein', label: 'עשיר בחלבון', group: 'תזונה וזמן' },
  { id: 'lowcarb', label: 'דל פחמימות', group: 'תזונה וזמן' },
  { id: 'light', label: 'עד 400 קלוריות', group: 'תזונה וזמן' },
  { id: 'quick', label: 'עד 30 דקות', group: 'תזונה וזמן' },
];
export const DIET_IDS = DIETS.map((d) => d.id);

const MEAT = /(בשר|עוף|עופות|פרגית|חזה|שוקיים|כנפיים|הודו|כבש(?!ו|ים)|טלה|בקר|אנטריקוט|סינטה|נקניק|קבב|שניצל|קציצ|המבורגר|כבד|פסטרמה|סלמי|ציר עוף|מרק עוף|אווז|ברווז|חזיר|בייקון)/;
const NOT_MEAT = /(צמחי|טבעונ|סויה|תחליף|ללא בשר|פטריות|אגוז הודו)/;
const DAIRY = /(גבינ|חמאה(?!\s*(בוטנים|שקדים|קקאו|אגוזים|קשיו))|שמנת(?!\s*(צמחית|קוקוס))|יוגורט|קוטג|לבנה|פרמזן|מוצרלה|ריקוטה|מסקרפונה|צהובה|בולגרית|פטה|חלב(?!ון|ונ|ה|\s*(קוקוס|שקדים|סויה|שיבולת|אורז|צמחי|מרוכז צמחי)))/;
const NOT_DAIRY = /(טבעונ|צמחי|פרווה)/;
const FISH = /(דג(?!נ|ן)|סלמון|טונה|אנשובי|סרדינ|בקלה|אמנון|לברק|דניס|מושט|הרינג|מקרל)/;
// לא כשר בכל מקרה
const TREIF = /(חזיר|בייקון(?!\s*(הודו|טבעוני|צמחי))|לארד|שרימפ|סרטן|סרטנים|לובסטר|קלמרי|תמנון|צדפ|מולים|פירות ים|אויסטר|סקלופ)/;
const ANIMAL = /(ביצ|חלמון|דבש|ג'לטין|ז'לטין|ג׳לטין)/;
const GLUTEN = /(קמח(?!\s*(תירס|אורז|שקדים|כוסמת|תפוח|חומוס|קוקוס|תפו"א|תפוחי אדמה|טפיוקה))|לחם|פסטה|ספגטי|אטריות|פירורי|סולת|בורגול|קוסקוס|פתיתים|בצק|טורטי|פיתה|לחמני|פריכיות|שיבולת שועל|קוואקר|שעורה|כוסמין|בירה|רוטב סויה|מצה|פנקו|קרקר|ביסקוויט|עוגיות|ופל)/;
// צליאק: גם מה שבדרך כלל מכיל גלוטן נסתר, ושיבולת שועל
const CELIAC = /(שיבולת|קוואקר|גרנולה|מאלט|לתת|סייטן|אבקת מרק|קוביית ציר|קוביות ציר|ציר מוכן|קורנפלקס|רוטב ברביקיו|רוטב טריאקי|רוטב צדפות|ווסטרשייר|תערובת תבלינים|שקדי מרק|קרוטונים|רוטב סויה)/;
const GF_SAFE = /(ללא גלוטן|נטול גלוטן|טמארי)/;
const EGGS = /(ביצ|חלמון|חלבון ביצה|חלבונים|מיונז)/;
const NUTS = /(אגוז(?!\s*מוסקט)|אגוזי|בוטנ|שקד(?!י מרק)|פקאן|קשיו|פיסטוק|מקדמיה|נוגט|פרלין|מרציפן|פרלינה|נוטלה)/;
const LACTOSE_SAFE = /(ללא לקטוז|נטול לקטוז)/;

const any = (items, re, safe) => items.some((i) => re.test(i) && !(safe && safe.test(i)));

// זמן הכנה בדקות מתוך טקסט בעברית ("45 דקות", "שעה וחצי", "1.5 שעות")
export function parseMinutes(text) {
  const t = String(text || '');
  if (!t) return null;
  let minutes = 0;
  const hours = t.match(/(\d+(?:\.\d+)?)\s*(?:שעות|שעה|ש['׳]|hours?|h\b)/i);
  if (hours) minutes += Number(hours[1]) * 60;
  else if (/שעתיים/.test(t)) minutes += 120;
  else if (/שעה/.test(t)) minutes += 60;
  if (/וחצי/.test(t) && /שע/.test(t)) minutes += 30;
  if (/ורבע/.test(t) && /שע/.test(t)) minutes += 15;
  const mins = t.match(/(\d+)\s*(?:דקות|דק['׳]?|דקה|min)/i);
  if (mins) minutes += Number(mins[1]);
  return minutes || null;
}

export function recipeMinutes(r) {
  const total = parseMinutes(r.totalTime);
  if (total) return total;
  const parts = [parseMinutes(r.prepTime), parseMinutes(r.cookTime)].filter(Boolean);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

// מה המתכון לפי המצרכים. items: שורות המצרכים; extra: ערכים תזונתיים (למנה) וזמן בדקות, אם ידועים
export function dietInfo(items, { nutrition = null, minutes = null } = {}) {
  const list = (items || []).map((i) => String(i || '')).filter(Boolean);
  const meat = any(list, MEAT, NOT_MEAT);
  const dairy = any(list, DAIRY, NOT_DAIRY);
  const fish = any(list, FISH);
  const treif = any(list, TREIF, /(טבעוני|צמחי)/);
  const n = (k) => (nutrition && Number(nutrition[k]) >= 0 && nutrition[k] !== null && nutrition[k] !== '' ? Number(nutrition[k]) : null);
  return {
    // כשר: בלי מאכלות אסורים, בלי בשר וחלב יחד ובלי בשר ודגים יחד
    kosher: !treif && !(meat && dairy) && !(meat && fish),
    parve: !meat && !dairy && !treif,
    dairy: dairy && !meat && !treif,
    meat: meat && !dairy && !treif,
    gf: !any(list, GLUTEN, GF_SAFE),
    celiac: !any(list, GLUTEN, GF_SAFE) && !any(list, CELIAC, GF_SAFE),
    lactose: !any(list, DAIRY, new RegExp(`${NOT_DAIRY.source}|${LACTOSE_SAFE.source}`)),
    eggs: !any(list, EGGS, /(טבעונ|ללא ביצים)/),
    nuts: !any(list, NUTS),
    vegan: !meat && !dairy && !fish && !treif && !any(list, ANIMAL, /(טבעונ|תחליף|תמרים|סילאן)/),
    vegetarian: !meat && !fish && !treif && !any(list, /(ג'לטין|ז'לטין|ג׳לטין)/),
    protein: n('protein') !== null && n('protein') >= 20,
    lowcarb: n('carbs') !== null && n('carbs') <= 15,
    light: n('calories') !== null && n('calories') > 0 && n('calories') <= 400,
    quick: Boolean(minutes) && minutes <= 30,
  };
}

export const recipeDiet = (r) =>
  dietInfo((r.ingredients || []).flatMap((s) => s.items || []), { nutrition: r.nutrition, minutes: recipeMinutes(r) });

// האם המתכון מתאים לכל הסינונים שנבחרו
export function matchesDiets(info, ids) {
  return (ids || []).every((id) => !DIET_IDS.includes(id) || info[id]);
}

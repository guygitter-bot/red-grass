// סינון מתכונים לפי כשרות, רגישויות, תזונה, זמן וציוד – הערכה לפי המצרכים (לא תעודת כשרות ולא אישור רפואי).
// מתכון שה-AI בנה מקבל גם סימון של ה-AI (r.diet), שגובר על ההערכה כל עוד המצרכים לא נערכו (טביעת אצבע of).
// הקובץ זהה ב-api/diet.js וב-web/src/lib/diet.js (בדיקה בשרת מוודאת שהם זהים) – לשנות בשניהם.

// הסינונים, לפי קבוצות (הסדר כאן = הסדר במסך)
export const DIETS = [
  { id: 'kosher', label: 'כשר', group: 'כשרות' },
  { id: 'parve', label: 'פרווה', group: 'כשרות' },
  { id: 'dairy', label: 'חלבי', group: 'כשרות' },
  { id: 'meat', label: 'בשרי', group: 'כשרות' },
  { id: 'pesach', label: 'כשר לפסח (בלי חמץ)', group: 'כשרות' },
  { id: 'kitniyot', label: 'לפסח בלי קטניות', group: 'כשרות' },
  { id: 'gf', label: 'ללא גלוטן', group: 'רגישויות' },
  { id: 'celiac', label: 'מתאים לצליאקים', group: 'רגישויות' },
  { id: 'lactose', label: 'ללא לקטוז', group: 'רגישויות' },
  { id: 'eggs', label: 'ללא ביצים', group: 'רגישויות' },
  { id: 'nuts', label: 'ללא אגוזים ובוטנים', group: 'רגישויות' },
  { id: 'nosugar', label: 'ללא סוכר', group: 'רגישויות' },
  { id: 'lowsodium', label: 'דל מלח', group: 'רגישויות' },
  { id: 'baby', label: 'מתאים לתינוקות ופעוטות', group: 'רגישויות' },
  { id: 'vegan', label: 'טבעוני', group: 'תזונה וזמן' },
  { id: 'vegetarian', label: 'צמחוני', group: 'תזונה וזמן' },
  { id: 'protein', label: 'עשיר בחלבון', group: 'תזונה וזמן' },
  { id: 'lowcarb', label: 'דל פחמימות', group: 'תזונה וזמן' },
  { id: 'light', label: 'עד 400 קלוריות', group: 'תזונה וזמן' },
  { id: 'quick', label: 'עד 30 דקות', group: 'תזונה וזמן' },
  { id: 'pressure', label: 'בסיר לחץ', group: 'ציוד' },
  { id: 'airfryer', label: 'באייר פרייר', group: 'ציוד' },
  { id: 'nooven', label: 'בלי תנור', group: 'ציוד' },
];
export const DIET_IDS = DIETS.map((d) => d.id);
// מה שה-AI מסמן בזמן בניית המתכון (לפי המצרכים). ערכים תזונתיים, זמן וציוד – תמיד מחושבים
export const AI_DIETS = ['kosher', 'parve', 'dairy', 'meat', 'pesach', 'kitniyot', 'gf', 'celiac', 'lactose', 'eggs', 'nuts', 'nosugar', 'lowsodium', 'baby', 'vegan', 'vegetarian'];

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
// פסח: חמץ (מצה וקמח מצה מותרים), וקטניות למי שלא אוכל
const PESACH_SAFE = /(מצה|מצות|כשר לפסח|ללא גלוטן|נטול גלוטן|קמח שקדים|קמח קוקוס|קמח תפו|קמח תפוחי אדמה)/;
const KITNIYOT = /(אורז|תירס|קורנפלור|עמילן תירס|עדש|שעועית|חומוס|אפונ|סויה|אדממה|בוטנ|במבה|שומשום|טחינ|(^|\s)פול(\s|$)|קטניות|דוחן|כוסמת|חרדל|קנולה|קימל)/;
const SUGAR = /(סוכר|דבש|סילאן|סירופ|מייפל|ריבה|קרמל|ממרח שוקולד|נוטלה|שוקולד(?!\s*מריר\s*[89])|סוכריות|מרשמלו|חלב מרוכז|קונפיטורה|ג'לי|ג׳לי|רוטב צ'ילי מתוק|קטשופ)/;
const SUGAR_SAFE = /(ללא סוכר|תחליף סוכר|ממתיק|סטיביה|אריתריטול|סוכרלוז|קסיליטול)/;
const HIGH_SALT = /(רוטב סויה|טמארי|אבקת מרק|קוביית ציר|קוביות ציר|ציר מוכן|זיתים|מלפפון חמוץ|חמוצים|כבושים|בולגרית|פטה|פרמזן|נקניק|סלמי|פסטרמה|אנשובי|דג מלוח|הרינג|צלפים|מיסו|רוטב דגים|מלח[^\d]{0,15}(כף|כפות)|(כף|כפות)[^\d]{0,6}מלח)/;
const BABY_NO = /(דבש|יין|וודקה|ליקר|ברנדי|רום|קוניאק|ויסקי|בירה|צ'ילי|צ׳ילי|חריף|חריפה|סחוג|הריסה|פלפל חריף|קפה|אספרסו|נקניק|סלמי|פסטרמה|בייקון)/;
// ציוד – לפי שלבי ההכנה
const PRESSURE = /(סיר לחץ|אינסטנט פוט|instant pot|נינג'ה פודי|נינג׳ה פודי)/i;
const AIRFRYER = /(אייר ?פרייר|air ?fryer|סיר טיגון ללא שמן|סיר טיגון באוויר)/i;
const OVEN = /(תנור|אופים|לאפות|אפייה|אפיה|נאפה|נאפית|גריל עליון)/;

// טביעת אצבע של המצרכים: סימון ה-AI תקף רק לאותם מצרכים (אחרי עריכה – חוזרים להערכה)
export function ingredientsPrint(items) {
  let h = 5381;
  for (const ch of (items || []).map((i) => String(i || '').trim()).join('\n')) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
}

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

// מה המתכון לפי המצרכים. items: שורות המצרכים; extra: ערכים תזונתיים (למנה), זמן בדקות, שלבי ההכנה, וסימון ה-AI – אם ידועים
export function dietInfo(items, { nutrition = null, minutes = null, steps = null, ai = null } = {}) {
  const list = (items || []).map((i) => String(i || '')).filter(Boolean);
  const meat = any(list, MEAT, NOT_MEAT);
  const dairy = any(list, DAIRY, NOT_DAIRY);
  const fish = any(list, FISH);
  const treif = any(list, TREIF, /(טבעוני|צמחי)/);
  const n = (k) => (nutrition && Number(nutrition[k]) >= 0 && nutrition[k] !== null && nutrition[k] !== '' ? Number(nutrition[k]) : null);
  const sugar = any(list, SUGAR, SUGAR_SAFE);
  const salty = any(list, HIGH_SALT, /(דל נתרן|מופחת נתרן|ללא מלח)/);
  const chametz = any(list, GLUTEN, PESACH_SAFE) || any(list, /(שמרים|שיבולת|קוואקר|גרנולה|מאלט|לתת)/, /כשר לפסח/);
  const nuts = any(list, NUTS);
  const stepList = (steps || []).map((i) => String(i || '')).filter(Boolean);
  const info = {
    // כשר: בלי מאכלות אסורים, בלי בשר וחלב יחד ובלי בשר ודגים יחד
    kosher: !treif && !(meat && dairy) && !(meat && fish),
    parve: !meat && !dairy && !treif,
    dairy: dairy && !meat && !treif,
    meat: meat && !dairy && !treif,
    pesach: !treif && !(meat && dairy) && !chametz,
    kitniyot: !treif && !(meat && dairy) && !chametz && !any(list, KITNIYOT, /כשר לפסח/),
    gf: !any(list, GLUTEN, GF_SAFE),
    celiac: !any(list, GLUTEN, GF_SAFE) && !any(list, CELIAC, GF_SAFE),
    lactose: !any(list, DAIRY, new RegExp(`${NOT_DAIRY.source}|${LACTOSE_SAFE.source}`)),
    eggs: !any(list, EGGS, /(טבעונ|ללא ביצים)/),
    nuts: !nuts,
    nosugar: !sugar,
    // דל מלח: לפי הנתרן (עד 400 מ"ג למנה) אם ידוע, אחרת בלי מצרכים מלוחים במיוחד
    lowsodium: n('sodium') !== null ? n('sodium') <= 400 : !salty,
    // תינוקות ופעוטות: בלי דבש, אלכוהול, חריף, קפה, נקניקים, סוכר, הרבה מלח ואגוזים שלמים
    baby: !any(list, BABY_NO, /(ללא|בלי)/) && !sugar && !salty && !any(list, NUTS, /(חמאת|ממרח|טחונ|קמח)/),
    vegan: !meat && !dairy && !fish && !treif && !any(list, ANIMAL, /(טבעונ|תחליף|תמרים|סילאן)/),
    vegetarian: !meat && !fish && !treif && !any(list, /(ג'לטין|ז'לטין|ג׳לטין)/),
    protein: n('protein') !== null && n('protein') >= 20,
    lowcarb: n('carbs') !== null && n('carbs') <= 15,
    light: n('calories') !== null && n('calories') > 0 && n('calories') <= 400,
    quick: Boolean(minutes) && minutes <= 30,
    pressure: stepList.some((t) => PRESSURE.test(t)),
    airfryer: stepList.some((t) => AIRFRYER.test(t)),
    nooven: stepList.length > 0 && !stepList.some((t) => OVEN.test(t) && !AIRFRYER.test(t)),
  };
  // סימון ה-AI (כשהמצרכים לא השתנו מאז) גובר על ההערכה
  if (ai && typeof ai === 'object' && ai.of === ingredientsPrint(list)) {
    for (const k of AI_DIETS) if (typeof ai[k] === 'boolean') info[k] = ai[k];
  }
  return info;
}

export const recipeDiet = (r) => {
  const items = (r.ingredients || []).flatMap((s) => s.items || []);
  return dietInfo(items, { nutrition: r.nutrition, minutes: recipeMinutes(r), steps: (r.steps || []).flatMap((s) => s.items || []), ai: r.diet });
};

// סימון ה-AI כפי שנשמר במתכון (עם טביעת האצבע של המצרכים)
export function cleanDiet(raw, items) {
  if (!raw || typeof raw !== 'object') return null;
  const out = { of: ingredientsPrint((items || []).map((i) => String(i || '')).filter(Boolean)) };
  for (const k of AI_DIETS) if (typeof raw[k] === 'boolean') out[k] = raw[k];
  return Object.keys(out).length > 1 ? out : null;
}

// מה להציג בדף המתכון (קצר): סוג כשרות, גלוטן, טבעוני/צמחוני, זמן וציוד
export function dietBadges(info) {
  const out = [];
  if (info.parve) out.push('פרווה');
  else if (info.dairy) out.push('חלבי');
  else if (info.meat) out.push('בשרי');
  if (!info.kosher) out.push('לא כשר');
  if (info.celiac) out.push('מתאים לצליאקים');
  else if (info.gf) out.push('ללא גלוטן');
  if (info.vegan) out.push('טבעוני');
  else if (info.vegetarian) out.push('צמחוני');
  if (info.nosugar) out.push('ללא סוכר');
  if (info.quick) out.push('עד 30 דקות');
  if (info.airfryer) out.push('אייר פרייר');
  if (info.pressure) out.push('סיר לחץ');
  return out;
}

// האם המתכון מתאים לכל הסינונים שנבחרו
export function matchesDiets(info, ids) {
  return (ids || []).every((id) => !DIET_IDS.includes(id) || info[id]);
}

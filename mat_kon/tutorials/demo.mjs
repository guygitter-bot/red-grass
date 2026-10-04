// נתוני דמו לסרטוני ההדרכה: ספר מתכונים קטן, רשימת קניות, מקרר ומזווה. לא נוגעים בשרת האמיתי.

// "תמונה" של מנה: רקע צבעוני, צלחת ואימוג'י
export function dishImage(emoji, from, to) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<radialGradient id="p" cx=".5" cy=".45" r=".5"><stop offset=".7" stop-color="#ffffff"/><stop offset="1" stop-color="#e7e5e4"/></radialGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<circle cx="400" cy="310" r="230" fill="#000" opacity=".12"/>
<circle cx="400" cy="295" r="225" fill="url(#p)"/>
<circle cx="400" cy="295" r="165" fill="none" stroke="#e7e5e4" stroke-width="6"/>
<text x="400" y="365" font-size="200" text-anchor="middle" font-family="Noto Color Emoji">${emoji}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const days = (n) => new Date(Date.now() - n * 86400000).toISOString();

export const RECIPES = [
  {
    id: 'r-shakshuka',
    title: 'שקשוקה ביתית',
    category: 'ארוחת בוקר',
    description: 'שקשוקה עשירה ברוטב עגבניות ופלפלים, עם ביצים רכות. מוכנה ב-25 דקות.',
    image: dishImage('🍳', '#fb923c', '#dc2626'),
    servings: '4 מנות',
    prepTime: '10 דקות',
    cookTime: '15 דקות',
    totalTime: '25 דקות',
    tags: ['מהיר', 'צמחוני', 'ביצים'],
    ingredients: [{ title: '', items: ['2 כפות שמן זית', '1 בצל קצוץ', '1 פלפל אדום חתוך לרצועות', '3 שיני שום', '6 עגבניות בשלות מרוסקות', '1 כף רסק עגבניות', '1 כפית פפריקה מתוקה', '1/2 כפית כמון', '6 ביצים', 'מלח ופלפל', 'פטרוזיליה קצוצה להגשה'] }],
    steps: [{ title: '', items: ['מחממים שמן במחבת רחבה ומטגנים את הבצל 5 דקות עד שמזהיב.', 'מוסיפים פלפל ושום ומטגנים עוד 3 דקות.', 'מוסיפים עגבניות, רסק ותבלינים ומבשלים 10 דקות על אש בינונית.', 'עושים גומות ברוטב, שוברים לתוכן את הביצים, מכסים ומבשלים 6-8 דקות.', 'מפזרים פטרוזיליה ומגישים עם לחם טרי.'] }],
    tips: ['למי שאוהב חריף – להוסיף פלפל חריף קצוץ עם השום.'],
    source: { url: 'https://www.example-food.co.il/shakshuka', kind: 'web', site: 'אוכל ביתי' },
    rating: 5,
    favorite: true,
    createdAt: days(1),
  },
  {
    id: 'r-chocolate-cake',
    title: 'עוגת שוקולד בחושה',
    category: 'עוגות',
    description: 'עוגת שוקולד לחה בקערה אחת, בלי מיקסר.',
    image: dishImage('🍰', '#a16207', '#451a03'),
    servings: '12 פרוסות',
    prepTime: '15 דקות',
    cookTime: '40 דקות',
    totalTime: '55 דקות',
    tags: ['בלי מיקסר', 'שוקולד', 'לשבת'],
    ingredients: [
      { title: 'לעוגה', items: ['2 כוסות קמח', '1.5 כוסות סוכר', '1/2 כוס קקאו', '2 כפיות אבקת אפייה', '3 ביצים', '1 כוס חלב', '3/4 כוס שמן', '1 כוס מים רותחים'] },
      { title: 'לציפוי', items: ['200 גרם שוקולד מריר', '1 מיכל שמנת מתוקה'] },
    ],
    steps: [{ title: '', items: ['מחממים תנור ל-170 מעלות.', 'מערבבים בקערה את כל היבשים.', 'מוסיפים ביצים, חלב ושמן ומערבבים.', 'מוסיפים מים רותחים ומערבבים לבלילה חלקה.', 'אופים 40 דקות עד שקיסם יוצא עם פירורים לחים.', 'ממיסים שוקולד עם שמנת ויוצקים על העוגה.'] }],
    tips: ['העוגה טעימה עוד יותר למחרת.'],
    source: { url: 'https://www.example-food.co.il/chocolate-cake', kind: 'web' },
    rating: 5,
    createdAt: days(3),
  },
  {
    id: 'r-pasta',
    title: 'פסטה ברוטב עגבניות ובזיליקום',
    category: 'פסטה ואורז',
    description: 'רוטב עגבניות פשוט ומהיר לארוחת ערב של אמצע שבוע.',
    image: dishImage('🍝', '#f87171', '#b91c1c'),
    servings: '4 מנות',
    totalTime: '20 דקות',
    tags: ['מהיר', 'ילדים'],
    ingredients: [{ title: '', items: ['500 גרם ספגטי', '3 כפות שמן זית', '4 שיני שום פרוסות', '1 קופסת עגבניות מרוסקות', 'עלי בזיליקום', 'פרמזן מגורר להגשה', 'מלח'] }],
    steps: [{ title: '', items: ['מבשלים את הפסטה במים רותחים עם מלח לפי ההוראות.', 'מטגנים שום בשמן זית דקה אחת.', 'מוסיפים עגבניות ומבשלים 10 דקות.', 'מערבבים את הפסטה ברוטב, מוסיפים בזיליקום ומגישים עם פרמזן.'] }],
    tips: [],
    source: { url: 'https://www.youtube.com/watch?v=demo', kind: 'youtube', author: 'מטבח של בית' },
    createdAt: days(5),
  },
  {
    id: 'r-chicken',
    title: 'עוף בתנור עם תפוחי אדמה',
    category: 'עוף',
    image: dishImage('🍗', '#fbbf24', '#b45309'),
    servings: '6 מנות',
    totalTime: 'שעה וחצי',
    tags: ['לשבת', 'תבנית אחת'],
    ingredients: [{ title: '', items: ['1 עוף בשר מחולק ל-8', '1 קילו תפוחי אדמה', '2 בצלים', '4 כפות שמן זית', '2 כפות סילאן', '1 כף פפריקה', 'מלח ופלפל'] }],
    steps: [{ title: '', items: ['חותכים תפוחי אדמה ובצלים ומניחים בתבנית.', 'משרים את העוף בשמן, סילאן ותבלינים ומניחים מעל.', 'אופים מכוסה שעה ב-180 מעלות.', 'מגלים ואופים עוד חצי שעה עד שמשחים.'] }],
    tips: [],
    source: { url: 'https://www.instagram.com/p/demo', kind: 'instagram', author: 'שירן מבשלת' },
    rating: 4,
    createdAt: days(8),
  },
  {
    id: 'r-salad',
    title: 'סלט ישראלי קצוץ דק',
    category: 'סלטים',
    image: dishImage('🥗', '#86efac', '#15803d'),
    servings: '4 מנות',
    totalTime: '15 דקות',
    tags: ['צמחוני', 'טבעוני', 'מהיר'],
    ingredients: [{ title: '', items: ['4 עגבניות', '3 מלפפונים', '1 בצל סגול', 'חופן פטרוזיליה', '3 כפות שמן זית', 'מיץ מלימון אחד', 'מלח'] }],
    steps: [{ title: '', items: ['קוצצים דק את כל הירקות.', 'מוסיפים פטרוזיליה, שמן זית ולימון.', 'ממליחים ממש לפני ההגשה.'] }],
    tips: [],
    source: { kind: 'manual' },
    createdAt: days(12),
  },
  {
    id: 'r-soup',
    title: 'מרק עדשים כתומות',
    category: 'מרקים',
    image: dishImage('🍲', '#fdba74', '#c2410c'),
    servings: '6 מנות',
    totalTime: '40 דקות',
    tags: ['חורף', 'טבעוני'],
    ingredients: [{ title: '', items: ['2 כוסות עדשים כתומות', '1 בצל', '2 גזרים', '1 כפית כמון', '1 כפית כורכום', '8 כוסות מים', 'מיץ מחצי לימון'] }],
    steps: [{ title: '', items: ['מטגנים בצל וגזר קצוצים.', 'מוסיפים עדשים, תבלינים ומים.', 'מבשלים 25 דקות וטוחנים לקרם.', 'מוסיפים לימון ומגישים.'] }],
    tips: [],
    source: { kind: 'photo' },
    createdAt: days(15),
  },
  {
    id: 'r-cookies',
    title: 'עוגיות שוקולד צ\'יפס של סבתא',
    category: 'עוגיות ומאפים מתוקים',
    image: dishImage('🍪', '#fde68a', '#a16207'),
    servings: '30 עוגיות',
    totalTime: '30 דקות',
    tags: ['ילדים', 'שוקולד'],
    ingredients: [{ title: '', items: ['200 גרם חמאה רכה', '1 כוס סוכר חום', '2 ביצים', '2.5 כוסות קמח', '1 כפית אבקת אפייה', '200 גרם שוקולד צ\'יפס'] }],
    steps: [{ title: '', items: ['מקציפים חמאה וסוכר.', 'מוסיפים ביצים ואז קמח ואבקת אפייה.', 'מקפלים פנימה שוקולד צ\'יפס.', 'יוצרים כדורים ואופים 12 דקות ב-180 מעלות.'] }],
    tips: [],
    source: { kind: 'whatsapp', chat: 'משפחה 💛', author: 'סבתא רחל', date: '12.09.2026', text: 'המתכון לעוגיות שביקשתם 😘\n200 גרם חמאה, כוס סוכר חום, 2 ביצים...' },
    createdAt: days(20),
  },
];

// המתכון ש"נוצר" כשמדביקים קישור / מצלמים / כותבים בסרטון
export const NEW_RECIPE = {
  id: 'r-quiche',
  title: 'פשטידת תרד וגבינות',
  category: 'צמחוני וטבעוני',
  description: 'פשטידה רכה וזהובה עם תרד, פטה וגבינה צהובה.',
  image: dishImage('🥧', '#bef264', '#4d7c0f'),
  servings: '8 מנות',
  prepTime: '15 דקות',
  cookTime: '45 דקות',
  totalTime: 'שעה',
  tags: ['צמחוני', 'לשבת'],
  ingredients: [{ title: '', items: ['500 גרם תרד קפוא מופשר', '4 ביצים', '250 גרם גבינה לבנה', '150 גרם פטה', '100 גרם גבינה צהובה מגוררת', '2 כפות קמח', 'מלח ואגוז מוסקט'] }],
  steps: [{ title: '', items: ['מחממים תנור ל-180 מעלות.', 'סוחטים היטב את התרד.', 'מערבבים בקערה את כל המרכיבים.', 'יוצקים לתבנית משומנת ואופים 45 דקות עד שהפשטידה זהובה.'] }],
  tips: ['אפשר להחליף חצי מהתרד בפטריות מוקפצות.'],
  source: { url: 'https://www.example-food.co.il/spinach-quiche', kind: 'web' },
};

export const SHOPPING = [
  { id: 's1', text: 'חלב 3%', checked: false },
  { id: 's2', text: 'לחם מחמצת', checked: false },
  { id: 's3', text: 'עגבניות', checked: false },
  { id: 's4', text: 'בננות', checked: true },
];

export const PANTRY = [
  ['ביצים', '10', 'fridge'], ['חלב 3%', '1 ליטר', 'fridge'], ['גבינה לבנה 5%', '2 גביעים', 'fridge'], ['עגבניות', '6', 'fridge'],
  ['מלפפונים', '4', 'fridge'], ['חמאה', '', 'fridge'], ['פטה', '', 'fridge'],
  ['אורז', '1 קילו', 'pantry'], ['פסטה', '2 חבילות', 'pantry'], ['עדשים כתומות', '', 'pantry'], ['קמח', '', 'pantry'], ['שמן זית', '', 'pantry'],
].map(([name, qty, place], i) => ({ id: `p${i}`, name, qty, place }));

export const SEARCH_RESULTS = [
  { title: 'פשטידת תרד וגבינות קלה', url: 'https://www.example-food.co.il/spinach-quiche', site: 'אוכל ביתי', description: 'פשטידה רכה בקערה אחת, עם פטה וגבינה צהובה.' },
  { title: 'פשטידת תרד בלי קמח', url: 'https://www.example-chef.co.il/spinach-pie', site: 'השף בבית', description: 'גרסה קלילה ללא קמח, מתאימה גם ללא גלוטן.' },
  { title: 'Spinach & feta quiche', url: 'https://www.example-kitchen.com/quiche', site: 'Example Kitchen', description: 'קיש צרפתי עם בצק פריך, תרד ופטה.' },
];

export const IDEAS = [
  { title: 'חביתת ירק עם פטה', url: 'https://www.example-food.co.il/omelet', site: 'אוכל ביתי', description: 'משתמש בביצים, פטה ועגבניות שיש לכם. לא חסר כלום.' },
  { title: 'אורז עם עדשים (מג\'דרה)', url: 'https://www.example-chef.co.il/mujadara', site: 'השף בבית', description: 'אורז ועדשים מהמזווה. חסר רק בצל.' },
  { title: 'פסטה עגבניות וגבינה לבנה', url: 'https://www.example-kitchen.co.il/pasta', site: 'מטבח מהיר', description: 'פסטה, עגבניות וגבינה לבנה. חסר בזיליקום (לא חובה).' },
];

export const SCAN_SINGLE = [{ name: 'יוגורט יווני', qty: '4 גביעים', place: 'fridge' }];
export const SCAN_MANY = [
  { name: 'חלב 3%', qty: '1 ליטר', place: 'fridge' }, { name: 'שמנת מתוקה', qty: '1 מיכל', place: 'fridge' },
  { name: 'גזר', qty: '5', place: 'fridge' }, { name: 'קוטג\' 5%', qty: '1', place: 'fridge' },
  { name: 'פלפל אדום', qty: '3', place: 'fridge' }, { name: 'לימון', qty: '2', place: 'fridge' },
];

export const STORES = {
  stores: [
    { id: 'n/1', name: 'שופרסל שלי – מרכז', chain: 'shufersal', chainName: 'שופרסל', kind: 'supermarket', lat: 32.08, lon: 34.78, distance: 450, address: 'אבן גבירול 50, תל אביב', orderUrl: 'https://www.shufersal.co.il/online/' },
    { id: 'n/2', name: 'רמי לוי', chain: 'rami', chainName: 'רמי לוי', kind: 'supermarket', lat: 32.081, lon: 34.785, distance: 1200, address: 'דרך נמיר 20, תל אביב', orderUrl: 'https://www.rami-levy.co.il/' },
    { id: 'n/3', name: 'יוחננוף', chain: 'yochananof', chainName: 'יוחננוף', kind: 'supermarket', lat: 32.07, lon: 34.79, distance: 2100, address: 'יגאל אלון 10, תל אביב', orderUrl: null },
  ],
  prices: {
    source: 'cheapersal',
    note: 'נמצאו מחירים ל-4 מתוך 4 מוצרים בתל אביב.',
    chains: [
      { chain: 'rami', chainName: 'רמי לוי', total: 38.6, missing: 0, items: [{ item: 'חלב 3%', product: 'חלב 3% תנובה 1 ליטר', price: 6.9 }, { item: 'לחם מחמצת', product: 'לחם מחמצת 750 גרם', price: 17.9 }, { item: 'עגבניות', product: 'עגבניות 1 ק"ג', price: 5.9, promo: true }, { item: 'ביצים', product: 'ביצים L 12', price: 7.9 }] },
      { chain: 'yochananof', chainName: 'יוחננוף', total: 41.3, missing: 1, items: [{ item: 'חלב 3%', product: 'חלב 3% 1 ליטר', price: 6.9 }, { item: 'לחם מחמצת', product: 'לחם מחמצת', price: 18.5 }, { item: 'עגבניות', product: 'עגבניות 1 ק"ג', price: 6.5 }] },
      { chain: 'shufersal', chainName: 'שופרסל', total: 44.2, missing: 0, items: [{ item: 'חלב 3%', product: 'חלב 3% תנובה 1 ליטר', price: 7.2 }, { item: 'לחם מחמצת', product: 'לחם מחמצת 750 גרם', price: 19.9 }, { item: 'עגבניות', product: 'עגבניות 1 ק"ג', price: 7.9 }, { item: 'ביצים', product: 'ביצים L 12', price: 9.2 }] },
    ],
  },
};

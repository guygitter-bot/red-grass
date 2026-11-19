// סטים מוכנים. "בהשראת" – תיאור כללי של הסט והסגנון, לא העתק של ציוד אמיתי.
// pieces: מזהים מ-PIECES ב-lib/kit.js · voice: כוונון הקול (חסר = ברירת מחדל)

export const KITS = [
  {
    id: 'standard',
    name: 'סט רוק רגיל',
    drummer: 'נקודת פתיחה',
    desc: 'הסט הקלאסי: בס, סנר, היי-האט, שני טומים, טום רצפה, קראש ורייד. מתאים לכל שיר.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'tom2', 'floor1', 'crash1', 'ride'],
    voice: {},
  },
  {
    id: 'bonham',
    name: 'בהשראת ג׳ון בונהם',
    drummer: 'לד זפלין',
    desc: 'בס ענק ועמוק, טום אחד למעלה ושני טומי רצפה, כוונון נמוך וצליל כבד ורחב. סט מינימלי אבל עם כוח.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'floor1', 'floor2', 'crash1', 'ride'],
    voice: { kickTune: 0.72, kickDecay: 1.5, kickClick: 0.3, snareTune: 0.85, snareDecay: 1.15, snareSnap: 0.9, tomTune: 0.8, tomDecay: 1.3, cymDecay: 1.1, cymBright: 0.85 },
  },
  {
    id: 'ringo',
    name: 'בהשראת רינגו סטאר',
    drummer: 'הביטלס',
    desc: 'סט קטן ו"מחונק": בס וטומים עם בד או כרית, צליל יבש וקצר שיושב בדיוק בתוך השיר.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'floor1', 'crash1', 'ride'],
    voice: { kickTune: 1.1, kickDecay: 0.55, kickClick: 0.15, snareTune: 0.95, snareDecay: 0.6, snareSnap: 0.7, tomTune: 1, tomDecay: 0.55, cymDecay: 0.6, cymBright: 0.8 },
  },
  {
    id: 'peart',
    name: 'בהשראת ניל פירט',
    drummer: 'ראש',
    desc: 'סט ענק: ארבעה טומים, שני טומי רצפה, שלושה סוגי מצילות, צ׳יינה, ספלאש ואפילו פעמון. צליל נקי ומדויק.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'tom2', 'tom3', 'tom4', 'floor1', 'floor2', 'crash1', 'crash2', 'ride', 'china', 'splash', 'cowbell'],
    voice: { kickTune: 1, kickDecay: 0.9, kickClick: 0.8, snareTune: 1.1, snareDecay: 0.9, snareSnap: 1.2, tomTune: 1.1, tomDecay: 1, cymDecay: 1, cymBright: 1.2 },
  },
  {
    id: 'barker',
    name: 'בהשראת טרוויס בארקר',
    drummer: 'בלינק-182',
    desc: 'פאנק מהיר והדוק: טום אחד למעלה, אחד ברצפה, סנר גבוה וחד ובס קצר שמרגיש כמו אגרוף.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'floor1', 'crash1', 'crash2', 'ride'],
    voice: { kickTune: 1.2, kickDecay: 0.65, kickClick: 1, snareTune: 1.25, snareDecay: 0.8, snareSnap: 1.35, tomTune: 1.15, tomDecay: 0.8, cymDecay: 0.8, cymBright: 1.25 },
  },
  {
    id: 'grohl',
    name: 'בהשראת דייב גרוהל',
    drummer: 'נירוונה / פו פייטרס',
    desc: 'רוק כבד ופשוט: שני טומים וטום רצפה, צ׳יינה ושתי מצילות. סנר חזק ועבה, מכה ישרה ובלי קישוטים.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'tom2', 'floor1', 'crash1', 'crash2', 'ride', 'china'],
    voice: { kickTune: 0.9, kickDecay: 1.1, kickClick: 0.8, snareTune: 0.9, snareDecay: 1.2, snareSnap: 1.3, tomTune: 0.9, tomDecay: 1.1, cymDecay: 1.2, cymBright: 1 },
  },
  {
    id: 'porcaro',
    name: 'בהשראת ג׳ף פורקארו',
    drummer: 'טוטו / מוזיקאי אולפן',
    desc: 'סט אולפן חם ומאוזן: שלושה טומים וטום רצפה, סנר שמן ומדויק. צליל "מוכן להקלטה" לכל סגנון.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'tom2', 'tom3', 'floor1', 'crash1', 'ride'],
    voice: { kickTune: 0.95, kickDecay: 0.95, kickClick: 0.4, snareTune: 0.95, snareDecay: 1, snareSnap: 0.9, tomTune: 1, tomDecay: 1, cymDecay: 0.95, cymBright: 0.95 },
  },
  {
    id: 'chadsmith',
    name: 'בהשראת צ׳אד סמית׳',
    drummer: 'רד הוט צ׳ילי פפרס',
    desc: 'פאנק-פאנק עם הרבה כוח: שני טומים, טום רצפה ושתי מצילות. בס עמוק וסנר שמתפוצץ, מושלם לגרוב.',
    pieces: ['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'tom2', 'floor1', 'crash1', 'crash2', 'ride'],
    voice: { kickTune: 0.95, kickDecay: 1, kickClick: 0.7, snareTune: 1.05, snareDecay: 0.95, snareSnap: 1.25, tomTune: 0.95, tomDecay: 1, cymDecay: 1, cymBright: 1.05 },
  },
  {
    id: 'ulrich',
    name: 'בהשראת לארס אולריך',
    drummer: 'מטאליקה',
    desc: 'שני פדלי בס לריצות מהירות, שלושה טומים ושני טומי רצפה, צ׳יינה ושתי מצילות. בס "קליקי" וחד שנשמע גם במהירות.',
    pieces: ['kick', 'kick2', 'snare', 'hihat', 'hihatOpen', 'tom1', 'tom2', 'tom3', 'floor1', 'floor2', 'crash1', 'crash2', 'ride', 'china'],
    voice: { kickTune: 1.05, kickDecay: 0.7, kickClick: 1.3, snareTune: 1.1, snareDecay: 0.9, snareSnap: 1.25, tomTune: 1, tomDecay: 0.9, cymDecay: 1, cymBright: 1.3 },
  },
];

export function kitById(id) {
  return KITS.find((k) => k.id === id) || null;
}

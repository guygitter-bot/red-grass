// ביטים מפושטים לכל שיר (מצב "ללמוד את השיר"). המפתח = מזהה היוטיוב של השיר ב-songs.js.
// זו גרסה מפושטת של הביט המרכזי כפי שמכירים אותו מההקלטה – לא תמלול מדויק, ובלי המילויים והקישוטים.
// קצב (bpm) = הקצב המקורי בקירוב, לפי רבעים. כל סעיף = תיבה או שתיים של 4 פעמות:
//   steps = כמה צעדים בתיבה (16 = רבעי-שמיניות/שש-עשרה, 12 = שלישיות לגרוב "שאפל"), bars = כמה תיבות.
// hits: לכל חלק מחרוזת – x = מכה, נקודה = שקט; רווחים מתעלמים (לקריאות). אורך = steps * bars.
// החלקים חייבים להיות בסט של הלהקה (בדיקה מוודאת) – בסט אישי החלקים החסרים מוחלפים ב-lib/lesson.js.

// ממיר מחרוזת למקומות המכות; זורק שגיאה אם האורך לא מתאים (תופס טעויות בזמן בדיקה)
function indices(str, len, where) {
  const s = str.replace(/\s/g, '');
  if (s.length !== len) throw new Error(`grooves: אורך ${s.length} במקום ${len} ב-${where}`);
  const out = [];
  for (let i = 0; i < s.length; i++) if (s[i] === 'x') out.push(i);
  return out;
}

function sec(id, name, steps, bars, hits) {
  const out = {};
  for (const [piece, str] of Object.entries(hits)) out[piece] = indices(str, steps * bars, `${id}/${piece}`);
  return { id, name, steps, bars, hits: out };
}

// תבניות נפוצות (תיבה אחת של 16)
const H8 = 'x.x. x.x. x.x. x.x.'; // שמיניות
const H4 = 'x... x... x... x...'; // רבעים
const H16 = 'xxxx xxxx xxxx xxxx';
const BK = '.... x... .... x...'; // סנר בפעמות 2 ו-4
const NO = '.... .... .... ....';
const two = (s) => `${s} ${s}`;

// מילוי טומים יורד, שש-עשרה, בתיבה אחת
const fillDown = (a, b, c, d) => ({ [a]: 'xxxx .... .... ....', [b]: '.... xxxx .... ....', [c]: '.... .... xxxx ....', [d]: '.... .... .... xxxx' });

const g = (bpm, tip, sections) => ({ bpm, timeSig: 4, tip, sections });

export const GROOVES = {
  // ---- בונהם ----
  JM3fodiK9rY: g(71, 'גרוב שאפל כבד ואיטי: הסנר חזק מאוד בפעמות 2 ו-4, והבס נכנס מאחור. תנו לצליל להתפשט.', [
    sec('main', 'הביט הראשי', 12, 1, { kick: 'x.x ... .x. ...', snare: '... x.. ... x..', hihat: 'x.x x.x x.x x.x' }),
    sec('open', 'פתוח יותר', 12, 1, { kick: 'x.x ... .x. ...', snare: '... x.. ... x..', hihat: 'x.. x.. x.. x..', hihatOpen: '..x ..x ..x ..x' }),
  ]),
  D2lSwosw9xY: g(170, 'רוק ישר ומהיר: שמיניות בהיי-האט, סנר בפעמות 2 ו-4. שומרים על קצב אחיד.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, crash1: 'x... .... .... ....', ride: '..x. x.x. x.x. x.x.' }),
  ]),
  TA9Rec1qAFQ: g(91, 'הבס מנגן רצף מהיר כמו בס כפול (פה פשוט: שתי מכות רצופות). הסנר ברור בפעמות 2 ו-4.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x.xx ..x. x.xx ..x.', snare: BK, hihat: H8 }),
    sec('fill', 'מילוי', 16, 1, { snare: 'x.x. .... .... ....', tom1: '.... x.x. .... ....', floor1: '.... .... x.x. x...', kick: 'x... .... .... x...' }),
  ]),
  ww9484EM2OQ: g(80, 'כבד ואיטי ובלי למהר. מעט מכות, כל אחת עם כוח.', [
    sec('main', 'הביט הראשי', 16, 2, { kick: two('x... .... ..x. ....'), snare: two(BK), hihat: two(H8) }),
    sec('big', 'הקטע הכבד', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, crash1: 'x... .... x... ....', ride: '..x. x.x. ..x. x.x.' }),
  ]),
  '2KPEHohJMuw': g(82, 'מקפידים על הסנר בפעמות 2 ו-4; הבס עוקב אחרי הריף של הגיטרה.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x..x ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'המשך', 16, 2, { kick: 'x..x ..x. x... .... x..x ..x. x... ..x.', snare: two(BK), ride: two(H8) }),
  ]),

  // ---- רינגו ----
  '45cYwDMibGo': g(82, 'רגוע ויבש, כמעט בלי היי-האט מלא. הטומים נכנסים כמו חלק מהמנגינה.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... .... ..x. ....', snare: BK, hihat: H8 }),
    sec('toms', 'טומים', 16, 1, { kick: 'x... .... .... ....', tom1: '.... x.x. .... ....', floor1: '.... .... x.x. x...', snare: '.... .... .... ....' }),
  ]),
  SyNt5zm3U_M: g(124, 'קצב לא רגיל לתקופה: הבס זז, והסנר מחזיק את הפעמות. נסו קודם לאט.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x..x ..x. .... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, ride: H8 }),
  ]),
  A_MjCqQoLLA: g(74, 'מתחילים עדין ומחכים לכניסה הגדולה. אחרי זה – קראש ואנרגיה.', [
    sec('main', 'הבית', 16, 1, { kick: 'x... .... x... ....', snare: BK, hihat: H8 }),
    sec('big', 'הכניסה הגדולה', 16, 1, { kick: 'x... .... x... ....', snare: BK, crash1: 'x... .... .... ....', ride: H8 }),
  ]),
  '2Q_ZzBGPdqE': g(95, 'ישר ומהיר, שמיניות קבועות. הסנר נותן את הפעמות.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, ride: H8, crash1: 'x... .... .... ....' }),
  ]),
  cK5G8fPmWeA: g(120, 'ביט לא יומרני אבל עם הרבה תחושה. המילויים הם הסוד – כאן רק הבסיס.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x.x. ..x. x... ....', snare: BK, hihat: H8 }),
    sec('fill', 'מילוי טומים', 16, 1, { snare: 'x.x. .... .... ....', tom1: '.... x.x. .... ....', floor1: '.... .... xxx. x...', kick: 'x... .... .... ....' }),
  ]),

  // ---- פירט ----
  auLBLk4ibAk: g(88, 'הגרוב נקי ומדויק. המילוי המפורסם יורד מהטומים הגבוהים לנמוכים.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. ..x. ....', snare: BK, hihat: H8 }),
    sec('fill', 'המילוי המפורסם', 16, 1, fillDown('tom1', 'tom2', 'tom3', 'floor1')),
  ]),
  ZiRuj2_czzw: g(90, 'גרוב נקי, בלי למהר. הרייד מוסיף אוויר.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. ..x. ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, ride: H8, crash1: 'x... .... .... ....' }),
  ]),
  ftVTWDrtrlc: g(135, 'השיר משנה משקלים – כאן רק הביט הבסיסי ב-4/4, לתרגול הקצב והסנר.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x..x ..x. x... ....', snare: BK, hihat: H8 }),
    sec('bell', 'עם פעמון', 16, 1, { kick: 'x..x ..x. x... ....', snare: BK, cowbell: H4 }),
  ]),
  g_QtO0Rhp0w: g(136, 'רוק מתקדם מהיר: היי-האט פתוח ושמח, סנר יציב.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8, hihatOpen: '.... .... .... ..x.' }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, crash1: 'x... .... .... ....', ride: H8 }),
  ]),
  EYYdQB0mkEU: g(104, 'קצב בינוני ויציב; הבס והסנר מחזיקים, ההיי-האט זז.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H16 }),
  ]),

  // ---- בארקר ----
  K7l5ZeVVoCA: g(168, 'פאנק מהיר: שמיניות חזקות והסנר בפעמות 2 ו-4. מתחילים לאט ומעלים מהירות.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... x... x... x...', snare: BK, crash1: 'x.x. x.x. x.x. x.x.' }),
  ]),
  '9Ht5RZpzPqw': g(148, 'קל יחסית להתחלה: ביט פופ-פאנק ישר.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, crash1: 'x... .... .... ....', ride: H8 }),
  ]),
  sT0g16_LQaQ: g(164, 'פאנק מהיר; הבס מהדהד את הגיטרה.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... x... ..x. ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... x... x... x...', snare: BK, crash1: 'x.x. x.x. x.x. x.x.' }),
  ]),
  z7hhDINyBP0: g(176, 'מהיר מאוד – תתחילו ב-50%. בס ישר וסנר חזק.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... x... x... x...', snare: BK, crash1: 'x.x. x.x. x.x. x.x.' }),
  ]),
  vVy9Lgpg1m8: g(160, 'ביט פאנק-פופ מהיר; ההיי-האט שומר על שמיניות.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, crash1: 'x... .... .... ....', ride: H8 }),
  ]),

  // ---- גרוהל ----
  hTWKbfoikeg: g(117, 'בית שקט עם היי-האט, ופזמון חזק עם מצילות. המילוי בפתיחה מפורסם – כאן גרסה פשוטה.', [
    sec('main', 'הבית', 16, 1, { kick: 'x... ..x. ..x. ....', snare: BK, hihat: H8 }),
    sec('chorus', 'הפזמון', 16, 1, { kick: 'x... ..x. ..x. ....', snare: BK, crash1: H8 }),
    sec('fill', 'מילוי', 16, 1, { snare: 'xxxx x... .... ....', tom1: '.... .x.. .... ....', tom2: '.... ..x. x... ....', floor1: '.... .... ..x. x.x.', kick: 'x... .... .... ....' }),
  ]),
  PbgKEjNBHqM: g(138, 'רוק ישר ועוצמתי; סנר חזק ובלי קישוטים.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, crash1: H8 }),
  ]),
  pkcJEvMcnEg: g(123, 'בית רגוע ופזמון בוער. הדינמיקה היא העיקר.', [
    sec('main', 'הבית', 16, 1, { kick: 'x... .... x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'הפזמון', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, crash1: H8 }),
  ]),
  J6EDW5WFb2M: g(154, 'מהיר וקצבי, סנר על כל פעמה שנייה.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'המשך', 16, 1, { kick: 'x... x... x... x...', snare: BK, crash1: 'x... .... .... ....', ride: H8 }),
  ]),
  s88r_q7oufE: g(170, 'מהיר ומחוספס: הסנר חד ומרחיק, ההיי-האט נדחף קדימה.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, ride: H8, crash1: 'x... .... .... ....' }),
  ]),

  // ---- פורקארו ----
  qmOLtTGvsbM: g(86, 'גרוב "חצי שאפל": הסנר נכנס בפעמות 2 ו-4 בעדינות, וההיי-האט מנגן שלישיות. הקשבה ובאמת רגוע.', [
    sec('main', 'הביט הראשי', 12, 1, { kick: 'x.. ... ..x ...', snare: '... x.. ... x..', hihat: 'x.x x.x x.x x.x' }),
    sec('chorus', 'פזמון', 12, 1, { kick: 'x.. ... ..x ...', snare: '... x.. ... x..', ride: 'x.x x.x x.x x.x', crash1: 'x.. ... ... ...' }),
  ]),
  FTQbiNvZqaY: g(92, 'ביט פופ-רוק נקי: היי-האט שמיניות, סנר ברור. שומרים על אחידות.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, hihat: H8, crash1: 'x... .... .... ....' }),
  ]),
  'htgr3pvBr-I': g(104, 'רוק קלאסי של שנות ה-70: בס ישר וסנר חזק.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, crash1: H8 }),
  ]),
  QCq9751mOFo: g(100, 'רוק מלודי. הסנר יציב וההיי-האט פתוח בקצה התיבה.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8, hihatOpen: '.... .... .... ..x.' }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, ride: H8 }),
  ]),
  EWIgEtkE3GA: g(98, 'גרוב רך וקליל: היי-האט שש-עשרה בעדינות, סנר רך.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. .x.. ....', snare: BK, hihat: H16 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. .x.. ..x.', snare: BK, hihat: H16, hihatOpen: '.... .... .... ..x.' }),
  ]),

  // ---- צ'אד סמית' ----
  '8DyziWtkfBw': g(91, 'גרוב פאנקי: הבס זז בין הפעמות והסנר חד. מרגישים את ה"בין".', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x..x ..x. ..x. ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x..x ..x. ..x. x...', snare: BK, hihat: H16 }),
  ]),
  Mr_uHJPUlO8: g(91, 'פאנק-רוק חזק עם בס קופצני.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x..x ..x. x..x ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, crash1: H8 }),
  ]),
  GLvohMXgcBo: g(84, 'מתחילים שקט ומתפוצצים בפזמון. השקט חשוב לא פחות מהמכות.', [
    sec('main', 'הבית השקט', 16, 1, { kick: 'x... .... .... ....', snare: '.... x... .... x...', hihat: H4 }),
    sec('chorus', 'הכניסה החזקה', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, crash1: 'x... .... .... ....', ride: H8 }),
  ]),
  Sb5aq5HcS1A: g(96, 'ביט רוק פשוט וחזק; ההיי-האט בשמיניות.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, crash1: 'x... .... .... ....', ride: H8 }),
  ]),
  YlUKcNNmywk: g(96, 'קצב פשוט ויפה: רק בס, סנר והיי-האט. הקשבה לדינמיקה.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... .... x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8, crash1: 'x... .... .... ....' }),
  ]),

  // ---- אולריך ----
  'CD-E-LDc384': g(123, 'כבד ופשוט, מתאים להתחלה. הסנר בפעמות 2 ו-4 ובס ישר.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('heavy', 'הקטע הכבד', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, crash1: 'x... .... x... ....', china: '.... .... .... ..x.' }),
  ]),
  '6xjJ2XIbGRk': g(212, 'מהיר מאוד – תתחילו ב-50%. הבס הכפול משתלב בין הרגליים (כאן בגרסה פשוטה של שש-עשרה).', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x.x. x.x. x.x. x.x.', kick2: '.x.x .x.x .x.x .x.x', snare: BK, hihat: H8 }),
    sec('slow', 'הקטע האיטי', 16, 1, { kick: 'x... ..x. x... ..x.', snare: BK, ride: H8 }),
  ]),
  'WM8bTdBs-cw': g(105, 'מתחילים בקצב איטי וכבד, ואחרי זה השיר מאיץ. כאן הביט המרכזי.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('gallop', 'מכות הבס', 16, 1, { kick: 'x.xx x.xx x.xx x.xx', snare: BK, ride: H8 }),
  ]),
  G1cjHbXdU0s: g(148, 'מהיר וקופצני; סנר חזק על 2 ו-4.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, hihat: H8 }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x.x. x.x. x.x. x.x.', snare: BK, crash1: 'x... .... .... ....', china: '.... .... .... ..x.' }),
  ]),
  A8MO7fkZc5o: g(88, 'כבד ואיטי; המכות נותנות מקום זו לזו. הקשיבו לרווחים.', [
    sec('main', 'הביט הראשי', 16, 1, { kick: 'x... .... x... ....', snare: BK, hihat: H4, hihatOpen: '.... .... .... ..x.' }),
    sec('chorus', 'פזמון', 16, 1, { kick: 'x... ..x. x... ....', snare: BK, crash1: 'x... .... x... ....', ride: H8 }),
  ]),
};

export function grooveFor(youtubeId) {
  return (typeof youtubeId === 'string' && GROOVES[youtubeId]) || null;
}

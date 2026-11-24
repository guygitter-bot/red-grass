// הגדרות 9 חלקי טופס הקליטה: כותרות, שדות ותוויות בעברית. מהקל לקשה.
// kind: 'fields' = שדות קבועים תחת key · 'rows' = שורות חוזרות · 'list' = רשימת שורות טקסט.
// type של שדה: text | area | number | choice
export const INTAKE_SECTIONS = [
  {
    id: 'business', key: 'business', kind: 'fields', title: 'העסק', hint: 'ההיכרות הראשונה – מה העסק ומי עובד בו.',
    fields: [
      { key: 'name', label: 'איך קוראים לעסק?', type: 'text', placeholder: 'למשל: מספרה, משרד רו״ח, חנות אונליין' },
      { key: 'field', label: 'מה העסק עושה?', type: 'text', placeholder: 'במשפט אחד' },
      { key: 'employees', label: 'כמה אנשים עובדים בו?', type: 'number', placeholder: '0', suffix: 'אנשים' },
      { key: 'roles', label: 'מי עושה מה?', type: 'area', wide: true, placeholder: 'למשל: אני מטפלת בלקוחות, אחותי בכספים, עובד אחד במשלוחים' },
    ],
  },
  {
    id: 'offer', key: 'offer', kind: 'fields', title: 'שירותים ומוצרים', hint: 'מה מוכרים, ומה מכניס הכי הרבה כסף.',
    fields: [
      { key: 'items', label: 'מה העסק מוכר?', type: 'area', placeholder: 'רשימה קצרה של שירותים או מוצרים' },
      { key: 'topEarner', label: 'מה מכניס הכי הרבה כסף?', type: 'area', placeholder: 'השירות או המוצר שהכי משתלם' },
    ],
  },
  {
    id: 'customers', key: 'customers', kind: 'fields', title: 'לקוחות', hint: 'מי הלקוח הטוב ואיך הוא מגיע.',
    fields: [
      { key: 'ideal', label: 'מי הלקוח האידיאלי?', type: 'area', placeholder: 'מי הוא, מה הוא צריך, למה הוא קונה' },
      { key: 'reach', label: 'איך לקוחות מגיעים אליך?', type: 'area', placeholder: 'המלצות, אינסטגרם, גוגל, וואטסאפ…' },
    ],
  },
  {
    id: 'tools', key: 'tools', kind: 'rows', title: 'המערכות היום', hint: 'במה העסק עובד היום – ומה מפריע בו',
    rowLabel: 'מערכת', addLabel: 'הוספת מערכת', empty: 'עוד לא נוספה מערכת.',
    fields: [
      { key: 'tool', label: 'איזו מערכת / כלי?', type: 'text', placeholder: 'אקסל, וואטסאפ, CRM…' },
      { key: 'purpose', label: 'למה משתמשים בה?', type: 'text', placeholder: 'מעקב לקוחות, תזכורות…' },
      { key: 'issues', label: 'מה מפריע בה?', type: 'area', wide: true, placeholder: 'מה איטי, מסורבל או חסר' },
      {
        key: 'replace', label: 'להחליף אותה?', type: 'choice',
        options: [{ value: 'yes', label: 'להחליף' }, { value: 'maybe', label: 'אולי' }, { value: 'no', label: 'להשאיר' }],
      },
      { key: 'monthlyCost', label: 'כמה עולה בחודש?', type: 'number', placeholder: '0', suffix: '₪' },
    ],
  },
  {
    id: 'pains', key: 'pains', kind: 'rows', title: 'כאבים', hint: 'מה מבזבז זמן או כסף. עדיף דוגמה אחת אמיתית מאלף מילים.',
    rowLabel: 'כאב', addLabel: 'הוספת כאב', empty: 'עוד לא נוסף כאב.',
    fields: [
      { key: 'pain', label: 'מה הבעיה?', type: 'area', wide: true, placeholder: 'מה לא עובד או לוקח יותר מדי זמן' },
      { key: 'lastTime', label: 'הפעם האחרונה שזה קרה', type: 'area', wide: true, placeholder: 'ספרי מה קרה, מתי ומה זה עלה' },
      { key: 'frequency', label: 'כל כמה זמן זה קורה?', type: 'text', placeholder: 'כל יום, פעם בשבוע…' },
      { key: 'hoursPerMonth', label: 'כמה שעות בחודש זה לוקח?', type: 'number', placeholder: '0', suffix: 'שעות' },
    ],
  },
  {
    id: 'missing', key: 'missing', kind: 'list', title: 'מערכות שהיה רוצה', hint: 'מה הלקוח היה רוצה שיהיה לו – במילים שלו',
    rowLabel: 'מערכת', addLabel: 'הוספת שורה', empty: 'עוד לא נוסף דבר.', placeholder: 'למשל: מערכת שתזכיר ללקוחות על תור',
  },
  {
    id: 'goal', key: 'goal', kind: 'fields', title: 'יעד במספרים', hint: 'איך נדע שהצליח.',
    fields: [
      { key: 'success', label: 'מה ייחשב הצלחה?', type: 'area', wide: true, placeholder: 'למשל: 10 שעות פחות בחודש, 20% יותר פגישות, אפס שכחות' },
    ],
  },
  {
    id: 'budget', key: 'budget', kind: 'fields', title: 'לוח זמנים', hint: 'עד מתי צריך את זה',
    fields: [
      { key: 'timeline', label: 'עד מתי צריך את זה?', type: 'text', placeholder: 'תאריך או "בחודש הקרוב"' },
    ],
  },
  {
    id: 'tech', key: 'tech', kind: 'fields', title: 'רמה טכנית', hint: 'מי ישמור על הכלי אחרי שהוא עולה, ואיפה המידע.',
    fields: [
      {
        key: 'maintain', label: 'הלקוח יתחזק לבד?', type: 'choice',
        options: [{ value: 'yes', label: 'כן' }, { value: 'partly', label: 'חלקית' }, { value: 'no', label: 'לא' }],
      },
      { key: 'decider', label: 'מי מחליט?', type: 'text', placeholder: 'מי מאשר תקציב וכלים' },
      { key: 'dataLocation', label: 'איפה המידע נמצא היום?', type: 'area', wide: true, placeholder: 'קבצים, מייל, טלפון, מערכת…' },
      {
        key: 'sensitive', label: 'יש מידע רגיש?', type: 'choice',
        options: [{ value: 'yes', label: 'כן' }, { value: 'no', label: 'לא' }],
      },
      { key: 'sensitiveNote', label: 'איזה מידע רגיש?', type: 'area', wide: true, optional: true, showIf: { key: 'sensitive', value: 'yes' }, placeholder: 'למשל: פרטי תשלום, מידע רפואי' },
    ],
  },
];

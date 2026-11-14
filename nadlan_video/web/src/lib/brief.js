// הבחירות בטופס "סרטון חדש". המזהים זהים ל-api/brief.js – לשנות בשניהם (בדיקה בשרת מוודאת).
export const KINDS = {
  building: { label: 'בניין / פרויקט', hint: 'צילום, הדמיה או חזית של הבניין' },
  apartment: { label: 'דירה', hint: 'תוכנית הדירה (שרטוט) או צילומים מבפנים' },
  house: { label: 'בית פרטי', hint: 'צילום או שרטוט של הבית' },
};

export const LOOKS = {
  golden: { label: 'שעת זהב', hint: 'שמש נמוכה וחמה' },
  day: { label: 'יום בהיר', hint: 'שמיים כחולים ואור נקי' },
  dusk: { label: 'דמדומים', hint: 'שמיים כחולים־כהים ואורות דולקים' },
};

export const ASPECTS = [
  { id: '16:9', label: 'לרוחב', hint: 'אתר, יוטיוב, מסך במשרד המכירות' },
  { id: '9:16', label: 'לאורך', hint: 'אינסטגרם, טיקטוק, ווטסאפ' },
];

export const QUALITIES = [
  { id: 'max', label: 'איכות מקסימלית', hint: 'לסרטון הסופי' },
  { id: 'fast', label: 'טיוטה מהירה', hint: 'זול ומהיר, לבדוק כיוון' },
];

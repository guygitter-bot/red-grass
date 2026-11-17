// דיבור עם הצוות: זיהוי דיבור (מיקרופון → טקסט) של הדפדפן/הטלפון, בלי שרת ובלי עלות. התשובות מגיעות רק בכתב.
// Web Speech: כרום, אנדרואיד, ספארי באייפון.
const LANG = 'he-IL';

const Recognition = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
export const canListen = () => Boolean(Recognition());

// ---------- הקשבה ----------
// continuous=false: מסתיים לבד אחרי שתיקה (מצב שיחה קולית). true: עד שלוחצים שוב (הכתבה).
export function listen({ continuous = false, onText, onEnd, onError }) {
  const R = Recognition();
  if (!R) {
    onError?.('הדפדפן הזה לא תומך בזיהוי דיבור');
    return null;
  }
  const rec = new R();
  rec.lang = LANG;
  rec.continuous = continuous;
  rec.interimResults = true;
  let done = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) done = joinText(done, r[0].transcript);
      else interim = joinText(interim, r[0].transcript);
    }
    onText?.(done, interim);
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') micOk = false;
    onError?.(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? MIC_BLOCKED : 'זיהוי הדיבור לא הצליח', e.error);
  };
  rec.onend = () => onEnd?.(done);
  try {
    rec.start();
  } catch {
    onError?.('לא הצלחנו להפעיל את המיקרופון');
    return null;
  }
  return rec;
}

// בקשת רשות למיקרופון (החלון של כרום "לאפשר?"). זיהוי הדיבור לבדו לא תמיד מקפיץ את השאלה,
// בעיקר כשההקשבה מתחילה לבד אחרי הקראה – לכן מבקשים מראש, בלחיצה של המשתמש.
let micOk = false;
export async function askMic() {
  if (micOk) return true;
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (!md?.getUserMedia) return true; // אין דרך לשאול – ננסה בכל זאת
  try {
    const stream = await md.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    micOk = true;
    return true;
  } catch {
    return false;
  }
}
export const MIC_BLOCKED = 'המיקרופון חסום. בכרום: ⋮ ← הגדרות ← הגדרות אתר ← מיקרופון – לבדוק שהאתר לא ברשימת החסומים, ולרענן.';

export const joinText = (a, b) => [a, b].map((s) => (s || '').trim()).filter(Boolean).join(' ');

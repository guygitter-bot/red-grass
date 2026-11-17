// דיבור עם הצוות: זיהוי דיבור (מיקרופון → טקסט) והקראת התשובות בקול – הכול של הדפדפן/הטלפון, בלי שרת ובלי עלות.
// זיהוי דיבור: Web Speech (כרום, אנדרואיד, ספארי באייפון). הקראה: speechSynthesis עם קול בעברית אם יש במכשיר.
const LANG = 'he-IL';
const MAX_CHUNK = 220; // כרום עוצר באמצע הקראה ארוכה – מחלקים למשפטים

const Recognition = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
export const canListen = () => Boolean(Recognition());
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

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
    onError?.(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'צריך לאשר גישה למיקרופון' : 'זיהוי הדיבור לא הצליח');
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

export const joinText = (a, b) => [a, b].map((s) => (s || '').trim()).filter(Boolean).join(' ');

// ---------- הקראה ----------
// טקסט נקי להקראה: בלי סימני Markdown, קוד, קישורים ואימוג'ים
export function cleanForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_~]+/g, '')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// חלוקה לקטעים קצרים לפי סוף משפט / שורה
export function chunks(text, max = MAX_CHUNK) {
  const out = [];
  for (const part of text.split(/(?<=[.!?…:;\n])\s+/)) {
    let p = part.trim();
    while (p.length > max) {
      const cut = p.lastIndexOf(' ', max);
      const at = cut > max / 2 ? cut : max;
      out.push(p.slice(0, at).trim());
      p = p.slice(at).trim();
    }
    if (p) out.push(p);
  }
  return out;
}

let queue = 0; // כמה קטעים עוד מחכים להקראה
let stopped = 0; // עצירה ידנית – ההקראה שנעצרה לא ממשיכה להקשבה
const hebrewVoice = () => (canSpeak() ? window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('he')) : null);
export const hasHebrewVoice = () => Boolean(hebrewVoice());
export const isSpeaking = () => queue > 0;

// מוסיף לתור ההקראה. onDone נקרא כשהתור כולו נגמר
export function speak(text, onDone) {
  if (!canSpeak()) return onDone?.();
  const parts = chunks(cleanForSpeech(text));
  if (!parts.length) return onDone?.();
  const voice = hebrewVoice();
  const run = stopped;
  parts.forEach((p, n) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = LANG;
    if (voice) u.voice = voice;
    queue++;
    // יש מכשירים שלא מודיעים שההקראה נגמרה – אחרי זמן סביר ממשיכים בכל זאת
    let ended = false;
    const guard = setTimeout(() => end(), 2500 + p.length * 120);
    const end = () => {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      queue = Math.max(queue - 1, 0);
      if (n === parts.length - 1 && queue === 0 && run === stopped) onDone?.();
    };
    u.onend = end;
    u.onerror = end;
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  queue = 0;
  stopped++;
  if (canSpeak()) window.speechSynthesis.cancel();
}

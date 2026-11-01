// "מתכון בהקלטה": מקריאים את המתכון בקול והטלפון כותב (זיהוי דיבור בעברית של המערכת – בלי שרת ובלי עלות).
// בדפדפן: Web Speech API (כרום, ספארי). באפליקציה לאנדרואיד: התוסף speech-recognition (ב-WebView אין Web Speech).
// הזיהוי נעצר לבד אחרי שתיקה קצרה – ממשיכים מחדש עד שהמשתמש לוחץ "סיום", והטקסט מצטבר.
import { isNative } from './native';

const LANG = 'he-IL';
const WebSpeech = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);

// התוסף הוא Proxy של Capacitor: אסור להחזיר אותו ישר מפונקציה async (או await עליו) –
// JS בודק אם יש לו then(), והתוסף זורק "SpeechRecognition.then() is not implemented". לכן עוטפים באובייקט.
let nativePlugin;
async function plugin() {
  if (!nativePlugin) {
    const { registerPlugin } = await import('@capacitor/core');
    nativePlugin = { sr: registerPlugin('SpeechRecognition') };
  }
  return nativePlugin;
}

export async function voiceSupported() {
  if (isNative()) {
    try {
      const { sr } = await plugin();
      return (await sr.available()).available;
    } catch {
      return false;
    }
  }
  return Boolean(WebSpeech());
}

// טקסט מצטבר: קטעים שהסתיימו + הקטע שמדברים עכשיו
export const joinSegments = (done, current) => [...done, current].map((s) => String(s || '').trim()).filter(Boolean).join('\n');

// מתחיל להקשיב. onText(טקסט מלא עד עכשיו), onError(הודעה בעברית). מחזיר פונקציה שעוצרת
export async function startDictation({ onText, onError }) {
  const done = [];
  let current = '';
  let active = true;
  const emit = () => onText(joinSegments(done, current));
  const commit = () => {
    if (current.trim()) done.push(current.trim());
    current = '';
  };

  if (isNative()) {
    const { sr } = await plugin();
    const perm = await sr.checkPermissions().catch(() => ({}));
    if (perm.speechRecognition !== 'granted') {
      const asked = await sr.requestPermissions().catch(() => ({}));
      if (asked.speechRecognition !== 'granted') throw new Error('צריך לאשר גישה למיקרופון כדי להקליט');
    }
    await sr.removeAllListeners().catch(() => {});
    await sr.addListener('partialResults', (data) => {
      current = data?.matches?.[0] || current;
      emit();
    });
    const listen = () => {
      if (!active) return;
      sr.start({ language: LANG, partialResults: true, popup: false, maxResults: 1 }).catch(() => {});
    };
    await sr.addListener('listeningState', ({ status }) => {
      // התוצאה הסופית של הקטע מגיעה רגע אחרי "stopped" – מחכים לה ורק אז מתחילים קטע חדש
      if (status === 'stopped') {
        setTimeout(() => {
          commit();
          emit();
          listen();
        }, 400);
      }
    });
    // שגיאה (למשל שתיקה ארוכה) עוצרת בלי הודעה – בודקים ומתחילים שוב
    const watchdog = setInterval(async () => {
      if (!active) return;
      const { listening } = await sr.isListening().catch(() => ({ listening: true }));
      if (!listening) {
        commit();
        listen();
      }
    }, 2500);
    listen();
    return async () => {
      active = false;
      clearInterval(watchdog);
      await sr.stop().catch(() => {});
      await sr.removeAllListeners().catch(() => {});
      commit();
      emit();
    };
  }

  const Rec = WebSpeech();
  if (!Rec) throw new Error('הדפדפן הזה לא תומך בהקלטה. אפשר להשתמש במיקרופון שבמקלדת.');
  let rec;
  const listen = () => {
    if (!active) return;
    rec = new Rec();
    rec.lang = LANG;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) done.push(text.trim());
        else interim += text;
      }
      current = interim;
      emit();
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false;
        onError?.('צריך לאשר גישה למיקרופון כדי להקליט');
      }
    };
    // כרום עוצר אחרי שתיקה – ממשיכים
    rec.onend = () => {
      commit();
      emit();
      if (active) setTimeout(listen, 200);
    };
    rec.start();
  };
  listen();
  return async () => {
    active = false;
    try {
      rec?.stop();
    } catch {
      // כבר נעצר
    }
    commit();
    emit();
  };
}

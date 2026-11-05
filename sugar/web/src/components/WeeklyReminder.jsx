// התזכורת השבועית: כל יום ראשון ב-9:30 מגיעה לטלפון התראה להוריד מ-CareLink את הקובץ של השבוע ולהעלות ליומן.
// כל מכשיר מפעיל לעצמו (צריך אישור התראות). באייפון – רק אחרי "הוספה למסך הבית".
import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { enableNotifications, isSubscribed, notifyState, testNotification } from '../lib/push';
import { Button } from './ui';

export default function WeeklyReminder() {
  const [state, setState] = useState(notifyState());
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    isSubscribed().then(setOn);
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg('');
    try {
      await enableNotifications();
      setOn(true);
      setState(notifyState());
      setMsg('מעולה! בכל יום ראשון ב-9:30 תגיע תזכורת למכשיר הזה.');
    } catch (err) {
      setMsg(err.message);
      setState(notifyState());
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setMsg('');
    try {
      const { sent } = await testNotification();
      setMsg(sent ? 'נשלחה התראת בדיקה – היא אמורה להופיע בעוד כמה שניות.' : 'לא נמצא מכשיר רשום. נסו להפעיל שוב.');
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted">בכל יום ראשון ב-9:30 תגיע התראה לטלפון: להוריד מ-CareLink את הקובץ של השבוע האחרון ולהעלות אותו ליומן. כל מכשיר מפעיל לעצמו.</p>
      {state === 'ios-install' ? (
        <p className="rounded-xl bg-soft p-3 text-sm">באייפון: קודם להוסיף את היומן למסך הבית (כפתור השיתוף ← &quot;הוספה למסך הבית&quot;), לפתוח משם, ואז להפעיל כאן.</p>
      ) : state === 'unsupported' ? (
        <p className="rounded-xl bg-soft p-3 text-sm">הדפדפן הזה לא תומך בהתראות. בטלפון זה עובד מכרום (אנדרואיד) או מהיומן שהותקן במסך הבית.</p>
      ) : state === 'denied' ? (
        <p className="rounded-xl bg-soft p-3 text-sm">ההתראות חסומות במכשיר הזה. אפשר לאשר אותן בהגדרות הדפדפן (הרשאות האתר), ואז לחזור לכאן.</p>
      ) : on ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-sm font-medium text-ok">
            <BellRing size={18} /> התזכורת פעילה במכשיר הזה
          </span>
          <Button kind="ghost" onClick={test}>
            לשלוח התראת בדיקה
          </Button>
        </div>
      ) : (
        <Button onClick={enable} disabled={busy} className="flex items-center gap-2">
          <BellRing size={18} /> {busy ? 'רגע…' : 'להפעיל את התזכורת במכשיר הזה'}
        </Button>
      )}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}

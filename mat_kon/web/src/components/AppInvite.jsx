import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { isNative } from '../lib/native';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.matkon';

// מי שעובד על ספר משותף מהאתר בטלפון אנדרואיד: הזמנה (פעם אחת) להוריד את האפליקציה.
// נכנסים עם אותו חשבון ונשארים באותו ספר משותף
export default function AppInvite({ user }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return Boolean(localStorage.getItem('matkon_app_invite_done'));
    } catch {
      return true;
    }
  });
  if (hidden || isNative() || !user?.bookId || !/Android/i.test(navigator.userAgent)) return null;
  const done = () => {
    try {
      localStorage.setItem('matkon_app_invite_done', '1');
    } catch {
      // אחסון חסום – רק מסתירים עכשיו
    }
    setHidden(true);
  };
  return (
    <div className="mt-4 rounded-2xl bg-white shadow-sm p-3 border border-orange-200 flex gap-3 items-start">
      <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><Smartphone size={20} /></span>
      <div className="flex-1 min-w-0">
        <div className="font-bold">יש לנו אפליקציה לאנדרואיד 📱</div>
        <p className="text-sm text-stone-600 mt-0.5 leading-relaxed">
          נוח יותר מהאתר: משתפים מתכון מכל אפליקציה (טיקטוק, אינסטגרם, ווטסאפ) ישר לספר. נכנסים עם אותו חשבון, והספר המשותף נשאר כמו שהוא.
        </p>
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" onClick={done} className="mt-2 inline-block rounded-xl bg-orange-500 text-white text-sm font-bold px-4 py-2">
          להורדה מ-Google Play
        </a>
      </div>
      <button onClick={done} className="p-1 text-stone-400" aria-label="לא עכשיו"><X size={18} /></button>
    </div>
  );
}

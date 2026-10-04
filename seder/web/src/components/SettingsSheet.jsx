import { useState } from 'react';
import { Bell, CalendarPlus, Download, Upload } from 'lucide-react';
import { useStore } from '../App';
import { normalize } from '../lib/store';
import { todayKey } from '../lib/dates';
import { downloadIcs } from '../lib/calendar';
import { askPermission, notificationsSupported } from '../lib/notify';
import { Sheet } from './ui';

const row = 'w-full flex items-center gap-3 rounded-2xl bg-stone-50 p-3 text-right';

export default function SettingsSheet({ onClose }) {
  const { state, act } = useStore();
  const [perm, setPerm] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'));
  const upcoming = state.tasks.filter((t) => !t.done && t.due && t.due >= todayKey());

  const backup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seder-backup-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const restore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = normalize(JSON.parse(await file.text()));
      if (!window.confirm(`לשחזר ${data.tasks.length} משימות מהגיבוי? מה שיש עכשיו יוחלף.`)) return;
      act(() => data);
      onClose();
    } catch {
      window.alert('הקובץ לא נראה כמו גיבוי של סדר');
    }
  };

  return (
    <Sheet title="הגדרות" onClose={onClose}>
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-stone-500 mt-1">תזכורות</h3>
        {perm === 'granted' ? (
          <div className={row}><Bell size={20} className="text-emerald-600" /><span>התראות מופעלות ✓<span className="block text-xs text-stone-500">מגיעות כשהאפליקציה פתוחה או ברקע</span></span></div>
        ) : perm === 'unsupported' ? (
          <div className={`${row} text-sm text-stone-600`}><Bell size={20} />בדפדפן הזה אין התראות. באייפון: "הוספה למסך הבית" ופתיחה משם.</div>
        ) : (
          <button onClick={async () => setPerm(await askPermission())} className={row}><Bell size={20} className="text-violet-600" /><span>הפעלת התראות<span className="block text-xs text-stone-500">{perm === 'denied' ? 'נחסם – אפשר לאשר בהגדרות הדפדפן' : 'כדי לקבל תזכורת על המסך'}</span></span></button>
        )}
        <p className="text-xs text-stone-500 leading-relaxed">💡 הכי בטוח: לשמור אירועים חשובים גם ביומן (כפתור "ליומן" בכל משימה) – כך התזכורת מגיעה מהיומן של הטלפון גם כשהאפליקציה סגורה.</p>

        <h3 className="text-sm font-bold text-stone-500 pt-3">יומן</h3>
        <button disabled={!upcoming.length} onClick={() => downloadIcs(upcoming, 'seder-upcoming')} className={`${row} disabled:opacity-50`}>
          <CalendarPlus size={20} className="text-sky-600" />
          <span>כל המשימות הקרובות ליומן ({upcoming.length})<span className="block text-xs text-stone-500">קובץ ‎.ics‎ – נפתח ביומן של אייפון, גוגל או אאוטלוק, עם התזכורות</span></span>
        </button>

        <h3 className="text-sm font-bold text-stone-500 pt-3">ווטסאפ</h3>
        <div className={`${row} text-sm text-stone-600 block`}>
          <p>• <b>מווטסאפ לאפליקציה:</b> לחיצה ארוכה על הודעה ← שיתוף ← "סדר" (אחרי הוספה למסך הבית באנדרואיד), או העתקה והדבקה בכפתור "הדבקת הודעה מווטסאפ".</p>
          <p className="mt-1">• <b>מהאפליקציה לווטסאפ:</b> בכל משימה, תחום או יום יש כפתור שיתוף – לבקש עזרה או לחלק משימות.</p>
        </div>

        <h3 className="text-sm font-bold text-stone-500 pt-3">גיבוי</h3>
        <p className="text-xs text-stone-500">הכול נשמר במכשיר הזה בלבד. מומלץ לגבות מדי פעם, ולהעביר כך למכשיר אחר.</p>
        <button onClick={backup} className={row}><Download size={20} className="text-violet-600" />הורדת גיבוי ({state.tasks.length} משימות)</button>
        <label className={`${row} cursor-pointer`}>
          <Upload size={20} className="text-violet-600" />שחזור מגיבוי
          <input type="file" accept="application/json,.json" onChange={restore} className="hidden" />
        </label>
      </div>
    </Sheet>
  );
}

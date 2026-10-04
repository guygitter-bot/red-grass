import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarPlus, Cloud, CloudOff, Download, Lock, MessageSquarePlus, Upload, UserRound } from 'lucide-react';
import { useStore } from '../App';
import { normalize, setName } from '../lib/store';
import { greeting, todayKey } from '../lib/dates';
import { downloadIcs } from '../lib/calendar';
import { askPermission, notificationsSupported } from '../lib/notify';
import { enablePush, pushActive, pushSupported, sendTestPush } from '../lib/push';
import { Sheet } from './ui';

const row = 'w-full flex items-center gap-3 rounded-2xl bg-stone-50 p-3 text-right';

export default function SettingsSheet({ onClose }) {
  const { state, act, syncStatus, syncNow, lock, openRequests } = useStore();
  const [perm, setPerm] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'));
  const [push, setPush] = useState(() => pushActive());
  const [pushMsg, setPushMsg] = useState('');
  const turnOn = async () => {
    const p = await askPermission();
    setPerm(p);
    if (p === 'granted') setPush(await enablePush());
  };
  const test = async () => {
    setPushMsg('שולח...');
    try {
      const r = await sendTestPush();
      if (r.sent) setPushMsg('נשלחה! אמורה להופיע תוך כמה שניות (אפשר גם לסגור את האפליקציה ולבדוק).');
      else if (r.devices) setPushMsg('השליחה לא הצליחה כרגע – נסי שוב בעוד דקה.');
      else {
        setPush(await enablePush());
        setPushMsg('המכשיר נרשם מחדש – לחצי שוב על "התראת בדיקה".');
      }
    } catch (e) {
      setPushMsg(e.message || 'השליחה נכשלה');
    }
  };
  const upcoming = state.tasks.filter((t) => !t.done && t.due && t.due >= todayKey());
  // השם נשמר כשיוצאים מהשדה (או בסגירת ההגדרות), לא בכל אות
  const [name, setNameDraft] = useState(state.profile?.name || '');
  const nameRef = useRef(name);
  nameRef.current = name;
  const savedName = useRef(name);
  const saveName = () => {
    if (nameRef.current === savedName.current) return;
    savedName.current = nameRef.current;
    act(setName, nameRef.current);
  };
  const saveRef = useRef(saveName);
  saveRef.current = saveName;
  useEffect(() => () => saveRef.current(), []);

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
      if (!window.confirm(`לשחזר ${data.tasks.length} משימות מהגיבוי? מה שיש עכשיו יוחלף${syncStatus === 'off' ? '' : ' – גם במכשירים האחרים'}.`)) return;
      // השחזור נחשב לעריכה חדשה, כדי שיגבר על מה שבשרת
      const now = Date.now();
      act((s) => ({
        ...data,
        tasks: data.tasks.map((t) => ({ ...t, updatedAt: now })),
        categories: data.categories.map((c) => ({ ...c, updatedAt: now })),
        // גיבוי ישן בלי שם – השם הנוכחי נשאר
        profile: data.profile.updatedAt ? { ...data.profile, updatedAt: now } : s.profile,
        sync: s.sync,
      }));
      onClose();
    } catch {
      window.alert('הקובץ לא נראה כמו גיבוי של סדר');
    }
  };

  return (
    <Sheet title="הגדרות" onClose={onClose}>
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-stone-500 mt-1">השם שלי</h3>
        <label className={row}>
          <UserRound size={20} className="text-violet-600 shrink-0" />
          <span className="flex-1 min-w-0">
            <input
              value={name}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              maxLength={40}
              placeholder="איך לקרוא לך?"
              className="w-full bg-transparent outline-none text-base"
            />
            <span className="block text-xs text-stone-500">מופיע בלוח בברכה – "{greeting(new Date().getHours(), name)}"</span>
          </span>
        </label>

        <h3 className="text-sm font-bold text-stone-500 pt-3">סנכרון בין מכשירים</h3>
        {syncStatus === 'off' ? (
          <button onClick={() => { onClose(); lock(); }} className={row}>
            <CloudOff size={20} className="text-stone-400" />
            <span>לא מחובר<span className="block text-xs text-stone-500">לחצי כדי להיכנס שוב עם הסיסמה</span></span>
          </button>
        ) : (
          <div className={row}>
            <Cloud size={20} className="text-emerald-600" />
            <span className="flex-1">מחובר – המשימות מסתנכרנות<span className="block text-xs text-stone-500">{syncStatus === 'offline' ? 'אין אינטרנט כרגע – יסונכרן כשהרשת תחזור' : syncStatus === 'error' ? 'הסנכרון האחרון נכשל' : 'בטלפון ובמחשב, אוטומטית'}</span></span>
            <button onClick={syncNow} className="text-xs rounded-lg bg-white border border-stone-200 px-2 py-1">סנכרון עכשיו</button>
          </div>
        )}
        <button onClick={() => { onClose(); lock(); }} className={row}>
          <Lock size={20} className="text-violet-600" />
          <span>נעילה עכשיו<span className="block text-xs text-stone-500">האפליקציה ננעלת בכל פתיחה, ואחרי 5 דקות ברקע</span></span>
        </button>

        <h3 className="text-sm font-bold text-stone-500 pt-3">שיפור האפליקציה</h3>
        <button onClick={() => { onClose(); openRequests(); }} className={row}>
          <MessageSquarePlus size={20} className="text-violet-600" />
          <span>בקשה לשינוי באפליקציה<span className="block text-xs text-stone-500">כותבים מה לשנות – Claude מכין, ומאשרים כאן</span></span>
        </button>

        <h3 className="text-sm font-bold text-stone-500 pt-3">תזכורות</h3>
        {perm === 'granted' && push ? (
          <div className={row}>
            <Bell size={20} className="text-emerald-600" />
            <span className="flex-1">התראות מופעלות ✓<span className="block text-xs text-stone-500">מגיעות לטלפון בזמן – גם כשהאפליקציה סגורה</span></span>
            <button onClick={test} className="text-xs rounded-lg bg-white border border-stone-200 px-2 py-1">התראת בדיקה</button>
          </div>
        ) : perm === 'unsupported' || !pushSupported() ? (
          <div className={`${row} text-sm text-stone-600`}><Bell size={20} />בדפדפן הזה אין התראות. באייפון: "הוספה למסך הבית" ופתיחה משם.</div>
        ) : (
          <button onClick={turnOn} className={row}><Bell size={20} className="text-violet-600" /><span>הפעלת התראות<span className="block text-xs text-stone-500">{perm === 'denied' ? 'נחסם – צריך לאשר התראות לאתר בהגדרות הדפדפן' : 'תזכורות לטלפון בזמן – גם כשהאפליקציה סגורה'}</span></span></button>
        )}
        {pushMsg && <p className="text-xs text-violet-700">{pushMsg}</p>}
        <p className="text-xs text-stone-500 leading-relaxed">💡 צריך להפעיל פעם אחת בכל מכשיר (טלפון, מחשב). אפשר גם לשמור אירוע חשוב ביומן (כפתור "ליומן" בכל משימה).</p>

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
        <p className="text-xs text-stone-500">{syncStatus === 'off' ? 'בלי סנכרון הכול נשמר במכשיר הזה בלבד – מומלץ לגבות מדי פעם.' : 'גיבוי לקובץ, ליתר ביטחון.'}</p>
        <button onClick={backup} className={row}><Download size={20} className="text-violet-600" />הורדת גיבוי ({state.tasks.length} משימות)</button>
        <label className={`${row} cursor-pointer`}>
          <Upload size={20} className="text-violet-600" />שחזור מגיבוי
          <input type="file" accept="application/json,.json" onChange={restore} className="hidden" />
        </label>
      </div>
    </Sheet>
  );
}

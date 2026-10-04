import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, RefreshCw, Wrench, X } from 'lucide-react';
import { Button, Card, ErrorBox } from './ui';
import { fileToDataUrl } from '../lib/image';
import { feedbackAction, listFeedback, sendFeedback } from '../lib/proxy';

const ERRORS = {
  429: 'נשלחו היום הרבה בקשות. אפשר לשלוח שוב מחר.',
  500: 'שליחת תיקונים עוד לא הופעלה בשרת. ספר/י לבעל האפליקציה.',
};

const STATUS = {
  received: ['התקבלה', 'bg-slate-100 text-slate-600'],
  working: ['Claude עובד על זה...', 'bg-amber-100 text-amber-700'],
  ready: ['מוכן לאישור', 'bg-violet-100 text-violet-700'],
  question: ['Claude שואל', 'bg-sky-100 text-sky-700'],
  failed: ['לא הצליח', 'bg-red-100 text-red-600'],
  done: ['בוצע ✓', 'bg-emerald-100 text-emerald-700'],
  rejected: ['נסגרה בלי שינוי', 'bg-slate-100 text-slate-500'],
  closed: ['נסגרה', 'bg-slate-100 text-slate-500'],
  unknown: ['לא זמין כרגע', 'bg-slate-100 text-slate-500'],
};

// בקשה אחת: המצב, מה Claude כתב, ומה אפשר לעשות עכשיו
function RequestItem({ req, act, busy }) {
  const [reply, setReply] = useState('');
  const [label, color] = STATUS[req.status] || STATUS.unknown;
  const open = !['done', 'rejected', 'closed', 'unknown'].includes(req.status);
  const canReply = ['question', 'ready', 'failed'].includes(req.status);

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{req.title || `בקשה ${req.number}`}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${color}`}>{label}</span>
      </div>
      {req.message && open && <p className="text-sm text-slate-600 whitespace-pre-line bg-slate-50 rounded-lg p-2">{req.message}</p>}
      {req.status === 'ready' && (
        <div className="flex gap-2">
          <Button className="flex-1 py-2" disabled={busy} onClick={() => act('approve', req.number)}>
            לאשר ולהעלות
          </Button>
          <Button variant="secondary" className="py-2" disabled={busy} onClick={() => confirm('לסגור את הבקשה בלי שינוי?') && act('reject', req.number)}>
            לא מתאים
          </Button>
        </div>
      )}
      {req.status === 'failed' && (
        <Button variant="secondary" className="w-full py-2" disabled={busy} onClick={() => act('retry', req.number)}>
          לנסות שוב
        </Button>
      )}
      {canReply && (
        <div className="flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={req.status === 'question' ? 'התשובה ל-Claude...' : 'לבקש שינוי נוסף...'}
            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm"
          />
          <Button
            variant="secondary"
            className="py-2"
            disabled={busy || !reply.trim()}
            onClick={async () => (await act('reply', req.number, reply)) && setReply('')}
          >
            שלח
          </Button>
        </div>
      )}
    </div>
  );
}

// שליחת תיקון או הצעה, ומעקב אחרי הבקשות. Claude מכין את השינוי, ומאשרים כאן בלחיצה.
export default function FeedbackCard({ settings }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requests, setRequests] = useState([]);
  // רק בעל האפליקציה ומכשירים שהוא אישר רואים את הכרטיס (השרת עונה 403 לאחרים)
  const [allowed, setAllowed] = useState(false);

  // settings נבנה מחדש בכל רינדור, אז תלויים רק בפרטי החיבור
  const { proxyUrl, accessCode, deviceKey } = settings;
  const refresh = useCallback(() => {
    listFeedback({ proxyUrl, accessCode, deviceKey })
      .then((list) => {
        setRequests(list);
        setAllowed(true);
      })
      .catch((err) => {
        if (err.status === 403 || err.status === 401) setAllowed(false);
      });
  }, [proxyUrl, accessCode, deviceKey]);

  useEffect(() => {
    refresh();
    // כל עוד מסך ההגדרות פתוח, מתעדכנים כל חצי דקה
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImage(await fileToDataUrl(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const run = async (fn, okText) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(okText);
      refresh();
      return true;
    } catch (err) {
      setError(ERRORS[err.status] || err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const context = {
        env: import.meta.env.VITE_APP_ENV === 'staging' ? 'staging' : 'production',
        view: 'settings',
        device: navigator.userAgent,
      };
      await sendFeedback(settings, { text, image, context });
      setText('');
      setImage(null);
    }, 'נשלח ✓ Claude מתחיל לעבוד על זה. המצב יופיע כאן למטה.');

  const NOTICES = {
    approve: 'מאושר ✓ השינוי עולה לאפליקציה תוך כדקה-שתיים. אחר כך סגור/י ופתח/י את האפליקציה.',
    reject: 'הבקשה נסגרה בלי שינוי.',
    retry: 'Claude מנסה שוב.',
    reply: 'נשלח ל-Claude ✓',
  };
  const act = (action, number, replyText) => run(() => feedbackAction(settings, action, number, replyText), NOTICES[action]);

  if (!allowed) return null;

  return (
    <Card className="space-y-3 border-amber-100">
      <h3 className="font-bold text-amber-700 flex items-center gap-2">
        <Wrench size={18} /> שלח תיקון או הצעה
      </h3>
      <p className="text-xs text-slate-500">
        כתוב/י מה לא עובד או מה כדאי לשנות. Claude מכין את השינוי, ואז מופיע כאן "מוכן לאישור" עם הסבר. כמה שיותר ברור,
        למשל: "במסך הוספת אוכל, הכפתור של המועדפים קטן מדי".
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={3000}
        rows={3}
        placeholder="מה לתקן?"
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      {image ? (
        <div className="relative inline-block">
          <img src={image} alt="צילום מסך" className="h-24 rounded-lg border border-slate-200" />
          <button
            onClick={() => setImage(null)}
            className="absolute -top-2 -left-2 bg-white rounded-full p-1 shadow text-slate-500"
            aria-label="הסר צילום מסך"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="file" accept="image/*" onChange={pickImage} className="hidden" />
          <ImagePlus size={18} /> צרף צילום מסך (לא חובה)
        </label>
      )}
      <Button onClick={send} disabled={!text.trim() || busy} className="w-full bg-amber-500 shadow-amber-200 hover:bg-amber-600">
        {busy ? 'רגע...' : 'שלח תיקון'}
      </Button>
      {notice && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">{notice}</p>}
      <ErrorBox>{error}</ErrorBox>

      {requests.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">הבקשות שלי</span>
            <button onClick={refresh} className="text-slate-400 p-1" aria-label="רענן">
              <RefreshCw size={16} />
            </button>
          </div>
          {requests.map((r) => (
            <RequestItem key={r.number} req={r} act={act} busy={busy} />
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-400">הטקסט נשמר בבקשה ב-GitHub (ציבורי). צילום המסך נשמר רק בשרת של האפליקציה.</p>
    </Card>
  );
}

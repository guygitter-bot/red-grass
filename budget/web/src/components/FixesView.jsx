// בקשת שינוי באפליקציה: כותבים מה לשנות (ואפשר לצרף צילום מסך), Claude מכין את השינוי,
// ומופיע כאן "מוכן לאישור" עם הסבר – מאשרים בלחיצה והשינוי עולה. השרת: api/fixes.js
import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, RefreshCw, Wrench, X } from 'lucide-react';
import { api } from '../lib/api';
import { Button, inputCls } from './ui';

const STATUS = {
  received: ['התקבלה', 'bg-soft text-muted'],
  working: ['Claude עובד על זה…', 'bg-amber-500/15 text-amber-600 dark:text-amber-400'],
  ready: ['מוכן לאישור', 'bg-violet-500/15 text-violet-600 dark:text-violet-300'],
  question: ['Claude שואל', 'bg-sky-500/15 text-sky-600 dark:text-sky-300'],
  failed: ['לא הצליח', 'bg-minus/15 text-minus'],
  done: ['בוצע ✓', 'bg-plus/15 text-plus'],
  rejected: ['נסגרה בלי שינוי', 'bg-soft text-muted'],
  closed: ['נסגרה', 'bg-soft text-muted'],
  unknown: ['לא זמין כרגע', 'bg-soft text-muted'],
};

const NOTICES = {
  approve: 'מאושר ✓ השינוי עולה לאפליקציה תוך כמה דקות. אחר כך סוגרים ופותחים את האפליקציה.',
  reject: 'הבקשה נסגרה בלי שינוי.',
  retry: 'Claude מנסה שוב.',
  reply: 'נשלח ל-Claude ✓',
};

// צילום מסך מוקטן ל-JPEG (עד 1280 פיקסלים) כדי שיישלח מהר
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function RequestItem({ req, act, busy }) {
  const [reply, setReply] = useState('');
  const [label, color] = STATUS[req.status] || STATUS.unknown;
  const open = !['done', 'rejected', 'closed', 'unknown'].includes(req.status);
  const canReply = ['question', 'ready', 'failed'].includes(req.status);
  return (
    <div className="space-y-2 rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{req.title || `בקשה ${req.number}`}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${color}`}>{label}</span>
      </div>
      {req.message && open && <p className="rounded-xl bg-page p-3 text-sm whitespace-pre-line">{req.message}</p>}
      {req.status === 'ready' && (
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => act('approve', req.number)}>
            לאשר ולהעלות
          </Button>
          <Button kind="ghost" disabled={busy} onClick={() => confirm('לסגור את הבקשה בלי שינוי?') && act('reject', req.number)}>
            לא מתאים
          </Button>
        </div>
      )}
      {req.status === 'failed' && (
        <Button kind="ghost" className="w-full" disabled={busy} onClick={() => act('retry', req.number)}>
          לנסות שוב
        </Button>
      )}
      {canReply && (
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={req.status === 'question' ? 'התשובה ל-Claude…' : 'לבקש עוד שינוי…'}
          />
          <Button kind="ghost" disabled={busy || !reply.trim()} onClick={async () => (await act('reply', req.number, reply)) && setReply('')}>
            שליחה
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FixesView() {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [state, setState] = useState({ loading: true, enabled: true, requests: [] });

  const refresh = useCallback(() => {
    api('/fix/list')
      .then((r) => setState({ loading: false, ...r }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, []);

  useEffect(() => {
    refresh();
    // כל עוד המסך פתוח – מתעדכנים כל חצי דקה
    const timer = setInterval(refresh, 30000);
    return () => {
      clearInterval(timer);
    };
  }, [refresh]);

  const run = async (fn, ok) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(ok);
      refresh();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      await api('/fix/send', { text, image, view: window.location.hash.slice(0, 40), device: navigator.userAgent });
      setText('');
      setImage(null);
    }, 'נשלח ✓ Claude מתחיל לעבוד על זה (כמה דקות). המצב יופיע כאן למטה.');

  const act = (action, number, replyText) => run(() => api(`/fix/${action}`, { number, text: replyText }), NOTICES[action]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImage(await shrink(file));
    } catch {
      setError('לא הצלחתי לקרוא את התמונה');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <Wrench className="text-accent" /> בקשת שינוי באפליקציה
      </h1>
      <p className="mb-4 text-sm text-muted">
        כותבים מה לתקן או מה להוסיף. Claude מכין את השינוי, ואז מופיע כאן "מוכן לאישור" עם הסבר – מאשרים, והשינוי עולה לאפליקציה.
        כמה שיותר ברור, למשל: "בדוח החודשי, להוסיף עמודה של אחוז מההוצאות".
      </p>

      {!state.loading && !state.enabled ? (
        <p className="rounded-2xl bg-card p-4 text-sm shadow-sm">בקשות שינוי עוד לא הופעלו בשרת.</p>
      ) : (
        <div className="mb-5 space-y-3 rounded-2xl bg-card p-4 shadow-sm">
          <textarea className={inputCls} rows={4} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה לשנות?" />
          {image ? (
            <div className="relative inline-block">
              <img src={image} alt="צילום מסך" className="h-24 rounded-lg border border-line" />
              <button onClick={() => setImage(null)} className="absolute -top-2 -left-2 rounded-full bg-card p-1 text-muted shadow" aria-label="הסרת צילום המסך">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="file" accept="image/*" onChange={pick} className="hidden" />
              <ImagePlus size={18} /> צירוף צילום מסך (לא חובה)
            </label>
          )}
          <Button className="w-full" onClick={send} disabled={!text.trim() || busy}>
            {busy ? 'רגע…' : 'שליחה ל-Claude'}
          </Button>
          <p className="text-xs text-muted">
            הטקסט נשמר בבקשה ב-GitHub, שהיא ציבורית – לא לכתוב בו סכומים או פרטים אישיים. צילום המסך נשמר רק בשרת של האפליקציה.
          </p>
        </div>
      )}

      {notice && <p className="mb-4 rounded-xl bg-plus/10 p-3 text-sm text-plus">{notice}</p>}
      {error && <p className="mb-4 rounded-xl bg-minus/10 p-3 text-sm text-minus">{error}</p>}

      {state.requests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">הבקשות שלי</h2>
            <button onClick={refresh} className="rounded-full p-2 text-muted hover:bg-soft" aria-label="רענון">
              <RefreshCw size={16} />
            </button>
          </div>
          {state.requests.map((r) => (
            <RequestItem key={r.number} req={r} act={act} busy={busy} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Check, RotateCcw, Send, X } from 'lucide-react';
import { approveChangeRequest, listChangeRequests, rejectChangeRequest, retryChangeRequest, sendChangeRequest } from '../lib/sync';
import { Sheet } from './ui';

const STATUS = {
  received: { label: 'התקבלה', className: 'bg-stone-100 text-stone-600' },
  working: { label: 'בעבודה...', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'מוכן לאישור', className: 'bg-violet-100 text-violet-800' },
  done: { label: 'בוצע ✓', className: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'לא הצליח', className: 'bg-rose-100 text-rose-700' },
  rejected: { label: 'נסגרה', className: 'bg-stone-100 text-stone-500' },
};

// בקשה לשינוי באפליקציה: Claude מבצע אותה, והאישור (או הדחייה) נעשה כאן – בלי GitHub
export default function RequestsSheet({ onClose }) {
  const [text, setText] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(null);
  const [notice, setNotice] = useState('');

  const load = () => listChangeRequests().then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // בזמן ש-Claude עובד – מתעדכן לבד
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const send = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    setError('');
    try {
      const req = await sendChangeRequest(text.trim());
      setList((l) => [req, ...(l || [])]);
      setText('');
      setNotice('נשלח! Claude מתחיל לעבוד על זה – זה לוקח כמה דקות.');
    } catch (e) {
      setError(e.message || 'השליחה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const act = async (r, kind) => {
    if (kind === 'reject' && !window.confirm('לסגור את הבקשה בלי להעלות את השינוי?')) return;
    setActing(`${kind}:${r.number}`);
    setError('');
    try {
      if (kind === 'approve') await approveChangeRequest(r.number);
      if (kind === 'reject') await rejectChangeRequest(r.number);
      if (kind === 'retry') await retryChangeRequest(r.number);
      setNotice(kind === 'approve' ? 'אושר! השינוי עולה לאפליקציה – בעוד כדקה סגרי ופתחי את האפליקציה.' : kind === 'retry' ? 'Claude מנסה שוב.' : 'הבקשה נסגרה.');
      await load();
    } catch (e) {
      setError(e.message || 'הפעולה נכשלה');
    } finally {
      setActing(null);
    }
  };

  return (
    <Sheet title="בקשה לשינוי באפליקציה" onClose={onClose}>
      <p className="text-sm text-stone-500">מה להוסיף, לשנות או לתקן? כתבי במילים פשוטות. Claude יבצע את השינוי, ואז הוא יופיע כאן לאישור – רק אחרי האישור הוא עולה לאפליקציה.</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => { setText(e.target.value); setNotice(''); }}
        rows={5}
        maxLength={4000}
        placeholder="למשל: שבמסך היומי יהיה כפתור שמעביר את כל המשימות שלא בוצעו למחר"
        className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-violet-500"
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-emerald-700">{notice}</p>}
      <button onClick={send} disabled={text.trim().length < 3 || busy} className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">
        <Send size={18} />{busy ? 'שולח...' : 'שליחה'}
      </button>

      <div className="flex items-center justify-between mt-6 mb-2">
        <h3 className="text-sm font-bold text-stone-500">הבקשות שלי</h3>
        <button onClick={load} className="text-xs text-violet-700">רענון</button>
      </div>
      {list === null && !error && <p className="text-sm text-stone-400">טוען...</p>}
      {list?.length === 0 && <p className="text-sm text-stone-400">עוד לא נשלחו בקשות</p>}
      <div className="space-y-2 pb-2">
        {list?.map((r) => {
          const st = STATUS[r.status] || STATUS.received;
          const busyHere = acting?.endsWith(`:${r.number}`);
          return (
            <div key={r.number} className={`rounded-2xl border p-3 ${r.status === 'ready' ? 'border-violet-300 bg-violet-50/50' : 'border-stone-200'}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 font-medium">{r.title}</div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${st.className}`}>{st.label}</span>
              </div>
              <div className="mt-1 text-xs text-stone-500">{new Date(r.createdAt).toLocaleDateString('he-IL')}</div>
              {r.status === 'ready' && (
                <>
                  {r.summary && <p className="mt-2 text-sm text-stone-700 whitespace-pre-line rounded-xl bg-white border border-stone-100 p-2.5 max-h-56 overflow-auto">{r.summary}</p>}
                  <div className="mt-2 flex gap-2">
                    <button disabled={!!acting} onClick={() => act(r, 'approve')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 text-white font-bold py-2.5 disabled:opacity-50">
                      <Check size={18} />{acting === `approve:${r.number}` ? 'מאשר...' : 'לאשר ולהעלות'}
                    </button>
                    <button disabled={!!acting} onClick={() => act(r, 'reject')} className="flex items-center justify-center gap-1 rounded-xl border border-stone-200 bg-white px-3 text-stone-600 disabled:opacity-50">
                      <X size={16} />לא מתאים
                    </button>
                  </div>
                </>
              )}
              {r.status === 'failed' && (
                <div className="mt-2 flex gap-2">
                  <button disabled={!!acting} onClick={() => act(r, 'retry')} className="flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 px-3 py-1.5 text-sm disabled:opacity-50">
                    <RotateCcw size={14} />{busyHere ? 'שולח...' : 'לנסות שוב'}
                  </button>
                  <button disabled={!!acting} onClick={() => act(r, 'reject')} className="rounded-xl px-3 py-1.5 text-sm text-stone-500 disabled:opacity-50">לוותר</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

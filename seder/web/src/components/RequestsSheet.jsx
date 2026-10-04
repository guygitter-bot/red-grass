import { useEffect, useState } from 'react';
import { Check, Pencil, Play, RotateCcw, Send, Wallet, X } from 'lucide-react';
import { approveChangeRequest, listChangeRequests, rejectChangeRequest, retryChangeRequest, sendChangeRequest, setCredits, startChangeRequest } from '../lib/sync';
import { Sheet } from './ui';

const STATUS = {
  received: { label: 'התקבלה', className: 'bg-stone-100 text-stone-600' },
  estimating: { label: 'מעריך מחיר...', className: 'bg-amber-100 text-amber-800' },
  quote: { label: 'מחכה לאישור שלך', className: 'bg-sky-100 text-sky-800' },
  working: { label: 'בעבודה...', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'מוכן לאישור', className: 'bg-violet-100 text-violet-800' },
  done: { label: 'בוצע ✓', className: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'לא הצליח', className: 'bg-rose-100 text-rose-700' },
  rejected: { label: 'נסגרה', className: 'bg-stone-100 text-stone-500' },
};

// סכום בדולרים לתצוגה
const usd = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

// היתרה בחשבון הקרדיטים של Claude: מוקלדת ידנית (אין דרך לקרוא אותה מ-Anthropic), והשרת מוריד ממנה כל שינוי
function CreditsCard({ credits, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await setCredits(amount);
      setEditing(false);
      await onSaved();
    } catch (e) {
      setError(e.message || 'השמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-card p-3 mb-4">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-violet-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-stone-500">יתרה בחשבון הקרדיטים</div>
          {credits ? (
            <div className={`text-lg font-bold ${credits.balance < 1 ? 'text-rose-600' : ''}`}>{usd(credits.balance)}</div>
          ) : (
            <div className="text-sm text-stone-500">עוד לא הוזנה</div>
          )}
        </div>
        {!editing && (
          <button onClick={() => { setEditing(true); setAmount(credits ? String(credits.balance) : ''); }} className="flex items-center gap-1 rounded-xl border border-stone-200 px-2.5 py-1.5 text-sm">
            <Pencil size={14} />{credits ? 'עדכון' : 'הזנה'}
          </button>
        )}
      </div>
      {credits && !editing && credits.spent > 0 && (
        <div className="mt-1 text-xs text-stone-500">הוזן {usd(credits.amount)} ב-{new Date(credits.setAt).toLocaleDateString('he-IL')}, ומאז שינויים עלו {usd(credits.spent)}</div>
      )}
      {editing && (
        <div className="mt-2">
          <p className="text-xs text-stone-500">כמה כסף יש עכשיו בחשבון (בדולרים)? רואים את זה באתר console.anthropic.com, בעמוד Billing. אחרי זה היתרה מתעדכנת כאן לבד.</p>
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
              placeholder="20.00"
              className="flex-1 min-w-0 rounded-xl border border-stone-200 bg-card px-3 py-2 outline-none focus:border-violet-500"
            />
            <button onClick={save} disabled={saving || !amount.trim()} className="rounded-xl bg-violet-600 text-white font-bold px-4 disabled:opacity-40">{saving ? 'שומר...' : 'שמירה'}</button>
            <button onClick={() => setEditing(false)} className="rounded-xl px-2 text-stone-500">ביטול</button>
          </div>
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

// בקשה לשינוי באפליקציה: קודם הערכת מחיר, Claude מבצע רק אחרי "לבצע", והאישור (או הדחייה) נעשה כאן – בלי GitHub
export default function RequestsSheet({ onClose }) {
  const [text, setText] = useState('');
  const [list, setList] = useState(null);
  const [credits, setCreditsState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(null);
  const [notice, setNotice] = useState('');

  const load = () => listChangeRequests()
    .then((res) => {
      setList(res.requests);
      setCreditsState(res.credits);
    })
    .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // בזמן ההערכה ובזמן ש-Claude עובד – מתעדכן לבד
    const t = setInterval(load, 20000);
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
      setNotice('נשלח! תוך כדקה יופיע כאן כמה השינוי יעלה, ותוכלי להחליט אם לבצע.');
    } catch (e) {
      setError(e.message || 'השליחה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const act = async (r, kind) => {
    if (kind === 'reject' && !window.confirm(r.status === 'quote' ? 'לבטל את הבקשה? לא ייגבה כסף על הביצוע.' : 'לסגור את הבקשה בלי להעלות את השינוי?')) return;
    setActing(`${kind}:${r.number}`);
    setError('');
    try {
      if (kind === 'approve') await approveChangeRequest(r.number);
      if (kind === 'reject') await rejectChangeRequest(r.number);
      if (kind === 'retry') await retryChangeRequest(r.number);
      if (kind === 'go') await startChangeRequest(r.number);
      setNotice({
        approve: 'אושר! השינוי עולה לאפליקציה – בעוד כדקה סגרי ופתחי את האפליקציה.',
        retry: 'Claude מנסה שוב.',
        go: 'Claude מתחיל לעבוד על זה – זה לוקח כמה דקות.',
        reject: 'הבקשה נסגרה.',
      }[kind]);
      await load();
    } catch (e) {
      setError(e.message || 'הפעולה נכשלה');
    } finally {
      setActing(null);
    }
  };

  return (
    <Sheet title="בקשה לשינוי באפליקציה" onClose={onClose}>
      <CreditsCard credits={credits} onSaved={load} />
      <p className="text-sm text-stone-500">מה להוסיף, לשנות או לתקן? כתבי במילים פשוטות. קודם תראי כמה השינוי יעלה ותחליטי אם לבצע. אחרי ש-Claude מבצע, השינוי מופיע כאן לאישור – ורק אחרי האישור הוא עולה לאפליקציה.</p>
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
            <div key={r.number} className={`rounded-2xl border p-3 ${r.status === 'ready' || r.status === 'quote' ? 'border-violet-300 bg-violet-50/50' : 'border-stone-200'}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 font-medium">{r.title}</div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${st.className}`}>{st.label}</span>
              </div>
              <div className="mt-1 text-xs text-stone-500">
                {new Date(r.createdAt).toLocaleDateString('he-IL')}
                {r.cost > 0 && r.status !== 'quote' && <> · עלה {usd(r.cost)}</>}
              </div>
              {r.status === 'quote' && (
                <>
                  <div className="mt-2 rounded-xl bg-card border border-stone-100 p-2.5">
                    {r.estimate?.usd != null ? (
                      <div className="font-bold">השינוי יעלה בערך {usd(r.estimate.usd)}</div>
                    ) : (
                      <div className="font-bold">לא הצלחתי להעריך כמה זה יעלה</div>
                    )}
                    {r.estimate?.note && <p className="mt-1 text-sm text-stone-600">{r.estimate.note}</p>}
                    {credits && r.estimate?.usd != null && (
                      <p className={`mt-1 text-xs ${credits.balance < r.estimate.usd ? 'text-rose-600' : 'text-stone-500'}`}>
                        {credits.balance < r.estimate.usd ? `אין מספיק יתרה (נשארו ${usd(credits.balance)})` : `אחרי הביצוע יישארו בערך ${usd(credits.balance - r.estimate.usd)}`}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button disabled={!!acting} onClick={() => act(r, 'go')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 text-white font-bold py-2.5 disabled:opacity-50">
                      <Play size={18} />{acting === `go:${r.number}` ? 'שולח...' : 'לבצע'}
                    </button>
                    <button disabled={!!acting} onClick={() => act(r, 'reject')} className="flex items-center justify-center gap-1 rounded-xl border border-stone-200 bg-card px-3 text-stone-600 disabled:opacity-50">
                      <X size={16} />לבטל
                    </button>
                  </div>
                </>
              )}
              {r.status === 'ready' && (
                <>
                  {r.summary && <p className="mt-2 text-sm text-stone-700 whitespace-pre-line rounded-xl bg-card border border-stone-100 p-2.5 max-h-56 overflow-auto">{r.summary}</p>}
                  <div className="mt-2 flex gap-2">
                    <button disabled={!!acting} onClick={() => act(r, 'approve')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 text-white font-bold py-2.5 disabled:opacity-50">
                      <Check size={18} />{acting === `approve:${r.number}` ? 'מאשר...' : 'לאשר ולהעלות'}
                    </button>
                    <button disabled={!!acting} onClick={() => act(r, 'reject')} className="flex items-center justify-center gap-1 rounded-xl border border-stone-200 bg-card px-3 text-stone-600 disabled:opacity-50">
                      <X size={16} />לא מתאים
                    </button>
                  </div>
                </>
              )}
              {r.status === 'failed' && (
                <div className="mt-2 flex gap-2">
                  <button disabled={!!acting} onClick={() => act(r, 'retry')} className="flex items-center gap-1.5 rounded-xl bg-card border border-stone-200 px-3 py-1.5 text-sm disabled:opacity-50">
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

import { useEffect, useState } from 'react';
import { ExternalLink, Send } from 'lucide-react';
import { listChangeRequests, sendChangeRequest } from '../lib/sync';
import { Sheet } from './ui';

const STATUS = {
  received: { label: 'התקבלה', className: 'bg-stone-100 text-stone-600' },
  working: { label: 'בעבודה...', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'מוכן לאישור', className: 'bg-violet-100 text-violet-800' },
  done: { label: 'בוצע ✓', className: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'לא הצליח', className: 'bg-rose-100 text-rose-700' },
  rejected: { label: 'נסגרה', className: 'bg-stone-100 text-stone-500' },
};

// בקשה לשינוי באפליקציה: נשלחת ל-GitHub, Claude מבצע אותה ופותח PR לאישור
export default function RequestsSheet({ onClose }) {
  const [text, setText] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const load = () => listChangeRequests().then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const send = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    setError('');
    try {
      const req = await sendChangeRequest(text.trim());
      setList((l) => [req, ...(l || [])]);
      setText('');
      setSent(true);
    } catch (e) {
      setError(e.message || 'השליחה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="בקשה לשינוי באפליקציה" onClose={onClose}>
      <p className="text-sm text-stone-500">מה להוסיף, לשנות או לתקן? כתבי במילים פשוטות. Claude יבצע את השינוי ויכין אותו לאישור – אחרי האישור (מיזוג ב-GitHub) הוא עולה לאפליקציה.</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => { setText(e.target.value); setSent(false); }}
        rows={5}
        maxLength={4000}
        placeholder="למשל: שבמסך היומי יהיה כפתור שמעביר את כל המשימות שלא בוצעו למחר"
        className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-violet-500"
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {sent && <p className="mt-2 text-sm text-emerald-700">נשלח! אפשר לעקוב כאן אחרי המצב.</p>}
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
          return (
            <div key={r.number} className="rounded-2xl border border-stone-200 p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 font-medium">{r.title}</div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${st.className}`}>{st.label}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                <span>{new Date(r.createdAt).toLocaleDateString('he-IL')}</span>
                {r.prUrl && <a href={r.prUrl} target="_blank" rel="noopener" className="flex items-center gap-1 text-violet-700 font-medium"><ExternalLink size={12} />לאישור ומיזוג</a>}
                <a href={r.url} target="_blank" rel="noopener" className="underline">פרטים</a>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

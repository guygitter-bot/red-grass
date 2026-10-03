import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { getAdminErrors, getAdminUsage } from '../lib/api';

const nis = (usd) => `₪${(usd * 3.7).toFixed(2)}`;
const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

// ניהול: כמה AI כל ספר צרך החודש (והערכת עלות), ותקלות אחרונות
export default function AdminView({ onBack }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [usage, setUsage] = useState(null);
  const [errors, setErrors] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setUsage(null);
    getAdminUsage(month).then(setUsage).catch((e) => setError(e.message));
  }, [month]);
  useEffect(() => {
    getAdminErrors().then(setErrors).catch(() => setErrors([]));
  }, []);

  const total = usage?.rows.reduce((t, r) => t + r.usd, 0) || 0;
  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה"><ArrowRight size={22} /></button>
          <div className="font-bold flex-1">עלויות ותקלות</div>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="text-sm rounded-lg border border-stone-200 px-2 py-1" dir="ltr" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 mt-4 space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <section>
          <h2 className="font-bold text-lg mb-1">שימוש ב-AI לפי ספר</h2>
          <p className="text-xs text-stone-500 mb-2">
            הערכה לפי מחיר לטוקנים{usage ? ` ($${usage.price.in}/$${usage.price.out} למיליון, $${usage.price.search} לחיפוש)` : ''} – החשבון בפועל ב-console.anthropic.com.
          </p>
          {!usage ? <Loader2 className="animate-spin text-orange-500" /> : (
            <>
              <div className="rounded-2xl bg-orange-50 p-3 mb-2 flex justify-between font-bold">
                <span>סה"כ החודש</span><span>${total.toFixed(2)} · {nis(total)}</span>
              </div>
              <ul className="rounded-2xl bg-white shadow-sm divide-y divide-stone-100">
                {usage.rows.map((r) => (
                  <li key={r.id} className="p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold truncate">{r.name}{r.members ? ` +${r.members}` : ''}</span>
                      <span className="font-bold shrink-0">${r.usd.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {r.ops} פעולות · {r.calls} קריאות AI · {k(r.input)} טוקנים נכנסים · {k(r.output)} יוצאים · {r.searches} חיפושים
                      {r.plan === 'paid' ? ' · מנוי' : r.plan === 'free' ? ` · חינם (${r.added} מתכונים)` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <h2 className="font-bold text-lg mb-2 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> תקלות אחרונות</h2>
          {!errors ? <Loader2 className="animate-spin text-orange-500" /> : !errors.length ? (
            <p className="text-sm text-stone-500">אין תקלות 🎉</p>
          ) : (
            <ul className="space-y-2">
              {errors.map((e, i) => (
                <li key={i} className="rounded-xl bg-white shadow-sm p-3 text-sm">
                  <div className="flex justify-between gap-2 text-xs text-stone-500">
                    <span>{e.where}{e.status ? ` · ${e.status}` : ''} · {e.user}</span>
                    <span dir="ltr">{new Date(e.at).toLocaleString('he-IL')}</span>
                  </div>
                  <div className="mt-1 break-words" dir="auto">{e.message}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

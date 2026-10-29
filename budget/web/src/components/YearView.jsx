// מבט קדימה: 12 חודשים עם הכנסות, הוצאות, מה נשאר ויתרה צפויה. לחיצה על חודש פותחת אותו
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, forecast, money, monthName, thisMonth } from '../lib/budget';

export default function YearView({ data, open }) {
  const [from, setFrom] = useState(thisMonth());
  const rows = useMemo(() => forecast(data, from, 12), [data, from]);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense)));
  const totals = rows.reduce((a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense }), { income: 0, expense: 0 });
  const hasBalance = rows.some((r) => r.balance != null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button onClick={() => setFrom(addMonths(from, -12))} className="rounded-full p-2 hover:bg-soft" aria-label="שנה קודמת">
          <ChevronRight />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold lg:text-2xl">
            {monthName(from, true)} – {monthName(addMonths(from, 11), true)}
          </h1>
          {from !== thisMonth() && (
            <button onClick={() => setFrom(thisMonth())} className="text-sm text-accent-ink">
              מהחודש הנוכחי
            </button>
          )}
        </div>
        <button onClick={() => setFrom(addMonths(from, 12))} className="rounded-full p-2 hover:bg-soft" aria-label="שנה הבאה">
          <ChevronLeft />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-card p-3 shadow-sm">
          <div className="text-xs text-muted">הכנסות ב-12 חודשים</div>
          <div className="num font-bold text-plus">{money(totals.income)}</div>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-sm">
          <div className="text-xs text-muted">הוצאות ב-12 חודשים</div>
          <div className="num font-bold text-minus">{money(totals.expense)}</div>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-sm">
          <div className="text-xs text-muted">נשאר</div>
          <div className={`num font-bold ${totals.income - totals.expense < 0 ? 'text-minus' : 'text-plus'}`}>{money(totals.income - totals.expense, true)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
        <div className={`hidden gap-2 border-b border-line px-4 py-2 text-sm text-muted lg:grid ${hasBalance ? 'lg:grid-cols-[8rem_1fr_7rem_7rem_7rem_8rem]' : 'lg:grid-cols-[8rem_1fr_7rem_7rem_7rem]'}`}>
          <span>חודש</span>
          <span />
          <span>הכנסות</span>
          <span>הוצאות</span>
          <span>נשאר</span>
          {hasBalance && <span>יתרה צפויה</span>}
        </div>
        {rows.map((r) => (
          <button
            key={r.month}
            onClick={() => open(r.month)}
            className={`block w-full border-b border-line px-4 py-3 text-right last:border-0 hover:bg-soft lg:grid lg:items-center lg:gap-2 ${hasBalance ? 'lg:grid-cols-[8rem_1fr_7rem_7rem_7rem_8rem]' : 'lg:grid-cols-[8rem_1fr_7rem_7rem_7rem]'}`}
          >
            <div className="flex items-center justify-between lg:block">
              <span className="font-bold">{monthName(r.month)}</span>
              <span className={`num font-bold lg:hidden ${r.net < 0 ? 'text-minus' : 'text-plus'}`}>{money(r.net, true)}</span>
            </div>
            <div className="my-2 space-y-1 lg:my-0">
              <div className="h-2 rounded-full bg-plus/70" style={{ width: `${(r.income / max) * 100}%` }} />
              <div className="h-2 rounded-full bg-minus/70" style={{ width: `${(r.expense / max) * 100}%` }} />
            </div>
            <div className="flex justify-between text-sm lg:hidden">
              <span>
                הכנסות <span className="num text-plus">{money(r.income)}</span>
              </span>
              <span>
                הוצאות <span className="num text-minus">{money(r.expense)}</span>
              </span>
            </div>
            {r.balance != null && <div className="mt-1 text-sm text-muted lg:hidden">יתרה צפויה: <span className={`num ${r.balance < 0 ? 'text-minus' : 'text-ink'}`}>{money(r.balance)}</span></div>}
            <span className="num hidden text-plus lg:block">{money(r.income)}</span>
            <span className="num hidden text-minus lg:block">{money(r.expense)}</span>
            <span className={`num hidden font-bold lg:block ${r.net < 0 ? 'text-minus' : 'text-plus'}`}>{money(r.net, true)}</span>
            {hasBalance && <span className={`num hidden lg:block ${r.balance < 0 ? 'text-minus' : ''}`}>{r.balance == null ? '—' : money(r.balance)}</span>}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">הסכומים לפני כרטיסי אשראי והוצאות משתנות (אלא אם הוספת אותם)</p>
    </div>
  );
}

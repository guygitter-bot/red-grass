// מסך החודש: סיכום (הכנסות, הוצאות, נשאר, יתרה צפויה) והשורות לפי סוג
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { addMonths, byCategory, forecast, money, monthName, thisMonth } from '../lib/budget';
import ItemEditor from './ItemEditor';
import LineSheet from './LineSheet';

const GROUPS = [
  ['income', null, 'הכנסות'],
  ['expense', 'fixed', 'הוצאות קבועות'],
  ['expense', 'installments', 'תשלומים'],
  ['expense', 'once', 'הוצאות חד־פעמיות'],
];

export function Stat({ label, value, tone = '', sub }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm lg:p-4">
      <div className="text-xs text-muted lg:text-sm">{label}</div>
      <div className={`num text-lg font-bold lg:text-2xl ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function MonthView({ data, month, go }) {
  const [edit, setEdit] = useState(null);
  const [line, setLine] = useState(null);
  const [byCat, setByCat] = useState(false);
  const [s] = useMemo(() => forecast(data, month, 1), [data, month]);
  const cats = useMemo(() => byCategory(s), [s]);
  const now = thisMonth();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button onClick={() => go(addMonths(month, -1))} className="rounded-full p-2 hover:bg-soft" aria-label="חודש קודם">
          <ChevronRight />
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-bold">{monthName(month)}</h1>
          {month !== now && (
            <button onClick={() => go(now)} className="text-sm text-accent-ink">
              חזרה לחודש הנוכחי
            </button>
          )}
        </div>
        <button onClick={() => go(addMonths(month, 1))} className="rounded-full p-2 hover:bg-soft" aria-label="חודש הבא">
          <ChevronLeft />
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Stat label="הכנסות צפויות" value={money(s.income)} tone="text-plus" />
        <Stat label="הוצאות צפויות" value={money(s.expense)} tone="text-minus" />
        <Stat label="נשאר החודש" value={money(s.net, true)} tone={s.net < 0 ? 'text-minus' : 'text-plus'} sub="לפני אשראי והוצאות משתנות" />
        <Stat
          label="יתרה צפויה בסוף החודש"
          value={s.balance == null ? '—' : money(s.balance)}
          tone={s.balance < 0 ? 'text-minus' : ''}
          sub={s.balance == null ? 'אפשר לקבוע יתרה בהגדרות' : null}
        />
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setEdit({ kind: 'expense' })} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2.5 font-medium text-white">
          <Plus size={18} /> הוצאה
        </button>
        <button onClick={() => setEdit({ kind: 'income' })} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line bg-card px-3 py-2.5 font-medium">
          <Plus size={18} /> הכנסה
        </button>
        {cats.length > 0 && (
          <button onClick={() => setByCat(!byCat)} className={`rounded-xl border border-line px-3 py-2.5 text-sm font-medium ${byCat ? 'bg-soft text-accent-ink' : 'bg-card'}`}>
            לפי קטגוריה
          </button>
        )}
      </div>

      {byCat && (
        <section className="mb-5 rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-bold">הוצאות לפי קטגוריה</h2>
          {cats.map((c) => (
            <div key={c.category} className="mb-2">
              <div className="flex justify-between text-sm">
                <span>{c.category}</span>
                <span className="num font-medium">{money(c.amount)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-soft">
                <div className="h-2 rounded-full bg-minus/70" style={{ width: `${Math.max(2, (c.amount / s.expense) * 100)}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {s.lines.length === 0 && (
        <div className="rounded-2xl bg-card p-6 text-center text-muted shadow-sm">
          אין עדיין הוצאות או הכנסות בחודש הזה.
          <br />
          מתחילים מהקבועות: משכורת, שכירות או משכנתא, חשבונות, ביטוחים, תשלומים…
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map(([kind, type, title]) => {
          const lines = s.lines.filter((l) => l.item.kind === kind && (!type || l.item.type === type));
          if (!lines.length) return null;
          const total = lines.reduce((a, l) => a + l.amount, 0);
          return (
            <section key={title} className="rounded-2xl bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-bold">{title}</h2>
                <span className={`num font-bold ${kind === 'income' ? 'text-plus' : 'text-minus'}`}>{money(total)}</span>
              </div>
              <ul>
                {lines.map((l) => (
                  <li key={l.item.id}>
                    <button onClick={() => setLine(l)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-right last:border-0 hover:bg-soft">
                      <div className="min-w-0 flex-1">
                        <div className={`truncate font-medium ${l.skipped ? 'text-muted line-through' : ''}`}>{l.item.name}</div>
                        <div className="truncate text-xs text-muted">
                          {[l.item.category, l.count && `תשלום ${l.index}/${l.count}`, l.changed && !l.skipped && `שונה לחודש הזה (רגיל ${money(l.planned)})`, l.skipped && 'לא בחודש הזה']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span className={`num shrink-0 font-medium ${l.skipped ? 'text-muted' : ''}`}>{money(l.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {line && (
        <LineSheet
          line={line}
          month={month}
          onClose={() => setLine(null)}
          onEdit={() => {
            setEdit({ item: line.item });
            setLine(null);
          }}
        />
      )}
      {edit && <ItemEditor data={data} item={edit.item} kind={edit.kind} month={month} onClose={() => setEdit(null)} />}
    </div>
  );
}

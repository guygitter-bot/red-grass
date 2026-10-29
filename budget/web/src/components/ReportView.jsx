// הדוח החודשי: כמו הגיליון באקסל – כרטיס לכל קטגוריה, סיכום בסוף, הדפסה והורדה לאקסל
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { addMonths, forecast, lineDetail, money, monthName, reportGroups, thisMonth } from '../lib/budget';

const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// קובץ CSV של הדוח (BOM כדי שאקסל יקרא עברית נכון)
function reportCsv(s, groups) {
  const rows = [['קטגוריה', 'שם', 'סכום', 'פירוט', 'אמצעי תשלום', 'הערה']];
  for (const g of groups) {
    for (const l of g.lines) rows.push([g.category, l.item.name, l.amount, lineDetail(l), l.item.payment, l.item.note]);
    rows.push([g.category, `סה״כ ${g.category}`, g.total, '', '', '']);
    rows.push([]);
  }
  rows.push(['', 'סה״כ הכנסות', s.income, '', '', '']);
  rows.push(['', 'סה״כ הוצאות', s.expense, '', '', '']);
  rows.push(['', s.net < 0 ? 'יתרה (חובה)' : 'יתרה (זכות)', s.net, '', '', '']);
  if (s.balance != null) rows.push(['', 'יתרה צפויה בבנק בסוף החודש', Math.round(s.balance), '', '', '']);
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportView({ data, month, go }) {
  const s = useMemo(() => forecast(data, month, 1)[0], [data, month]);
  const groups = useMemo(() => reportGroups(s), [s]);
  const now = thisMonth();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button onClick={() => go(addMonths(month, -1))} className="rounded-full p-2 hover:bg-soft print:hidden" aria-label="חודש קודם">
          <ChevronRight />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold lg:text-2xl">דוח חודשי – {monthName(month)}</h1>
          {month !== now && (
            <button onClick={() => go(now)} className="text-sm text-accent-ink print:hidden">
              חזרה לחודש הנוכחי
            </button>
          )}
        </div>
        <button onClick={() => go(addMonths(month, 1))} className="rounded-full p-2 hover:bg-soft print:hidden" aria-label="חודש הבא">
          <ChevronLeft />
        </button>
      </div>

      <div className="mb-4 flex gap-2 print:hidden">
        <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line bg-card px-3 py-2.5 font-medium hover:bg-soft">
          <Printer size={18} /> הדפסה
        </button>
        <button
          onClick={() => download(`דוח-${month}.csv`, reportCsv(s, groups))}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line bg-card px-3 py-2.5 font-medium hover:bg-soft"
        >
          <Download size={18} /> לאקסל
        </button>
      </div>

      {s.lines.length === 0 && <div className="rounded-2xl bg-card p-6 text-center text-muted shadow-sm">אין הוצאות או הכנסות בחודש הזה.</div>}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {groups.map((g) => (
          <section key={`${g.kind}:${g.category}`} className="break-inside-avoid overflow-hidden rounded-2xl bg-card shadow-sm print:border print:border-line print:shadow-none">
            <h2 className={`border-b border-line px-3 py-2.5 font-bold ${g.kind === 'income' ? 'text-plus' : ''}`}>{g.category}</h2>
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-3 py-1.5 text-right font-medium">שם</th>
                  <th className="w-20 px-2 py-1.5 text-left font-medium">סכום</th>
                  <th className="w-24 px-2 py-1.5 text-right font-medium">פירוט</th>
                  <th className="hidden w-28 px-2 py-1.5 text-right font-medium sm:table-cell">אמצעי תשלום</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l) => (
                  <tr key={l.item.id} className="border-t border-line align-top">
                    <td className={`px-3 py-2 ${l.skipped ? 'text-muted line-through' : ''}`}>
                      <div className="break-words font-medium">{l.item.name}</div>
                      {l.item.payment && <div className="break-words text-xs font-normal text-muted sm:hidden">{l.item.payment}</div>}
                      {l.changed && !l.skipped && <span className="mt-0.5 inline-block rounded-full bg-soft px-1.5 text-[11px] text-accent-ink">שונה</span>}
                    </td>
                    <td className={`num px-2 py-2 text-left ${l.skipped ? 'text-muted line-through' : ''}`}>{money(l.amount)}</td>
                    <td className="px-2 py-2 text-right text-xs">
                      <div className={`break-words ${l.skipped ? 'text-muted line-through' : ''}`}>{lineDetail(l)}</div>
                      {l.item.note && <div className="break-words text-muted">{l.item.note}</div>}
                    </td>
                    <td className="hidden break-words px-2 py-2 text-right text-xs text-muted sm:table-cell">{l.item.payment}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line font-bold">
                  <td className="px-3 py-2">סה״כ</td>
                  <td className={`num px-2 py-2 text-left ${g.kind === 'income' ? 'text-plus' : 'text-minus'}`}>{money(g.total)}</td>
                  <td colSpan={2} className="hidden sm:table-cell" />
                  <td className="sm:hidden" />
                </tr>
              </tfoot>
            </table>
          </section>
        ))}
      </div>

      {s.lines.length > 0 && (
        <section className="mt-4 break-inside-avoid rounded-2xl bg-card p-4 shadow-sm print:border print:border-line print:shadow-none lg:max-w-md">
          <h2 className="mb-2 font-bold">סיכום החודש</h2>
          <div className="flex justify-between py-1">
            <span>סה״כ הכנסות</span>
            <span className="num font-bold text-plus">{money(s.income)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>סה״כ הוצאות</span>
            <span className="num font-bold text-minus">{money(s.expense)}</span>
          </div>
          <div className="flex justify-between border-t border-line py-1 pt-2">
            <span>יתרה ({s.net < 0 ? 'חובה' : 'זכות'})</span>
            <span className={`num font-bold ${s.net < 0 ? 'text-minus' : 'text-plus'}`}>{money(s.net, true)}</span>
          </div>
          {s.balance != null && (
            <div className="flex justify-between py-1">
              <span>יתרה צפויה בבנק בסוף החודש</span>
              <span className={`num font-bold ${s.balance < 0 ? 'text-minus' : ''}`}>{money(s.balance)}</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

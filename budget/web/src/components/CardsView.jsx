// מעקב כרטיסי אשראי: כמה ירד מכל כרטיס בכל חודש (כמו בגיליון "מעקב כרטיסים"). רק למעקב – לא נכנס לסיכום החודש
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { addMonths, cardTable, money, monthName, thisMonth } from '../lib/budget';
import { remove, save } from '../lib/store';
import { inputCls } from './ui';

export default function CardsView({ data }) {
  const [month, setMonth] = useState(thisMonth());
  const [newName, setNewName] = useState('');
  const { names, rows } = useMemo(() => cardTable(data), [data]);
  const [extra, setExtra] = useState([]);
  const all = [...new Set([...names, ...extra])];
  const current = rows.find((r) => r.month === month);

  const setAmount = (name, value) => {
    const id = `card:${name}:${month}`;
    const amount = Number(String(value).replace(/[,₪\s]/g, ''));
    if (String(value).trim() === '' || !Number.isFinite(amount) || amount <= 0) remove(id);
    else save({ id, t: 'card', name, month, amount });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">כרטיסי אשראי</h1>
      <p className="mb-4 text-sm text-muted">כמה ירד מכל כרטיס בחודש. למעקב ולגרפים בלבד – לא נכנס לסיכום החודש (ההוצאות עצמן כבר רשומות בנפרד).</p>

      <div className="mb-4 rounded-2xl bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setMonth(addMonths(month, -1))} className="rounded-full p-2 hover:bg-soft" aria-label="חודש קודם">
            <ChevronRight />
          </button>
          <div className="text-center">
            <div className="font-bold">{monthName(month)}</div>
            <div className="num text-sm text-muted">סה״כ {money(current?.total || 0)}</div>
          </div>
          <button onClick={() => setMonth(addMonths(month, 1))} className="rounded-full p-2 hover:bg-soft" aria-label="חודש הבא">
            <ChevronLeft />
          </button>
        </div>
        {all.map((name) => (
          <label key={`${name}:${month}`} className="mb-2 flex items-center gap-3">
            <span className="flex-1 truncate">{name}</span>
            <input
              className={`${inputCls} num w-32`}
              inputMode="decimal"
              defaultValue={current?.byName[name] || ''}
              placeholder="₪"
              onBlur={(e) => {
                if (String(current?.byName[name] || '') !== e.target.value) setAmount(name, e.target.value);
              }}
            />
          </label>
        ))}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) setExtra([...extra, newName.trim()]);
            setNewName('');
          }}
        >
          <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="כרטיס חדש (שם)" />
          <button className="flex items-center gap-1 rounded-xl border border-line bg-card px-3 font-medium hover:bg-soft">
            <Plus size={18} /> הוספה
          </button>
        </form>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-card shadow-sm">
          <table className="num w-full text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="p-2 text-right font-medium">חודש</th>
                {names.map((n) => (
                  <th key={n} className="p-2 text-right font-medium whitespace-nowrap">
                    {n}
                  </th>
                ))}
                <th className="p-2 text-right font-medium">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.month} className="cursor-pointer border-b border-line last:border-0 hover:bg-soft" onClick={() => setMonth(r.month)}>
                  <td className="p-2 font-medium whitespace-nowrap">{monthName(r.month, true)}</td>
                  {names.map((n) => (
                    <td key={n} className="p-2 whitespace-nowrap">
                      {r.byName[n] ? money(r.byName[n]) : '—'}
                    </td>
                  ))}
                  <td className="p-2 font-bold whitespace-nowrap">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

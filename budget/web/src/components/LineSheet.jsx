// לחיצה על שורה במסך החודש: סכום אחר רק לחודש הזה, דילוג על החודש, או עריכה של הרשומה כולה
import { useState } from 'react';
import { TYPES, EVERY, lastMonth, money, monthName } from '../lib/budget';
import { remove, save } from '../lib/store';
import { Button, Field, Sheet, inputCls } from './ui';

export default function LineSheet({ line, month, onEdit, onClose }) {
  const { item } = line;
  const [amount, setAmount] = useState(String(line.amount));
  const ovId = `ov:${item.id}:${month}`;
  const value = Number(String(amount).replace(/[,₪\s]/g, ''));

  const setMonth = (v) => {
    if (v === line.planned) remove(ovId);
    else save({ id: ovId, t: 'override', itemId: item.id, month, amount: v });
    onClose();
  };

  const end = lastMonth(item);
  return (
    <Sheet title={item.name} onClose={onClose}>
      <div className="mb-4 space-y-1 rounded-2xl bg-soft p-3 text-sm">
        <div>
          {item.kind === 'income' ? 'הכנסה' : 'הוצאה'} {TYPES[item.type]}
          {item.type === 'fixed' && item.every > 1 && ` · ${EVERY[item.every]}`}
          {item.category && ` · ${item.category}`}
        </div>
        {line.count && (
          <div>
            תשלום {line.index} מתוך {line.count} · נשארו {line.count - line.index} אחרי החודש הזה
          </div>
        )}
        <div className="text-muted">
          {item.type === 'once' ? monthName(item.start) : `מ${monthName(item.start)}${end ? ` עד ${monthName(end)}` : ' · בלי סוף'}`}
        </div>
        <div>
          סכום רגיל: <b className="num">{money(line.planned)}</b>
        </div>
        {item.note && <div className="text-muted">{item.note}</div>}
      </div>
      {item.type !== 'once' && (
        <>
          <Field label={`סכום ב${monthName(month)} בלבד`}>
            <input className={`${inputCls} num`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button className="flex-1" disabled={!Number.isFinite(value) || value < 0} onClick={() => setMonth(value)}>
              שמירה לחודש הזה
            </Button>
            {!line.skipped && (
              <Button kind="ghost" onClick={() => setMonth(0)}>
                לא בחודש הזה
              </Button>
            )}
            {line.changed && (
              <Button kind="ghost" onClick={() => setMonth(line.planned)}>
                חזרה לסכום הרגיל
              </Button>
            )}
          </div>
        </>
      )}
      <Button kind="ghost" className="w-full" onClick={onEdit}>
        עריכה בכל החודשים
      </Button>
    </Sheet>
  );
}

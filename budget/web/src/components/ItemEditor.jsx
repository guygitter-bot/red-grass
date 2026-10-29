// הוספה / עריכה של הכנסה או הוצאה (קבועה, תשלומים או חד־פעמית)
import { useState } from 'react';
import { CATEGORIES, EVERY, addMonths, monthName, safeItem } from '../lib/budget';
import { newId, remove, save } from '../lib/store';
import { Button, Field, Segmented, Sheet, inputCls } from './ui';

// כל החודשים לבחירה: שנה אחורה ו-6 שנים קדימה (וגם החודש שכבר שמור, אם הוא רחוק יותר)
function monthOptions(around, keep) {
  const list = Array.from({ length: 84 }, (_, i) => addMonths(around, i - 12));
  if (keep && !list.includes(keep)) list.push(keep);
  return list.sort();
}

export default function ItemEditor({ item, month, kind = 'expense', data, onClose }) {
  const [f, setF] = useState(() =>
    item ? { ...safeItem(item), amount: String(safeItem(item).amount) } : { kind, type: 'fixed', name: '', category: '', amount: '', start: month, end: '', every: 1, count: 12, payment: '', note: '' },
  );
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const amount = Number(String(f.amount).replace(/[,₪\s]/g, ''));
  const ok = f.name.trim() && Number.isFinite(amount) && amount > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    save({
      id: item?.id || newId(),
      t: 'item',
      kind: f.kind,
      type: f.type,
      name: f.name.trim(),
      category: f.category.trim(),
      amount,
      start: f.start,
      end: f.type === 'fixed' ? f.end : '',
      every: f.type === 'fixed' ? Number(f.every) : 1,
      count: f.type === 'installments' ? Math.max(1, Math.round(Number(f.count)) || 1) : 1,
      payment: f.payment.trim(),
      note: f.note.trim(),
    });
    onClose();
  };

  const del = () => {
    if (confirm(`למחוק את "${item.name}" מכל החודשים?`)) {
      remove(item.id);
      onClose();
    }
  };

  const months = monthOptions(month, f.start);
  // הצעות: הקטגוריות ואמצעי התשלום שכבר בשימוש, ואחריהן ברירות המחדל
  const items = data?.items || [];
  const cats = [...new Set([...items.filter((i) => i.kind === f.kind).map((i) => i.category), ...CATEGORIES[f.kind]].filter(Boolean))];
  const payments = [...new Set(items.map((i) => i.payment).filter(Boolean))];
  const income = f.kind === 'income';
  return (
    <Sheet title={item ? 'עריכה' : income ? 'הכנסה חדשה' : 'הוצאה חדשה'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="mb-3">
          <Segmented value={f.kind} onChange={set('kind')} options={[['expense', 'הוצאה'], ['income', 'הכנסה']]} />
        </div>
        <div className="mb-3">
          <Segmented value={f.type} onChange={set('type')} options={[['fixed', 'קבועה'], ['installments', 'תשלומים'], ['once', 'חד־פעמית']]} />
        </div>
        <Field label="שם">
          <input className={inputCls} value={f.name} onChange={set('name')} placeholder={income ? 'למשל: משכורת' : 'למשל: ארנונה'} autoFocus={!item} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.type === 'installments' ? 'סכום כל תשלום' : 'סכום'}>
            <input className={`${inputCls} num`} inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="₪" />
          </Field>
          <Field label="קטגוריה">
            <input className={inputCls} list={`cats-${f.kind}`} value={f.category} onChange={set('category')} placeholder="בחירה או כתיבה" />
            <datalist id={`cats-${f.kind}`}>
              {cats.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.type === 'once' ? 'באיזה חודש' : f.type === 'installments' ? 'תשלום ראשון' : 'מאיזה חודש'}>
            <select className={inputCls} value={f.start} onChange={set('start')}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
          </Field>
          {f.type === 'fixed' && (
            <Field label="עד איזה חודש">
              <select className={inputCls} value={f.end} onChange={set('end')}>
                <option value="">בלי סוף</option>
                {months
                  .filter((m) => m >= f.start)
                  .map((m) => (
                    <option key={m} value={m}>
                      {monthName(m)}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {f.type === 'installments' && (
            <Field label="מספר תשלומים" hint={`אחרון: ${monthName(addMonths(f.start, Math.max(1, Number(f.count) || 1) - 1))}`}>
              <input className={`${inputCls} num`} inputMode="numeric" value={f.count} onChange={set('count')} />
            </Field>
          )}
        </div>
        {f.type === 'fixed' && (
          <Field label="כל כמה זמן">
            <select className={inputCls} value={f.every} onChange={set('every')}>
              {Object.entries(EVERY).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {f.type === 'installments' && ok && (
          <p className="mb-3 rounded-xl bg-soft p-3 text-sm">
            סה״כ: <b className="num">₪{Math.round(amount * (Number(f.count) || 1)).toLocaleString('he-IL')}</b> ב-{Number(f.count) || 1} תשלומים
          </p>
        )}
        <Field label="אמצעי תשלום (רשות)">
          <input className={inputCls} list="payments" value={f.payment} onChange={set('payment')} placeholder='למשל: כ"א 8328 / הוראת קבע' />
          <datalist id="payments">
            {payments.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="הערה (רשות)">
          <input className={inputCls} value={f.note} onChange={set('note')} placeholder="למשל: משוער" />
        </Field>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" disabled={!ok}>
            שמירה
          </Button>
          {item && (
            <Button type="button" kind="danger" onClick={del}>
              מחיקה
            </Button>
          )}
        </div>
        {item && <p className="mt-2 text-xs text-muted">שינוי כאן חל על כל החודשים. לשינוי בחודש אחד בלבד – לוחצים על השורה במסך החודש.</p>}
      </form>
    </Sheet>
  );
}

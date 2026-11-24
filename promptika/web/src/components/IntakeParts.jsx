// חלקים קטנים של טופס הקליטה: שדה לפי סוג, תג התקדמות, שורה חוזרת
import { Trash2 } from 'lucide-react';
import { inputClass } from './ui';

const CHIP = {
  empty: { text: 'ריק', cls: 'border-line bg-page text-muted' },
  partial: { text: 'חלקי', cls: 'border-orange/50 bg-soft text-orange-ink' },
  filled: { text: 'מלא', cls: 'border-turq/50 bg-turq/15 text-turq-ink' },
};

export function StatusChip({ status }) {
  const c = CHIP[status];
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${c.cls}`}>{c.text}</span>;
}

// שדה אחד: טקסט קצר / ארוך / מספר / בחירה
export function IntakeField({ def, value, onChange, idPrefix }) {
  const id = `${idPrefix}-${def.key}`;
  const span = def.wide ? 'lg:col-span-2' : '';
  if (def.type === 'choice') {
    return (
      <fieldset className={span}>
        <legend className="mb-1 text-sm font-medium text-ink">{def.label}</legend>
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const on = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                // לחיצה שנייה מנקה את הבחירה – אפשר לדלג
                onClick={() => onChange(on ? '' : o.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${on ? 'border-turq bg-turq/15 text-turq-ink' : 'border-line bg-card text-ink hover:border-turq'}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }
  return (
    <div className={span}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">{def.label}</label>
      {def.type === 'area' ? (
        <textarea id={id} rows={3} className={`${inputClass} resize-y`} value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : def.type === 'number' ? (
        <div className="flex items-center gap-2">
          <input id={id} type="number" inputMode="decimal" min="0" dir="ltr" className={`${inputClass} text-end`} value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
          {def.suffix && <span className="shrink-0 text-sm text-muted">{def.suffix}</span>}
        </div>
      ) : (
        <input id={id} type="text" className={inputClass} value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// כרטיס של שורה חוזרת עם כפתור מחיקה
export function RowCard({ title, onRemove, children }) {
  return (
    <div className="rounded-lg border border-line bg-page p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-muted">{title}</span>
        <button type="button" onClick={onRemove} aria-label={`מחיקת ${title}`} className="rounded-lg p-1.5 text-danger hover:bg-card">
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
      {children}
    </div>
  );
}

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { DIETS } from '../lib/diet';

// סינון לפי כשרות, רגישויות, תזונה וזמן (כמה ביחד = מתכונים שמתאימים לכולם). הערכה לפי המצרכים
export default function DietFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const groups = [...new Set(DIETS.map((d) => d.group))];
  const label = (id) => DIETS.find((d) => d.id === id)?.label || id;
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border inline-flex items-center gap-1 ${value.length ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-stone-200 text-stone-700'}`}
      >
        <SlidersHorizontal size={14} /> {value.length ? `סינון (${value.length})` : 'כשר, ללא גלוטן ועוד'}
      </button>
      {!open && value.length > 0 && value.map((id) => (
        <button key={id} onClick={() => toggle(id)} className="shrink-0 rounded-full px-3 py-1.5 text-sm border border-orange-300 bg-orange-50 text-orange-800 inline-flex items-center gap-1">
          {label(id)} <X size={13} />
        </button>
      ))}
      {open && (
        <div className="basis-full rounded-2xl bg-white border border-stone-200 p-3 space-y-3">
          {groups.map((g) => (
            <div key={g}>
              <div className="text-xs font-bold text-stone-500 mb-1.5">{g}</div>
              <div className="flex flex-wrap gap-2">
                {DIETS.filter((d) => d.group === g).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    className={`rounded-full px-3 py-1.5 text-sm border ${value.includes(d.id) ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-stone-200 text-stone-700'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-stone-500 leading-relaxed">
            לפי המצרכים שבמתכון – הערכה בלבד, לא תעודת כשרות ולא אישור רפואי. בצליאקיה ובאלרגיות כדאי לבדוק גם את התוויות של המוצרים.
            קלוריות, חלבון ופחמימות – רק במתכונים שיש להם ערכים תזונתיים.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="rounded-full bg-orange-500 text-white px-4 py-1.5 text-sm font-bold">סגירה</button>
            {value.length > 0 && <button onClick={() => onChange([])} className="rounded-full border border-stone-200 px-4 py-1.5 text-sm">ניקוי הסינון</button>}
          </div>
        </div>
      )}
    </>
  );
}

// מדידה בלי ארוחה (בבוקר, בלילה, לפני/אחרי ספורט, טיפול בנמוך)
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { level, numOrEmpty } from '../lib/diary';
import { newId, remove, save } from '../lib/store';
import { getMe } from '../lib/me';
import { Button, Field, Sheet, inputCls } from './ui';
import { Glucose } from './bits';

const NOTES = ['בוקר בצום', 'לילה', 'לפני ספורט', 'אחרי ספורט', 'אחרי טיפול בנמוך', 'לפני שינה'];

export default function ReadingEditor({ data, reading, onClose }) {
  const [r, setR] = useState({ ...reading, value: String(reading.value ?? ''), note: reading.note || '' });
  const v = numOrEmpty(r.value);
  const submit = (e) => {
    e.preventDefault();
    if (!(v > 0)) return;
    save({ ...r, id: reading.id || newId('r'), t: 'reading', value: v, by: reading.by || getMe() });
    onClose();
  };
  return (
    <Sheet title={reading.id ? 'מדידה' : 'מדידה חדשה'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="שעה">
            <input type="time" className={`${inputCls} num`} value={r.time} onChange={(e) => setR({ ...r, time: e.target.value })} required />
          </Field>
          <Field label="סוכר (mg/dL)">
            <input className={`${inputCls} num text-lg`} inputMode="numeric" value={r.value} onChange={(e) => setR({ ...r, value: e.target.value })} autoFocus required />
          </Field>
        </div>
        {v > 0 && (
          <div className="-mt-1 mb-3 flex items-center gap-2 text-sm">
            <Glucose value={v} settings={data.settings} />
            {level(v, data.settings) === 'low' && <span className="text-low">נמוך – לטפל ולמדוד שוב אחרי 15 דקות</span>}
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {NOTES.map((n) => (
            <button key={n} type="button" onClick={() => setR({ ...r, note: r.note === n ? '' : n })} className={`rounded-full border px-3 py-1 text-sm ${r.note === n ? 'border-accent bg-soft text-accent-ink' : 'border-line text-muted'}`}>
              {n}
            </button>
          ))}
        </div>
        <Field label="הערה">
          <input className={inputCls} value={r.note} onChange={(e) => setR({ ...r, note: e.target.value })} />
        </Field>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!(v > 0)}>
            שמירה
          </Button>
          {reading.id && (
            <Button
              type="button"
              kind="danger"
              aria-label="מחיקה"
              onClick={() => {
                if (confirm('למחוק את המדידה?')) {
                  remove(reading.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={18} />
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

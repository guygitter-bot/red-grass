// הזריקה הלילית (ארוכת טווח): לחיצה אחת – ממולא מראש בכמות ובשעה הרגילות (מההגדרות), ואפשר לשנות.
// נשמרת כמדידה עם basal: true – יחידות, מדד הסוכר באותה שעה (לא חובה) ומיקום הזריקה.
import { useState } from 'react';
import { Moon, Trash2 } from 'lucide-react';
import { SITES, lastSite, nowTime, numOrEmpty } from '../lib/diary';
import { newId, remove, save } from '../lib/store';
import { getMe } from '../lib/me';
import { Button, Field, Sheet, inputCls } from './ui';
import { Glucose, SitePicker } from './bits';

export default function BasalEditor({ data, date, existing, onClose }) {
  const s = data.settings;
  const [r, setR] = useState(() => ({
    time: existing?.time || (date === data.today && nowTime() > '20:00' ? nowTime() : s.basalTime),
    insulin: String(existing ? existing.insulin : s.basalDose),
    value: existing && existing.value !== '' ? String(existing.value) : '',
    site: existing?.site || '',
    note: existing?.note || '',
  }));
  const [asDefault, setAsDefault] = useState(false);
  const dose = numOrEmpty(r.insulin);
  const v = numOrEmpty(r.value);
  const prevSite = lastSite(data, { id: existing?.id || '-', date, time: r.time });
  const changedDose = dose !== '' && dose !== s.basalDose;

  const submit = (e) => {
    e.preventDefault();
    if (!(dose > 0)) return;
    save({ ...(existing || {}), id: existing?.id || newId('b'), t: 'reading', basal: true, date, time: r.time, insulin: dose, value: v > 0 ? v : '', site: r.site, note: r.note, by: existing?.by || getMe() });
    // הכמות החדשה הופכת לקבועה (לפעמים הבאות)
    if (asDefault && changedDose) save({ id: 'settings', t: 'settings', ...s, basalDose: dose });
    onClose();
  };

  return (
    <Sheet title="🌙 זריקה לילית" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="יחידות">
            <input className={`${inputCls} num text-lg font-bold`} inputMode="decimal" value={r.insulin} onChange={(e) => setR({ ...r, insulin: e.target.value })} required />
          </Field>
          <Field label="שעה">
            <input type="time" className={`${inputCls} num`} value={r.time} onChange={(e) => setR({ ...r, time: e.target.value })} required />
          </Field>
        </div>
        {changedDose && (
          <label className="-mt-1 mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asDefault} onChange={(e) => setAsDefault(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            מעכשיו {dose} יחידות בכל ערב (במקום {s.basalDose})
          </label>
        )}
        <Field label="מדד הסוכר עכשיו (לא חובה)">
          <div className="flex items-center gap-2">
            <input className={`${inputCls} num`} inputMode="numeric" value={r.value} onChange={(e) => setR({ ...r, value: e.target.value })} placeholder="mg/dL" autoFocus={!existing} />
            {v > 0 && <Glucose value={v} settings={s} />}
          </div>
        </Field>
        <Field label="מיקום הזריקה" hint={prevSite ? `בפעם הקודמת: ${SITES[prevSite]}` : ''}>
          <SitePicker value={r.site} prev={prevSite} onChange={(site) => setR({ ...r, site })} />
        </Field>
        <Field label="הערה">
          <input className={inputCls} value={r.note} onChange={(e) => setR({ ...r, note: e.target.value })} />
        </Field>
        <div className="flex gap-2">
          <Button className="flex flex-1 items-center justify-center gap-2" disabled={!(dose > 0)}>
            <Moon size={18} /> שמירה
          </Button>
          {existing && (
            <Button
              type="button"
              kind="danger"
              aria-label="מחיקה"
              onClick={() => {
                if (confirm('למחוק את הזריקה הלילית?')) {
                  remove(existing.id);
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

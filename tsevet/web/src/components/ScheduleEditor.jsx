// חלון יצירה / עריכה של משימה קבועה
import { useState } from 'react';
import { DAY_CHIPS, defaultForm, formFrom } from '../lib/schedules';
import { Button, Field, Segmented, Sheet, inputCls } from './ui';

export default function ScheduleEditor({ initial, agents, budgets, onClose, onSave }) {
  const [f, setF] = useState(() => (initial.id ? formFrom(initial) : defaultForm(agents)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const toggleDay = (d) => set({ days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() });

  const save = async (e) => {
    e.preventDefault();
    if (!f.text.trim()) return setError('צריך לכתוב מה לעשות');
    if (f.days.length === 0) return setError('צריך לבחור לפחות יום אחד');
    setBusy(true);
    setError('');
    const body = { ...f, text: f.text.trim(), title: f.title.trim() };
    const r = await onSave(body);
    // כשל – השגיאה מוצגת גם במסך הרשימה, כאן נשארים לתקן
    if (!r) setError('השמירה לא הצליחה, אפשר לנסות שוב');
    setBusy(false);
  };

  return (
    <Sheet title={initial.id ? 'עריכת משימה קבועה' : 'משימה קבועה חדשה'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="מה לעשות">
          <textarea
            className={`${inputCls} min-h-28`}
            value={f.text}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="תבדוק מה חדש במאגר AI על עריכת וידאו, ותלמד את עורך הווידאו את מה שחשוב"
          />
        </Field>
        <Field label="שם קצר (לא חובה)">
          <input className={inputCls} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="אם ריק – תחילת הטקסט" />
        </Field>
        <Field label="מי עושה">
          <select className={inputCls} value={f.to ?? ''} onChange={(e) => set({ to: e.target.value || null })}>
            {agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.emoji} {a.name}
              </option>
            ))}
            <option value="">כל הצוות (הם מחליטים)</option>
          </select>
        </Field>
        <div className="mb-3">
          <span className="mb-1 block text-sm font-medium text-muted">באילו ימים</span>
          <div className="flex gap-1.5">
            {DAY_CHIPS.map((c, d) => (
              <button
                key={d}
                type="button"
                aria-pressed={f.days.includes(d)}
                onClick={() => toggleDay(d)}
                className={`h-10 flex-1 rounded-full border text-sm font-medium ${f.days.includes(d) ? 'border-accent bg-accent text-white' : 'border-line bg-page text-muted'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => set({ days: [0, 1, 2, 3, 4, 5, 6] })} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-soft">
              כל יום
            </button>
            <button type="button" onClick={() => set({ days: [0, 1, 2, 3, 4] })} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-soft">
              ימי חול
            </button>
          </div>
        </div>
        <Field label="באיזו שעה">
          <input type="time" step="60" className={inputCls} value={f.time} onChange={(e) => set({ time: e.target.value })} required />
        </Field>
        <div className="mb-3">
          <span className="mb-1 block text-sm font-medium text-muted">תקרת הוצאה לכל הפעלה</span>
          <Segmented value={f.budget} options={budgets.map((b) => [b, `$${b}`])} onChange={(b) => set({ budget: b })} />
          <span className="mt-1 block text-xs text-muted">אם המשימה מגיעה לתקרה – היא נעצרת, וממשיכים בבוקר</span>
        </div>
        {error && <p className="mb-3 text-sm text-bad">{error}</p>}
        <Button className="w-full" disabled={busy}>
          {busy ? 'שומר…' : 'שמירה'}
        </Button>
      </form>
    </Sheet>
  );
}

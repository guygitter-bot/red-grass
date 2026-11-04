// עריכת ארוחה: מה אכל, כמה מנות, סוכר לפני, כמה אינסולין, ומדידות אחרי (שעה + ערך).
// מתחת – הפעמים הקודמות של אותה ארוחה (כמה אינסולין ניתן ומה יצא), כדי ללמוד מה עובד.
import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { SLOTS, TAGS, dayLabel, level, LEVEL_TEXT, minutes, nowTime, numOrEmpty, outcome, safeMeal, similarMeals, suggestByRatio } from '../lib/diary';
import { newId, remove, save } from '../lib/store';
import { getMe } from '../lib/me';
import { Button, Field, Sheet, inputCls } from './ui';
import { Glucose } from './bits';

const PORTIONS = [0.5, 1, 1.5, 2, 3];

// שעה + דקות (למדידה "שעתיים אחרי")
function plus(time, mins) {
  const t = (minutes(time) + mins) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export default function MealEditor({ data, meal, onClose }) {
  const isNew = !meal.id;
  const [m, setM] = useState(() => {
    const safe = safeMeal(meal);
    // שדות מספר נערכים כטקסט (כדי שאפשר יהיה להקליד "1.5")
    return { ...safe, before: String(safe.before), insulin: String(safe.insulin), carbs: String(safe.carbs), readings: safe.readings.map((r) => ({ ...r, value: String(r.value) })) };
  });
  const [asFixed, setAsFixed] = useState(false);
  const set = (patch) => setM((x) => ({ ...x, ...patch }));
  const s = data.settings;

  const previous = useMemo(() => similarMeals(data, { ...safeMeal(m), id: meal.id || '-' }, 6), [data, m, meal.id]);
  const before = numOrEmpty(m.before);
  const calc = suggestByRatio(s, numOrEmpty(m.carbs), before);

  const submit = (e) => {
    e.preventDefault();
    const id = meal.id || newId('m');
    let templateId = m.templateId;
    if (asFixed && !templateId) {
      templateId = newId('t');
      save({ id: templateId, t: 'template', name: m.name, slot: m.slot, time: m.time, food: m.food, portion: numOrEmpty(m.portion) || 1, carbs: numOrEmpty(m.carbs), dose: numOrEmpty(m.insulin), days: [] });
    }
    save({
      ...m,
      id,
      t: 'meal',
      templateId,
      portion: numOrEmpty(m.portion) || 1,
      carbs: numOrEmpty(m.carbs),
      before: numOrEmpty(m.before),
      insulin: numOrEmpty(m.insulin),
      readings: m.readings.map((r) => ({ time: r.time, value: numOrEmpty(r.value) })).filter((r) => r.time && r.value !== ''),
      by: m.by || getMe(),
    });
    onClose();
  };

  const addReading = () => {
    const last = m.readings[m.readings.length - 1]?.time;
    const time = m.date === data.today ? nowTime() : plus(last || m.time, last ? 60 : 120);
    set({ readings: [...m.readings, { time, value: '' }] });
  };
  const setReading = (i, patch) => set({ readings: m.readings.map((r, j) => (i === j ? { ...r, ...patch } : r)) });

  return (
    <Sheet title={isNew ? 'ארוחה חדשה' : m.name} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="שם הארוחה">
            <input className={inputCls} value={m.name} onChange={(e) => set({ name: e.target.value })} list="meal-names" required />
            <datalist id="meal-names">
              {data.templates.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </Field>
          <Field label="שעה">
            <input type="time" className={`${inputCls} num`} value={m.time} onChange={(e) => set({ time: e.target.value })} required />
          </Field>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(SLOTS).map(([k, label]) => (
            <button key={k} type="button" onClick={() => set({ slot: k })} className={`rounded-full border px-3 py-1 text-sm ${m.slot === k ? 'border-accent bg-soft text-accent-ink' : 'border-line text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
        <Field label="מה אכל/ה">
          <textarea className={inputCls} rows={2} value={m.food} onChange={(e) => set({ food: e.target.value })} placeholder="למשל: אורז, שניצל, מלפפון" />
        </Field>

        <Field label="כמה מנות">
          <div className="flex flex-wrap items-center gap-1.5">
            {PORTIONS.map((p) => (
              <button key={p} type="button" dir="ltr" onClick={() => set({ portion: p })} className={`num min-w-12 rounded-xl border px-3 py-2 font-medium ${Number(m.portion) === p ? 'border-accent bg-soft text-accent-ink' : 'border-line'}`}>
                {p === 0.5 ? '½' : p === 1.5 ? '1½' : p}
              </button>
            ))}
            <input className={`${inputCls} num w-20`} inputMode="decimal" value={PORTIONS.includes(Number(m.portion)) ? '' : m.portion} onChange={(e) => set({ portion: e.target.value })} placeholder="אחר" aria-label="מנות – מספר אחר" />
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="סוכר לפני">
            <input className={`${inputCls} num`} inputMode="numeric" value={m.before} onChange={(e) => set({ before: e.target.value })} placeholder="mg/dL" />
          </Field>
          <Field label="אינסולין (יח׳)">
            <input className={`${inputCls} num`} inputMode="decimal" value={m.insulin} onChange={(e) => set({ insulin: e.target.value })} placeholder="יחידות" />
          </Field>
          <Field label="פחמימה (גרם)">
            <input className={`${inputCls} num`} inputMode="numeric" value={m.carbs} onChange={(e) => set({ carbs: e.target.value })} placeholder="לא חובה" />
          </Field>
        </div>
        {before !== '' && level(before, s) !== 'ok' && (
          <p className={`-mt-1 mb-3 rounded-xl p-2 text-sm ${level(before, s) === 'low' ? 'bg-low/15 text-low' : 'bg-high/15 text-high'}`}>
            {level(before, s) === 'low' ? `סוכר נמוך (${before}) – קודם לטפל בנמוך ולמדוד שוב אחרי 15 דקות.` : `הסוכר לפני ${LEVEL_TEXT[level(before, s)]} (${before}).`}
          </p>
        )}
        {calc && (
          <p className="-mt-1 mb-3 rounded-xl bg-soft p-2 text-sm">
            לפי ההגדרות שלכם: {calc.food} יח׳ לאוכל{calc.correction ? ` + ${calc.correction} תיקון` : ''} = <b className="num">{calc.total} יח׳</b>. חישוב בלבד – ההחלטה שלכם ושל הצוות.
          </p>
        )}

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-muted">מדידות אחרי הארוחה</span>
            <button type="button" onClick={addReading} className="flex items-center gap-1 text-sm font-medium text-accent-ink">
              <Plus size={16} /> מדידה
            </button>
          </div>
          {!m.readings.length && <p className="text-sm text-muted">למשל שעתיים אחרי, ושוב אחרי 4 שעות.</p>}
          {m.readings.map((r, i) => {
            const after = numOrEmpty(r.value);
            const mins = minutes(r.time) - minutes(m.time);
            return (
              <div key={i} className="mb-2 flex items-center gap-2">
                <input type="time" className={`${inputCls} num w-28`} value={r.time} onChange={(e) => setReading(i, { time: e.target.value })} aria-label="שעה" />
                <input className={`${inputCls} num w-24`} inputMode="numeric" value={r.value} onChange={(e) => setReading(i, { value: e.target.value })} placeholder="סוכר" aria-label="סוכר" autoFocus={!r.value} />
                {after !== '' && <Glucose value={after} settings={s} small />}
                {mins > 0 && <span className="num text-xs text-muted">+{Math.floor(mins / 60)}:{String(mins % 60).padStart(2, '0')}</span>}
                <button type="button" onClick={() => set({ readings: m.readings.filter((_, j) => j !== i) })} className="mr-auto rounded-full p-1.5 text-muted hover:bg-soft" aria-label="מחיקת מדידה">
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(TAGS).map(([k, label]) => {
            const on = m.tags.includes(k);
            return (
              <button key={k} type="button" onClick={() => set({ tags: on ? m.tags.filter((x) => x !== k) : [...m.tags, k] })} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-accent bg-soft text-accent-ink' : 'border-line text-muted'}`}>
                {label}
              </button>
            );
          })}
        </div>
        <Field label="הערה">
          <input className={inputCls} value={m.note} onChange={(e) => set({ note: e.target.value })} placeholder="למשל: הזריקה 10 דקות לפני האוכל" />
        </Field>
        {!m.templateId && (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asFixed} onChange={(e) => setAsFixed(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            להוסיף לתפריט הקבוע
          </label>
        )}

        {previous.length > 0 && (
          <div className="mb-4 rounded-2xl border border-line p-3">
            <div className="mb-2 text-sm font-bold">בפעמים הקודמות</div>
            <table className="num w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="text-right font-normal">מתי</th>
                  <th className="font-normal">מנות</th>
                  <th className="font-normal">לפני</th>
                  <th className="font-normal">אינסולין</th>
                  <th className="font-normal">שעתיים אחרי</th>
                </tr>
              </thead>
              <tbody>
                {previous.map((p) => {
                  const o = outcome(p);
                  return (
                    <tr key={p.id} className="border-t border-line text-center">
                      <td className="py-1.5 text-right">{dayLabel(p.date, data.today)}</td>
                      <td>{p.portion}</td>
                      <td>{p.before === '' ? '—' : <Glucose value={p.before} settings={s} small />}</td>
                      <td className="font-bold">{p.insulin === '' ? '—' : p.insulin}</td>
                      <td>{o.after2h === '' ? (o.peak === '' ? '—' : <Glucose value={o.peak} settings={s} small label="שיא" />) : <Glucose value={o.after2h} settings={s} small />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2">
          <Button className="flex-1">שמירה</Button>
          {!isNew && (
            <Button
              type="button"
              kind="danger"
              onClick={() => {
                if (confirm('למחוק את הארוחה?')) {
                  remove(meal.id);
                  onClose();
                }
              }}
              aria-label="מחיקה"
            >
              <Trash2 size={18} />
            </Button>
          )}
        </div>
        {m.by && <p className="mt-2 text-center text-xs text-muted">נרשם ע״י {m.by}</p>}
        {isNew && m.date !== data.today && <p className="mt-2 text-center text-xs text-muted">ל{dayLabel(m.date, data.today)}</p>}
      </form>
    </Sheet>
  );
}

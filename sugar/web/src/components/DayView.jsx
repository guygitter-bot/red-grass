// מסך היום: גרף הסוכר של היום, הארוחות (כרטיס לכל ארוחה עם לפני / אינסולין / מדידות אחרי), מדידות בלי ארוחה,
// "להוסיף את התפריט הקבוע" ותזכורת למדוד שעתיים אחרי ארוחה.
import { useState } from 'react';
import { BellRing, ChevronLeft, ChevronRight, ListPlus, Plus, Syringe, Trash2 } from 'lucide-react';
import { SITES, SLOTS, TAGS, addDays, allPoints, dayLabel, mealFromTemplate, missingFixed, nowTime, outcome, waitingForCheck } from '../lib/diary';
import { newId, remove, save } from '../lib/store';
import { getMe } from '../lib/me';
import { Button, Sheet } from './ui';
import { DayChart, Glucose } from './bits';
import MealEditor from './MealEditor';
import ReadingEditor from './ReadingEditor';

function MealCard({ meal, s, onOpen, onQuick }) {
  const o = outcome(meal);
  return (
    <article className="rounded-2xl bg-card p-4 shadow-sm">
      <button onClick={onOpen} className="block w-full text-right">
        <div className="mb-2 flex items-start gap-2">
          <span className="num rounded-lg bg-soft px-2 py-0.5 text-sm font-bold text-accent-ink">{meal.time}</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">
              {meal.name} <span className="text-sm font-normal text-muted">· {SLOTS[meal.slot]}</span>
            </div>
            {meal.food && <div className="truncate text-sm text-muted">{meal.food}</div>}
          </div>
          <span className="num shrink-0 text-sm text-muted">{meal.portion} {meal.portion === 1 ? 'מנה' : 'מנות'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Glucose value={meal.before} settings={s} small label="לפני" />
          <span className={`num inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-bold ${meal.insulin === '' ? 'bg-soft text-muted' : 'bg-accent/15 text-accent-ink'}`}>
            <Syringe size={14} /> {meal.insulin === '' ? '—' : `${meal.insulin} יח׳`}
          </span>
          {meal.site && <span className="text-xs text-muted">📍 {SITES[meal.site]}</span>}
          {meal.carbs !== '' && <span className="num text-xs text-muted">{meal.carbs} גר׳ פחמ׳</span>}
          {o.after.map((r, i) => (
            <Glucose key={i} value={r.value} settings={s} small label={r.time} />
          ))}
        </div>
        {(meal.tags.length > 0 || meal.note) && (
          <div className="mt-2 text-xs text-muted">
            {meal.tags.map((t) => TAGS[t]).join(' · ')}
            {meal.tags.length > 0 && meal.note && ' · '}
            {meal.note}
          </div>
        )}
      </button>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2">
        <button onClick={onQuick} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-accent-ink hover:bg-soft">
          <Plus size={16} /> מדידה אחרי
        </button>
        {meal.by && <span className="mr-auto text-xs text-muted">{meal.by}</span>}
        {/* מחיקה ישירות מהכרטיס (למשל ארוחה שנכנסה פעמיים בטעות) */}
        <button
          onClick={() => {
            if (confirm(`למחוק את "${meal.name}" (${meal.time})?`)) remove(meal.id);
          }}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-soft hover:text-minus ${meal.by ? '' : 'mr-auto'}`}
          aria-label={`מחיקת ${meal.name}`}
        >
          <Trash2 size={16} /> מחיקה
        </button>
      </div>
    </article>
  );
}

// מדידה מהירה אחרי ארוחה: רק שעה וערך
function QuickReading({ meal, s, onClose }) {
  const [time, setTime] = useState(nowTime());
  const [value, setValue] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const v = Number(value);
    if (!(v > 0)) return;
    save({ id: meal.id, readings: [...meal.readings, { time, value: v }] });
    onClose();
  };
  return (
    <Sheet title={`מדידה אחרי ${meal.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input type="time" className="num w-28 rounded-xl border border-line bg-page px-3 py-2.5" value={time} onChange={(e) => setTime(e.target.value)} aria-label="שעה" />
        <input className="num w-28 rounded-xl border border-line bg-page px-3 py-2.5 text-lg" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="סוכר" autoFocus aria-label="סוכר" />
        {Number(value) > 0 && <Glucose value={Number(value)} settings={s} />}
        <Button className="w-full" disabled={!(Number(value) > 0)}>
          שמירה
        </Button>
      </form>
    </Sheet>
  );
}

export default function DayView({ data, date, go, openCal }) {
  const s = data.settings;
  const [editing, setEditing] = useState(null);
  const [quick, setQuick] = useState(null);
  const [reading, setReading] = useState(null);
  const [picker, setPicker] = useState(false);
  const meals = data.meals.filter((m) => m.date === date);
  const loose = data.readings.filter((r) => r.date === date);
  const points = allPoints(data, date, date);
  const missing = missingFixed(data, date);
  const waiting = date === data.today ? waitingForCheck(data, date) : [];

  // ארוחה אחת מהתפריט – נפתח ישר מסך הארוחה (ממולא מהתפריט) כדי למלא סוכר ואינסולין ולשמור.
  // כמה ארוחות ביחד ("להוסיף את כל התפריט") – נשמרות מיד, וממלאים כל אחת אחר כך.
  const addFixed = (list) => {
    setPicker(false);
    if (list.length === 1) {
      setEditing({ ...mealFromTemplate(list[0], date), by: getMe(), fromMenu: true });
      return;
    }
    save(list.map((t) => ({ ...mealFromTemplate(t, date), id: newId('m'), by: getMe() })));
  };

  // ציר אחד של היום: ארוחות ומדידות לפי השעה
  const timeline = [...meals.map((m) => ({ kind: 'meal', time: m.time, m })), ...loose.map((r) => ({ kind: 'reading', time: r.time, r }))].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => go(addDays(date, -1))} className="rounded-full p-2 hover:bg-soft" aria-label="היום הקודם">
          <ChevronRight />
        </button>
        <div className="text-center">
          <button onClick={() => openCal(date.slice(0, 7))} className="text-xl font-bold hover:text-accent-ink" title="לוח שנה">
            {dayLabel(date, data.today)} 📅
          </button>
          {date !== data.today && (
            <button onClick={() => go(data.today)} className="text-sm text-accent-ink">
              חזרה להיום
            </button>
          )}
        </div>
        <button onClick={() => go(addDays(date, 1))} className="rounded-full p-2 hover:bg-soft" aria-label="היום הבא">
          <ChevronLeft />
        </button>
      </div>

      {waiting.map((m) => (
        <button key={m.id} onClick={() => setQuick(m)} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-high/15 p-3 text-right text-sm font-medium">
          <BellRing size={20} className="text-high" />
          עברו שעתיים מ{m.name} ({m.time}) – הגיע הזמן למדוד
        </button>
      ))}

      <section className="mb-4 rounded-2xl bg-card p-3 shadow-sm">
        {points.length ? <DayChart points={points} meals={meals} settings={s} /> : <p className="p-4 text-center text-sm text-muted">עוד אין מדידות ביום הזה</p>}
      </section>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Button onClick={() => setEditing({ t: 'meal', date, time: date === data.today ? nowTime() : '13:00', slot: 'other', name: '' })} className="flex items-center justify-center gap-1">
          <Plus size={18} /> ארוחה
        </Button>
        <Button kind="ghost" onClick={() => setReading({ t: 'reading', date, time: date === data.today ? nowTime() : '08:00', value: '' })} className="flex items-center justify-center gap-1">
          <Plus size={18} /> מדידה בלי ארוחה
        </Button>
        {data.templates.length > 0 && (
          <Button kind="ghost" onClick={() => setPicker(true)} className="col-span-2 flex items-center justify-center gap-1 lg:col-span-1">
            <ListPlus size={18} /> מהתפריט הקבוע{missing.length ? ` (${missing.length})` : ''}
          </Button>
        )}
      </div>

      {!timeline.length && (
        <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
          <p className="mb-2 font-bold">היום עוד ריק</p>
          <p className="text-sm text-muted">{data.templates.length ? 'אפשר להוסיף את כל הארוחות הקבועות בלחיצה אחת, ואז רק למלא סוכר ואינסולין.' : 'מוסיפים ארוחה, או בונים תפריט קבוע במסך "תפריט קבוע".'}</p>
          {missing.length > 0 && (
            <Button className="mt-3" onClick={() => addFixed(missing)}>
              להוסיף את כל התפריט הקבוע ({missing.length})
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {timeline.map((x) =>
          x.kind === 'meal' ? (
            <MealCard key={x.m.id} meal={x.m} s={s} onOpen={() => setEditing(x.m)} onQuick={() => setQuick(x.m)} />
          ) : (
            <button key={x.r.id} onClick={() => setReading(x.r)} className="flex items-center gap-3 rounded-2xl bg-card p-4 text-right shadow-sm">
              <span className="num rounded-lg bg-soft px-2 py-0.5 text-sm font-bold text-accent-ink">{x.r.time}</span>
              <span className="flex-1">מדידה{x.r.note ? ` · ${x.r.note}` : ''}</span>
              <Glucose value={x.r.value} settings={s} />
            </button>
          ),
        )}
      </div>

      {picker && (
        <Sheet title="מהתפריט הקבוע" onClose={() => setPicker(false)}>
          {missing.length > 1 && (
            <Button className="mb-3 w-full" onClick={() => addFixed(missing)}>
              להוסיף את כל מה שמתאים ליום הזה ({missing.length})
            </Button>
          )}
          <div className="overflow-hidden rounded-2xl border border-line">
            {data.templates
              .filter((t) => !t.archived)
              .map((t) => (
                <button key={t.id} onClick={() => addFixed([t])} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-right last:border-0 hover:bg-soft">
                  <span className="num text-sm text-muted">{t.time}</span>
                  <span className="flex-1">
                    <span className="font-medium">{t.name}</span>
                    {t.food && <span className="block truncate text-xs text-muted">{t.food}</span>}
                  </span>
                  {!missing.includes(t) && <span className="text-xs text-muted">כבר ביום</span>}
                  <Plus size={18} className="text-accent" />
                </button>
              ))}
          </div>
        </Sheet>
      )}
      {editing && <MealEditor data={data} meal={editing} onClose={() => setEditing(null)} />}
      {quick && <QuickReading meal={quick} s={s} onClose={() => setQuick(null)} />}
      {reading && <ReadingEditor data={data} reading={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { CalendarPlus, Share2 } from 'lucide-react';
import { useStore } from '../App';
import { forDay, isOverdue, sortTasks } from '../lib/store';
import { addDays, dayLabel, fromKey, todayKey, weekdayShort } from '../lib/dates';
import { downloadIcs } from '../lib/calendar';
import { listText, shareText } from '../lib/share';
import { TaskList } from './TaskItem';
import { Empty, QuickAdd, Section } from './ui';

export default function DayView({ day, setDay }) {
  const { state } = useStore();
  const today = todayKey();
  const strip = Array.from({ length: 21 }, (_, i) => addDays(today, i - 3));
  const selected = useRef(null);
  // בסוגריים מסולסלים: ב-Chrome החדש scrollIntoView מחזיר Promise, ו-React היה מנסה להריץ אותו כ"ניקוי" ביציאה מהמסך
  useEffect(() => {
    selected.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [day]);

  const tasks = sortTasks(forDay(state.tasks, day));
  const timed = tasks.filter((t) => t.time && !t.done);
  const rest = tasks.filter((t) => !t.time || t.done);
  const overdue = day === today ? sortTasks(state.tasks.filter((t) => isOverdue(t))) : [];
  const count = (key) => forDay(state.tasks, key).filter((t) => !t.done).length;

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
        {strip.map((key) => {
          const active = key === day;
          const n = count(key);
          return (
            <button key={key} ref={active ? selected : null} onClick={() => setDay(key)} className={`shrink-0 w-12 rounded-2xl py-2 flex flex-col items-center ${active ? 'bg-violet-600 text-white' : key === today ? 'bg-violet-100 text-violet-800' : 'bg-white border border-stone-200'}`}>
              <span className="text-[11px] opacity-80">{weekdayShort(key)}</span>
              <span className="font-bold">{fromKey(key).getDate()}</span>
              <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${n ? (active ? 'bg-white' : 'bg-violet-500') : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div>
          <h2 className="text-xl font-bold">{dayLabel(day)}</h2>
          <input type="date" aria-label="מעבר לתאריך" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="text-xs text-stone-500 bg-transparent" />
        </div>
        {tasks.length > 0 && (
          <div className="flex gap-1">
            <button aria-label="שיתוף הרשימה" title="שיתוף הרשימה בווטסאפ" onClick={() => shareText(listText(`משימות ל${dayLabel(day)}`, tasks))} className="p-2 rounded-xl bg-emerald-50 text-emerald-700"><Share2 size={18} /></button>
            <button aria-label="הוספה ליומן" title="כל משימות היום ליומן (קובץ)" onClick={() => downloadIcs(tasks.filter((t) => !t.done), `seder-${day}`)} className="p-2 rounded-xl bg-sky-50 text-sky-700"><CalendarPlus size={18} /></button>
          </div>
        )}
      </div>

      <div className="mt-3">
        <QuickAdd key={day} placeholder={`משימה מהירה ל${dayLabel(day)}... (למשל: לרופא ב10:00 !)`} defaults={{ due: day }} />
      </div>

      {overdue.length > 0 && (
        <Section title={`🔥 נשאר מימים קודמים (${overdue.length})`}>
          <TaskList tasks={overdue} />
        </Section>
      )}

      {timed.length > 0 && (
        <Section title="⏰ לפי שעה">
          <TaskList tasks={timed} showDate={false} />
        </Section>
      )}

      <Section title={timed.length ? 'עוד משימות' : 'משימות'}>
        {rest.length ? <TaskList tasks={rest} showDate={false} /> : timed.length ? null : <Empty>אין כלום ב{dayLabel(day)}</Empty>}
      </Section>
    </div>
  );
}

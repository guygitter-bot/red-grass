import { ClipboardPaste } from 'lucide-react';
import { useStore } from '../App';
import { dashboard, forDay, sortTasks } from '../lib/store';
import { DAY_NAMES, todayKey } from '../lib/dates';
import { colorOf } from '../lib/colors';
import { TaskList } from './TaskItem';
import { Empty, QuickAdd, Section } from './ui';

function greeting(h) {
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

function Stat({ value, label, tone, onClick }) {
  return (
    <button onClick={onClick} className={`rounded-2xl p-3 text-right ${tone}`}>
      <div className="text-2xl font-black leading-none">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </button>
  );
}

export default function Dashboard() {
  const { state, openDay, openArea, openLater, importText } = useStore();
  const now = new Date();
  const today = todayKey(now);
  const d = dashboard(state, now);
  const todays = sortTasks(forDay(state.tasks, today));
  const pct = d.todayTotal ? Math.round((d.todayDone / d.todayTotal) * 100) : 0;

  return (
    <div>
      <div className="mt-1">
        <div className="text-stone-500 text-sm">יום {DAY_NAMES[now.getDay()]}, {now.getDate()}.{now.getMonth() + 1}</div>
        <div className="text-xl font-bold">{greeting(now.getHours())} ✨</div>
      </div>

      <div className="mt-4 rounded-3xl bg-gradient-to-l from-violet-600 to-fuchsia-500 text-white p-4 shadow-lg shadow-violet-200">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm opacity-90">היום</div>
            <div className="text-3xl font-black">{d.todayDone}/{d.todayTotal}</div>
          </div>
          <div className="text-sm opacity-90">{d.todayTotal === 0 ? 'יום פנוי – מה רוצים להספיק?' : pct === 100 ? 'הכול בוצע! 🎉' : `נשארו ${d.today}`}</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        <Stat value={d.overdue.length} label="באיחור" tone={d.overdue.length ? 'bg-rose-100 text-rose-700' : 'bg-white text-stone-500 border border-stone-200'} onClick={() => openDay(today)} />
        <Stat value={d.waiting.length} label="מעקבים" tone="bg-amber-100 text-amber-800" onClick={() => openLater('followup')} />
        <Stat value={d.later} label="לבדוק" tone="bg-sky-100 text-sky-800" onClick={() => openLater('later')} />
        <Stat value={d.doneThisWeek} label="בוצעו השבוע" tone="bg-emerald-100 text-emerald-800" />
      </div>

      <div className="mt-4 space-y-2">
        <QuickAdd placeholder="משימה מהירה להיום..." defaults={{ due: today }} />
        <button onClick={() => importText('')} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 py-2.5 text-sm font-medium">
          <ClipboardPaste size={18} />הדבקת הודעה מווטסאפ
        </button>
      </div>

      {d.overdue.length > 0 && (
        <Section title={`🔥 באיחור (${d.overdue.length})`}>
          <TaskList tasks={d.overdue.slice(0, 5)} />
        </Section>
      )}

      <Section title="📌 היום" action={<button onClick={() => openDay(today)} className="text-sm text-violet-700">לתצוגה היומית</button>}>
        {todays.length ? <TaskList tasks={todays} showDate={false} /> : <Empty>אין משימות להיום. אפשר לרשום למעלה ✍️</Empty>}
      </Section>

      {d.upcoming.length > 0 && (
        <Section title="🗓️ בשבוע הקרוב">
          <TaskList tasks={d.upcoming} />
        </Section>
      )}

      {d.important.length > 0 && (
        <Section title="❗ חשוב">
          <TaskList tasks={d.important} />
        </Section>
      )}

      {d.waiting.length > 0 && (
        <Section title="⏳ מחכה לתשובה / מעקב">
          <TaskList tasks={d.waiting} />
        </Section>
      )}

      <Section title="תחומי חיים">
        <div className="grid grid-cols-2 gap-2">
          {d.byCategory.map((c) => {
            const total = c.open + c.done;
            return (
              <button key={c.id} onClick={() => openArea(c.id)} className="rounded-2xl bg-white border border-stone-200 p-3 text-right shadow-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorOf(c.color).soft}`}>{c.emoji}</span>
                  <span className="font-medium truncate">{c.name}</span>
                </div>
                <div className="text-xs text-stone-500 mt-2">{c.open ? `${c.open} פתוחות` : 'אין משימות פתוחות'}</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className={`h-full rounded-full ${colorOf(c.color).bar}`} style={{ width: `${total ? (c.done / total) * 100 : 0}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {d.noDate > 0 && <p className="text-xs text-stone-400 text-center mt-6">{d.noDate} משימות בלי תאריך – נמצאות בתוך התחומים</p>}
    </div>
  );
}

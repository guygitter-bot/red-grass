// לוח שנה: חודש בתצוגת לוח, לכל יום – ממוצע הסוכר בצבע, כמה ארוחות ונמוכים. לחיצה על יום פותחת אותו.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DAYS, addMonths, level, monthDays, monthName } from '../lib/diary';

const CELL = {
  low: 'bg-low/15 text-low',
  ok: 'bg-ok/15 text-ok',
  high: 'bg-high/15 text-high',
  veryHigh: 'bg-low/15 text-low',
};

export default function CalendarView({ data, month, go, openDay }) {
  const s = data.settings;
  const { offset, days } = monthDays(data, month);
  const withData = days.filter((d) => d.count);
  const all = withData.reduce((a, d) => a + d.count, 0);
  const lows = withData.reduce((a, d) => a + d.low, 0);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => go(addMonths(month, -1))} className="rounded-full p-2 hover:bg-soft" aria-label="החודש הקודם">
          <ChevronRight />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold">{monthName(month)}</h1>
          {month !== data.today.slice(0, 7) && (
            <button onClick={() => go(data.today.slice(0, 7))} className="text-sm text-accent-ink">
              לחודש הנוכחי
            </button>
          )}
        </div>
        <button onClick={() => go(addMonths(month, 1))} className="rounded-full p-2 hover:bg-soft" aria-label="החודש הבא">
          <ChevronLeft />
        </button>
      </div>

      <div className="rounded-2xl bg-card p-2 shadow-sm lg:p-4">
        <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">
          {DAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, i) => (
            <div key={`e${i}`} />
          ))}
          {days.map((d) => {
            const lv = d.mean === '' ? '' : level(d.mean, s);
            const isToday = d.date === data.today;
            const future = d.date > data.today;
            return (
              <button
                key={d.date}
                onClick={() => openDay(d.date)}
                className={`flex min-h-16 flex-col items-center rounded-xl border p-1 text-center hover:bg-soft lg:min-h-20 ${isToday ? 'border-accent' : 'border-transparent'} ${future ? 'opacity-50' : ''}`}
                aria-label={`${d.day} ב${monthName(month)}${d.count ? `, ממוצע ${d.mean}` : ''}`}
              >
                <span className={`text-sm ${isToday ? 'font-bold text-accent-ink' : ''}`}>{d.day}</span>
                {d.count > 0 && <span className={`num mt-0.5 rounded-md px-1 text-xs font-bold lg:text-sm ${CELL[lv]}`}>{d.mean}</span>}
                <span className="mt-auto flex gap-0.5 text-[10px] leading-tight text-muted">
                  {d.meals > 0 && <span>🍽{d.meals}</span>}
                  {d.low > 0 && <span className="font-bold text-low">↓{d.low}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {withData.length ? `החודש: ${withData.length === 1 ? 'יום אחד' : `${withData.length} ימים`} עם מדידות, ${all === 1 ? 'מדידה אחת' : `${all} מדידות`}${lows ? `, ${lows} נמוכים` : ''}.` : 'אין מדידות בחודש הזה.'} המספר בכל יום – ממוצע הסוכר. 🍽 ארוחות · ↓ נמוכים.
      </p>
    </div>
  );
}

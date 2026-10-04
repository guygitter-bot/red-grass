import { Calendar, ChevronLeft, ChevronRight, Droplets, Plus, Trash2 } from 'lucide-react';
import { Button, Card, MEALS } from './ui';
import { formatDisplayDate, today } from '../lib/dates';
import { formatPoints, qtyPrefix } from '../lib/points';

export default function Dashboard({
  user, selectedDate, setSelectedDate, changeDate, dayLogs, dailyUsed,
  water, addWater, removeWater, removeLog, openAdd,
}) {
  const pointsLeft = user.dailyTarget - dailyUsed;
  const progress = Math.min((dailyUsed / user.dailyTarget) * 100, 100) || 0;
  const isToday = selectedDate === today();

  return (
    <div className="space-y-5 pb-20">
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
        <button onClick={() => changeDate(1)} className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl" aria-label="יום הבא">
          <ChevronRight size={24} />
        </button>
        <button className="text-center flex-1 flex flex-col items-center" onClick={() => setSelectedDate(today())}>
          <span className={`text-lg font-bold ${isToday ? 'text-emerald-600' : 'text-slate-700'}`}>{formatDisplayDate(selectedDate)}</span>
          {!isToday && <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full mt-1">חזור להיום</span>}
        </button>
        <button onClick={() => changeDate(-1)} className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl" aria-label="יום קודם">
          <ChevronLeft size={24} />
        </button>
      </div>

      <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-emerald-100 text-sm mb-1">{pointsLeft >= 0 ? 'נותרו להיום' : 'חריגה היום'}</p>
            <div className="text-5xl font-black tracking-tight">{formatPoints(Math.abs(pointsLeft))}</div>
            <p className="text-emerald-100 text-sm mt-1">מתוך {user.dailyTarget}</p>
          </div>
          <div className="h-24 w-24 relative flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-emerald-700/30" />
              <circle
                cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * progress) / 100}
                className="text-white transition-all duration-1000 ease-out" strokeLinecap="round"
              />
            </svg>
            <div className="absolute font-bold text-lg">{Math.round(progress)}%</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={openAdd} className="h-16 text-lg">
          <Plus size={24} /> הוסף אוכל
        </Button>
        <div className="bg-cyan-50 border border-cyan-100 rounded-xl flex items-center justify-between px-2">
          <button onClick={removeWater} className="p-3 text-cyan-600 hover:bg-cyan-100 rounded-lg disabled:opacity-30" disabled={water === 0}>
            -
          </button>
          <div className="flex flex-col items-center flex-1 py-2 text-cyan-700">
            <Droplets size={20} className="mb-0.5" />
            <span className="font-bold text-sm leading-none">{water} כוסות</span>
          </div>
          <button onClick={addWater} className="p-3 text-cyan-600 hover:bg-cyan-100 rounded-lg">
            +
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 px-1">
          <Calendar size={18} /> סיכום ארוחות
        </h3>
        {MEALS.map((meal) => {
          const mealLogs = dayLogs.filter((l) => l.mealType === meal);
          if (mealLogs.length === 0) return null;
          const mealPoints = mealLogs.reduce((s, l) => s + Number(l.points), 0);
          return (
            <div key={meal} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-2 border-b border-slate-50 pb-2">
                <span className="font-bold text-slate-600">{meal}</span>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{formatPoints(mealPoints)} נק'</span>
              </div>
              <div className="space-y-2">
                {mealLogs.map((log) => (
                  <div key={log.id} className="text-sm text-slate-600">
                    <div className="flex justify-between items-center gap-2">
                      <span>{log.foodName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium">{formatPoints(log.points)}</span>
                        <button onClick={() => removeLog(log.id)} className="text-red-300 hover:text-red-500 p-1" aria-label="מחק">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {log.components?.length > 1 && (
                      <div className="text-xs text-slate-400 pr-2">
                        {log.components.map((c) => `${qtyPrefix(c.qty)}${c.name} (${formatPoints(c.unitPoints * c.qty)})`).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {dayLogs.length === 0 && (
          <div className="text-center py-10 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400">טרם הוזנו ארוחות ביום זה</div>
        )}
      </div>
    </div>
  );
}

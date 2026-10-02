import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, Input } from './ui';

export default function WeightView({ user, history, addWeight, removeWeight }) {
  const [value, setValue] = useState('');
  const lost = user.startWeight - user.currentWeight;
  const goal = user.startWeight - user.goalWeight;
  const progress = goal > 0 ? Math.max(0, Math.min(100, (lost / goal) * 100)) : 0;

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold">מעקב משקל</h2>
      <Card>
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-slate-500 text-sm">משקל נוכחי</p>
            <div className="text-4xl font-black text-slate-800">{user.currentWeight}</div>
          </div>
          <div className="text-left">
            <p className="text-slate-500 text-sm">יעד</p>
            <div className="text-xl font-bold text-emerald-600">{user.goalWeight}</div>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-slate-400 text-center">
          {lost >= 0 ? 'ירדת' : 'עלית'} {Math.abs(lost).toFixed(1)} ק"ג מתוך {Math.abs(goal).toFixed(1)} ק"ג
        </p>
      </Card>

      <Card>
        <h3 className="font-bold mb-3">עדכון שקילה</h3>
        <div className="flex gap-2">
          <Input type="number" inputMode="decimal" step="0.1" placeholder="משקל עדכני..." value={value} onChange={(e) => setValue(e.target.value)} />
          <Button
            disabled={!(parseFloat(value) > 0)}
            onClick={() => {
              addWeight(parseFloat(value));
              setValue('');
            }}
          >
            עדכן
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="font-bold text-slate-700">היסטוריה</h3>
        {history
          .map((entry, idx) => ({ entry, idx }))
          .reverse()
          .map(({ entry, idx }) => (
            <div key={`${entry.date}-${idx}`} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-50">
              <span className="text-slate-500">
                {new Date(entry.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600">{entry.weight} ק"ג</span>
                {history.length > 1 && (
                  <button onClick={() => removeWeight(idx)} className="text-red-300 hover:text-red-500 p-1" aria-label="מחק">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

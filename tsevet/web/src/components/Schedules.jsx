// משימות קבועות: רשימה, הפעלה / השהיה, הרצה עכשיו, עריכה ומחיקה
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Play, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { go } from '../lib/route';
import { budgetText, nextText, whenText } from '../lib/schedules';
import { currentSubscription, pushSupported } from '../lib/push';
import { Button } from './ui';
import ScheduleEditor from './ScheduleEditor';

// מתג הפעלה
function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${on ? 'right-0.5' : 'right-[1.375rem]'}`} />
    </button>
  );
}

function ScheduleCard({ s, agents, onToggle, onRun, onEdit, onDelete }) {
  const agent = agents.find((a) => a.key === s.to);
  const who = s.to === null || s.to === undefined ? '👥 כל הצוות' : agent ? `${agent.emoji} ${agent.name}` : s.to;
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-bold">{s.title}</h3>
          <p className="mt-1 text-sm text-muted">{whenText(s)}</p>
        </div>
        <Switch on={s.enabled} onChange={onToggle} label={s.enabled ? 'להשהות' : 'להפעיל'} />
      </div>
      <dl className="mt-2 space-y-0.5 text-sm text-muted">
        <div>מי עושה: {who}</div>
        <div>{budgetText(s.budget)}</div>
        <div>{s.enabled && s.next ? `הפעם הבאה: ${nextText(s.next)}` : 'מושהית'}</div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onRun} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-soft">
          <Play size={15} /> להריץ עכשיו
        </button>
        {s.conv && (
          <button onClick={() => go(`/c/${encodeURIComponent(s.conv)}`)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-soft">
            <MessageSquare size={15} /> לשיחה
          </button>
        )}
        <button onClick={onEdit} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-soft" aria-label="עריכה">
          <Pencil size={15} /> עריכה
        </button>
        <button onClick={onDelete} className="rounded-xl border border-line px-3 py-2 text-bad hover:bg-soft" aria-label="מחיקה">
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

export default function Schedules({ agents }) {
  const [list, setList] = useState(null);
  const [budgets, setBudgets] = useState([0.5, 1, 2, 5]);
  const [editing, setEditing] = useState(null); // null / {} חדש / משימה קיימת
  const [error, setError] = useState('');
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    api('/app/schedules', {})
      .then((r) => {
        setList(r.schedules || []);
        if (r.budgets) setBudgets(r.budgets);
      })
      .catch((e) => setError(e.message));
    if (pushSupported()) {
      currentSubscription().then((sub) => setPushOn(!!sub));
    }
  }, []);

  // קריאה שמחזירה את הרשימה המעודכנת
  const call = async (path, body) => {
    try {
      const r = await api(path, body);
      setList(r.schedules || []);
      setError('');
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  const run = async (s) => {
    if (!window.confirm('להריץ עכשיו? זה עולה כמו הפעלה רגילה')) return;
    try {
      const r = await api('/app/schedules/run', { id: s.id });
      if (r.conv) go(`/c/${encodeURIComponent(r.conv)}`);
    } catch (e) {
      setError(e.message);
    }
  };

  const del = (s) => {
    if (window.confirm(`למחוק את "${s.title}"?`)) call('/app/schedules/delete', { id: s.id });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4">
      <p className="text-sm text-muted">משימות שהצוות עושה לבד בזמן קבוע – גם כשהאפליקציה סגורה. כל הפעלה נכנסת לשיחה משלה.</p>
      {!pushOn && (
        <p className="text-sm text-muted">
          כדי לדעת כשמשימה הסתיימה –{' '}
          <button onClick={() => go('/settings')} className="font-medium text-accent-ink underline">
            להפעיל התראות בהגדרות
          </button>
        </p>
      )}
      <Button className="flex w-full items-center justify-center gap-2" onClick={() => setEditing({})}>
        <Plus size={18} /> משימה קבועה חדשה
      </Button>
      {error && <p className="rounded-xl border border-line bg-card p-3 text-sm text-bad">{error}</p>}
      {list?.length === 0 && <p className="py-6 text-center text-sm text-muted">עוד אין משימות קבועות.</p>}
      <ul className="space-y-3">
        {list?.map((s) => (
          <ScheduleCard
            key={s.id}
            s={s}
            agents={agents}
            onToggle={(enabled) => call('/app/schedules/save', { id: s.id, enabled })}
            onRun={() => run(s)}
            onEdit={() => setEditing(s)}
            onDelete={() => del(s)}
          />
        ))}
      </ul>
      {editing && (
        <ScheduleEditor
          initial={editing}
          agents={agents}
          budgets={budgets}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            const r = await call('/app/schedules/save', form);
            if (r) setEditing(null);
            return r;
          }}
        />
      )}
    </div>
  );
}

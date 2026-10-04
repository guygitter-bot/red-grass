import { Bell, Check, Clock, Link2, ListChecks, Paperclip, PlayCircle, User } from 'lucide-react';
import { useStore } from '../App';
import { PRIORITIES, TYPES, attachmentsOf, contactsOf, isOverdue, progress, reminderAt, toggleDone } from '../lib/store';
import { dayLabel } from '../lib/dates';
import { colorOf } from '../lib/colors';

export default function TaskItem({ task, showDate = true, showCategory = true }) {
  const { state, act, edit } = useStore();
  const cat = state.categories.find((c) => c.id === task.categoryId);
  const parent = task.parentId && state.tasks.find((t) => t.id === task.parentId);
  const { done, total } = progress(state.tasks, task.id);
  const late = isOverdue(task);
  const prio = PRIORITIES[task.priority] || PRIORITIES[2];
  const video = task.links?.some((l) => l.kind === 'video');
  const people = contactsOf(task).map((c) => c.name || c.phone);
  const remindAt = reminderAt(task);
  const files = attachmentsOf(task).length;

  return (
    <div className={`flex items-start gap-3 bg-card rounded-2xl border p-3 shadow-sm ${task.done ? 'border-stone-100 opacity-60' : 'border-stone-200'}`}>
      <button
        aria-label={task.done ? 'סימון כלא בוצע' : 'סימון כבוצע'}
        onClick={() => act(toggleDone, task.id)}
        className={`mt-0.5 shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${task.done ? 'bg-violet-600 border-violet-600 text-white' : task.priority === 3 ? 'border-rose-400' : 'border-stone-300'}`}
      >
        {task.done && <Check size={16} strokeWidth={3} />}
      </button>
      <button onClick={() => edit(task)} className="flex-1 min-w-0 text-right">
        {parent && <div className="text-xs text-stone-400 truncate">↳ {parent.title}</div>}
        <div className={`font-medium leading-snug ${task.done ? 'line-through text-stone-400' : ''}`}>
          {task.type !== 'task' && <span className="ml-1">{TYPES[task.type]?.emoji}</span>}
          {task.title}
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-stone-500">
          {task.priority !== 2 && !task.done && (
            <span className={`flex items-center gap-1 ${prio.text}`}><span className={`w-2 h-2 rounded-full ${prio.dot}`} />{prio.short}</span>
          )}
          {showDate && task.due && (
            <span className={late ? 'text-rose-600 font-bold' : ''}>{late ? 'באיחור · ' : ''}{dayLabel(task.due)}</span>
          )}
          {task.time && <span className="flex items-center gap-0.5"><Clock size={12} />{task.time}</span>}
          {remindAt && !task.done && (
            <span className="flex items-center gap-0.5" title="תזכורת"><Bell size={12} />{`${String(remindAt.getHours()).padStart(2, '0')}:${String(remindAt.getMinutes()).padStart(2, '0')}`}</span>
          )}
          {total > 0 && <span className="flex items-center gap-0.5"><ListChecks size={12} />{done}/{total}</span>}
          {task.links?.length > 0 && (video ? <PlayCircle size={12} /> : <Link2 size={12} />)}
          {files > 0 && <span className="flex items-center gap-0.5" title="תמונות וקבצים"><Paperclip size={12} />{files > 1 ? files : ''}</span>}
          {people.length > 0 && <span className="flex items-center gap-0.5 min-w-0 max-w-full"><User size={12} className="shrink-0" /><span className="truncate">{people.join(', ')}</span></span>}
          {showCategory && cat && <span className={`rounded-full px-2 py-0.5 ${colorOf(cat.color).soft}`}>{cat.emoji} {cat.name}</span>}
        </div>
      </button>
    </div>
  );
}

export function TaskList({ tasks, ...props }) {
  return (
    <div className="space-y-2">
      {tasks.map((t) => <TaskItem key={t.id} task={t} {...props} />)}
    </div>
  );
}

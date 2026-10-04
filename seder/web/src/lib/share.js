// שיתוף לצורך עזרה: משימה (עם תתי המשימות) או רשימת היום – כהודעת ווטסאפ מסודרת
import { dayLabel } from './dates';
import { PRIORITIES, contactsText } from './store';

export function taskText(task, subtasks = [], now = new Date()) {
  const lines = [`*${task.title}*`];
  const when = [task.due && dayLabel(task.due, now), task.time].filter(Boolean).join(' ב-');
  if (when) lines.push(`🗓️ ${when}`);
  if (task.priority === 3) lines.push(`❗ ${PRIORITIES[3].label}`);
  const people = contactsText(task);
  if (people) lines.push(`👤 לבירור עם: ${people}`);
  if (task.notes && task.notes !== task.title) lines.push('', task.notes);
  for (const link of task.links || []) if (!task.notes?.includes(link.url)) lines.push(link.url);
  if (subtasks.length) {
    lines.push('');
    for (const s of subtasks) lines.push(`${s.done ? '✅' : '⬜'} ${s.title}`);
  }
  return lines.join('\n');
}

export function listText(title, tasks) {
  return [`*${title}*`, ...tasks.map((t) => `${t.done ? '✅' : '⬜'} ${t.time ? `${t.time} ` : ''}${t.title}`)].join('\n');
}

export function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// בטלפון: חלון השיתוף של המערכת (ווטסאפ, מייל...). אחרת – ווטסאפ ישירות
export async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  window.open(whatsappUrl(text), '_blank', 'noopener');
}

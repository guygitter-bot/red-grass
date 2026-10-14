import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useStore } from '../App';
import { sortTasks, toggleDone } from '../lib/store';
import { colorOf } from '../lib/colors';
import { TaskList } from './TaskItem';
import { Chip, Empty, QuickAdd } from './ui';

// "לבדוק בהמשך": קישורים, סרטונים, המלצות ומחשבות – ומעקבים שמחכים לתשובה
function LaterCard({ item }) {
  const { state, act, edit } = useStore();
  const cat = state.categories.find((c) => c.id === item.categoryId);
  const link = item.links?.[0];
  const preview = item.notes && item.notes !== item.title ? item.notes.replace(/https?:\/\/\S+/g, '').trim().slice(0, 140) : '';
  return (
    <div className={`rounded-2xl bg-card border border-stone-200 p-3 shadow-sm ${item.done ? 'opacity-50' : ''}`}>
      <button onClick={() => edit(item)} className="w-full text-right">
        <div className="font-medium">{link ? (link.kind === 'video' ? '🎬 ' : '🔗 ') : '💭 '}{item.title}</div>
        {preview && <div className="text-sm text-stone-500 mt-1 line-clamp-2 whitespace-pre-line">{preview}</div>}
      </button>
      <div className="flex items-center gap-2 mt-2 text-xs">
        {cat && <span className={`rounded-full px-2 py-0.5 ${colorOf(cat.color).soft}`}>{cat.emoji} {cat.name}</span>}
        <span className="text-stone-400">{new Date(item.createdAt).toLocaleDateString('he-IL')}</span>
        <span className="flex-1" />
        {link && <a href={link.url} target="_blank" rel="noopener" className="flex items-center gap-1 rounded-lg bg-violet-50 text-violet-700 px-2 py-1"><ExternalLink size={14} />פתיחה</a>}
        <button onClick={() => act(toggleDone, item.id)} className="rounded-lg bg-stone-100 text-stone-600 px-2 py-1">{item.done ? 'החזרה' : 'נבדק ✓'}</button>
      </div>
    </div>
  );
}

export default function LaterView({ seg, setSeg }) {
  const { state, importText } = useStore();
  const [cat, setCat] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const matching = state.tasks.filter((t) => t.type === seg && (showDone || !t.done) && (!cat || t.categoryId === cat));
  // רעיונות: החדש ביותר למעלה. מעקבים: לפי מועד הבדיקה הבא
  const items = seg === 'later' ? [...matching].sort((a, b) => a.done - b.done || b.createdAt - a.createdAt) : sortTasks(matching);

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-violet-100 p-1 mt-1 lg:max-w-xl">
        <button onClick={() => setSeg('later')} className={`rounded-xl py-2 text-sm font-medium ${seg === 'later' ? 'bg-card shadow text-violet-700' : 'text-violet-900/60'}`}>💡 לבדוק בהמשך</button>
        <button onClick={() => setSeg('followup')} className={`rounded-xl py-2 text-sm font-medium ${seg === 'followup' ? 'bg-card shadow text-violet-700' : 'text-violet-900/60'}`}>⏳ מעקבים ותשובות</button>
      </div>
      <p className="text-xs text-stone-500 mt-3">
        {seg === 'later' ? 'קישורים, סרטונים, המלצות ומחשבות – הכול נשמר כאן, כדי לא לשכוח איפה זה נכתב.' : 'דברים שמחכים לתשובה ממישהו (בנק, גן, רופא...) – כדי לזכור לבדוק שוב.'}
      </p>
      <div className="mt-3 space-y-2">
        <QuickAdd placeholder={seg === 'later' ? 'רעיון, המלצה או קישור...' : 'ממי מחכים לתשובה? (אפשר עם "ביום שלישי")'} defaults={{ type: seg, categoryId: cat }} />
        {seg === 'later' && <button onClick={() => importText('')} className="text-sm text-emerald-700 underline">הדבקת הודעה מווטסאפ</button>}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-wrap lg:overflow-visible mt-3">
        <Chip active={!cat} onClick={() => setCat(null)}>הכול</Chip>
        {state.categories.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.emoji} {c.name}</Chip>)}
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <Empty>{seg === 'later' ? 'עוד אין כאן כלום. שומרים פה כל מה ש"צריך לבדוק פעם"' : 'לא מחכים לאף אחד כרגע 🙌'}</Empty>}
        {seg === 'later' ? <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">{items.map((t) => <LaterCard key={t.id} item={t} />)}</div> : <TaskList tasks={items} />}
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-500 mt-4">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-violet-600" />
        להציג גם מה שכבר טופל
      </label>
    </div>
  );
}

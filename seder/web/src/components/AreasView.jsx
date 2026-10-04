import { useState } from 'react';
import { ChevronRight, Pencil, Plus, Share2 } from 'lucide-react';
import { useStore } from '../App';
import { COLORS, removeCategory, sortTasks, topLevel, upsertCategory } from '../lib/store';
import { colorOf } from '../lib/colors';
import { listText, shareText } from '../lib/share';
import { TaskList } from './TaskItem';
import { Chip, Empty, QuickAdd, Section, Sheet } from './ui';

const EMOJIS = ['💅', '🧹', '💼', '🛒', '🧸', '❤️', '🏠', '💰', '🩺', '🏃‍♀️', '🎓', '✈️', '🎉', '🐶', '🚗', '📚', '🍳', '🙏', '🎨', '📞'];

function CategoryForm({ initial, onClose }) {
  const { act, state } = useStore();
  const [cat, setCat] = useState(initial || { name: '', emoji: '📁', color: 'violet' });
  const count = initial ? state.tasks.filter((t) => t.categoryId === initial.id).length : 0;
  const saveCat = () => {
    if (!cat.name.trim()) return;
    act(upsertCategory, { ...cat, name: cat.name.trim() });
    onClose();
  };
  const del = () => {
    if (!window.confirm(count ? `למחוק את התחום? ${count} המשימות שבו יישארו, בלי תחום.` : 'למחוק את התחום?')) return;
    act(removeCategory, initial.id);
    onClose(true);
  };
  return (
    <Sheet
      title={initial ? 'עריכת תחום' : 'תחום חדש'}
      onClose={() => onClose()}
      footer={(
        <div className="flex gap-2">
          <button onClick={saveCat} disabled={!cat.name.trim()} className="flex-1 rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">שמירה</button>
          {initial && <button onClick={del} className="rounded-2xl border border-stone-200 px-4 text-rose-600 text-sm">מחיקה</button>}
        </div>
      )}
    >
      <input autoFocus value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} placeholder="שם התחום (למשל: בריאות, כספים, חגים)" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 outline-none focus:border-violet-500" />
      <div className="text-xs font-bold text-stone-500 mt-4 mb-2">סמל</div>
      <div className="flex flex-wrap gap-2">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => setCat({ ...cat, emoji: e })} className={`w-10 h-10 rounded-xl text-xl ${cat.emoji === e ? 'bg-violet-100 ring-2 ring-violet-500' : 'bg-stone-50'}`}>{e}</button>
        ))}
      </div>
      <div className="text-xs font-bold text-stone-500 mt-4 mb-2">צבע</div>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button key={c} aria-label={c} onClick={() => setCat({ ...cat, color: c })} className={`w-9 h-9 rounded-full ${colorOf(c).solid} ${cat.color === c ? 'ring-4 ring-offset-2 ring-violet-300' : ''}`} />
        ))}
      </div>
    </Sheet>
  );
}

function CategoryDetail({ id, back }) {
  const { state } = useStore();
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(false);
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return null;
  const all = sortTasks(topLevel(state.tasks).filter((t) => t.categoryId === id));
  const shown = all.filter((t) => (filter === 'open' ? !t.done && t.type !== 'later' : filter === 'later' ? t.type === 'later' && !t.done : t.done));

  return (
    <div className="lg:max-w-3xl">
      <button onClick={back} className="flex items-center gap-1 text-sm text-violet-700 mt-1"><ChevronRight size={18} />כל התחומים</button>
      <div className="flex items-center gap-3 mt-3">
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${colorOf(cat.color).soft}`}>{cat.emoji}</span>
        <h2 className="text-2xl font-bold flex-1">{cat.name}</h2>
        <button aria-label="שיתוף" onClick={() => shareText(listText(cat.name, all.filter((t) => !t.done)))} className="p-2 rounded-xl bg-emerald-50 text-emerald-700"><Share2 size={18} /></button>
        <button aria-label="עריכת תחום" onClick={() => setEditing(true)} className="p-2 rounded-xl bg-stone-100 text-stone-600"><Pencil size={18} /></button>
      </div>
      <div className="mt-4">
        <QuickAdd placeholder={`משימה ב${cat.name}...`} defaults={{ categoryId: id, type: filter === 'later' ? 'later' : 'task' }} />
      </div>
      <div className="flex gap-2 mt-4">
        <Chip active={filter === 'open'} onClick={() => setFilter('open')}>פתוחות</Chip>
        <Chip active={filter === 'later'} onClick={() => setFilter('later')}>💡 לבדוק</Chip>
        <Chip active={filter === 'done'} onClick={() => setFilter('done')}>בוצעו</Chip>
      </div>
      <div className="mt-3">
        {shown.length ? <TaskList tasks={shown} showCategory={false} /> : <Empty>{filter === 'done' ? 'עוד לא סומן כלום כבוצע' : 'אין כאן כלום עדיין'}</Empty>}
      </div>
      {editing && <CategoryForm initial={cat} onClose={(deleted) => { setEditing(false); if (deleted) back(); }} />}
    </div>
  );
}

export default function AreasView({ area, setArea }) {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);
  if (area) return <CategoryDetail id={area} back={() => setArea(null)} />;

  const uncategorized = sortTasks(topLevel(state.tasks).filter((t) => !t.categoryId && !t.done && t.type !== 'later'));
  return (
    <div>
      <h2 className="text-xl font-bold mt-1">תחומי חיים</h2>
      <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-3 xl:grid-cols-4 lg:gap-3">
        {state.categories.map((c) => {
          const open = topLevel(state.tasks).filter((t) => t.categoryId === c.id && !t.done && t.type !== 'later').length;
          return (
            <button key={c.id} onClick={() => setArea(c.id)} className="flex items-center gap-3 rounded-2xl bg-card border border-stone-200 p-3 shadow-sm text-right">
              <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xl ${colorOf(c.color).soft}`}>{c.emoji}</span>
              <span className="min-w-0">
                <span className="block font-medium truncate">{c.name}</span>
                <span className="block text-xs text-stone-500">{open ? `${open} פתוחות` : 'הכול מסודר'}</span>
              </span>
            </button>
          );
        })}
        <button onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 text-violet-700 p-3">
          <Plus size={20} />תחום חדש
        </button>
      </div>

      {uncategorized.length > 0 && (
        <Section title="בלי תחום">
          <TaskList tasks={uncategorized} />
        </Section>
      )}
      {adding && <CategoryForm onClose={() => setAdding(false)} />}
    </div>
  );
}

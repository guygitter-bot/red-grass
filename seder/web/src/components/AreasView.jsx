import { useState } from 'react';
import { ArrowUpDown, Check, ChevronRight, Pencil, Plus, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { useStore } from '../App';
import { CATEGORY_KINDS, COLORS, PRIORITIES, TYPES, addTask, clearChecked, isList, moveCategory, moveTask, removeCategory, sortCategories, sortManual, sortTasks, toggleDone, topLevel, uncheckAll, upsertCategory } from '../lib/store';
import { colorOf } from '../lib/colors';
import { dayLabel } from '../lib/dates';
import { listText, shareText } from '../lib/share';
import { TaskList } from './TaskItem';
import { Chip, Empty, QuickAdd, Section, Sheet, Sortable } from './ui';

const EMOJIS = ['💅', '🧹', '💼', '🛒', '🧸', '❤️', '🏠', '💰', '🩺', '🏃‍♀️', '🎓', '✈️', '🎉', '🐶', '🚗', '📚', '🍳', '🙏', '🎨', '📞'];

// מחיקת תחום / רשימה: בוחרים מה קורה למשימות שבו – נשארות בלי תחום, או נמחקות יחד איתו
function DeleteCategory({ cat, onClose }) {
  const { act, state } = useStore();
  const count = topLevel(state.tasks).filter((t) => t.categoryId === cat.id).length;
  const list = isList(cat);
  const remove = (withTasks) => {
    act(removeCategory, cat.id, withTasks);
    onClose(true);
  };
  const btn = 'w-full rounded-2xl py-3 font-bold';
  return (
    <Sheet title={list ? `מחיקת הרשימה "${cat.name}"` : `מחיקת התחום "${cat.name}"`} onClose={() => onClose()}>
      <p className="text-sm text-stone-600">
        {count ? `${list ? 'ברשימה' : 'בתחום'} יש ${count} ${list ? 'פריטים' : 'משימות'}.` : list ? 'הרשימה ריקה.' : 'אין בתחום משימות.'} המחיקה עוברת לכל המכשירים.
      </p>
      <div className="space-y-2 mt-4 lg:max-w-md">
        {count > 0 && <button onClick={() => remove(true)} className={`${btn} bg-rose-600 text-white`}>{list ? 'מחיקת הרשימה וכל הפריטים' : `מחיקת התחום וכל ${count} המשימות`}</button>}
        {(count === 0 || !list) && (
          <button onClick={() => remove(false)} className={`${btn} ${count ? 'border border-rose-200 text-rose-700' : 'bg-rose-600 text-white'}`}>
            {count ? 'מחיקת התחום בלבד (המשימות יישארו, בלי תחום)' : list ? 'מחיקת הרשימה' : 'מחיקת התחום'}
          </button>
        )}
        <button onClick={() => onClose()} className={`${btn} bg-stone-100 text-stone-600`}>ביטול</button>
      </div>
    </Sheet>
  );
}

function CategoryForm({ initial, onClose }) {
  const { act } = useStore();
  const [cat, setCat] = useState(initial || { name: '', emoji: '📁', color: 'violet' });
  const [deleting, setDeleting] = useState(false);
  const saveCat = () => {
    if (!cat.name.trim()) return;
    act(upsertCategory, { ...cat, name: cat.name.trim() });
    onClose();
  };
  if (deleting) return <DeleteCategory cat={initial} onClose={(deleted) => (deleted ? onClose(true) : setDeleting(false))} />;
  return (
    <Sheet
      title={initial ? (isList(initial) ? 'עריכת רשימה' : 'עריכת תחום') : 'תחום / רשימה חדשה'}
      onClose={() => onClose()}
      footer={(
        <div className="flex gap-2">
          <button onClick={saveCat} disabled={!cat.name.trim()} className="flex-1 rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">שמירה</button>
          {initial && <button onClick={() => setDeleting(true)} className="flex items-center gap-1.5 rounded-2xl border border-stone-200 px-4 text-rose-600 text-sm"><Trash2 size={16} />מחיקה</button>}
        </div>
      )}
    >
      <input autoFocus value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} placeholder={isList(cat) ? 'שם הרשימה (למשל: מה לארוז, קניות, תווי קניה)' : 'שם התחום (למשל: בריאות, כספים, חגים)'} className="w-full rounded-xl border border-stone-200 bg-card px-3 py-2.5 outline-none focus:border-violet-500" />
      <div className="text-xs font-bold text-stone-500 mt-4 mb-2">סוג</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(CATEGORY_KINDS).map(([id, k]) => {
          const active = id === 'list' ? isList(cat) : !isList(cat);
          return (
            <button key={id} type="button" onClick={() => setCat({ ...cat, kind: id === 'list' ? 'list' : null })} className={`rounded-xl border p-2.5 text-right ${active ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-stone-200'}`}>
              <span className="block font-bold text-sm">{id === 'list' ? '📝' : '✅'} {k.label}</span>
              <span className="block text-xs text-stone-500 mt-0.5">{k.hint}</span>
            </button>
          );
        })}
      </div>
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

// הכותרת של תחום / רשימה: סמל, שם, שיתוף, עריכה ומחיקה
function DetailHeader({ cat, back, share, edit, remove }) {
  const list = isList(cat);
  return (
    <>
      <button onClick={back} className="flex items-center gap-1 text-sm text-violet-700 mt-1"><ChevronRight size={18} />כל התחומים</button>
      <div className="flex items-center gap-2 mt-3">
        <span className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-2xl ml-1 ${colorOf(cat.color).soft}`}>{cat.emoji}</span>
        <span className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold truncate">{cat.name}</h2>
          {list && <span className="block text-xs text-stone-500">📝 רשימה</span>}
        </span>
        <button aria-label="שיתוף" onClick={share} className="p-2 rounded-xl bg-emerald-50 text-emerald-700"><Share2 size={18} /></button>
        <button aria-label={list ? 'עריכת רשימה' : 'עריכת תחום'} onClick={edit} className="p-2 rounded-xl bg-stone-100 text-stone-600"><Pencil size={18} /></button>
        <button aria-label={list ? 'מחיקת הרשימה' : 'מחיקת התחום'} onClick={remove} className="p-2 rounded-xl bg-rose-50 text-rose-600"><Trash2 size={18} /></button>
      </div>
    </>
  );
}

// רשימה (מה לארוז, קניות, תווי קניה...): מוסיפים פריטים ומסמנים. בלי תאריכים וחשיבות.
// לחיצה על פריט פותחת אותו לעריכה (למשל לכתוב בהערות סכום ותוקף של תו קניה)
function ListDetail({ cat, back }) {
  const { state, act, edit } = useStore();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const all = sortManual(topLevel(state.tasks).filter((t) => t.categoryId === cat.id));
  const open = all.filter((t) => !t.done);
  const checked = all.filter((t) => t.done);

  // אפשר להדביק כמה שורות בבת אחת – כל שורה פריט
  const add = (e) => {
    e.preventDefault();
    const items = text.split('\n').map((l) => l.replace(/^\s*([-*•⬜✅]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    for (const title of items) act(addTask, { title, categoryId: cat.id });
    setText('');
  };
  const clear = () => {
    if (window.confirm(`להוריד מהרשימה ${checked.length} פריטים שסומנו?`)) act(clearChecked, cat.id);
  };

  const row = (t) => (
    <div key={t.id} className={`flex items-center gap-3 rounded-2xl bg-card border p-2.5 pr-3 shadow-sm ${t.done ? 'border-stone-100 opacity-60' : 'border-stone-200'}`}>
      <button
        aria-label={t.done ? 'ביטול הסימון' : 'סימון'}
        onClick={() => act(toggleDone, t.id)}
        className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition ${t.done ? 'bg-violet-600 border-violet-600 text-white' : 'border-stone-300'}`}
      >
        {t.done && <Check size={18} strokeWidth={3} />}
      </button>
      <button onClick={() => edit(t)} className="flex-1 min-w-0 text-right">
        <span className={`block font-medium leading-snug break-words ${t.done ? 'line-through text-stone-400' : ''}`}>{t.title}</span>
        {t.notes && <span className="block text-xs text-stone-500 truncate">{t.notes}</span>}
      </button>
    </div>
  );

  return (
    <div className="lg:max-w-3xl">
      <DetailHeader cat={cat} back={back} share={() => shareText(listText(cat.name, all))} edit={() => setEditing(true)} remove={() => setDeleting(true)} />
      {!ordering && (
        <form onSubmit={add} className="mt-4 flex items-center gap-2 bg-card rounded-2xl border border-violet-200 shadow-sm pr-4 pl-1.5 py-1.5 focus-within:border-violet-500">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) add(e); }}
            rows={Math.min(5, text.split('\n').length)}
            placeholder="פריט חדש..."
            enterKeyHint="enter"
            className="flex-1 min-w-0 resize-none bg-transparent outline-none py-1.5 placeholder:text-stone-400"
          />
          <button aria-label="הוספה" disabled={!text.trim()} className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-30"><Plus size={20} /></button>
        </form>
      )}
      <div className="flex items-center gap-2 mt-4 text-sm">
        <span className="text-stone-500">{all.length ? `סומנו ${checked.length} מתוך ${all.length}` : ''}</span>
        {!ordering && open.length > 1 && (
          <button aria-label="שינוי סדר הפריטים" onClick={() => setOrdering(true)} className="mr-auto shrink-0 flex items-center gap-1.5 rounded-xl bg-stone-100 text-stone-600 px-2.5 py-1.5"><ArrowUpDown size={16} /><span className="hidden sm:inline">שינוי סדר</span><span className="sm:hidden">סדר</span></button>
        )}
      </div>
      {all.length > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${colorOf(cat.color).bar}`} style={{ width: `${(checked.length / all.length) * 100}%` }} />
        </div>
      )}
      <div className="mt-3">
        {ordering ? <TaskOrder tasks={open} done={() => setOrdering(false)} />
          : all.length ? <div className="space-y-2">{open.map(row)}</div> : <Empty>הרשימה ריקה. כותבים פריט למעלה ✍️ (אפשר להדביק כמה שורות בבת אחת)</Empty>}
      </div>
      {!ordering && checked.length > 0 && (
        <Section
          title={`✅ סומנו (${checked.length})`}
          action={(
            <div className="flex gap-2">
              <button onClick={() => act(uncheckAll, cat.id)} className="flex items-center gap-1 rounded-xl bg-stone-100 text-stone-600 px-2.5 py-1.5 text-sm"><RotateCcw size={14} />הכול מחדש</button>
              <button onClick={clear} className="flex items-center gap-1 rounded-xl bg-rose-50 text-rose-600 px-2.5 py-1.5 text-sm"><Trash2 size={14} />ניקוי</button>
            </div>
          )}
        >
          <div className="space-y-2">{checked.map(row)}</div>
        </Section>
      )}
      {editing && <CategoryForm initial={cat} onClose={(deleted) => { setEditing(false); if (deleted) back(); }} />}
      {deleting && <DeleteCategory cat={cat} onClose={(deleted) => { setDeleting(false); if (deleted) back(); }} />}
    </div>
  );
}

function CategoryDetail({ id, back }) {
  const { state } = useStore();
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return null;
  if (isList(cat)) return <ListDetail key={cat.id} cat={cat} back={back} />;
  // בתוך תחום: הסדר הידני (אם הזיזו משימות), אחרת הסדר הרגיל
  const all = sortManual(topLevel(state.tasks).filter((t) => t.categoryId === id));
  const shown = all.filter((t) => (filter === 'open' ? !t.done && t.type !== 'later' : filter === 'later' ? t.type === 'later' && !t.done : t.done));

  return (
    <div className="lg:max-w-3xl">
      <DetailHeader cat={cat} back={back} share={() => shareText(listText(cat.name, all.filter((t) => !t.done)))} edit={() => setEditing(true)} remove={() => setDeleting(true)} />
      {!ordering && (
        <div className="mt-4">
          <QuickAdd placeholder={`משימה ב${cat.name}...`} defaults={{ categoryId: id, type: filter === 'later' ? 'later' : 'task' }} />
        </div>
      )}
      <div className="flex items-center gap-2 mt-4">
        <Chip active={filter === 'open'} onClick={() => { setFilter('open'); setOrdering(false); }}>פתוחות</Chip>
        <Chip active={filter === 'later'} onClick={() => { setFilter('later'); setOrdering(false); }}>💡 לבדוק</Chip>
        <Chip active={filter === 'done'} onClick={() => { setFilter('done'); setOrdering(false); }}>בוצעו</Chip>
        {!ordering && filter !== 'done' && shown.length > 1 && (
          <button aria-label="שינוי סדר המשימות" onClick={() => setOrdering(true)} className="mr-auto shrink-0 flex items-center gap-1.5 rounded-xl bg-stone-100 text-stone-600 px-2.5 py-1.5 text-sm"><ArrowUpDown size={16} /><span className="hidden sm:inline">שינוי סדר</span><span className="sm:hidden">סדר</span></button>
        )}
      </div>
      <div className="mt-3">
        {ordering && shown.length > 1 ? <TaskOrder tasks={shown} done={() => setOrdering(false)} />
          : shown.length ? <TaskList tasks={shown} showCategory={false} /> : <Empty>{filter === 'done' ? 'עוד לא סומן כלום כבוצע' : 'אין כאן כלום עדיין'}</Empty>}
      </div>
      {editing && <CategoryForm initial={cat} onClose={(deleted) => { setEditing(false); if (deleted) back(); }} />}
      {deleting && <DeleteCategory cat={cat} onClose={(deleted) => { setDeleting(false); if (deleted) back(); }} />}
    </div>
  );
}

const ORDER_HINT = 'מושכים בשש הנקודות למעלה או למטה (במחשב אפשר לגרור את כל השורה). הסדר נשמר מיד, בכל המכשירים.';

// שינוי סדר התחומים: משיכה באצבע. הסדר הזה הוא הסדר בכל האפליקציה
// (כאן, בלוח, ובבחירת תחום במשימה), ומסתנכרן לכל המכשירים
function CategoryOrder({ done }) {
  const { state, act } = useStore();
  const list = sortCategories(state.categories);
  return (
    <div className="mt-3 lg:max-w-xl">
      <p className="text-sm text-stone-500 mb-2">{ORDER_HINT}</p>
      <Sortable
        items={list}
        getKey={(c) => c.id}
        getLabel={(c) => c.name}
        onMove={(from, to) => act(moveCategory, list[from].id, to - from)}
        render={(c, grip) => (
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-stone-200 p-2 pr-3 shadow-sm">
            <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-lg ${colorOf(c.color).soft}`}>{c.emoji}</span>
            <span className="flex-1 min-w-0 font-medium truncate">{c.name}</span>
            {grip}
          </div>
        )}
      />
      <button onClick={done} className="mt-3 w-full rounded-2xl bg-violet-600 text-white font-bold py-3">סיום</button>
    </div>
  );
}

// שינוי סדר המשימות בתוך תחום (הפתוחות, או "לבדוק"). משימות חדשות נכנסות למעלה עד שמזיזים אותן
function TaskOrder({ tasks, done }) {
  const { act } = useStore();
  const ids = tasks.map((t) => t.id);
  return (
    <div>
      <p className="text-sm text-stone-500 mb-2">{ORDER_HINT}</p>
      <Sortable
        items={tasks}
        getKey={(t) => t.id}
        getLabel={(t) => t.title}
        onMove={(from, to) => act(moveTask, ids, from, to)}
        render={(t, grip) => (
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-stone-200 p-2 pr-3 shadow-sm">
            <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${(PRIORITIES[t.priority] || PRIORITIES[2]).dot}`} />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{t.type !== 'task' && <span className="ml-1">{TYPES[t.type]?.emoji}</span>}{t.title}</span>
              {t.due && <span className="block text-xs text-stone-500">{dayLabel(t.due)}{t.time ? ` · ${t.time}` : ''}</span>}
            </span>
            {grip}
          </div>
        )}
      />
      <button onClick={done} className="mt-3 w-full rounded-2xl bg-violet-600 text-white font-bold py-3">סיום</button>
    </div>
  );
}

export default function AreasView({ area, setArea }) {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  if (area) return <CategoryDetail id={area} back={() => setArea(null)} />;

  const uncategorized = sortTasks(topLevel(state.tasks).filter((t) => !t.categoryId && !t.done && t.type !== 'later'));
  return (
    <div>
      <div className="flex items-center justify-between mt-1">
        <h2 className="text-xl font-bold">תחומי חיים</h2>
        {!ordering && state.categories.length > 1 && (
          <button onClick={() => setOrdering(true)} className="flex items-center gap-1.5 rounded-xl bg-stone-100 text-stone-600 px-3 py-1.5 text-sm"><ArrowUpDown size={16} />שינוי סדר</button>
        )}
      </div>
      {ordering ? <CategoryOrder done={() => setOrdering(false)} /> : (
        <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-3 xl:grid-cols-4 lg:gap-3">
          {state.categories.map((c) => {
            const open = topLevel(state.tasks).filter((t) => t.categoryId === c.id && !t.done && t.type !== 'later').length;
            return (
              <button key={c.id} onClick={() => setArea(c.id)} className="flex items-center gap-3 rounded-2xl bg-card border border-stone-200 p-3 shadow-sm text-right">
                <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xl ${colorOf(c.color).soft}`}>{c.emoji}</span>
                <span className="min-w-0">
                  <span className="block font-medium truncate">{c.name}</span>
                  <span className="block text-xs text-stone-500">{isList(c) ? `📝 ${open ? `רשימה · ${open} פריטים` : 'רשימה · הכול סומן'}` : open ? `${open} פתוחות` : 'הכול מסודר'}</span>
                </span>
              </button>
            );
          })}
          <button onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 text-violet-700 p-3">
            <Plus size={20} />תחום / רשימה
          </button>
        </div>
      )}

      {!ordering && uncategorized.length > 0 && (
        <Section title="בלי תחום">
          <TaskList tasks={uncategorized} />
        </Section>
      )}
      {adding && <CategoryForm onClose={() => setAdding(false)} />}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, GripVertical, Heart, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { emojiOf } from '../lib/recipes';

// כל הקטגוריות במסך אחד: אריח לכל קטגוריה (עם תמונה של מתכון ממנה), לחיצה מסננת את הספר.
// לב = מועדפת (מוצגת ראשונה ובקיצורי הדרך במסך הבית). במצב עריכה גוררים אריח בידית כדי לשנות את הסדר.
export default function CategoriesView({ categories, custom, favorites, counts, recipes, active, onPick, onAdd, onRemove, onToggleFavorite, onReorder, onBack }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // קטגוריות עם מתכונים, וגם קטגוריות שלכם שעוד ריקות (categories כבר מסודרות: מועדפות קודם)
  const shown = categories.filter((c) => counts[c] || custom.includes(c));
  const cover = (c) => recipes.find((r) => r.category === c && r.image)?.image;
  const isFav = (c) => favorites.includes(c);

  // גרירה: בזמן הגרירה מציגים סדר זמני, ושומרים בסוף
  const [dragList, setDragList] = useState(null);
  const [dragging, setDragging] = useState(null);
  const list = dragList || shown;
  const listRef = useRef(list);
  listRef.current = list;
  const scrollTimer = useRef(null);

  useEffect(() => () => clearInterval(scrollTimer.current), []);

  const startDrag = (e, c) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(c);
    setDragList(shown);
  };

  const moveDrag = (e) => {
    if (!dragging) return;
    // גלילה אוטומטית כשמגיעים לקצה המסך
    clearInterval(scrollTimer.current);
    const edge = e.clientY < 90 ? -12 : e.clientY > window.innerHeight - 90 ? 12 : 0;
    if (edge) scrollTimer.current = setInterval(() => window.scrollBy(0, edge), 16);
    const over = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest?.('[data-cat]')).find(Boolean);
    const target = over?.dataset.cat;
    if (!target || target === dragging || isFav(target) !== isFav(dragging)) return; // מועדפות זזות רק בין המועדפות
    const cur = listRef.current;
    const next = cur.filter((x) => x !== dragging);
    next.splice(cur.indexOf(target), 0, dragging);
    setDragList(next);
  };

  const endDrag = () => {
    clearInterval(scrollTimer.current);
    if (dragging && dragList && dragList.join('|') !== shown.join('|')) onReorder(dragList);
    setDragging(null);
    setDragList(null);
  };

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setAdding(false);
    return run('add', async () => {
      await onAdd(n);
      setName('');
      setAdding(false);
    });
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold flex-1">📂 קטגוריות</div>
          <button
            onClick={() => setEditing((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-sm inline-flex items-center gap-1 ${editing ? 'bg-orange-500 text-white font-bold' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            {editing ? <><Check size={16} /> סיום</> : <><Pencil size={15} /> סידור</>}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-4">
        {editing && (
          <p className="mb-3 rounded-xl bg-orange-50 text-orange-900 text-sm p-2.5 leading-relaxed">
            גוררים אריח בידית <GripVertical size={14} className="inline -mt-0.5" /> כדי להזיז אותו. ❤️ = מועדפת – מוצגת ראשונה.
            {custom.length > 0 && <> קטגוריה שלכם אפשר למחוק בפח.</>}
          </p>
        )}
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {list.map((c, i) => {
            const image = cover(c);
            const mine = custom.includes(c);
            const fav = isFav(c);
            return (
              <li
                key={c}
                data-cat={c}
                className={`relative transition-transform ${dragging === c ? 'z-10 scale-105' : ''} ${editing && dragging !== c ? (i % 2 ? 'animate-[wiggle_.35s_ease-in-out_infinite_alternate]' : 'animate-[wiggle_.35s_ease-in-out_.17s_infinite_alternate]') : ''}`}
              >
                <button
                  onClick={() => !editing && onPick(c)}
                  className={`w-full text-right rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition ${active === c ? 'ring-2 ring-orange-500' : ''} ${dragging === c ? 'shadow-xl ring-2 ring-orange-400' : ''}`}
                >
                  <div className="relative h-20 bg-orange-100 flex items-center justify-center">
                    {image && <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} className="absolute inset-0 w-full h-full object-cover opacity-90" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                    <span className="relative text-3xl drop-shadow">{emojiOf(c)}</span>
                  </div>
                  <div className="p-2.5">
                    <div className="font-bold leading-snug line-clamp-2">{c}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{counts[c] || 0} מתכונים{mine ? ' · שלכם' : ''}</div>
                  </div>
                </button>
                <button
                  onClick={() => onToggleFavorite(c)}
                  className="absolute top-1.5 left-1.5 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center"
                  aria-label={fav ? `הסרת ${c} מהמועדפות` : `סימון ${c} כמועדפת`}
                  aria-pressed={fav}
                >
                  <Heart size={18} className={fav ? 'text-rose-500' : 'text-stone-400'} fill={fav ? 'currentColor' : 'none'} />
                </button>
                {editing && (
                  <span
                    onPointerDown={(e) => startDrag(e, c)}
                    className="absolute top-1.5 right-1.5 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center text-stone-600 cursor-grab touch-none select-none"
                    aria-label={`גרירת ${c}`}
                    role="button"
                  >
                    <GripVertical size={20} />
                  </span>
                )}
                {editing && mine && (
                  <button
                    onClick={() => window.confirm(`למחוק את הקטגוריה "${c}"? המתכונים שבה יעברו ל"אחר".`) && run(`rm-${c}`, () => onRemove(c))}
                    className="absolute top-12 left-1.5 w-9 h-9 rounded-full bg-white shadow text-red-600 flex items-center justify-center"
                    aria-label={`מחיקת הקטגוריה ${c}`}
                  >
                    {busy === `rm-${c}` ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                )}
              </li>
            );
          })}
          <li>
            <a href="#/help" className="block w-full text-right rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition">
              <div className="h-20 bg-gradient-to-bl from-orange-500 to-amber-400 flex items-center justify-center text-3xl">🎬</div>
              <div className="p-2.5">
                <div className="font-bold leading-snug">סרטוני הדרכה</div>
                <div className="text-xs text-stone-500 mt-0.5">איך משתמשים בכל דבר</div>
              </div>
            </a>
          </li>
          <li>
            {adding ? (
              <form onSubmit={submit} className="h-full rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 p-3 flex flex-col gap-2 justify-center">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  maxLength={30}
                  placeholder="שם הקטגוריה"
                  className="w-full rounded-xl border border-orange-300 bg-white px-3 py-2 text-sm outline-none"
                />
                <div className="flex gap-1.5">
                  <button disabled={busy === 'add'} className="flex-1 rounded-xl bg-orange-500 text-white py-1.5 text-sm font-bold disabled:opacity-50">
                    {busy === 'add' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'הוספה'}
                  </button>
                  <button type="button" onClick={() => setAdding(false)} className="rounded-xl bg-white px-2.5" aria-label="ביטול"><X size={16} /></button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full h-full min-h-32 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 text-orange-700 font-bold flex flex-col items-center justify-center gap-1"
              >
                <Plus size={24} /> קטגוריה חדשה
              </button>
            )}
          </li>
        </ul>
        <p className="mt-4 text-sm text-stone-500 leading-relaxed">
          בקטגוריה משלכם הסוכן ישבץ מתכונים חדשים כשהם מתאימים. מתכון קיים מעבירים בדף המתכון, בבחירת הקטגוריה.
          הסדר והמועדפות נשמרים לכל הספר (גם בספר משותף).
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ArrowRight, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { emojiOf } from '../lib/recipes';

// כל הקטגוריות במסך אחד: אריח לכל קטגוריה (עם תמונה של מתכון ממנה), לחיצה מסננת את הספר
export default function CategoriesView({ categories, custom, counts, recipes, active, onPick, onAdd, onRemove, onBack }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // קטגוריות עם מתכונים, וגם קטגוריות שלכם שעוד ריקות
  const shown = categories.filter((c) => counts[c] || custom.includes(c));
  const cover = (c) => recipes.find((r) => r.category === c && r.image)?.image;

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
          {custom.length > 0 && (
            <button onClick={() => setEditing((v) => !v)} className="rounded-full px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 inline-flex items-center gap-1">
              {editing ? <><Check size={16} /> סיום</> : <><Pencil size={15} /> עריכה</>}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-4">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shown.map((c) => {
            const image = cover(c);
            const mine = custom.includes(c);
            return (
              <li key={c} className="relative">
                <button
                  onClick={() => !editing && onPick(c)}
                  className={`w-full text-right rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition ${active === c ? 'ring-2 ring-orange-500' : ''}`}
                >
                  <div className="relative h-20 bg-orange-100 flex items-center justify-center">
                    {image && <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover opacity-90" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                    <span className="relative text-3xl drop-shadow">{emojiOf(c)}</span>
                  </div>
                  <div className="p-2.5">
                    <div className="font-bold leading-snug line-clamp-2">{c}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{counts[c] || 0} מתכונים{mine ? ' · שלכם' : ''}</div>
                  </div>
                </button>
                {editing && mine && (
                  <button
                    onClick={() => window.confirm(`למחוק את הקטגוריה "${c}"? המתכונים שבה יעברו ל"אחר".`) && run(`rm-${c}`, () => onRemove(c))}
                    className="absolute top-2 left-2 w-9 h-9 rounded-full bg-white shadow text-red-600 flex items-center justify-center"
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
        </p>
      </div>
    </div>
  );
}

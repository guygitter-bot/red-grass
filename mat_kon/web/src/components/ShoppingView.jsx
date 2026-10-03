import { useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, Plus, Share2, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import StoresSheet from './StoresSheet';
import { organizeShopping } from '../lib/api';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

// רשימת הקניות: מצרכים שנוספו ממתכונים (לפי מספר המנות שנבחר) ופריטים שהוספתם בעצמכם
export default function ShoppingView({ session, items, onChange, onBack, onToast }) {
  const [stores, setStores] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // קיבוץ: לפי מחלקה אחרי "סידור חכם", אחרת לפי המתכון שממנו הפריט הגיע
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const key = item.group || item.recipeTitle || 'פריטים נוספים';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map];
  }, [items]);
  const checkedCount = items.filter((i) => i.checked).length;

  const add = (e) => {
    e.preventDefault();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    onChange([...items, ...lines.map((l) => ({ id: newId(), text: l, checked: false }))]);
    setText('');
  };

  const organize = async () => {
    setBusy(true);
    setError('');
    try {
      const open = items.filter((i) => !i.checked);
      const result = await organizeShopping(session, open.map((i) => i.text));
      // רק הפריטים שנשלחו לסידור מוחלפים; מה שסומן או נוסף בינתיים (גם ע"י בן משפחה) נשאר
      const sentIds = new Set(open.map((i) => i.id));
      const organized = result.flatMap((g) => g.items.map((t) => ({ id: newId(), text: t, checked: false, group: g.title })));
      onChange((current) => [...current.filter((i) => !sentIds.has(i.id)), ...organized]);
      onToast('הרשימה סודרה לפי מחלקות');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const textOut = groups
      .map(([title, list]) => [`*${title}*`, ...list.filter((i) => !i.checked).map((i) => `• ${i.text}`)].join('\n'))
      .join('\n\n');
    try {
      if (navigator.share) await navigator.share({ title: 'רשימת קניות', text: `🛒 רשימת קניות\n\n${textOut}` });
      else {
        await navigator.clipboard.writeText(textOut);
        onToast('הרשימה הועתקה');
      }
    } catch {
      // בוטל
    }
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="flex-1 font-bold">רשימת קניות</div>
          {items.length > 0 && (
            <button onClick={share} className="p-2 rounded-full hover:bg-stone-100" aria-label="שיתוף" title="שיתוף">
              <Share2 size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="הוספת פריט (למשל: חלב)"
            className="flex-1 min-w-0 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
          />
          <button className="rounded-2xl bg-orange-500 text-white px-4 font-bold flex items-center gap-1 shrink-0">
            <Plus size={18} /> הוספה
          </button>
        </form>

        {items.length === 0 ? (
          <div className="text-center mt-12 text-stone-500 leading-relaxed">
            <div className="text-5xl mb-3">🛒</div>
            הרשימה ריקה. בדף של מתכון לוחצים "הוספה לרשימת קניות",
            <br />
            והמצרכים נכנסים לכאן לפי מספר המנות שבחרתם.
          </div>
        ) : (
          <>
            <button
              onClick={() => setStores(true)}
              disabled={items.length === checkedCount}
              className="mt-3 w-full rounded-2xl bg-orange-500 text-white font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <ShoppingBag size={18} /> איפה לקנות הכי זול ({items.length - checkedCount} מוצרים)
            </button>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button
                onClick={organize}
                disabled={busy || items.length - checkedCount < 2}
                className="rounded-full bg-orange-50 text-orange-800 px-3 py-1.5 font-medium flex items-center gap-1.5 disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} סידור חכם (איחוד כפילויות ומחלקות)
              </button>
              {checkedCount > 0 && (
                <button onClick={() => onChange(items.filter((i) => !i.checked))} className="rounded-full bg-stone-100 px-3 py-1.5 flex items-center gap-1.5">
                  <Check size={15} /> מחיקת מה שנקנה ({checkedCount})
                </button>
              )}
              <button
                onClick={() => window.confirm('לרוקן את כל הרשימה?') && onChange([])}
                className="rounded-full bg-stone-100 px-3 py-1.5 flex items-center gap-1.5 text-red-600"
              >
                <Trash2 size={15} /> ניקוי הכל
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            {groups.map(([title, list]) => (
              <section key={title} className="mt-5">
                <h2 className="font-bold text-stone-800 mb-2">{title}</h2>
                <ul className="bg-white rounded-2xl shadow-sm divide-y divide-stone-100">
                  {list.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                      <button
                        onClick={() => onChange(items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)))}
                        className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center ${item.checked ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-300'}`}
                        aria-label="סימון"
                      >
                        {item.checked && <Check size={15} strokeWidth={3} />}
                      </button>
                      <span className={`flex-1 ${item.checked ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.text}</span>
                      <button onClick={() => onChange(items.filter((i) => i.id !== item.id))} className="p-1 text-stone-300 hover:text-red-500" aria-label="הסרה">
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
      {stores && <StoresSheet session={session} items={items.filter((i) => !i.checked).map((i) => i.text)} onClose={() => setStores(false)} />}
    </div>
  );
}

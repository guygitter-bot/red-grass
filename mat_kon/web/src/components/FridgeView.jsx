import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { matchRecipes } from '../lib/fridge';
import { CATEGORY_EMOJI } from '../lib/recipes';
import { usePersistentState } from '../lib/storage';

// מה יש לי במקרר: מקלידים מה יש בבית ומקבלים מתכונים מהספר שאפשר להכין, ומה חסר לכל אחד
export default function FridgeView({ recipes }) {
  const [have, setHave] = usePersistentState('matkon_fridge', []);
  const [ignoreStaples, setIgnoreStaples] = usePersistentState('matkon_fridge_staples', true);
  const [text, setText] = useState('');
  const results = useMemo(() => matchRecipes(recipes, have, { ignoreStaples }), [recipes, have, ignoreStaples]);

  const add = (e) => {
    e.preventDefault();
    const items = text.split(/[,\n،]+/).map((t) => t.trim()).filter(Boolean);
    if (items.length) setHave((h) => [...new Set([...h, ...items])]);
    setText('');
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center font-bold">מה יש לי במקרר?</div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="למשל: ביצים, עגבניות, גבינה צהובה"
            className="flex-1 min-w-0 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
          />
          <button className="rounded-2xl bg-orange-500 text-white px-4 font-bold flex items-center gap-1 shrink-0">
            <Plus size={18} /> הוספה
          </button>
        </form>

        {have.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {have.map((h) => (
              <span key={h} className="rounded-full bg-orange-100 text-orange-900 text-sm pr-3 pl-1.5 py-1 flex items-center gap-1">
                {h}
                <button onClick={() => setHave((list) => list.filter((x) => x !== h))} className="p-0.5" aria-label={`הסרת ${h}`}>
                  <X size={14} />
                </button>
              </span>
            ))}
            <button onClick={() => setHave([])} className="text-sm text-stone-500 underline">ניקוי</button>
          </div>
        )}

        <label className="mt-3 flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={ignoreStaples} onChange={(e) => setIgnoreStaples(e.target.checked)} className="accent-orange-500" />
          להניח שיש בבית מצרכי בסיס (מלח, פלפל, שמן, סוכר, קמח, בצל, שום)
        </label>

        {!have.length ? (
          <p className="mt-12 text-center text-stone-500 leading-relaxed">
            <span className="text-5xl block mb-3">🧊</span>
            כתבו מה יש לכם בבית, ונמצא בספר המתכונים מה אפשר להכין.
          </p>
        ) : !results.length ? (
          <p className="mt-10 text-center text-stone-500">אין בספר מתכון עם המצרכים האלה</p>
        ) : (
          <ul className="mt-5 space-y-2">
            {results.map(({ recipe, matched, missing, total }) => (
              <li key={recipe.id}>
                <a href={`#/r/${recipe.id}`} className="block rounded-2xl bg-white shadow-sm p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{CATEGORY_EMOJI[recipe.category]}</span>
                    <span className="flex-1 font-bold truncate">{recipe.title}</span>
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${missing.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {missing.length ? `${matched.length}/${total}` : 'יש הכל!'}
                    </span>
                  </div>
                  {missing.length > 0 && (
                    <p className="mt-1.5 text-sm text-stone-500 line-clamp-2">חסר: {missing.join(' · ')}</p>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

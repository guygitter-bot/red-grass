import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { addMeal, dateKey, MEALS, plannedRecipes, removeMeal, shiftWeek, shortDate, weekDays, weekStart } from '../lib/plan';
import { filterRecipes, emojiOf } from '../lib/recipes';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

// תכנון ארוחות שבועי: מתכונים מהספר או הערה חופשית לכל יום, ורשימת קניות לכל השבוע
export default function PlanView({ plan, recipes, onChange, onShopWeek }) {
  const [start, setStart] = useState(() => weekStart());
  const [adding, setAdding] = useState(null); // day key
  const days = useMemo(() => weekDays(start), [start]);
  const today = dateKey(new Date());
  const weekRecipes = plannedRecipes(plan, days, recipes);
  const isThisWeek = dateKey(start) === dateKey(weekStart());

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={() => setStart((s) => shiftWeek(s, -1))} className="p-2 rounded-full hover:bg-stone-100" aria-label="שבוע קודם">
            <ChevronRight size={22} />
          </button>
          <button onClick={() => setStart(weekStart())} className="flex-1 text-center font-bold">
            {isThisWeek ? 'השבוע' : 'שבוע'} {shortDate(days[0].date)}–{shortDate(days[6].date)}
          </button>
          <button onClick={() => setStart((s) => shiftWeek(s, 1))} className="p-2 rounded-full hover:bg-stone-100" aria-label="שבוע הבא">
            <ChevronLeft size={22} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <button
          disabled={!weekRecipes.length}
          onClick={() => onShopWeek(weekRecipes)}
          className="mt-4 w-full rounded-2xl bg-orange-500 text-white font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <ShoppingCart size={18} /> רשימת קניות לכל השבוע ({weekRecipes.length} מתכונים)
        </button>

        <div className="mt-4 space-y-3">
          {days.map((day) => {
            const meals = plan[day.key] || [];
            return (
              <section key={day.key} className={`rounded-2xl bg-white shadow-sm p-3 ${day.key === today ? 'ring-2 ring-orange-400' : ''}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">
                    יום {day.name} <span className="text-stone-400 font-normal text-sm">{shortDate(day.date)}</span>
                    {day.key === today && <span className="mr-2 text-xs text-orange-600">היום</span>}
                  </h2>
                  <button onClick={() => setAdding(day.key)} className="p-1.5 rounded-full bg-orange-50 text-orange-700" aria-label="הוספת ארוחה">
                    <Plus size={18} />
                  </button>
                </div>
                {meals.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {meals.map((m) => {
                      const recipe = m.recipeId && recipes.find((r) => r.id === m.recipeId);
                      return (
                        <li key={m.id} className="flex items-center gap-2 rounded-xl bg-stone-50 px-2.5 py-2">
                          <span className="text-lg">{recipe ? emojiOf(recipe.category) : '📝'}</span>
                          <div className="flex-1 min-w-0">
                            {recipe ? (
                              <a href={`#/r/${recipe.id}`} className="font-medium text-stone-800 truncate block">{recipe.title}</a>
                            ) : (
                              <span className="text-stone-700 truncate block">{m.title}</span>
                            )}
                            {m.meal && <span className="text-xs text-stone-400">{m.meal}</span>}
                          </div>
                          <button onClick={() => onChange(removeMeal(plan, day.key, m.id))} className="p-1 text-stone-300 hover:text-red-500" aria-label="הסרה">
                            <X size={16} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {adding && (
        <MealPicker
          recipes={recipes}
          dayLabel={`יום ${days.find((d) => d.key === adding)?.name}`}
          onClose={() => setAdding(null)}
          onPick={(meal) => {
            onChange(addMeal(plan, adding, { id: newId(), ...meal }));
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}

export function MealPicker({ recipes, dayLabel, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState('ארוחת ערב');
  const list = filterRecipes(recipes, { query }).slice(0, 50);
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">מה מבשלים ב{dayLabel}?</h2>
            <button onClick={onClose} className="p-1 text-stone-400" aria-label="סגירה"><X size={20} /></button>
          </div>
          <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
            {MEALS.map((m) => (
              <button key={m} onClick={() => setMeal(m)} className={`shrink-0 rounded-full px-3 py-1 text-sm border ${meal === m ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-200'}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש מתכון, או כתבו ארוחה חופשית"
              className="w-full rounded-2xl border border-stone-200 py-2.5 pr-9 pl-3 outline-none focus:border-orange-400"
            />
          </div>
          {query.trim() && (
            <button onClick={() => onPick({ title: query.trim(), meal })} className="mt-2 text-sm text-orange-700 font-medium">
              + הוספה כהערה: "{query.trim()}"
            </button>
          )}
        </div>
        <ul className="overflow-y-auto px-4 pb-4 divide-y divide-stone-100">
          {list.map((r) => (
            <li key={r.id}>
              <button onClick={() => onPick({ recipeId: r.id, title: r.title, meal })} className="w-full text-right flex items-center gap-2 py-2.5">
                <span className="text-lg">{emojiOf(r.category)}</span>
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-xs text-stone-400">{r.category}</span>
              </button>
            </li>
          ))}
          {!list.length && <li className="py-6 text-center text-stone-400 text-sm">לא נמצאו מתכונים</li>}
        </ul>
      </div>
    </div>
  );
}

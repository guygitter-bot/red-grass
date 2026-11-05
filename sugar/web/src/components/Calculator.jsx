// מחשבון אינסולין: בוחרים מה אוכלים מטבלת הפחמימות (כמה כוסות / מנות), מזינים סוכר לפני,
// ומקבלים כמה יחידות לפי ההגדרות (יחידה לכל X גרם, ותיקון רק אם הוזן פקטור תיקון). חישוב בלבד – לא הוראה רפואית.
// משמש גם כמסך (#/calc) וגם בתוך עריכת ארוחה (inline, עם onApply).
import { useState } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { SLOTS, calcDose, itemsCarbs, itemsText, level, numOrEmpty, nowTime, today } from '../lib/diary';
import { newId, save } from '../lib/store';
import { Button, Field, Sheet, inputCls } from './ui';
import { Glucose } from './bits';
import MealEditor from './MealEditor';

const fmtQty = (q) => (q === 0.5 ? '½' : Number.isInteger(q) ? String(q) : `${Math.floor(q)}½`);

// סוג הארוחה לפי השעה (לשם ברירת מחדל)
export function slotByTime(time) {
  const h = Number(time.slice(0, 2)) + Number(time.slice(3)) / 60;
  return h < 9 ? 'breakfast' : h < 11.5 ? 'ten' : h < 15 ? 'lunch' : h < 17.5 ? 'four' : h < 21 ? 'dinner' : 'night';
}

function FoodEditor({ food, onClose }) {
  const [f, setF] = useState({ name: food.name || '', unit: food.unit || 'כוס חד פעמית', carbs: food.carbs == null ? '' : String(food.carbs) });
  const submit = (e) => {
    e.preventDefault();
    const carbs = numOrEmpty(f.carbs);
    if (!f.name.trim() || carbs === '' || carbs < 0) return;
    save({ id: food.id || newId('f'), t: 'food', name: f.name.trim(), unit: f.unit.trim() || 'מנה', carbs });
    onClose();
  };
  return (
    <Sheet title={food.id ? 'עריכת מאכל' : 'מאכל חדש בטבלה'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="שם">
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="למשל: פיתה" autoFocus required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="יחידה">
            <input className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="כוס חד פעמית / יחידה / מנה" />
          </Field>
          <Field label="גרם פחמימה ליחידה">
            <input className={`${inputCls} num`} inputMode="decimal" value={f.carbs} onChange={(e) => setF({ ...f, carbs: e.target.value })} required />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1">שמירה</Button>
          {food.id && (
            <Button
              type="button"
              kind="danger"
              aria-label="מחיקה מהטבלה"
              onClick={() => {
                if (confirm(`להוריד את "${food.name}" מהטבלה?`)) {
                  // גם מאכל מהרשימה המובנית (שעוד לא נשמר כרשומה) – נשמר כ"נמחק"
                  save({ id: food.id, t: 'food', deleted: true });
                  onClose();
                }
              }}
            >
              <Trash2 size={18} />
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

export default function Calculator({ data, initial = {}, onApply, inline = false }) {
  const s = data.settings;
  // כמות לכל מאכל (לפי המזהה)
  const [qty, setQty] = useState(() => Object.fromEntries((initial.items || []).filter((x) => x.foodId).map((x) => [x.foodId, x.qty])));
  const [extra, setExtra] = useState('');
  const [before, setBefore] = useState(initial.before === '' || initial.before == null ? '' : String(initial.before));
  const [editFood, setEditFood] = useState(null);
  // מאכל חדש לטבלה – טופס קטן בתוך המסך (עובד גם בתוך מסך הארוחה)
  const [adding, setAdding] = useState(null);
  const addFood = () => {
    const c = numOrEmpty(adding.carbs);
    if (!adding.name.trim() || c === '' || c < 0) return;
    const id = newId('f');
    save({ id, t: 'food', name: adding.name.trim(), unit: adding.unit.trim() || 'מנה', carbs: c });
    // המאכל החדש נבחר מיד (יחידה אחת)
    setQty((q) => ({ ...q, [id]: 1 }));
    // אם הפחמימות הנוספות הפכו למאכל – לא לספור אותן פעמיים
    if (numOrEmpty(extra) === c) setExtra('');
    setAdding(null);
  };
  const [meal, setMeal] = useState(null);

  const items = data.foods.filter((f) => qty[f.id] > 0).map((f) => ({ foodId: f.id, name: f.name, qty: qty[f.id], carbs: f.carbs }));
  const extraCarbs = numOrEmpty(extra);
  const carbs = itemsCarbs(items) + (extraCarbs > 0 ? extraCarbs : 0);
  const b = numOrEmpty(before);
  const r = calcDose(s, items.length || extraCarbs > 0 ? carbs : '', b);
  const step = (id, d) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + d) }));

  const result = () => ({
    items: extraCarbs > 0 ? [...items, { foodId: '', name: 'פחמימות נוספות', qty: 1, carbs: extraCarbs }] : items,
    carbs,
    before: b,
    insulin: r ? r.rounded : '',
  });

  const recordMeal = () => {
    const x = result();
    const time = nowTime();
    const slot = slotByTime(time);
    setMeal({ t: 'meal', date: today(), time, slot, name: SLOTS[slot], food: itemsText(x.items), carbs: x.carbs, before: x.before, insulin: x.insulin, items: x.items });
  };

  return (
    <div className={inline ? '' : 'mx-auto max-w-2xl'}>
      {!inline && (
        <>
          <h1 className="mb-1 text-2xl font-bold">מחשבון אינסולין</h1>
          <p className="mb-4 text-sm text-muted">
            {s.icr > 0 ? `יחידה לכל ${s.icr} גרם פחמימה` : 'לא הוגדר יחס פחמימות'} · טווח תקין לפני ארוחה {s.low}-{s.high} ·{' '}
            <a href="#/settings" className="text-accent-ink underline">
              לשנות בהגדרות
            </a>
          </p>
        </>
      )}

      <section className={inline ? 'mb-3' : 'mb-4 rounded-2xl bg-card p-4 shadow-sm'}>
        <Field label="סוכר לפני האוכל">
          <div className="flex items-center gap-2">
            <input className={`${inputCls} num text-lg`} inputMode="numeric" value={before} onChange={(e) => setBefore(e.target.value)} placeholder="mg/dL" />
            {b !== '' && <Glucose value={b} settings={s} />}
          </div>
        </Field>

        <div className="mb-1 text-sm font-medium text-muted">מה אוכלים</div>
        <div className="divide-y divide-line rounded-2xl border border-line">
          {data.foods.map((f) => {
            const q = qty[f.id] || 0;
            return (
              <div key={f.id} className={`flex items-center gap-2 px-3 py-2 ${q ? 'bg-soft' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted">
                    {f.unit} = <span className="num">{f.carbs}</span> גר׳
                  </div>
                </div>
                {!inline && (
                  <button type="button" onClick={() => setEditFood(f)} className="rounded-full p-1.5 text-muted hover:bg-card" aria-label={`עריכת ${f.name}`}>
                    <Pencil size={14} />
                  </button>
                )}
                <button type="button" onClick={() => step(f.id, -0.5)} disabled={!q} className="rounded-full border border-line bg-card p-1.5 disabled:opacity-30" aria-label={`פחות ${f.name}`}>
                  <Minus size={16} />
                </button>
                <span className="num w-8 text-center font-bold" dir="ltr">
                  {q ? fmtQty(q) : '0'}
                </span>
                <button type="button" onClick={() => step(f.id, q ? 0.5 : 1)} className="rounded-full border border-line bg-card p-1.5" aria-label={`עוד ${f.name}`}>
                  <Plus size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Field label="פחמימות נוספות (גרם)" hint="משהו שלא בטבלה – לפי האריזה">
              <input className={`${inputCls} num`} inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0" />
            </Field>
          </div>
          {!adding && (
            <Button type="button" kind="ghost" className="mb-3 flex items-center gap-1" onClick={() => setAdding({ name: '', unit: 'כוס חד פעמית', carbs: extra })}>
              <Plus size={16} /> מאכל לטבלה
            </Button>
          )}
        </div>
        {adding && (
          <div className="rounded-2xl border border-accent p-3">
            <div className="mb-2 text-sm font-bold">מאכל חדש בטבלה</div>
            <div className="grid grid-cols-2 gap-2">
              <input className={`${inputCls} col-span-2`} value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder="שם, למשל: פיתה" aria-label="שם המאכל" autoFocus />
              <input className={inputCls} value={adding.unit} onChange={(e) => setAdding({ ...adding, unit: e.target.value })} placeholder="יחידה (כוס / יחידה / מנה)" aria-label="יחידה" />
              <input className={`${inputCls} num`} inputMode="decimal" value={adding.carbs} onChange={(e) => setAdding({ ...adding, carbs: e.target.value })} placeholder="גרם פחמימה ליחידה" aria-label="גרם פחמימה ליחידה" />
            </div>
            <div className="mt-2 flex gap-2">
              <Button type="button" className="flex-1" disabled={!adding.name.trim() || numOrEmpty(adding.carbs) === ''} onClick={addFood}>
                להוסיף לטבלה
              </Button>
              <Button type="button" kind="ghost" onClick={() => setAdding(null)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className={`${inline ? 'mb-3 border border-line' : 'mb-4 shadow-sm'} rounded-2xl bg-card p-4`} aria-live="polite">
        {!r ? (
          <p className="text-sm text-muted">{s.icr > 0 ? 'בוחרים מה אוכלים ומקבלים חישוב.' : 'כדי לחשב צריך להזין בהגדרות "יחס פחמימות" (כמה גרם ליחידה).'}</p>
        ) : (
          <>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-muted">סה״כ פחמימות</span>
              <span className="num font-bold">{r.carbs} גר׳</span>
            </div>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted">
                לאוכל ({r.carbs} ÷ {s.icr})
              </span>
              <span className="num">{r.food} יח׳</span>
            </div>
            {r.correction > 0 && (
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted">
                  תיקון ({b} − {r.target}) ÷ {s.cf}
                </span>
                <span className="num">+{r.correction} יח׳</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="font-bold">סה״כ לפי החישוב</span>
              <span className="num text-3xl font-bold text-accent-ink">{r.rounded} יח׳</span>
            </div>
            {r.rounded !== r.total && <p className="num text-left text-xs text-muted">מדויק: {r.total} (עוגל לחצי יחידה)</p>}

            {r.status === 'low' && <p className="mt-3 rounded-xl bg-low/15 p-3 text-sm font-medium text-low">הסוכר נמוך ({b}). קודם לטפל בנמוך ולמדוד שוב, ורק אחר כך להחליט על אינסולין – לפי ההנחיות של הצוות.</p>}
            {r.needsCf && (
              <p className="mt-3 rounded-xl bg-high/15 p-3 text-sm text-high">
                הסוכר מעל {s.high} – בחישוב <b>לא</b> נכלל תיקון. כדי שהמחשבון יחשב גם תיקון, צריך להזין בהגדרות &quot;פקטור תיקון&quot; שהצוות נתן.
              </p>
            )}
            {r.status === 'ok' && level(b, s) === 'ok' && <p className="mt-3 text-sm text-ok">הסוכר בטווח – בלי תיקון.</p>}
            {r.status === '' && <p className="mt-3 text-sm text-muted">לא הוזן סוכר לפני – החישוב רק לפי האוכל.</p>}
            <p className="mt-3 text-xs text-muted">חישוב לפי ההגדרות שהזנתם – לא הוראה רפואית. אם משהו לא נראה הגיוני, לבדוק עם הצוות.</p>
          </>
        )}
      </section>

      {inline ? (
        <Button type="button" className="w-full" disabled={!r} onClick={() => onApply(result())}>
          להעביר לארוחה
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!r} onClick={recordMeal}>
            לרשום כארוחה
          </Button>
          <Button
            kind="ghost"
            onClick={() => {
              setQty({});
              setExtra('');
              setBefore('');
            }}
          >
            ניקוי
          </Button>
        </div>
      )}

      {editFood && <FoodEditor food={editFood} onClose={() => setEditFood(null)} />}
      {meal && <MealEditor data={data} meal={meal} onClose={() => setMeal(null)} />}
    </div>
  );
}

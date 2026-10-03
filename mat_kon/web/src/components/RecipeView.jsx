import { useEffect, useState } from 'react';
import {
  ArrowRight, Camera, Check, ChefHat, Clock, ExternalLink, Heart, ImagePlus, Info, Loader2, MessageCircle, Minus, PenLine, Pencil, PlayCircle,
  CalendarPlus, Plus, Printer, RotateCw, Share2, ShoppingCart, Star, Trash2, Users, X,
} from 'lucide-react';
import CookMode from './CookMode';
import { missingLines } from '../lib/fridge';
import { baseServings, formatAmount, scaleSections } from '../lib/scale';
import { thumbnail } from '../lib/image';
import { DAY_NAMES, MEALS, dateKey, shortDate } from '../lib/plan';
import { emojiOf, VIDEO_LABEL, isVideo, recipeAsText, sectionsToText, shortUrl, textToSections } from '../lib/recipes';
import { usePersistentState } from '../lib/storage';

export default function RecipeView({ recipe, pantryNames = [], categories, onBack, onUpdate, onRefresh, onDelete, onAddToShopping, onAddToPlan }) {
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [cooking, setCooking] = useState(false);
  // מספר מנות: מכפיל לכמויות, נשמר לכל מתכון במכשיר
  const [factor, setFactor] = usePersistentState(`matkon_factor_${recipe.id}`, 1);
  const base = baseServings(recipe.servings);
  const ingredients = scaleSections(recipe.ingredients, factor);
  const canRefresh = Boolean(recipe.source.url) || recipe.source.kind === 'whatsapp';
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // סימון מצרכים ושלבים בזמן הבישול - נשמר רק במכשיר הזה
  const [checked, setChecked] = usePersistentState(`matkon_checked_${recipe.id}`, {});
  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  useEffect(() => window.scrollTo(0, 0), [recipe.id]);

  const run = async (name, fn) => {
    setBusy(name);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const fromChat = recipe.source.kind === 'whatsapp';
  const [showMessage, setShowMessage] = useState(false);

  const share = async () => {
    // מתכון מווטסאפ אין לו קישור: משתפים את המתכון עצמו
    const text = fromChat ? recipeAsText(recipe) : `${recipe.title}\n${recipe.source.url}`;
    try {
      if (navigator.share) await navigator.share(fromChat ? { title: recipe.title, text } : { title: recipe.title, text, url: recipe.source.url });
      else {
        await navigator.clipboard.writeText(fromChat ? text : recipe.source.url);
        setError(fromChat ? 'המתכון הועתק' : 'הקישור המקורי הועתק');
      }
    } catch {
      // המשתמש ביטל
    }
  };

  const video = isVideo(recipe);
  const times = [
    recipe.prepTime && ['הכנה', recipe.prepTime],
    recipe.cookTime && ['בישול/אפייה', recipe.cookTime],
    recipe.totalTime && ['סה"כ', recipe.totalTime],
  ].filter(Boolean);
  let stepNumber = 0;

  return (
    <div className="min-h-screen pb-16">
      {cooking && <CookMode recipe={recipe} ingredients={ingredients} onClose={() => setCooking(false)} />}
      {planning && (
        <DayPicker
          onClose={() => setPlanning(false)}
          onPick={(day, label, meal) => {
            onAddToPlan(day, label, meal);
            setPlanning(false);
          }}
        />
      )}
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)] print:hidden">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="flex-1 truncate font-bold">{recipe.title}</div>
          <button onClick={() => setPlanning(true)} className="p-2 rounded-full hover:bg-stone-100" aria-label="הוספה לתכנון השבועי" title="הוספה לתכנון השבועי">
            <CalendarPlus size={21} />
          </button>
          <button onClick={() => onUpdate({ favorite: !recipe.favorite })} className="p-2 rounded-full hover:bg-stone-100" aria-label="מועדף" title="מועדף">
            <Heart size={21} className={recipe.favorite ? 'text-rose-500' : ''} fill={recipe.favorite ? 'currentColor' : 'none'} />
          </button>
          <button onClick={share} className="p-2 rounded-full hover:bg-stone-100" aria-label="שיתוף" title="שיתוף">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <article className="max-w-2xl mx-auto px-4">
        {/* המקור בראש הדף: הקישור המקורי, או ההודעה מווטסאפ */}
        {!fromChat && !recipe.source.url ? (
          <div className="mt-4 rounded-2xl bg-stone-100 p-3 flex items-center gap-3 text-sm text-stone-700">
            <span className="w-10 h-10 rounded-xl bg-stone-500 text-white flex items-center justify-center shrink-0">
              {recipe.source.kind === 'photo' ? <Camera size={20} /> : <PenLine size={20} />}
            </span>
            {recipe.source.kind === 'photo' ? 'מתכון שנבנה מתמונה' : 'מתכון שכתבתם בעצמכם'}
          </div>
        ) : fromChat ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
            <button onClick={() => setShowMessage((v) => !v)} className="w-full flex items-center gap-3 text-right">
              <span className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <MessageCircle size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-emerald-700 font-medium">
                  מתוך ווטסאפ{recipe.source.chat ? ` · ${recipe.source.chat}` : ''}
                </span>
                <span className="block text-sm text-stone-800 truncate">
                  {[recipe.source.author, recipe.source.date].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-xs text-emerald-700 shrink-0">{showMessage ? 'הסתרה' : 'ההודעה המקורית'}</span>
            </button>
            {showMessage && (
              <p className="mt-3 text-sm text-stone-700 whitespace-pre-line bg-white rounded-xl p-3" dir="auto">{recipe.source.text}</p>
            )}
          </div>
        ) : (
          <a
            href={recipe.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-3 rounded-2xl bg-orange-50 border border-orange-200 p-3 hover:bg-orange-100 transition"
          >
            <span className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0">
              {video ? <PlayCircle size={22} /> : <ExternalLink size={20} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-orange-700 font-medium">
                {recipe.source.kind === 'facebook' ? 'הפוסט המקורי ב-Facebook' : video ? `הסרטון המקורי ב-${VIDEO_LABEL[recipe.source.kind]}` : 'המתכון המקורי'}
                {recipe.source.author ? ` · ${recipe.source.author}` : ''}
              </span>
              <span className="block text-sm text-stone-800 truncate" dir="ltr">{shortUrl(recipe.source.url)}</span>
            </span>
            <ExternalLink size={16} className="text-orange-400 shrink-0" />
          </a>
        )}
        {!fromChat && recipe.source.text && (
          <div className="mt-2 text-sm">
            <button onClick={() => setShowMessage((v) => !v)} className="text-orange-700 font-medium">
              {showMessage ? 'הסתרת הטקסט שהודבק' : 'הטקסט שהודבק מהפוסט'}
            </button>
            {showMessage && (
              <p className="mt-2 text-stone-700 whitespace-pre-line bg-white rounded-xl p-3 border border-stone-100" dir="auto">{recipe.source.text}</p>
            )}
          </div>
        )}

        {recipe.source.embed ? (
          <div className={`mt-3 rounded-2xl overflow-hidden bg-black print:hidden ${recipe.source.kind === 'tiktok' ? 'aspect-[9/16] max-w-xs mx-auto' : 'aspect-video'}`}>
            <iframe
              src={recipe.source.embed}
              title={recipe.title}
              className="w-full h-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          </div>
        ) : recipe.image ? (
          <img src={recipe.image} alt="" referrerPolicy="no-referrer" className="mt-3 w-full max-h-80 object-cover rounded-2xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : null}

        <h1 className="mt-5 text-3xl font-black leading-tight text-stone-900 print:mt-0">{recipe.title}</h1>
        {recipe.originalTitle && recipe.originalTitle !== recipe.title && (
          <p className="text-sm text-stone-400 mt-1" dir="auto">{recipe.originalTitle}</p>
        )}
        {recipe.description && <p className="mt-2 text-stone-600 leading-relaxed">{recipe.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 text-sm pr-3 pl-1 py-0.5">
            {emojiOf(recipe.category)}
            <select
              value={recipe.category}
              onChange={(e) => onUpdate({ category: e.target.value })}
              className="bg-transparent font-medium outline-none py-1 cursor-pointer"
              aria-label="קטגוריה"
            >
              {(categories.includes(recipe.category) ? categories : [...categories, recipe.category]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <Tags tags={recipe.tags || []} onChange={(tags) => onUpdate({ tags })} />
        </div>

        <Rating value={recipe.rating || 0} onChange={(rating) => onUpdate({ rating })} />

        {(recipe.servings || times.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-700">
            {recipe.servings && (
              <span className="flex items-center gap-1.5"><Users size={16} className="text-orange-500" /> {recipe.servings}{factor !== 1 ? ` (במקור)` : ''}</span>
            )}
            {times.map(([label, value]) => (
              <span key={label} className="flex items-center gap-1.5"><Clock size={16} className="text-orange-500" /> {label}: {value}</span>
            ))}
          </div>
        )}

        {recipe.notes && (
          <div className={`mt-4 rounded-2xl p-3 text-sm flex gap-2 ${recipe.confidence === 'low' ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>
            <Info size={18} className="shrink-0 mt-0.5" />
            <span>{recipe.notes}</span>
          </div>
        )}

        {editing ? (
          <Editor recipe={recipe} onCancel={() => setEditing(false)} onSave={async (patch) => { await onUpdate(patch); setEditing(false); }} />
        ) : (
          <>
            <Section
              title="מצרכים"
              action={(
                <button
                  onClick={() => onAddToShopping(ingredients.flatMap((s) => s.items))}
                  className="rounded-full bg-orange-50 text-orange-800 px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 print:hidden"
                >
                  <ShoppingCart size={15} /> לרשימת קניות
                </button>
              )}
            >
              <Servings base={base} factor={factor} onChange={setFactor} />
              {ingredients.map((s, si) => (
                <div key={si} className="mb-3">
                  {s.title && <h3 className="font-bold text-stone-800 mb-1.5">{s.title}</h3>}
                  <ul className="space-y-1">
                    {s.items.map((item, i) => {
                      const key = `i${si}.${i}`;
                      return (
                        <li key={key}>
                          <button onClick={() => toggle(key)} className="w-full text-right flex items-start gap-3 py-1.5">
                            <span className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${checked[key] ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-300'}`}>
                              {checked[key] && <Check size={14} strokeWidth={3} />}
                            </span>
                            <span className={checked[key] ? 'line-through text-stone-400' : 'text-stone-800'}>{item}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <MissingBox
                lines={ingredients.flatMap((s) => s.items)}
                pantryNames={pantryNames}
                onShop={(lines) => onAddToShopping(lines)}
              />
            </Section>

            <Section
              title="אופן ההכנה"
              action={recipe.steps.length > 0 && (
                <button onClick={() => setCooking(true)} className="rounded-full bg-stone-900 text-white px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 print:hidden">
                  <ChefHat size={15} /> מצב בישול
                </button>
              )}
            >
              {recipe.steps.map((s, si) => (
                <div key={si} className="mb-4">
                  {s.title && <h3 className="font-bold text-stone-800 mb-2">{s.title}</h3>}
                  <ol className="space-y-3">
                    {s.items.map((item, i) => {
                      const key = `s${si}.${i}`;
                      stepNumber += 1;
                      return (
                        <li key={key}>
                          <button onClick={() => toggle(key)} className="w-full text-right flex items-start gap-3">
                            <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${checked[key] ? 'bg-stone-200 text-stone-400' : 'bg-orange-500 text-white'}`}>
                              {checked[key] ? <Check size={15} strokeWidth={3} /> : stepNumber}
                            </span>
                            <span className={`leading-relaxed pt-0.5 ${checked[key] ? 'text-stone-400' : 'text-stone-800'}`}>{item}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </Section>

            {recipe.tips?.length > 0 && (
              <Section title="טיפים">
                <ul className="list-disc pr-5 space-y-1.5 text-stone-700">
                  {recipe.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </Section>
            )}

            <div className="print:hidden"><MyNotes value={recipe.myNotes || ''} onSave={(myNotes) => onUpdate({ myNotes })} /></div>
            {recipe.myNotes && <p className="hidden print:block mt-6 text-sm"><b>ההערות שלי:</b> {recipe.myNotes}</p>}

            {Object.values(checked).some(Boolean) && (
              <button onClick={() => setChecked({})} className="mt-4 text-sm text-stone-500 underline">ניקוי הסימונים</button>
            )}
          </>
        )}

        {error && <p className="mt-6 text-center text-sm text-stone-600">{error}</p>}

        {!editing && (
          <div className="mt-8 pt-5 border-t border-stone-200 flex flex-wrap gap-2 justify-center text-sm print:hidden">
            <ActionButton onClick={() => setEditing(true)} icon={<Pencil size={16} />}>עריכה</ActionButton>
            <ActionButton onClick={() => window.print()} icon={<Printer size={16} />}>הדפסה / PDF</ActionButton>
            {canRefresh && (
              <ActionButton onClick={() => run('refresh', onRefresh)} icon={busy === 'refresh' ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />} disabled={Boolean(busy)}>
                {busy === 'refresh' ? 'מסדר שוב מהמקור…' : 'רענון מהמקור'}
              </ActionButton>
            )}
            <ActionButton
              onClick={() => window.confirm(`למחוק את "${recipe.title}"?`) && run('delete', onDelete)}
              icon={<Trash2 size={16} />}
              className="text-red-600"
              disabled={Boolean(busy)}
            >
              מחיקה
            </ActionButton>
          </div>
        )}
      </article>
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xl font-black text-stone-900 flex items-center gap-2">
          <span className="w-1.5 h-6 rounded-full bg-orange-500" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// שינוי כמות: לפי מספר מנות כשהוא ידוע ("6 מנות"), אחרת מכפיל (½, ×2...)
function Servings({ base, factor, onChange }) {
  const btn = 'w-9 h-9 rounded-full bg-white border border-stone-200 flex items-center justify-center disabled:opacity-30';
  if (base) {
    const count = Math.round(base * factor * 2) / 2;
    const step = (d) => onChange(Math.max(0.5, count + d) / base);
    return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-stone-50 px-3 py-2 print:hidden">
        <span className="text-sm text-stone-600 flex-1">כמות</span>
        <button onClick={() => step(-1)} disabled={count <= 1} className={btn} aria-label="פחות"><Minus size={16} /></button>
        <span className="font-bold min-w-[4.5rem] text-center">{formatAmount(count)} מנות</span>
        <button onClick={() => step(1)} className={btn} aria-label="יותר"><Plus size={16} /></button>
        {factor !== 1 && <button onClick={() => onChange(1)} className="text-xs text-orange-700">איפוס</button>}
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2 overflow-x-auto no-scrollbar print:hidden">
      <span className="text-sm text-stone-600 shrink-0 ml-1">כמות</span>
      {[0.5, 1, 1.5, 2, 3].map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`shrink-0 rounded-full px-3 py-1 text-sm border ${factor === f ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-stone-200'}`}
        >
          {f === 1 ? 'רגיל' : `×${formatAmount(f)}`}
        </button>
      ))}
    </div>
  );
}

function ActionButton({ onClick, icon, children, className = '', disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-full bg-white border border-stone-200 px-4 py-2 hover:bg-stone-50 disabled:opacity-50 ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

function MyNotes({ value, onSave }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Section title="ההערות שלי">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== value && onSave(text)}
        rows={3}
        placeholder="למשל: הוספתי פחות סוכר, 35 דקות בתנור שלנו"
        className="w-full rounded-2xl border border-stone-200 bg-white p-3 outline-none focus:border-orange-400"
      />
    </Section>
  );
}

function Editor({ recipe, onCancel, onSave }) {
  const [title, setTitle] = useState(recipe.title);
  const [ingredients, setIngredients] = useState(sectionsToText(recipe.ingredients));
  const [steps, setSteps] = useState(sectionsToText(recipe.steps));
  const [tips, setTips] = useState((recipe.tips || []).join('\n'));
  const [image, setImage] = useState(recipe.image || null);
  const [saving, setSaving] = useState(false);
  const field = 'w-full rounded-2xl border border-stone-200 bg-white p-3 outline-none focus:border-orange-400 leading-relaxed';

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-stone-500">שורה לכל פריט. שורה שמתחילה ב-## פותחת קטע חדש (למשל "## לציפוי").</p>
      <label className="block">
        <span className="font-bold">שם המתכון</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="block">
        <span className="font-bold">מצרכים</span>
        <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={10} className={`${field} mt-1`} />
      </label>
      <label className="block">
        <span className="font-bold">אופן ההכנה</span>
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={12} className={`${field} mt-1`} />
      </label>
      <label className="block">
        <span className="font-bold">טיפים</span>
        <textarea value={tips} onChange={(e) => setTips(e.target.value)} rows={3} className={`${field} mt-1`} />
      </label>
      <div className="flex items-center gap-3">
        {image && <img src={image} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-xl object-cover" />}
        <label className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium flex items-center gap-1.5 cursor-pointer">
          <ImagePlus size={16} /> {image ? 'החלפת תמונה' : 'הוספת תמונה'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => e.target.files[0] && setImage(await thumbnail(e.target.files[0]).catch(() => image))}
          />
        </label>
        {image && <button type="button" onClick={() => setImage(null)} className="text-sm text-stone-500">הסרת תמונה</button>}
      </div>
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                title: title.trim() || recipe.title,
                ingredients: textToSections(ingredients),
                steps: textToSections(steps),
                tips: tips.split('\n').map((t) => t.trim()).filter(Boolean),
                ...(image !== (recipe.image || null) ? { image } : {}),
              });
            } finally {
              setSaving(false);
            }
          }}
          className="flex-1 rounded-2xl bg-orange-500 text-white font-bold py-3 disabled:opacity-50"
        >
          שמירה
        </button>
        <button onClick={onCancel} className="rounded-2xl bg-stone-100 px-5 font-medium">ביטול</button>
      </div>
    </div>
  );
}

// לאיזה יום לשבץ את המתכון (השבועיים הקרובים)
function DayPicker({ onClose, onPick }) {
  const [meal, setMeal] = useState('ארוחת ערב');
  const days = Array.from({ length: 14 }, (_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const label = i === 0 ? 'היום' : i === 1 ? 'מחר' : `יום ${DAY_NAMES[d.getDay()]}`;
    return { key: dateKey(d), label, date: shortDate(d) };
  });
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">מתי מבשלים?</h2>
          <button onClick={onClose} className="p-1 text-stone-400" aria-label="סגירה"><X size={20} /></button>
        </div>
        <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
          {MEALS.map((m) => (
            <button key={m} onClick={() => setMeal(m)} className={`shrink-0 rounded-full px-3 py-1 text-sm border ${meal === m ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-200'}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {days.map((d) => (
            <button key={d.key} onClick={() => onPick(d.key, d.label, meal)} className="rounded-xl border border-stone-200 py-2.5 hover:bg-orange-50">
              <span className="font-medium">{d.label}</span> <span className="text-xs text-stone-400">{d.date}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// דירוג בכוכבים (לחיצה על אותו כוכב מבטלת)
function Rating({ value, onChange }) {
  return (
    <div className="mt-3 flex items-center gap-0.5" aria-label="דירוג">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(value === n ? 0 : n)} className="p-0.5 print:pointer-events-none" aria-label={`${n} כוכבים`}>
          <Star size={22} className={n <= value ? 'text-amber-400' : 'text-stone-300 print:hidden'} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

// תגיות: הסרה ב-x, הוספה בכפתור +
function Tags({ tags, onChange }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setText('');
    setAdding(false);
  };
  return (
    <>
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-stone-100 text-stone-600 text-sm pr-3 pl-1.5 py-1 flex items-center gap-1">
          #{t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-stone-400 hover:text-red-500 print:hidden" aria-label={`הסרת ${t}`}>
            <X size={13} />
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={submit} className="print:hidden">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={submit}
            maxLength={30}
            placeholder="תגית"
            className="w-28 rounded-full border border-orange-300 px-3 py-1 text-sm outline-none"
          />
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="rounded-full border border-dashed border-stone-300 text-stone-500 text-sm px-2.5 py-1 flex items-center gap-1 print:hidden">
          <Plus size={13} /> תגית
        </button>
      )}
    </>
  );
}

// מה חסר בבית (לפי המלאי במקרר ובמזווה). מה שחסר נכנס לרשימת הקניות, ושם "איפה לקנות הכי זול" לכל הסל
function MissingBox({ lines, pantryNames, onShop }) {
  if (!lines.length || !pantryNames.length) return null;
  const missing = missingLines(lines, pantryNames);
  return (
    <div className="mt-2 rounded-2xl bg-orange-50/70 p-3 text-sm print:hidden">
      <p className="text-stone-700">
        {missing.length ? <><span className="font-bold">חסר לך בבית:</span> {missing.join(' · ')}</> : <span className="font-bold text-emerald-700">יש לך בבית את כל המצרכים! 🎉</span>}
      </p>
      {missing.length > 0 && (
        <button onClick={() => onShop(missing)} className="mt-2 rounded-full bg-white text-orange-800 px-3 py-1.5 font-medium inline-flex items-center gap-1.5">
          <ShoppingCart size={15} /> רק החסרים לרשימת הקניות
        </button>
      )}
    </div>
  );
}

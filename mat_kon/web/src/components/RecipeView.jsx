import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Camera, Check, ChefHat, Clock, ExternalLink, Heart, ImagePlus, Info, Loader2, MessageCircle, Minus, PenLine, Pencil, PlayCircle,
  CalendarPlus, Plus, Printer, RotateCw, Share2, ShoppingCart, Star, Trash2, Users, X,
} from 'lucide-react';
import CookMode from './CookMode';
import PublishPanel from './PublishPanel';
import { isNative, shareText } from '../lib/native';
import { STAPLES, missingLines } from '../lib/fridge';
import { shoppingName } from '../lib/shopping';
import { baseServings, formatAmount, scaleSections } from '../lib/scale';
import { thumbnail } from '../lib/image';
import { DAY_NAMES, MEALS, dateKey, shortDate } from '../lib/plan';
import { categoriesOf, emojiOf, VIDEO_LABEL, isVideo, sectionsToText, shortUrl, textToSections } from '../lib/recipes';
import { usePersistentState } from '../lib/storage';

// רק נגני סרטונים מהאתרים המוכרים
const SAFE_EMBED = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|www\.tiktok\.com\/embed\/|www\.instagram\.com\/(p|reel|tv)\/|player\.vimeo\.com\/video\/)/;

export default function RecipeView({ recipe, pantryNames = [], categories, onBack, onUpdate, onRefresh, onDelete, onAddToShopping, onAddToPlan, onShareLink, onEstimateNutrition, community }) {
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [shopPick, setShopPick] = useState(null); // בחירת מצרכים לרשימת הקניות: { preselect }
  // מספר מנות: מכפיל לכמויות, נשמר לכל מתכון במכשיר
  const [factor, setFactor] = usePersistentState(`matkon_factor_${recipe.id}`, 1);
  const base = baseServings(recipe.servings);
  const ingredients = scaleSections(recipe.ingredients, factor);
  const canRefresh = Boolean(recipe.source.url) || recipe.source.kind === 'whatsapp';
  const [busy, setBusy] = useState('');
  // עדכון קטן (מועדף, דירוג...): השגיאה כבר מוצגת כהודעה
  const quiet = (patch) => Promise.resolve(onUpdate(patch)).catch(() => {});
  const cats = categoriesOf(recipe);
  const setCats = (next) => next.length && quiet({ category: next[0], categories: next });
  const [error, setError] = useState('');
  // סימון מצרכים ושלבים בזמן הבישול - נשמר רק במכשיר הזה
  const [checked, setChecked] = usePersistentState(`matkon_checked_${recipe.id}`, {});
  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  // בסוגריים מסולסלים: בכרום חדש scrollTo מחזיר ערך, ו-React היה מנסה להריץ אותו כ"ניקוי" ביציאה מהמסך (קריסה)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [recipe.id]);

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

  // שיתוף בקישור ל-mat-kon: מי שמקבל רואה תצוגה מקדימה, ואת המתכון המלא – באפליקציה (וכך מצטרף)
  const share = () => run('share', async () => {
    const link = await onShareLink();
    const text = `${recipe.title} 🍲\nשלחתי לך מתכון מהספר שלי ב-mat-kon:\n${link}`;
    try {
      if (!(await shareText({ title: recipe.title, text }))) {
        await navigator.clipboard.writeText(text);
        setError('הקישור הועתק – אפשר להדביק אותו בהודעה');
      }
    } catch {
      // המשתמש ביטל
    }
  });

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
          <button onClick={() => quiet({ favorite: !recipe.favorite })} className="p-2 rounded-full hover:bg-stone-100" aria-label="מועדף" title="מועדף">
            <Heart size={21} className={recipe.favorite ? 'text-rose-500' : ''} fill={recipe.favorite ? 'currentColor' : 'none'} />
          </button>
          <button onClick={share} disabled={busy === 'share'} className="p-2 rounded-full hover:bg-stone-100" aria-label="שליחת המתכון" title="שליחת המתכון">
            {busy === 'share' ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
          </button>
        </div>
      </div>

      <article className="max-w-2xl mx-auto px-4">
        {/* המקור בראש הדף: הקישור המקורי, או ההודעה מווטסאפ */}
        {!fromChat && !recipe.source.url ? (
          <div className="mt-4 rounded-2xl bg-stone-100 p-3 flex items-center gap-3 text-sm text-stone-700">
            <span className="w-10 h-10 rounded-xl bg-stone-500 text-white flex items-center justify-center shrink-0">
              {recipe.source.kind === 'photo' ? <Camera size={20} /> : recipe.source.kind === 'community' ? <Users size={20} /> : <PenLine size={20} />}
            </span>
            {recipe.source.kind === 'photo' ? 'מתכון שנבנה מתמונה'
              : recipe.source.kind === 'community' ? `מתכון מהקהילה${recipe.source.author ? ` – של ${recipe.source.author}` : ''}` : 'מתכון שכתבתם בעצמכם'}
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

        {/* באפליקציה מהחנות נגני טיקטוק/יוטיוב חוסמים את ה-WebView ("overload-protect") – שם מציגים תמונה ופותחים את הסרטון באפליקציה שלו */}
        {isNative() && SAFE_EMBED.test(recipe.source.embed || '') && recipe.source.url ? (
          <a
            href={recipe.source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 relative block rounded-2xl overflow-hidden bg-stone-900 print:hidden aspect-video"
            aria-label="צפייה בסרטון המקורי"
          >
            {recipe.image && <img src={recipe.image} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover opacity-80" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white font-bold drop-shadow">
              <PlayCircle size={56} />
              צפייה בסרטון
            </span>
          </a>
        ) : SAFE_EMBED.test(recipe.source.embed || '') ? (
          <div className={`mt-3 rounded-2xl overflow-hidden bg-black print:hidden ${recipe.source.kind === 'tiktok' ? 'aspect-[9/16] max-w-xs mx-auto' : 'aspect-video'}`}>
            <iframe
              src={recipe.source.embed}
              title={recipe.title}
              className="w-full h-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
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
          {/* המתכון מופיע בכל הקטגוריות שלו; הראשונה היא הראשית */}
          {cats.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 text-sm font-medium pr-3 pl-1 py-1">
              {emojiOf(c)} {c}
              {cats.length > 1 && (
                <button onClick={() => setCats(cats.filter((x) => x !== c))} className="p-0.5 rounded-full hover:bg-orange-200 print:hidden" aria-label={`הסרה מהקטגוריה ${c}`}>
                  <X size={14} />
                </button>
              )}
            </span>
          ))}
          {cats.length < 4 && (
            <select
              value=""
              onChange={(e) => e.target.value && setCats([...cats.filter((x) => x !== 'אחר'), e.target.value])}
              className="rounded-full border border-dashed border-orange-300 bg-transparent text-orange-700 text-sm px-3 py-1 outline-none cursor-pointer print:hidden"
              aria-label="הוספה לקטגוריה"
            >
              <option value="">+ קטגוריה</option>
              {categories.filter((c) => !cats.includes(c)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        <Rating value={recipe.rating || 0} onChange={(rating) => quiet({ rating })} />

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

        {/* במקור אין מתכון כתוב (למשל סרטון בלבד) – המתכון שוחזר מהתמונה */}
        {recipe.basis === 'guessed' && (
          <div className="mt-4 rounded-2xl p-3 text-sm flex gap-2 bg-amber-100 text-amber-900 border border-amber-200">
            <Info size={18} className="shrink-0 mt-0.5" />
            <span><b>מתכון משוער:</b> במקור יש רק תמונה או סרטון, בלי מתכון כתוב. המצרכים והכמויות הם הערכה.</span>
          </div>
        )}

        {recipe.notes && (
          <div className={`mt-4 rounded-2xl p-3 text-sm flex gap-2 ${recipe.confidence === 'low' ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>
            <Info size={18} className="shrink-0 mt-0.5" />
            <span>{recipe.notes}</span>
          </div>
        )}

        {editing ? (
          <Editor recipe={recipe} onCancel={() => setEditing(false)} onSave={async (patch) => { if (Object.keys(patch).length) await onUpdate(patch); setEditing(false); }} />
        ) : (
          <>
            <Section
              title="מצרכים"
              action={(
                <button
                  onClick={() => setShopPick({})}
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
                onShop={(lines) => setShopPick({ preselect: lines })}
              />
              {shopPick && (
                <ShoppingPicker
                  lines={ingredients.flatMap((s) => s.items)}
                  preselect={shopPick.preselect}
                  onClose={() => setShopPick(null)}
                  onAdd={(names) => { setShopPick(null); onAddToShopping(names); }}
                />
              )}
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

            <Nutrition value={recipe.nutrition} busy={busy === 'nutrition'} onEstimate={() => run('nutrition', onEstimateNutrition)} />

            {/* מתכון אישי (לא מקישור ולא של מישהו אחר מהקהילה) אפשר לפרסם לקהילה */}
            {community && !recipe.source.url && recipe.source.kind !== 'community' && <PublishPanel recipe={recipe} community={community} />}

            <div className="print:hidden"><MyNotes value={recipe.myNotes || ''} onSave={(myNotes) => quiet({ myNotes })} /></div>
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

// הערכה תזונתית למנה: נוצרת עם המתכון, או בלחיצה (מתכון ישן / אחרי עריכת המצרכים)
const NUTRIENTS = [
  ['protein', 'חלבון', 'גרם'], ['carbs', 'פחמימות', 'גרם'], ['sugar', 'מתוכן סוכרים', 'גרם'], ['fat', 'שומן', 'גרם'],
  ['saturated_fat', 'מתוכו רווי', 'גרם'], ['fiber', 'סיבים תזונתיים', 'גרם'], ['sodium', 'נתרן', 'מ"ג'],
];
function Nutrition({ value, busy, onEstimate }) {
  const valid = value && typeof value === 'object' && Number(value.calories) > 0;
  const num = (v) => formatAmount(Math.round(Number(v) || 0));
  return (
    <Section title="ערכים תזונתיים">
      {valid ? (
        <>
          <div className="rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3 flex items-baseline justify-between gap-3">
            <span className="text-sm text-stone-600">{value.per || 'למנה'}</span>
            <span><span className="text-2xl font-black text-orange-600">{num(value.calories)}</span> <span className="text-sm text-stone-600">קלוריות</span></span>
          </div>
          <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
            {NUTRIENTS.map(([k, label, unit]) => (
              <div key={k} className="rounded-xl bg-white border border-stone-200 px-3 py-2">
                <div className="text-xs text-stone-500">{label}</div>
                <div className="font-bold text-stone-800">{num(value[k])} <span className="text-xs font-normal text-stone-500">{unit}</span></div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">הערכה בלבד, לפי המצרכים והכמויות שבמתכון.</p>
        </>
      ) : (
        <button onClick={onEstimate} disabled={busy} className="w-full rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 text-orange-700 font-medium py-3 flex items-center justify-center gap-2 disabled:opacity-60 print:hidden">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Info size={18} />}
          חישוב ערכים תזונתיים (קלוריות, חלבון, פחמימות, שומן)
        </button>
      )}
    </Section>
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
  const pending = useRef({ text: value, value, onSave });
  pending.current = { text, value, onSave };
  useEffect(() => {
    setText(value);
  }, [value]);
  // שמירה אחרי הפסקה קצרה בהקלדה, וגם ביציאה מהמסך (חזרה אחורה בלי לצאת מהשדה)
  useEffect(() => {
    if (text === value) return undefined;
    const t = setTimeout(() => onSave(text), 1200);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // שמירה ביציאה מהמסך וגם כשהאפליקציה נסגרת / עוברת לרקע
    const save = () => {
      const p = pending.current;
      if (p.text !== p.value) {
        p.onSave(p.text);
        pending.current = { ...p, value: p.text };
      }
    };
    const onHide = () => document.visibilityState === 'hidden' && save();
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onHide);
      save();
    };
  }, []);
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
            onChange={async (e) => {
              const file = e.target.files[0];
              e.target.value = '';
              if (file) setImage(await thumbnail(file).catch(() => image));
            }}
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
              // נשלח רק מה שבאמת השתנה (כך רענון מהמקור עדיין יכול לעדכן את השאר)
              const next = {
                title: title.trim() || recipe.title,
                ingredients: textToSections(ingredients),
                steps: textToSections(steps),
                tips: tips.split('\n').map((t) => t.trim()).filter(Boolean),
                image,
              };
              const before = { ...recipe, tips: recipe.tips || [], image: recipe.image || null };
              const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k])));
              await onSave(patch);
            } catch {
              // ההודעה כבר הוצגה; העורך נשאר פתוח עם הטקסט
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

// בחירה אילו מצרכים להוסיף לרשימת הקניות – רק שם המוצר, בלי הכמות שבמתכון.
// ברירת מחדל: הכול חוץ ממצרכי בסיס שבדרך כלל יש בבית (מלח, שמן...), או רק "החסרים" כשנפתח משם
function ShoppingPicker({ lines, preselect, onAdd, onClose }) {
  const items = [];
  for (const line of lines) {
    const name = shoppingName(line);
    if (!items.some((i) => i.name === name)) items.push({ name, line });
  }
  const [picked, setPicked] = useState(() => {
    const pre = preselect ? new Set(preselect.map(shoppingName)) : null;
    return new Set(items.filter((i) => (pre ? pre.has(i.name) : !STAPLES.includes(i.name))).map((i) => i.name));
  });
  const flip = (name) => setPicked((p) => {
    const next = new Set(p);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });
  const chosen = items.filter((i) => picked.has(i.name)).map((i) => i.name);
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center print:hidden" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 pt-5 pb-2">
          <h2 className="flex-1 text-lg font-black">מה להוסיף לרשימת הקניות?</h2>
          <button onClick={onClose} className="p-2 -m-2 text-stone-400" aria-label="סגירה"><X size={20} /></button>
        </div>
        <div className="flex gap-3 px-5 pb-2 text-sm">
          <button onClick={() => setPicked(new Set(items.map((i) => i.name)))} className="text-orange-700 underline">הכול</button>
          <button onClick={() => setPicked(new Set())} className="text-stone-500 underline">כלום</button>
        </div>
        <ul className="overflow-y-auto px-5 flex-1">
          {items.map(({ name, line }) => (
            <li key={name}>
              <button onClick={() => flip(name)} className="w-full text-right flex items-start gap-3 py-2 border-b border-stone-100">
                <span className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${picked.has(name) ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-300'}`}>
                  {picked.has(name) && <Check size={14} strokeWidth={3} />}
                </span>
                <span>
                  <span className="font-medium text-stone-800">{name}</span>
                  {name !== line && <span className="block text-xs text-stone-400">{line}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="p-4">
          <button
            disabled={!chosen.length}
            onClick={() => onAdd(chosen)}
            className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} /> הוספה לרשימה ({chosen.length})
          </button>
        </div>
      </div>
    </div>
  );
}

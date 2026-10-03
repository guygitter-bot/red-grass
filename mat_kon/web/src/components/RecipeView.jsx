import { useEffect, useState } from 'react';
import {
  ArrowRight, Check, Clock, ExternalLink, Heart, Info, Loader2, MessageCircle, Pencil, PlayCircle, RotateCw, Share2, Trash2, Users,
} from 'lucide-react';
import { CATEGORIES } from '../lib/categories';
import { CATEGORY_EMOJI, VIDEO_LABEL, isVideo, recipeAsText, sectionsToText, shortUrl, textToSections } from '../lib/recipes';
import { usePersistentState } from '../lib/storage';

export default function RecipeView({ recipe, onBack, onUpdate, onRefresh, onDelete }) {
  const [editing, setEditing] = useState(false);
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
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="flex-1 truncate font-bold">{recipe.title}</div>
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
        {fromChat ? (
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
          <div className={`mt-3 rounded-2xl overflow-hidden bg-black ${recipe.source.kind === 'tiktok' ? 'aspect-[9/16] max-w-xs mx-auto' : 'aspect-video'}`}>
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

        <h1 className="mt-5 text-3xl font-black leading-tight text-stone-900">{recipe.title}</h1>
        {recipe.originalTitle && recipe.originalTitle !== recipe.title && (
          <p className="text-sm text-stone-400 mt-1" dir="auto">{recipe.originalTitle}</p>
        )}
        {recipe.description && <p className="mt-2 text-stone-600 leading-relaxed">{recipe.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 text-sm pr-3 pl-1 py-0.5">
            {CATEGORY_EMOJI[recipe.category]}
            <select
              value={recipe.category}
              onChange={(e) => onUpdate({ category: e.target.value })}
              className="bg-transparent font-medium outline-none py-1 cursor-pointer"
              aria-label="קטגוריה"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          {(recipe.tags || []).map((t) => (
            <span key={t} className="rounded-full bg-stone-100 text-stone-600 text-sm px-3 py-1">{t}</span>
          ))}
        </div>

        {(recipe.servings || times.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-700">
            {recipe.servings && (
              <span className="flex items-center gap-1.5"><Users size={16} className="text-orange-500" /> {recipe.servings}</span>
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
            <Section title="מצרכים">
              {recipe.ingredients.map((s, si) => (
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
            </Section>

            <Section title="אופן ההכנה">
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

            <MyNotes value={recipe.myNotes || ''} onSave={(myNotes) => onUpdate({ myNotes })} />

            {Object.values(checked).some(Boolean) && (
              <button onClick={() => setChecked({})} className="mt-4 text-sm text-stone-500 underline">ניקוי הסימונים</button>
            )}
          </>
        )}

        {error && <p className="mt-6 text-center text-sm text-stone-600">{error}</p>}

        {!editing && (
          <div className="mt-8 pt-5 border-t border-stone-200 flex flex-wrap gap-2 justify-center text-sm">
            <ActionButton onClick={() => setEditing(true)} icon={<Pencil size={16} />}>עריכה</ActionButton>
            <ActionButton onClick={() => run('refresh', onRefresh)} icon={busy === 'refresh' ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />} disabled={Boolean(busy)}>
              {busy === 'refresh' ? 'מסדר שוב מהמקור…' : 'רענון מהמקור'}
            </ActionButton>
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

function Section({ title, children }) {
  return (
    <section className="mt-7">
      <h2 className="text-xl font-black text-stone-900 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-6 rounded-full bg-orange-500" />
        {title}
      </h2>
      {children}
    </section>
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

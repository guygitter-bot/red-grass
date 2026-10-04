import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, ImagePlus, Loader2, PenLine, X } from 'lucide-react';
import { addManualRecipe, addPhotoRecipe } from '../lib/api';
import { dataUrlToPart, photoForReading, thumbnail } from '../lib/image';
import { textToSections } from '../lib/recipes';

// מתכון חדש בלי קישור: מצלמים דף מספר / פתק / צילום מסך, או כותבים בעצמכם
export default function NewRecipeView({ session, categories, initialMode = 'photo', initialFiles, onFilesTaken, onBack, onSaved, onPaywall }) {
  const [mode, setMode] = useState(initialMode);
  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">מתכון חדש</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <div className="mt-4 grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
          {[['photo', 'מתמונה', Camera], ['manual', 'כתיבה ידנית', PenLine]].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`rounded-xl py-2.5 font-medium flex items-center justify-center gap-1.5 ${mode === key ? 'bg-white shadow-sm text-orange-700' : 'text-stone-600'}`}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
        {mode === 'photo' ? <PhotoForm session={session} initialFiles={initialFiles} onFilesTaken={onFilesTaken} onSaved={onSaved} onPaywall={onPaywall} /> : <ManualForm session={session} categories={categories} onSaved={onSaved} />}
      </div>
    </div>
  );
}

function PhotoForm({ session, initialFiles, onFilesTaken, onSaved, onPaywall }) {
  const [photos, setPhotos] = useState([]); // {url, file}
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (files) => {
    setError('');
    const added = [];
    for (const file of [...files].slice(0, 4 - photos.length)) {
      try {
        added.push({ url: await photoForReading(file), file });
      } catch (e) {
        setError(e.message);
      }
    }
    setPhotos((p) => [...p, ...added].slice(0, 4));
  };

  // תמונות שצולמו מהמסך הראשי ("צילום מתכון")
  const took = useRef(false);
  useEffect(() => {
    if (initialFiles?.length && !took.current) {
      took.current = true;
      pick(initialFiles);
      onFilesTaken?.();
    }
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const thumb = await thumbnail(photos[0].file).catch(() => null);
      const { recipe, user } = await addPhotoRecipe(session, { images: photos.map((p) => dataUrlToPart(p.url)), hint, thumb });
      onSaved(recipe, user);
    } catch (e) {
      if (e.status === 402) onPaywall(e.data.paymentUrl || '');
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-stone-600 leading-relaxed">
        צלמו דף מספר בישול, פתק בכתב יד, צילום מסך או מתכון מודפס. אפשר עד 4 תמונות של אותו מתכון (למשל שני עמודים).
      </p>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))} className="absolute top-1 left-1 bg-black/60 text-white rounded-full p-0.5" aria-label="הסרה">
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < 4 && (
          <>
            <label className="aspect-square rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-700 flex flex-col items-center justify-center gap-1 text-xs cursor-pointer">
              <Camera size={22} /> צילום
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick([...e.target.files]); e.target.value = ''; }} />
            </label>
            <label className="aspect-square rounded-xl border-2 border-dashed border-stone-300 text-stone-600 flex flex-col items-center justify-center gap-1 text-xs cursor-pointer">
              <ImagePlus size={22} /> מהגלריה
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { pick([...e.target.files]); e.target.value = ''; }} />
            </label>
          </>
        )}
      </div>
      <input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="הערה (לא חובה), למשל: העוגה של סבתא רחל"
        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={!photos.length || busy}
        onClick={submit}
        className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {busy && <Loader2 size={18} className="animate-spin" />}
        {busy ? 'קורא את המתכון מהתמונה…' : 'בניית מתכון מהתמונות'}
      </button>
    </div>
  );
}

function ManualForm({ session, categories, onSaved }) {
  const [form, setForm] = useState({ title: '', category: 'אחר', servings: '', ingredients: '', steps: '', tips: '' });
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const field = 'w-full rounded-2xl border border-stone-200 bg-white p-3 outline-none focus:border-orange-400 leading-relaxed';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { recipe } = await addManualRecipe(session, {
        title: form.title,
        category: form.category,
        servings: form.servings,
        ingredients: textToSections(form.ingredients),
        steps: textToSections(form.steps),
        tips: form.tips.split('\n').map((t) => t.trim()).filter(Boolean),
        image,
      });
      onSaved(recipe);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <label className="block">
        <span className="font-bold">שם המתכון</span>
        <input value={form.title} onChange={set('title')} required className={`${field} mt-1`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-bold">קטגוריה</span>
          <select value={form.category} onChange={set('category')} className={`${field} mt-1`}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-bold">כמות</span>
          <input value={form.servings} onChange={set('servings')} placeholder="למשל: 6 מנות" className={`${field} mt-1`} />
        </label>
      </div>
      <p className="text-sm text-stone-500">שורה לכל פריט. שורה שמתחילה ב-## פותחת קטע (למשל "## לציפוי").</p>
      <label className="block">
        <span className="font-bold">מצרכים</span>
        <textarea value={form.ingredients} onChange={set('ingredients')} rows={8} placeholder={'2 כוסות קמח\n1 כוס סוכר\n3 ביצים'} className={`${field} mt-1`} />
      </label>
      <label className="block">
        <span className="font-bold">אופן ההכנה</span>
        <textarea value={form.steps} onChange={set('steps')} rows={8} placeholder={'מחממים תנור ל-180 מעלות\nמערבבים את כל המצרכים\nאופים 30 דקות'} className={`${field} mt-1`} />
      </label>
      <label className="block">
        <span className="font-bold">טיפים</span>
        <textarea value={form.tips} onChange={set('tips')} rows={2} className={`${field} mt-1`} />
      </label>
      <div className="flex items-center gap-3">
        {image && <img src={image} alt="" className="w-16 h-16 rounded-xl object-cover" />}
        <label className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium flex items-center gap-1.5 cursor-pointer">
          <ImagePlus size={16} /> {image ? 'החלפת תמונה' : 'הוספת תמונה'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files[0];
              e.target.value = '';
              if (file) setImage(await thumbnail(file).catch(() => null));
            }}
          />
        </label>
        {image && <button type="button" onClick={() => setImage(null)} className="text-sm text-stone-500">הסרה</button>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3 disabled:opacity-40 flex items-center justify-center gap-2">
        {busy && <Loader2 size={18} className="animate-spin" />} שמירת המתכון
      </button>
    </form>
  );
}

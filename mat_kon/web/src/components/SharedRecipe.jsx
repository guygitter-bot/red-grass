import { useEffect, useState } from 'react';
import { BookmarkPlus, ChefHat, Clock, Loader2, Lock, Smartphone, Users, X } from 'lucide-react';
import { getSharedRecipe, getSharePreview, saveSharedRecipe } from '../lib/api';
import { isNative } from '../lib/native';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.matkon';

// מתכון שמישהו שלח בקישור (#recipe=...). מי שמחובר רואה את המתכון המלא ושומר אותו בספר שלו.
// מי שלא מחובר רואה רק תצוגה מקדימה: באפליקציה – כניסה/הרשמה, באתר – פתיחה באפליקציה (או הורדה מ-Google Play)
export default function SharedRecipe({ token, session, onLogin, onSaved, onClose, onPaywall }) {
  const [preview, setPreview] = useState(null);
  const [full, setFull] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getSharedRecipe(session, token)
      .then((d) => {
        if (alive) setFull(d);
      })
      .catch((e) => {
        if (!alive) return;
        // לא מחוברים: רק התצוגה המקדימה
        if (e.status !== 401) return setError(e.message);
        getSharePreview(token).then((p) => alive && setPreview(p)).catch((e2) => alive && setError(e2.message));
      });
    return () => {
      alive = false;
    };
  }, [token, session]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      onSaved(await saveSharedRecipe(session, token));
    } catch (e) {
      if (e.status === 402) onPaywall(e.data.paymentUrl);
      setError(e.message);
      setBusy(false);
    }
  };

  const info = full
    ? { ...full.recipe, by: full.by, time: full.recipe.totalTime || full.recipe.cookTime || full.recipe.prepTime }
    : preview;
  const android = /Android/i.test(navigator.userAgent);
  // פתיחה באפליקציה לאנדרואיד; אם היא לא מותקנת, Chrome פותח את הדף שלה ב-Google Play
  const intentUrl = `intent://recipe/${token}#Intent;scheme=matkon;package=app.matkon;end`;

  return (
    <div className="min-h-screen bg-[#fffbf5] pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100" aria-label="סגירה">
            <X size={22} />
          </button>
          <div className="flex-1 truncate font-bold">מתכון שנשלח אליך</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {!info && !error && (
          <div className="py-20 flex justify-center text-stone-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}
        {error && !info && <p className="mt-6 rounded-2xl bg-rose-50 text-rose-700 p-4 text-center">{error}</p>}

        {info && (
          <>
            {info.image && <img src={info.image} alt="" className="w-full aspect-video object-cover rounded-3xl bg-stone-100" />}
            <h1 className="mt-4 text-2xl font-black leading-tight">{info.title}</h1>
            {info.by && <p className="mt-1 text-sm text-orange-700 font-medium">נשלח אליך מ־{info.by}</p>}
            {info.description && <p className="mt-2 text-stone-600 leading-relaxed">{info.description}</p>}
            {full?.recipe.basis === 'guessed' && <p className="mt-2 rounded-xl bg-amber-100 text-amber-900 text-sm p-2">מתכון משוער: במקור יש רק תמונה או סרטון, בלי מתכון כתוב.</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-stone-600">
              {info.servings && <span className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-200 px-3 py-1"><Users size={15} />{info.servings}</span>}
              {info.time && <span className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-200 px-3 py-1"><Clock size={15} />{info.time}</span>}
            </div>
          </>
        )}

        {full && (
          <>
            <Sections title="מצרכים" sections={full.recipe.ingredients} />
            <Sections title="אופן ההכנה" sections={full.recipe.steps} numbered />
            {error && <p className="mt-4 rounded-2xl bg-rose-50 text-rose-700 p-3 text-sm text-center">{error}</p>}
            <div className="sticky bottom-0 mt-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#fffbf5] via-[#fffbf5] to-transparent">
              <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3.5 flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="animate-spin" size={20} /> : <BookmarkPlus size={20} />}
                שמירה בספר שלי
              </button>
            </div>
          </>
        )}

        {preview && (
          <div className="mt-5 rounded-3xl bg-white border border-stone-200 p-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
              <Lock size={24} />
            </div>
            <p className="font-bold">
              {preview.ingredients} מצרכים ו-{preview.steps} שלבים מחכים לך באפליקציה
            </p>
            <p className="mt-1 text-sm text-stone-600 leading-relaxed">
              mat-kon הוא ספר מתכונים בעברית: שומרים מתכון מכל קישור, סרטון או צילום. ההרשמה בחינם.
            </p>
            {isNative() ? (
              <button onClick={onLogin} className="mt-4 w-full rounded-2xl bg-orange-500 text-white font-bold py-3.5 flex items-center justify-center gap-2">
                <ChefHat size={20} />
                כניסה או הרשמה כדי לראות את המתכון
              </button>
            ) : (
              <>
                {android ? (
                  <a href={intentUrl} className="mt-4 w-full rounded-2xl bg-orange-500 text-white font-bold py-3.5 flex items-center justify-center gap-2">
                    <Smartphone size={20} />
                    פתיחה באפליקציה
                  </a>
                ) : (
                  <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className="mt-4 w-full rounded-2xl bg-orange-500 text-white font-bold py-3.5 flex items-center justify-center gap-2">
                    <Smartphone size={20} />
                    להורדת האפליקציה (אנדרואיד)
                  </a>
                )}
                {android && (
                  <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                    אין לך עדיין את האפליקציה? הכפתור יפתח את Google Play. אחרי ההתקנה חוזרים לכאן ולוחצים שוב.
                  </p>
                )}
                <button onClick={onLogin} className="mt-3 text-sm text-stone-600 underline">כבר יש לי חשבון – כניסה באתר</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Sections({ title, sections, numbered }) {
  let n = 0;
  if (!sections.length) return null;
  return (
    <section className="mt-6">
      <h2 className="text-lg font-black mb-2">{title}</h2>
      {sections.map((s, i) => (
        <div key={i} className="mb-3">
          {s.title && <h3 className="font-bold text-stone-700 mb-1">{s.title}</h3>}
          <ul className="space-y-1.5">
            {s.items.map((item, j) => (
              <li key={j} className="flex gap-2 leading-relaxed">
                <span className="text-orange-500 font-bold shrink-0">{numbered ? `${(n += 1)}.` : '•'}</span>
                <span>{numbered ? item.replace(/^\s*\d+[.)]\s*/, '') : item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

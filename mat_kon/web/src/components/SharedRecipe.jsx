import { useEffect, useState } from 'react';
import { BookmarkPlus, ChefHat, Clock, ExternalLink, Flag, Loader2, Lock, Smartphone, Star, Users, X } from 'lucide-react';
import { getCommunityRecipe, getSharedRecipe, getSharePreview, reportCommunity, saveCommunityRecipe, saveSharedRecipe } from '../lib/api';
import { isNative } from '../lib/native';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.matkon';

// מתכון שמישהו שלח בקישור (#recipe=...). מי שמחובר רואה את המתכון המלא ושומר אותו בספר שלו.
// מי שלא מחובר רואה רק תצוגה מקדימה: באפליקציה – כניסה/הרשמה, באתר – פתיחה באפליקציה (או הורדה מ-Google Play)
// communityKey: אותו מסך למתכון ממאגר הקהילה (עם דירוג, מספר שמירות וקרדיט למקור)
export default function SharedRecipe({ token, communityKey, session, onLogin, onSaved, onClose, onPaywall }) {
  const [preview, setPreview] = useState(null);
  const [full, setFull] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (communityKey ? getCommunityRecipe(session, communityKey) : getSharedRecipe(session, token))
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
      onSaved(await (communityKey ? saveCommunityRecipe(session, communityKey) : saveSharedRecipe(session, token)));
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
          <div className="flex-1 truncate font-bold">{communityKey ? 'מתכון מהקהילה' : 'מתכון שנשלח אליך'}</div>
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
            {full?.summary && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
                <CommunityStats s={full.summary} />
                {full.summary.personal && <span className="text-orange-700 font-medium">{full.summary.credit}</span>}
                {full.recipe.source?.url && (
                  <a href={full.recipe.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-700">
                    <ExternalLink size={13} /> {full.summary.credit || 'המקור'}
                  </a>
                )}
              </div>
            )}
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
            {communityKey && <Report session={session} communityKey={communityKey} />}
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

// דיווח על מתכון בקהילה (פעם אחת לכל ספר). אחרי כמה דיווחים מתכון שמשתמש פרסם מוסתר עד בדיקה
const REASONS = [['not-recipe', 'זה לא מתכון'], ['offensive', 'תוכן פוגעני'], ['personal', 'יש בו פרטים אישיים'], ['copied', 'הועתק בלי רשות'], ['other', 'משהו אחר']];
function Report({ session, communityKey }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const send = async (reason) => {
    await reportCommunity(session, communityKey, reason).catch(() => {});
    setDone(true);
    setOpen(false);
  };
  if (done) return <p className="mt-6 text-center text-sm text-stone-500">תודה על הדיווח – נבדוק את המתכון.</p>;
  return (
    <div className="mt-6 text-center">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-sm text-stone-500 inline-flex items-center gap-1"><Flag size={14} /> דיווח על המתכון</button>
      ) : (
        <div className="rounded-2xl bg-white border border-stone-200 p-3 text-right">
          <div className="font-bold text-sm mb-2">מה הבעיה במתכון?</div>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(([id, label]) => (
              <button key={id} onClick={() => send(id)} className="rounded-full border border-stone-200 px-3 py-1 text-sm hover:bg-stone-50">{label}</button>
            ))}
            <button onClick={() => setOpen(false)} className="px-2 text-sm text-stone-400">ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}

// דירוג (רק מ-3 דירוגים) ומספר הספרים שהמתכון נשמר בהם – בלי שמות
export function CommunityStats({ s }) {
  return (
    <>
      {s.rating ? (
        <span className="inline-flex items-center gap-1"><Star size={14} className="text-amber-500" fill="currentColor" /><b>{s.rating}</b> ({s.ratingCount} דירוגים)</span>
      ) : (
        <span className="text-stone-400">עוד אין מספיק דירוגים</span>
      )}
      <span>נשמר ב-{s.saves} {s.saves === 1 ? 'ספר' : 'ספרים'}</span>
    </>
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

import { useState } from 'react';
import { CheckCircle2, Loader2, Users, X } from 'lucide-react';

// פרסום מתכון אישי לקהילה: בפעם הראשונה בוחרים שם תצוגה (בלי אימייל) ומאשרים את תנאי השימוש.
// לפני הפרסום המתכון נבדק אוטומטית; אפשר לבטל את הפרסום בכל רגע
export default function PublishPanel({ recipe, community }) {
  const [step, setStep] = useState(null); // null | 'profile' | 'busy'
  const [name, setName] = useState('');
  const [terms, setTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const publish = async () => {
    setStep('busy');
    setError('');
    setMessage('');
    try {
      const res = await community.publish(recipe.id);
      setStep(null);
      if (res.review?.decision === 'review') setMessage('פורסם. המתכון יעבור גם בדיקה של צוות האפליקציה.');
      else setMessage(res.review?.imageRemoved ? 'פורסם בקהילה! 🎉 התמונה לא פורסמה, כי היא לא נראית כמו תמונה של אוכל.' : 'פורסם בקהילה! 🎉');
    } catch (e) {
      if (e.data?.needProfile) {
        const p = await community.getProfile().catch(() => ({}));
        setName(p.displayName || '');
        setTerms(Boolean(p.terms));
        setStep('profile');
        return;
      }
      setStep(null);
      setError(e.message);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await community.setProfile(name.trim(), terms);
      await publish();
    } catch (err) {
      setError(err.message);
    }
  };

  const unpublish = async () => {
    setStep('busy');
    setError('');
    try {
      await community.unpublish(recipe.id);
      setMessage('הפרסום בוטל. המתכון נשאר בספר שלך.');
    } catch (e) {
      setError(e.message);
    } finally {
      setStep(null);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50/60 p-3 print:hidden">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-orange-600 shrink-0" />
        <div className="flex-1 text-sm">
          {recipe.published ? <b className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={15} /> פורסם בקהילה</b> : 'רוצים לשתף את המתכון עם כולם?'}
        </div>
        {recipe.published ? (
          <button onClick={unpublish} disabled={step === 'busy'} className="text-sm text-stone-600 underline disabled:opacity-50">ביטול פרסום</button>
        ) : (
          <button onClick={publish} disabled={step === 'busy'} className="rounded-xl bg-orange-500 text-white text-sm font-bold px-3 py-1.5 flex items-center gap-1 disabled:opacity-60">
            {step === 'busy' && <Loader2 size={15} className="animate-spin" />} פרסום לקהילה
          </button>
        )}
      </div>
      {step === 'busy' && !recipe.published && <p className="mt-2 text-xs text-stone-500">בודקים את המתכון לפני הפרסום…</p>}
      {message && <p className="mt-2 text-sm text-stone-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {step === 'profile' && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setStep(null)}>
          <form onSubmit={saveProfile} onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-5 w-full max-w-sm relative">
            <button type="button" onClick={() => setStep(null)} className="absolute top-3 left-3 p-1 text-stone-400" aria-label="סגירה"><X size={20} /></button>
            <h2 className="text-lg font-black">פרסום בקהילה</h2>
            <p className="text-sm text-stone-600 mt-1">איך יקראו לך בקהילה? זה השם שיופיע ליד המתכונים שתפרסמו. האימייל שלך לא מוצג.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="למשל: דנה מבשלת" className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2.5 outline-none focus:border-orange-400" />
            <label className="mt-3 flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1" />
              <span>
                אני מפרסם/ת רק מתכונים שמותר לי לשתף, בלי פרטים אישיים ובלי תוכן פוגעני. מתכון שמדווח עליו יכול לרדת מהקהילה.
                {' '}<a href="#/privacy" className="text-orange-700 underline">תנאי השימוש והפרטיות</a>
              </span>
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button disabled={name.trim().length < 2 || !terms} className="mt-4 w-full rounded-xl bg-orange-500 text-white font-bold py-3 disabled:opacity-40">שמירה ופרסום</button>
          </form>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Link2, Loader2, Share2, Trash2, Users, X } from 'lucide-react';
import { cancelMemberLink, createMemberLink, getMembers, joinLink, removeMember } from '../lib/api';

// שיתוף הספר: בעל הספר שולח קישור הצטרפות לבן/בת זוג או לבני משפחה. כל אחד נכנס עם החשבון שלו,
// וכולם עובדים על אותו ספר (מתכונים, רשימת קניות, תכנון, מלאי), עם אותו מנוי.
export default function ShareView({ session, user, onBack }) {
  const [data, setData] = useState(null);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => getMembers(session).then(setData).catch((e) => setError(e.message)), [session]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const create = () => run('create', async () => {
    const join = await createMemberLink(session);
    setLink(joinLink(join.token));
    setCopied(false);
  });

  const share = async () => {
    const text = `הצטרפו לספר המתכונים שלי ב-mat-kon: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'mat-kon', text });
        return;
      } catch {
        // המשתמש סגר את חלון השיתוף – נעתיק במקום
      }
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  };

  const people = data ? (data.holder ? 1 : 0) + data.members.length : 0;
  const full = data && data.holder && people >= data.max;

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">שיתוף הספר</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 mt-4 space-y-4">
        <p className="text-sm text-stone-600 leading-relaxed">
          שולחים קישור הצטרפות לבן/בת הזוג או לבני משפחה. כל אחד נכנס עם החשבון שלו (גוגל או אימייל), וכולם עובדים על אותו
          ספר: מתכונים, רשימת קניות, תכנון שבועי והמקרר.
          {user ? ' המנוי והמתכונים החינמיים משותפים לכל הספר.' : ''}
        </p>

        {!link ? (
          <button
            onClick={create}
            disabled={busy === 'create' || full}
            className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {busy === 'create' ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />} יצירת קישור הצטרפות
          </button>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm p-4">
            <div className="font-bold mb-1">הקישור מוכן</div>
            <p className="text-xs text-stone-500 mb-2">טוב להצטרפות אחת, ותקף 7 ימים.</p>
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-3 py-2 text-sm break-all" dir="ltr">{link}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={share} className="flex-1 rounded-xl bg-orange-500 text-white font-bold py-2.5 flex items-center justify-center gap-1.5">
                <Share2 size={16} /> שליחה
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}
                className="rounded-xl bg-stone-100 px-4 font-medium flex items-center gap-1.5"
              >
                {copied ? <><Check size={16} /> הועתק</> : <><Copy size={16} /> העתקה</>}
              </button>
            </div>
          </div>
        )}
        {full && <p className="text-sm text-amber-700">בספר כבר {data.max} אנשים. כדי לצרף עוד צריך להסיר מישהו.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <section>
          <h2 className="font-bold mb-2 flex items-center gap-2"><Users size={18} className="text-orange-500" /> מי בספר</h2>
          {!data ? (
            !error && <Loader2 className="animate-spin text-orange-500" />
          ) : (
            <ul className="space-y-2">
              <li className="rounded-2xl bg-white shadow-sm p-3 flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{data.holder ? data.holder.name : 'את/ה'}</span>
                  {data.holder && <span className="block text-xs text-stone-500 truncate" dir="ltr">{data.holder.email}</span>}
                </span>
                <span className="text-xs rounded-full bg-orange-100 text-orange-800 px-2 py-0.5">בעל/ת הספר</span>
              </li>
              {data.members.map((m) => (
                <li key={m.id} className="rounded-2xl bg-white shadow-sm p-3 flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">{m.name}</span>
                    <span className="block text-xs text-stone-500 truncate" dir="ltr">{m.email}</span>
                  </span>
                  <button
                    onClick={() => window.confirm(`להסיר את ${m.name} מהספר? המתכונים נשארים בספר.`) && run(`rm-${m.id}`, () => removeMember(session, m.id))}
                    disabled={busy === `rm-${m.id}`}
                    className="p-2 text-stone-400 hover:text-red-600"
                    aria-label={`הסרת ${m.name}`}
                  >
                    {busy === `rm-${m.id}` ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data?.pending.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-stone-600 mb-1.5">קישורים שעוד לא נוצלו</h3>
              <ul className="space-y-1.5">
                {data.pending.map((p) => (
                  <li key={p.token} className="rounded-xl bg-stone-50 px-3 py-2 text-sm flex items-center gap-2">
                    <span className="flex-1 text-stone-600">תקף עד {new Date(p.expiresAt).toLocaleDateString('he-IL')}</span>
                    <button onClick={() => run(`c-${p.token}`, () => cancelMemberLink(session, p.token))} className="p-1 text-stone-400 hover:text-red-600" aria-label="ביטול הקישור">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

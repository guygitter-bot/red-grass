import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Loader2, Share2, Trash2, UserPlus } from 'lucide-react';
import { createInvite, deleteInvite, inviteLink, listInvites, loginLink, setPlan } from '../lib/api';

// בעל האפליקציה: יצירת קישורי הזמנה ומעקב אחרי המשתמשים
export default function InvitesView({ onBack }) {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(() => listInvites().then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const invite = await createInvite(name.trim());
      setName('');
      await load();
      share(invite);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const share = async (invite) => {
    const link = inviteLink(invite.token);
    const text = `${invite.name ? `${invite.name}, ` : ''}הזמנתי אותך ל-mat-kon, ספר מתכונים שמסדר לבד מתכון מכל קישור או סרטון:\n${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'mat-kon', text });
        return;
      }
    } catch {
      return; // ביטול השיתוף
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(invite.token);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('העתיקו את הקישור:', link);
    }
  };

  const remove = async (invite) => {
    const msg = invite.user
      ? `למחוק את ${invite.user.name}? כל המתכונים שלו/ה יימחקו.`
      : 'לבטל את קישור ההזמנה?';
    if (!window.confirm(msg)) return;
    try {
      await deleteInvite(invite.token);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const togglePlan = async (user) => {
    try {
      await setPlan(user.id, user.plan === 'paid' ? 'free' : 'paid');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">הזמנות</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <p className="mt-4 text-stone-600 leading-relaxed text-sm">
          מי שמקבל קישור הזמנה נרשם (שם, אימייל וסיסמה) ומקבל ספר מתכונים ריק משלו, שרק הוא רואה.
          {data ? ` ${data.freeLimit} המתכונים הראשונים בחינם, ואחר כך צריך מנוי.` : ''}
          {' '}כל קישור טוב להרשמה אחת.
        </p>

        <form onSubmit={create} className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למי ההזמנה? (לא חובה)"
            className="flex-1 min-w-0 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
          />
          <button disabled={busy} className="rounded-2xl bg-orange-500 text-white px-4 font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} קישור חדש
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {!data && !error && <Loader2 className="animate-spin mx-auto mt-10 text-orange-500" />}
        {data && data.invites.length === 0 && <p className="mt-10 text-center text-stone-500">עוד לא נוצרו הזמנות</p>}

        <ul className="mt-5 space-y-3">
          {data?.invites.map((inv) => (
            <li key={inv.token} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold truncate">{inv.user?.name || inv.name || 'הזמנה ללא שם'}</div>
                  {inv.user ? (
                    <div className="text-sm text-stone-500 truncate" dir="ltr">{inv.user.email}</div>
                  ) : (
                    <div className="text-sm text-amber-700">ממתין להרשמה</div>
                  )}
                </div>
                <button onClick={() => remove(inv)} className="p-2 text-stone-400 hover:text-red-600" aria-label="מחיקה" title="מחיקה">
                  <Trash2 size={18} />
                </button>
              </div>

              {inv.user ? (
                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <span className="text-stone-600">
                    {inv.user.added} מתכונים
                    {inv.user.plan === 'paid' ? '' : ` מתוך ${inv.user.freeLimit} חינמיים`}
                  </span>
                  <button
                    onClick={() => togglePlan(inv.user)}
                    className={`rounded-full px-3 py-1.5 font-medium flex items-center gap-1 ${inv.user.plan === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}
                    title="שינוי מנוי"
                  >
                    {inv.user.plan === 'paid' ? <><Check size={14} /> מנוי בתשלום</> : 'חינמי · סמן כמשלם'}
                  </button>
                </div>
              ) : (
                <button onClick={() => share(inv)} className="mt-3 w-full rounded-xl bg-orange-50 text-orange-800 py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                  {copied === inv.token ? <><Check size={16} /> הקישור הועתק</> : <><Share2 size={16} /> שליחת הקישור</>}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl bg-stone-100 p-4 text-sm text-stone-600">
          משתמש שנרשם ורוצה להיכנס ממכשיר נוסף:
          <button
            onClick={() => navigator.clipboard?.writeText(loginLink()).then(() => setCopied('login'))}
            className="mr-1 font-medium text-orange-700 inline-flex items-center gap-1"
          >
            {copied === 'login' ? <Check size={14} /> : <Copy size={14} />} העתקת קישור הכניסה
          </button>
        </div>
      </div>
    </div>
  );
}

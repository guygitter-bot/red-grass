import { useEffect, useState } from 'react';
import { Camera, Flag, Heart, Loader2, MessageCircle, Reply, Star, Trash2, X } from 'lucide-react';
import { talkPhoto } from '../lib/image';

// שיחה על מתכון בקהילה: טיפים ושאלות, תשובות, ו"הכנתי!" (תמונה + כוכבים). כל מה שנכתב עובר בדיקה אוטומטית,
// ובפעם הראשונה בוחרים שם תצוגה (האימייל לא מוצג). api: talkApi(session) מ-lib/api
export default function Talk({ api, communityKey }) {
  const [items, setItems] = useState(null);
  const [mode, setMode] = useState(null); // null | 'tip' | 'made' | {reply: id}
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [profileFor, setProfileFor] = useState(null); // הפריט שמחכה לשם תצוגה

  useEffect(() => {
    let alive = true;
    api.list(communityKey).then((list) => alive && setItems(list)).catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [api, communityKey]);

  const send = async (item) => {
    setError('');
    setNote('');
    try {
      const res = await api.post(communityKey, item);
      setItems((list) => [...(list || []), res.item]);
      setMode(null);
      if (res.imageRemoved) setNote('התמונה לא פורסמה, כי היא לא נראית כמו תמונה של אוכל.');
      return true;
    } catch (e) {
      if (e.data?.needProfile) {
        setProfileFor(item);
        return false;
      }
      setError(e.message);
      return false;
    }
  };

  const like = async (t) => {
    const updated = await api.like(communityKey, t.id).catch(() => null);
    if (updated) setItems((list) => list.map((x) => (x.id === t.id ? updated : x)));
  };
  const remove = async (t) => {
    if (!window.confirm('למחוק?')) return;
    await api.remove(communityKey, t.id).catch(() => {});
    setItems((list) => list.filter((x) => x.id !== t.id && x.parent !== t.id));
  };

  const top = (items || []).filter((t) => !t.parent).sort((a, b) => b.likes - a.likes || b.at.localeCompare(a.at));
  const repliesOf = (id) => (items || []).filter((t) => t.parent === id).sort((a, b) => a.at.localeCompare(b.at));
  const made = top.filter((t) => t.kind === 'made');

  return (
    <section className="mt-8 print:hidden">
      <h2 className="text-lg font-black mb-1 flex items-center gap-2">
        <MessageCircle size={20} className="text-orange-500" /> מה אומרים על המתכון
      </h2>
      <p className="text-sm text-stone-500 mb-3">
        {items === null ? 'טוען…' : top.length ? [count(top.length - made.length, 'תגובה אחת', 'תגובות'), made.length ? `${made.length} הכינו` : ''].filter(Boolean).join(' · ') : 'עוד אין תגובות. היו הראשונים לכתוב טיפ או לספר שהכנתם!'}
      </p>

      {!mode && (
        <div className="flex gap-2">
          <button onClick={() => setMode('tip')} className="flex-1 rounded-2xl border border-orange-200 bg-orange-50 text-orange-800 font-bold py-2.5 flex items-center justify-center gap-1.5">
            <MessageCircle size={17} /> טיפ או שאלה
          </button>
          <button onClick={() => setMode('made')} className="flex-1 rounded-2xl bg-orange-500 text-white font-bold py-2.5 flex items-center justify-center gap-1.5">
            <Camera size={17} /> הכנתי!
          </button>
        </div>
      )}
      {(mode === 'tip' || mode === 'made') && <Composer kind={mode} onSend={send} onCancel={() => setMode(null)} />}
      {error && <p className="mt-2 rounded-xl bg-rose-50 text-rose-700 p-2 text-sm">{error}</p>}
      {note && <p className="mt-2 text-sm text-stone-600">{note}</p>}

      <ul className="mt-4 space-y-3">
        {top.map((t) => (
          <li key={t.id} className="rounded-2xl bg-white border border-stone-200 p-3">
            <Item t={t} onLike={() => like(t)} onRemove={() => remove(t)} onReport={(reason) => api.report(communityKey, t.id, reason)} />
            <div className="mt-2 flex gap-3 text-sm">
              <button onClick={() => setMode({ reply: t.id })} className="text-orange-700 inline-flex items-center gap-1"><Reply size={14} /> תשובה</button>
            </div>
            {repliesOf(t.id).length > 0 && (
              <ul className="mt-2 mr-3 pr-3 border-r-2 border-orange-100 space-y-2">
                {repliesOf(t.id).map((r) => (
                  <li key={r.id}><Item t={r} small onLike={() => like(r)} onRemove={() => remove(r)} onReport={(reason) => api.report(communityKey, r.id, reason)} /></li>
                ))}
              </ul>
            )}
            {mode?.reply === t.id && <Composer kind="reply" onSend={(item) => send({ ...item, parent: t.id })} onCancel={() => setMode(null)} />}
          </li>
        ))}
      </ul>

      {profileFor && (
        <ProfileForm
          api={api}
          onClose={() => setProfileFor(null)}
          onDone={async () => {
            const item = profileFor;
            setProfileFor(null);
            await send(item);
          }}
        />
      )}
    </section>
  );
}

const count = (n, one, many) => (n === 1 ? one : n ? `${n} ${many}` : '');

const ago = (iso) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  return d < 30 ? `לפני ${d} ימים` : new Date(iso).toLocaleDateString('he-IL');
};

const REASONS = [['offensive', 'פוגעני'], ['personal', 'פרטים אישיים'], ['spam', 'פרסומת / ספאם'], ['other', 'משהו אחר']];

function Item({ t, small, onLike, onRemove, onReport }) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [big, setBig] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <b className="text-stone-800">{t.author}</b>
        {t.kind === 'made' && <span className="rounded-full bg-orange-100 text-orange-800 text-xs px-2 py-0.5">📸 הכנתי!</span>}
        <span className="text-xs text-stone-400">{ago(t.at)}</span>
        {t.hidden && <span className="text-xs text-rose-600">(מוסתר עד בדיקה)</span>}
      </div>
      {t.rating > 0 && (
        <div className="mt-0.5 flex text-amber-500" aria-label={`${t.rating} כוכבים`}>
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} fill={n <= t.rating ? 'currentColor' : 'none'} />)}
        </div>
      )}
      {t.text && <p className={`mt-1 whitespace-pre-line leading-relaxed text-stone-700 ${small ? 'text-sm' : ''}`} dir="auto">{t.text}</p>}
      {t.image && (
        <button onClick={() => setBig(true)} className="mt-2 block">
          <img src={t.image} alt="" loading="lazy" className="w-40 h-40 object-cover rounded-xl bg-stone-100" />
        </button>
      )}
      <div className="mt-1.5 flex items-center gap-3 text-xs text-stone-500">
        <button onClick={onLike} className={`inline-flex items-center gap-1 ${t.liked ? 'text-rose-600' : ''}`} aria-label="עזר לי">
          <Heart size={14} fill={t.liked ? 'currentColor' : 'none'} /> {t.likes > 0 ? t.likes : ''} עזר לי
        </button>
        {t.mine ? (
          <button onClick={onRemove} className="inline-flex items-center gap-1"><Trash2 size={13} /> מחיקה</button>
        ) : reported ? (
          <span>תודה, נבדוק</span>
        ) : (
          <button onClick={() => setReporting((r) => !r)} className="inline-flex items-center gap-1"><Flag size={13} /> דיווח</button>
        )}
      </div>
      {reporting && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {REASONS.map(([id, label]) => (
            <button key={id} onClick={() => { onReport(id).catch(() => {}); setReported(true); setReporting(false); }} className="rounded-full border border-stone-200 px-2.5 py-1 text-xs">{label}</button>
          ))}
        </div>
      )}
      {big && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={() => setBig(false)}>
          <img src={t.image} alt="" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}

// כתיבה: טיפ/שאלה, תשובה, או "הכנתי!" (תמונה + כוכבים + כמה מילים)
function Composer({ kind, onSend, onCancel }) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (file) => {
    if (!file) return;
    setError('');
    try {
      setImage(await talkPhoto(file));
    } catch (e) {
      setError(e.message);
    }
  };
  const ready = kind === 'made' ? Boolean(text.trim() || rating || image) : text.trim().length >= 2;
  const submit = async () => {
    setBusy(true);
    await onSend({ kind: kind === 'made' ? 'made' : 'tip', text: text.trim(), rating, image });
    setBusy(false);
  };
  return (
    <div className="mt-3 rounded-2xl bg-white border border-orange-200 p-3 space-y-2">
      {kind === 'made' && (
        <>
          <div className="font-bold">📸 הכנתי! איך יצא?</div>
          <div className="flex gap-1 text-amber-500">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} כוכבים`}>
                <Star size={26} fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          {image ? (
            <div className="relative w-28">
              <img src={image} alt="" className="w-28 h-28 object-cover rounded-xl" />
              <button onClick={() => setImage(null)} className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-stone-800 text-white flex items-center justify-center" aria-label="הסרת התמונה"><X size={14} /></button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 text-orange-800 px-3 py-2 text-sm cursor-pointer">
              <Camera size={16} /> תמונה של מה שיצא לכם
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          )}
        </>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={kind === 'reply' ? 2 : 3}
        maxLength={1000}
        placeholder={kind === 'reply' ? 'התשובה שלך…' : kind === 'made' ? 'כמה מילים (לא חובה): מה שיניתם, למי הגשתם…' : 'למשל: הוספתי עוד לימון, או: יצא לי יבש – למה?'}
        className="w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-orange-400"
      />
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={!ready || busy} className="rounded-xl bg-orange-500 text-white font-bold px-4 py-2 flex items-center gap-1.5 disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} פרסום
        </button>
        <button onClick={onCancel} className="rounded-xl border border-stone-200 px-4 py-2">ביטול</button>
      </div>
      <p className="text-xs text-stone-500">כל מה שנכתב בקהילה נבדק אוטומטית. בלי פרטים אישיים (טלפון, כתובת) ובלי פרסומות.</p>
    </div>
  );
}

// בפעם הראשונה: שם תצוגה ואישור התנאים (אותו פרופיל כמו בפרסום מתכון)
function ProfileForm({ api, onClose, onDone }) {
  const [name, setName] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.getProfile().then((p) => { setName(p.displayName || ''); setTerms(Boolean(p.terms)); }).catch(() => {});
  }, [api]);
  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.setProfile(name.trim(), terms);
      await onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-5 w-full max-w-sm relative">
        <button type="button" onClick={onClose} className="absolute top-3 left-3 p-1 text-stone-400" aria-label="סגירה"><X size={20} /></button>
        <h2 className="text-lg font-black">כותבים בקהילה</h2>
        <p className="text-sm text-stone-600 mt-1">איך יקראו לך בקהילה? זה השם שיופיע ליד מה שתכתבו. האימייל שלך לא מוצג.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="למשל: דנה מבשלת" className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2.5 outline-none focus:border-orange-400" />
        <label className="mt-3 flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1" />
          <span>
            אני כותב/ת בכבוד, בלי פרטים אישיים ובלי תוכן פוגעני. תגובה שמדווחים עליה יכולה לרדת מהקהילה.
            {' '}<a href="#/privacy" className="text-orange-700 underline">תנאי השימוש והפרטיות</a>
          </span>
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button disabled={name.trim().length < 2 || !terms} className="mt-4 w-full rounded-xl bg-orange-500 text-white font-bold py-3 disabled:opacity-40">שמירה ופרסום</button>
      </form>
    </div>
  );
}

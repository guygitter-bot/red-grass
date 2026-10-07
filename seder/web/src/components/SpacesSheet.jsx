import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Share2, Trash2, UserRound } from 'lucide-react';
import { createSpace, deleteSpace, listSpaces, resetSpace } from '../lib/sync';
import { spaceLink } from '../lib/space';
import { Sheet } from './ui';

// אפליקציה לאדם נוסף: יוצרים קישור ושולחים. מי שפותח אותו בוחר סיסמה ומקבל אפליקציה ריקה משלו –
// הוא לא רואה את המשימות כאן, ואת/ה לא רואה את שלו (ראו seder/api/spaces.js)
export default function SpacesSheet({ onClose }) {
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  const load = () => listSpaces().then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const space = await createSpace(name.trim());
      setList((l) => [space, ...(l || [])]);
      setName('');
    } catch (e) {
      setError(e.message || 'היצירה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const message = (s) => `שלום ${s.name}! הנה אפליקציית משימות משלך ("סדר"). בפתיחה הראשונה בוחרים סיסמה, ואז רק את/ה רואה את המשימות שלך:\n${spaceLink(s.id)}`;

  const copy = async (s) => {
    try {
      await navigator.clipboard.writeText(spaceLink(s.id));
      setCopied(s.id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('העתיקו את הקישור:', spaceLink(s.id));
    }
  };

  const act = async (s, kind) => {
    const question = kind === 'delete'
      ? `למחוק את האפליקציה של ${s.name}? כל המשימות שלו/ה יימחקו לתמיד, והקישור יפסיק לעבוד.`
      : `לאפס את הסיסמה של ${s.name}? כל המכשירים שלו/ה יתנתקו, ובפתיחה הבאה של הקישור תיבחר סיסמה חדשה. המשימות נשארות.`;
    if (!window.confirm(question)) return;
    setError('');
    try {
      if (kind === 'delete') await deleteSpace(s.id);
      else await resetSpace(s.id);
      await load();
    } catch (e) {
      setError(e.message || 'הפעולה נכשלה');
    }
  };

  return (
    <Sheet title="אפליקציה לאדם נוסף" onClose={onClose}>
      <p className="text-sm text-stone-500">
        יוצרים קישור ושולחים אותו. מי שפותח אותו בוחר סיסמה ומקבל אפליקציה ריקה משלו: הוא לא רואה את המשימות שלך, ואת לא רואה את שלו.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          maxLength={40}
          placeholder="שם (למשל: גיא)"
          className="flex-1 min-w-0 rounded-xl border border-stone-200 bg-card px-3 py-2.5 outline-none focus:border-violet-500"
        />
        <button onClick={create} disabled={!name.trim() || busy} className="flex items-center gap-1.5 rounded-xl bg-violet-600 text-white font-bold px-4 disabled:opacity-40">
          <Plus size={18} />{busy ? 'יוצר...' : 'יצירת קישור'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      <h3 className="text-sm font-bold text-stone-500 mt-6 mb-2">הקישורים שנוצרו</h3>
      {list === null && !error && <p className="text-sm text-stone-400">טוען...</p>}
      {list?.length === 0 && <p className="text-sm text-stone-400">עוד לא נוצרו קישורים</p>}
      <div className="space-y-2 pb-2">
        {list?.map((s) => (
          <div key={s.id} className="rounded-2xl border border-stone-200 p-3">
            <div className="flex items-center gap-2">
              <UserRound size={18} className="text-violet-600 shrink-0" />
              <div className="flex-1 min-w-0 font-medium truncate">{s.name}</div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {s.ready ? 'בשימוש' : 'עוד לא נפתח'}
              </span>
            </div>
            <div dir="ltr" className="mt-2 text-xs text-stone-500 truncate text-left">{spaceLink(s.id)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(message(s))}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3 py-1.5 text-sm font-bold">
                <Share2 size={14} />שליחה בווטסאפ
              </a>
              <button onClick={() => copy(s)} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-card px-3 py-1.5 text-sm">
                <Copy size={14} />{copied === s.id ? 'הועתק ✓' : 'העתקה'}
              </button>
              {s.ready && (
                <button onClick={() => act(s, 'reset')} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-card px-3 py-1.5 text-sm">
                  <KeyRound size={14} />איפוס סיסמה
                </button>
              )}
              <button onClick={() => act(s, 'delete')} aria-label={`מחיקה של ${s.name}`} className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm text-rose-600">
                <Trash2 size={14} />מחיקה
              </button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

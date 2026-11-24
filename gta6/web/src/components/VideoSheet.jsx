import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { codesOf, isWaiting, PLATFORMS, sourceOf } from '../lib/videos';
import CodeRow from './CodeRow';

const NEW = '__new__';
const EMPTY = { code: '', effect: '', platform: 'לא ידוע' };

// פרטי סרטון: כותרת, תקציר, קודים (עם עריכה ידנית), הערה, קטגוריה, לקרוא שוב, מחיקה
export default function VideoSheet({ item, categories, onClose, onUpdate, onDelete, onRetry }) {
  const [note, setNote] = useState(item.note || '');
  const [editing, setEditing] = useState(null); // רשימת קודים בעריכה, או null

  useEffect(() => {
    setNote(item.note || '');
    setEditing(null);
  }, [item.id, item.note]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function changeCategory(value) {
    if (value !== NEW) return onUpdate({ category: value });
    const name = window.prompt('שם הקטגוריה החדשה')?.trim();
    if (name) onUpdate({ category: name });
  }

  function editTitle() {
    const title = window.prompt('כותרת לסרטון', item.title)?.trim();
    if (title && title !== item.title) onUpdate({ title });
  }

  const setCode = (n, patch) => setEditing((list) => list.map((c, i) => (i === n ? { ...c, ...patch } : c)));

  async function saveCodes() {
    await onUpdate({ codes: editing.filter((c) => c.code.trim()) });
    setEditing(null);
  }

  const codes = codesOf(item);
  const known = categories.some((c) => c.name === item.category);
  const input = 'w-full rounded-lg border border-line bg-card px-2.5 py-2 text-sm outline-none focus:border-accent';

  return (
    <div className="fixed inset-0 z-40 flex items-end lg:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card w-full lg:max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <h2 className="text-xl font-bold leading-snug flex-1" dir="auto">{item.title}</h2>
          <button onClick={editTitle} className="p-1.5 rounded-full hover:bg-soft" aria-label="שינוי כותרת"><Pencil size={18} /></button>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-soft" aria-label="סגירה"><X size={20} /></button>
        </div>

        <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-accent text-white px-3 py-2 text-sm font-medium">
          <ExternalLink size={16} /> צפייה בסרטון ({sourceOf(item.url)})
        </a>

        {isWaiting(item) && <p className="text-accent-ink text-sm">קורא את הסרטון... זה לוקח בדרך כלל פחות מדקה.</p>}
        {item.status === 'failed' && <p className="text-red-600 dark:text-red-400 text-sm">{item.error || 'הקריאה נכשלה'}</p>}
        {item.summary && <p className="leading-relaxed">{item.summary}</p>}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold flex items-center gap-1.5"><KeyRound size={18} className="text-accent-ink" /> קודים</h3>
            {!editing && (
              <button onClick={() => setEditing(codes.length ? codes.map((c) => ({ ...c })) : [{ ...EMPTY }])} className="ms-auto flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-soft">
                <Pencil size={14} /> {codes.length ? 'עריכה' : 'הוספת קוד'}
              </button>
            )}
          </div>

          {!editing && !codes.length && !isWaiting(item) && (
            <p className="text-sm text-muted">לא מצאתי קודים בסרטון. קוד שמופיע רק על המסך – אפשר להוסיף כאן ידנית.</p>
          )}
          {!editing && codes.length > 0 && (
            <ul className="space-y-2">{codes.map((c) => <CodeRow key={c.code} code={c} />)}</ul>
          )}

          {editing && (
            <div className="space-y-3">
              {editing.map((c, n) => (
                <div key={n} className="bg-page border border-line rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={c.code} onChange={(e) => setCode(n, { code: e.target.value })} placeholder="הקוד (למשל R1, R2, L1, ←)" dir="ltr" className={`${input} font-mono`} />
                    <button onClick={() => setEditing((list) => list.filter((_, i) => i !== n))} className="shrink-0 p-2 rounded-lg border border-line hover:bg-soft text-red-600 dark:text-red-400" aria-label="מחיקת הקוד">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={c.effect} onChange={(e) => setCode(n, { effect: e.target.value })} placeholder="מה הקוד עושה" className={input} />
                    <select value={c.platform} onChange={(e) => setCode(n, { platform: e.target.value })} className={`${input} sm:w-44`}>
                      {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditing((list) => [...list, { ...EMPTY }])} className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:bg-soft">
                  <Plus size={15} /> עוד קוד
                </button>
                <button onClick={() => setEditing(null)} className="ms-auto rounded-lg border border-line px-3 py-2 text-sm hover:bg-soft">ביטול</button>
                <button onClick={saveCodes} className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium">שמירה</button>
              </div>
            </div>
          )}
        </section>

        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => <span key={t} className="text-xs text-muted rounded-full border border-line px-2 py-0.5" dir="auto">#{t}</span>)}
          </div>
        )}

        <label className="block">
          <span className="text-sm text-muted">קטגוריה</span>
          <select
            value={item.category || ''}
            onChange={(e) => changeCategory(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-page px-3 py-2.5 outline-none focus:border-accent"
          >
            {!item.category && <option value="">עוד לא נקבעה</option>}
            {item.category && !known && <option value={item.category}>{item.category}</option>}
            {categories.map((c) => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
            <option value={NEW}>+ קטגוריה חדשה...</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-muted">הערה שלי</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (item.note || '')) onUpdate({ note });
            }}
            rows={2}
            placeholder="למשל: עובד רק בסיפור, לא באונליין"
            className="mt-1 w-full rounded-xl border border-line bg-page px-3 py-2.5 outline-none focus:border-accent resize-none"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onRetry} disabled={isWaiting(item)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft disabled:opacity-40">
            <RefreshCw size={16} /> לקרוא שוב
          </button>
          <button
            onClick={() => {
              if (window.confirm('למחוק את הסרטון מהרשימה?')) onDelete();
            }}
            className="ms-auto flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-soft"
          >
            <Trash2 size={16} /> מחיקה
          </button>
        </div>
      </div>
    </div>
  );
}
